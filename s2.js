const express = require("express")
const path = require("path")
const fs = require("fs")
const os = require("os")
const fse = require("fs-extra")
const pino = require("pino")
const QRCode = require("qrcode")
const chalk = require("chalk")

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const CommandHandler = require("./commands")

process.on("uncaughtException", err => {
    console.error("UNCAUGHT:", err)
})

process.on("unhandledRejection", err => {
    console.error("UNHANDLED:", err)
})

const app = express()
const PORT = process.env.PORT || 3000
const BOT_NAME = process.env.BOT_NAME || "Error-MD"

const SESSION_DIR = path.join(__dirname, "sessions")

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR)
}

app.use(express.json({ limit: "5mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname))

const sessions = new Map()
const pairingCodes = new Map()
const qrDataUrls = new Map()
const reconnecting = new Set()

function getAuthDir(sessionId) {
    return path.join(SESSION_DIR, sessionId)
}

async function setQr(sessionId, qr) {
    try {
        const data = await QRCode.toDataURL(qr, {
            scale: 8,
            margin: 1
        })

        qrDataUrls.set(sessionId, data)
    } catch (e) {
        console.error("QR ERROR:", e.message)
    }
}

function getStartupUrls(port) {
    const urls = new Set([`http://localhost:${port}`])

    for (const interfaces of Object.values(os.networkInterfaces())) {
        for (const info of interfaces || []) {
            if (
                info &&
                info.family === "IPv4" &&
                !info.internal
            ) {
                urls.add(`http://${info.address}:${port}`)
            }
        }
    }

    return [...urls]
}

function cleanupSession(sessionId) {
    try {
        const authDir = getAuthDir(sessionId)

        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, {
                recursive: true,
                force: true
            })
        }

        sessions.delete(sessionId)
        pairingCodes.delete(sessionId)
        qrDataUrls.delete(sessionId)

    } catch (e) {
        console.error("CLEANUP ERROR:", e.message)
    }
}

async function startWhatsApp(sessionId, phoneForPair = null) {

    const authDir = getAuthDir(sessionId)

    fse.ensureDirSync(authDir)

    try {

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(authDir)

        const {
            version
        } = await fetchLatestBaileysVersion()

        console.log(
            `📡 WA Version: ${version.join(".")}`
        )

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            getMessage: async () => ({ conversation: "" })
        })

        const commandHandler =
            new CommandHandler(sock)

        sessions.set(sessionId, {
            sock,
            connected: false,
            commandHandler,
            createdAt: Date.now()
        })

        sock.ev.on(
            "creds.update",
            saveCreds
        )

        console.log(chalk.blue(`DEBUG: Session ${sessionId} - Registered: ${sock.authState.creds.registered}`));
        if (phoneForPair && !sock.authState.creds.registered) {
            console.log(chalk.yellow(`\n⏳  Requesting pairing code for +${phoneForPair}...`));
            console.log(chalk.yellow("⏳  Waiting 3 seconds for socket to initialise...\n"));

            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneForPair);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    pairingCodes.set(sessionId, code);
                    console.log(chalk.bgGreen.black.bold(`\n  🔑  PAIRING CODE [${sessionId}]: ${code}  \n`));
                } catch (err) {
                    console.error(chalk.red(`❌  Pairing failed [${sessionId}]: ${err.message}`));
                }
            }, 3000);
        }

        sock.ev.on(
            "connection.update",
            async update => {

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update

                if (qr && !phoneForPair) {
                    console.log(
                        `✨ QR RECEIVED ${sessionId}`
                    )

                    await setQr(sessionId, qr)
                }

                if (connection === "open") {

                    console.log(
                        `✅ CONNECTED ${sessionId}`
                    )

                    const session =
                        sessions.get(sessionId)

                    if (session) {
                        session.connected = true
                    }

                    reconnecting.delete(sessionId)
                }

                if (connection === "close") {

                    const statusCode =
                        lastDisconnect?.error?.output?.statusCode

                    console.log(
                        `❌ CLOSED ${sessionId} ${statusCode}`
                    )

                    const fatal =
                        statusCode === 401 ||
                        statusCode === 403 ||
                        statusCode === 440

                    if (fatal) {

                        console.log(
                            `🔥 Destroying corrupted session ${sessionId}`
                        )

                        cleanupSession(sessionId)

                        return
                    }

                    if (
                        statusCode !== DisconnectReason.loggedOut
                    ) {

                        if (
                            reconnecting.has(sessionId)
                        ) return

                        reconnecting.add(sessionId)

                        setTimeout(() => {

                            reconnecting.delete(sessionId)

                            startWhatsApp(
                                sessionId,
                                phoneForPair
                            )

                        }, 5000)
                    }
                }
            }
        )

        sock.ev.on(
            "messages.upsert",
            async ({ messages, type }) => {

                if (type !== "notify") return

                for (const msg of messages || []) {

                    try {

                        if (!msg.message) continue

                        const jid =
                            msg.key?.remoteJid

                        if (!jid) continue

                        if (
                            jid === "status@broadcast"
                        ) continue

                        if (
                            msg.message.protocolMessage
                        ) continue

                        // --- Automatic Group Monitoring ---
                        const { Antilink } = require("./libsAndPlugins/lib/antilink");
                        const { handleBadwordDetection } = require("./libsAndPlugins/lib/antibadword");
                        
                        await Antilink(msg, sock);
                        
                        const userMessage = msg.message?.conversation || 
                                          msg.message?.extendedTextMessage?.text || '';
                        if (userMessage) {
                            await handleBadwordDetection(sock, jid, msg, userMessage, msg.key.participant);
                        }
                        // ---------------------------------

                        commandHandler
                            .handleMessage(msg)
                            .catch(console.error)

                    } catch (e) {
                        console.error(
                            "MESSAGE ERROR:",
                            e.message
                        )
                    }
                }
            }
        )

        sock.ev.on(
            "group-participants.update",
            async update => {
                try {

                    const {
                        id,
                        action
                    } = update

                    if (
                        action === "promote" ||
                        action === "demote" ||
                        action === "remove"
                    ) {
                        commandHandler.clearAdminCache(id)
                    }

                } catch {}
            }
        )

    } catch (e) {

        console.error(
            `CRITICAL ${sessionId}:`,
            e
        )
    }
}

app.get("/", (_, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    )
})

app.get("/favicon.ico", (_, res) => {

    res.sendFile(
        path.join(__dirname, "icon.png")
    )
})

app.get("/health", (_, res) => {

    res.json({
        status: "online",
        sessions: sessions.size,
        uptime: process.uptime()
    })
})

app.get("/session-count", (_, res) => {

    let active = 0

    for (const [, s] of sessions) {
        if (s.connected) active++
    }

    res.json({
        total: sessions.size,
        active
    })
})

app.get("/qr-start", async (_, res) => {

    const sessionId =
        `qr_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`

    startWhatsApp(sessionId)

    let attempts = 0
    const wait = setInterval(() => {
        attempts++
        const qr = qrDataUrls.get(sessionId)
        if (qr) {
            clearInterval(wait)
            return res.json({
                success: true,
                qr: qr,
                sessionId
            })
        }
        if (attempts > 120) {
            clearInterval(wait)
            return res.json({
                success: false,
                error: "Timeout"
            })
        }
    }, 200)
})

app.get("/qr-poll", async (req, res) => {

    const sessionId = req.query.sessionId

    const session =
        sessions.get(sessionId)

    if (session?.connected) {

        return res.json({
            success: true,
            connected: true
        })
    }

    const qr =
        qrDataUrls.get(sessionId)

    if (qr) {

        return res.json({
            success: true,
            qr
        })
    }

    res.json({
        success: false
    })
})

app.all("/pair", async (req, res) => {

    const phone =
        String(req.query.number || req.query.phone || req.body?.phone || "")
            .replace(/\D/g, "")
            .replace(/^0+/, "")

    if (!phone) {

        return res.json({
            success: false,
            error: "Invalid phone"
        })
    }

    const sessionId =
        `session_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`

    pairingCodes.delete(sessionId)

    startWhatsApp(
        sessionId,
        phone
    )

    let tries = 0

    const wait = setInterval(() => {

        tries++

        const code =
            pairingCodes.get(sessionId)

        if (code) {

            clearInterval(wait)

            return res.json({
                success: true,
                code,
                sessionId
            })
        }

        if (tries > 150) {

            clearInterval(wait)

            return res.json({
                success: false,
                error: "Timeout"
            })
        }

    }, 200)
})

function cleanupOldSessions() {
    try {
        const now = Date.now()
        if (!fs.existsSync(SESSION_DIR)) return;

        for (const dir of fs.readdirSync(SESSION_DIR)) {
            const full = path.join(SESSION_DIR, dir)
            const stats = fs.statSync(full)
            const age = now - stats.mtimeMs

            // Only cleanup sessions older than 24h that are NOT active in memory
            if (age > 1000 * 60 * 60 * 24 && !sessions.has(dir)) {
                // Check if it's registered before deleting
                const credsFile = path.join(full, 'creds.json');
                let isRegistered = false;
                if (fs.existsSync(credsFile)) {
                    try {
                        const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
                        isRegistered = creds.registered === true;
                    } catch {}
                }

                if (!isRegistered) {
                    fs.rmSync(full, { recursive: true, force: true })
                    console.log(`🧹 Removed old unregistered session ${dir}`)
                }
            }
        }
    } catch (e) {
        console.error("SESSION CLEAN ERROR:", e.message)
    }
}

async function loadSessions() {
    if (!fs.existsSync(SESSION_DIR)) return;
    const dirs = fs.readdirSync(SESSION_DIR);
    console.log(chalk.cyan(`📦 Found ${dirs.length} session folders. Resuming registered bots...`));
    
    for (const dir of dirs) {
        const fullPath = path.join(SESSION_DIR, dir);
        if (fs.statSync(fullPath).isDirectory()) {
            const credsFile = path.join(fullPath, 'creds.json');
            if (fs.existsSync(credsFile)) {
                try {
                    const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
                    if (creds.registered) {
                        console.log(chalk.green(`🔄 Resuming active session: ${dir}`));
                        startWhatsApp(dir).catch(err => {
                            console.error(chalk.red(`❌ Failed to resume session ${dir}: ${err.message}`));
                        });
                    }
                } catch (e) {
                    console.error(chalk.yellow(`⚠️ Could not read creds for ${dir}: ${e.message}`));
                }
            }
        }
    }
}

setInterval(
    cleanupOldSessions,
    1000 * 60 * 60 // Run every hour
)

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🚀 ${BOT_NAME} RUNNING ON ${PORT}`
    )

    loadSessions();

    for (const url of getStartupUrls(PORT)) {
        console.log(`🌐 ${url}`)
    }
})
