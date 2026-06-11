const fs = require('fs');
const path = require('path');
const pino = require('pino');
const axios = require('axios');
const math = require('mathjs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ytDownloader = require('./libsAndPlugins/lib/ytdl2');
const events = require('./libsAndPlugins/Utilis/events');

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function createLegacyExternalStub(request) {
  if (request === "@adiwajshing/baileys" || request === "baileys") {
    const sock = new (require("events").EventEmitter)();
    const fakeSocket = {
      ev: sock,
      user: { id: "0@s.whatsapp.net" },
      authState: { creds: { registered: false } },
      decodeJid: (jid) => jid,
      sendMessage: async () => ({}),
      sendPresenceUpdate: async () => undefined,
      groupMetadata: async () => ({ participants: [] }),
      groupInviteCode: async () => "",
      getProfilePicture: async () => "",
      loadMessage: async () => null,
      requestPairingCode: async () => "",
      copyNForward: async () => undefined,
      downloadMediaMessage: async () => Buffer.alloc(0),
      sendMedia: async () => undefined,
      sendText: async () => undefined,
    };

    return {
      default: () => fakeSocket,
      useMultiFileAuthState: async () => ({
        state: { creds: { registered: false } },
        saveCreds: async () => undefined,
      }),
      DisconnectReason: { loggedOut: "loggedOut" },
      Browsers: { macOS: () => "macOS" },
      MessageType: {
        image: "image",
        video: "video",
        audio: "audio",
        sticker: "sticker",
        document: "document",
        text: "text",
      },
      Mimetype: { gif: "image/gif" },
      downloadContentFromMessage: async function* () {},
    };
  }

  if (request === "express") {
    const app = function app() {};
    app.use = () => app;
    app.get = () => app;
    app.post = () => app;
    app.listen = (_, cb) => {
      if (typeof cb === "function") cb();
      return { close: async () => undefined };
    };
    return Object.assign(
      () => app,
      {
        json: () => (_, __, next) => next && next(),
        urlencoded: () => (_, __, next) => next && next(),
      }
    );
  }

  if (request === "fs-extra") {
    return {
      ensureDirSync: () => undefined,
    };
  }

  if (request === "pino") {
    return () => ({ info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined });
  }

  if (request === "mongodb") {
    return { MongoClient: class { async connect() {}; db() { return { collection: () => ({ createIndex: () => {}, bulkWrite: () => {}, updateOne: () => {}, find: () => ({ project: () => ({ toArray: async () => [] }) }) }) } }; async close() {} } };
  }

  if (request === "qrcode") {
    return { toDataURL: async () => "data:image/png;base64," };
  }

  if (request === "moment") {
    const moment = () => ({ format: () => "", locale: () => moment });
    moment.utc = () => ({ format: () => "" });
    moment.unix = () => ({ format: () => "" });
    moment.tz = () => ({ format: () => "", locale: () => moment });
    return moment;
  }

  if (request === "simple-git") {
    return () => ({
      fetch: async () => undefined,
      log: async () => ({ total: 0, all: [] }),
      push: async () => undefined,
      addRemote: async () => undefined,
    });
  }

  if (request === "heroku-client") {
    return class Heroku {
      constructor() {}
      async get() { return { data: { quota_remaining: 0, quota_used: 0 } }; }
      async patch() {}
      async delete() {}
    };
  }

  if (request === "groq-sdk") {
    return class Groq {
      constructor() {
        this.chat = { completions: { create: async () => ({ choices: [{ message: { content: "" } }] }) } };
      }
    };
  }


  if (request === "sequelize") {
    return {
      DataTypes: { STRING: "STRING", TEXT: "TEXT", BOOLEAN: "BOOLEAN" }
    };
  }

  if (request.includes("Utilis/editors")) {
     return {
        photoEditor: async (path, type) => {
           // Return a placeholder or a simple filtered image using sharp if available
           return { status: true, result: "https://v-v.icu/placeholder.png" };
        },
        menu: () => "Photo Editor Menu"
     };
  }

  const base = async () => undefined;
  return new Proxy(base, {
    apply() {
      return undefined;
    },
    get(_target, prop) {
      if (prop === "default") return undefined;
      if (prop === "then") return undefined;
      return createLegacyExternalStub(prop);
    },
  });
}

function loadLegacyModules(rootDir) {
  const loaded = [];
  if (!fs.existsSync(rootDir)) return loaded;

  const skipModules = new Set([
    "autojoin.js",
    "ban.js",
    "antidelete.js",
    "ytdl.js",
    "remini.js",
  ]);
  const files = listFilesRecursive(rootDir)
    .filter(
      (file) =>
        file.endsWith(".js") &&
        !skipModules.has(path.basename(file)) &&
        !file.includes(`${path.sep}lowdb${path.sep}`)
    )
    .sort();

  const Module = require("module");
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "ytdl-core") request = "@distube/ytdl-core";
    
    // Force stubs for specific legacy utility paths to ensure compatibility
    if (request.includes("Utilis/editors")) {
       return createLegacyExternalStub(request);
    }

    try {
      return originalLoad.call(this, request, parent, isMain);
    } catch (error) {
      if (request.startsWith(".") || request.startsWith("/")) throw error;
      return createLegacyExternalStub(request);
    }
  };

  try {
    for (const file of files) {
      const cacheKey = fs.existsSync(file) ? fs.realpathSync(file) : file;
      if (global.__legacyLoadState && global.__legacyLoadState.has(cacheKey)) continue;

      try {
        require(file);
        if (!global.__legacyLoadState) global.__legacyLoadState = new Set();
        global.__legacyLoadState.add(cacheKey);
        loaded.push(file);
      } catch (error) {
        console.warn(
          `Skipping legacy module ${path.relative(__dirname, file)}: ${error?.message || error}`
        );
      }
    }
  } finally {
    Module._load = originalLoad;
  }

  return loaded;
}

function loadLegacyCommandTrees() {
  const baseDir = path.join(__dirname, "libsAndPlugins");
  const targets = [
    path.join(baseDir, "libpre"),
    path.join(baseDir, "plugins"),
  ];

  const loaded = [];
  for (const target of targets) {
    loaded.push(...loadLegacyModules(target));
  }
  return loaded;
}

if (!global.__legacyCommandsLoaded) {
  global.__legacyCommandsLoaded = true;
  if (!global.__legacyLoadState) {
    global.__legacyLoadState = new Set();
  }
  loadLegacyCommandTrees();
}

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
const BOT_IMAGE_URL = "icon.png";

const fakeMetaQuote = {
  key: {
    remoteJid: "status@broadcast",
    participant: "0@s.whatsapp.net",
    fromMe: false,
    id: "BAE5VIRALMETA01"
  },
  message: {
    contactMessage: {
      displayName: settings.botName,
      vcard: settings.fakeVCard.vcard
    }
  }
};

function buildChannelContextInfo() {
  const channelJid = settings.channelJid || "";
  const channelName = settings.channelName || "Error MD";
  if (!channelJid) return {};
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: channelJid,
      newsletterName: channelName,
      serverMessageId: 1
    }
  };
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const WORM_API_URL = "http://worm-gpt-vercel.vercel.app/";
const WORM_USAGE = [
  "🧠 *WORM AI USAGE*",
  "",
  "• *.worm <question>* (Quick AI)",
  "• *.worm medium <question>* (Smart AI)",
  "• *.worm large <api-key> <question>* (Paid Model)",
  "",
  "⚠️ _Note: Large model is available in Inbox only._"
].join("\n");

let cachedUniqueCommands = null;
let cachedMenuText = null;
let cachedBotImage = null;

function uniqueCommandList(commands = []) {
  if (cachedUniqueCommands && commands.length > 0) return cachedUniqueCommands;
  const seen = new Set();
  const normalized = [];
  for (const command of Array.isArray(commands) ? commands : []) {
    const name = String(command?.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(command);
  }
  if (commands.length > 0) cachedUniqueCommands = normalized;
  return normalized;
}

const commandEmojis = {
  'alive': '🟢', 'ping': '⚡', 'menu': '📜', 'help': '❓', 'info': '📋',
  'stats': '📊', 'about': '👨‍💻', 'runtime': '⏱️', 'id': '🆔', 'owner': '👑',
  'version': '📦', 'user': '👤', 'usermenu': '👤', 'repeat': '🔁',
  'tools': '🛠️', 'toolsmenu': '🛠️', 'calc': '🧮', 'reverse': '🔁', 'upper': '🔼',
  'lower': '🔽', 'capitalize': '🎩', 'count': '📏', 'password': '🔐', 'random': '🎲',
  'encode': '📤', 'decode': '📥', 'qr': '📱', 'shorten': '🔗', 'weather': '🌤️',
  'currency': '💱', 'fun': '🎪', 'funmenu': '🎪', 'wiki': '📚', 'quote': '📜',
  'fact': '📖', 'joke': '😂', 'meme': '🖼️', 'translate': '🌐', 'truth': '🤔',
  'dare': '⚡', 'riddle': '🧩', 'advice': '💡', 'cat': '🐱', 'dog': '🐶',
  'image': '🖼️', 'wallpaper': '🎨', 'lyrics': '🎵', 'movie': '🎬', 'anime': '🇯🇵',
  'covid': '🦠', 'horoscope': '🔮', 'group': '👥', 'groupmenu': '👥',
  'general': '📌', 'generalmenu': '📌', 'anti': '🛡️', 'antimenu': '🛡️',
  'tagall': '📢', 'mute': '🔇', 'unmute': '🔊', 'welcome': '👋', 'promote': '🔼',
  'demote': '🔽', 'kick': '👢', 'setdesc': '📝', 'setpp': '🖼️', 'antilink': '🔗',
  'antisticker': '🖼️', 'antiaudio': '🎵', 'vv': '🪟', 'default': '⏺️',
  'success': '✅', 'failure': '❌', 'song': '🎵', 'video': '🎥', 'ytdl': '📥'
};

const userCooldowns = new Map();
const COOLDOWN_TIME = 3000;

function checkCooldown(userId) {
  const lastUsed = userCooldowns.get(userId);
  if (!lastUsed) return true;
  const timeSinceLastUse = Date.now() - lastUsed;
  return timeSinceLastUse >= COOLDOWN_TIME;
}

function setCooldown(userId) {
  userCooldowns.set(userId, Date.now());
}

class CommandHandler {

  cleanJid(jid = "") {
    const j = String(jid || "");
    return j.split(":")[0];
  }

  constructor(sock) {
    this.sock = sock;
    this.stats = {
      commandsExecuted: 0,
      messagesProcessed: 0,
      groupsActive: 0,
      startTime: Date.now()
    };
    this.groupSettings = new Map();
    this.awaitingMenuSelection = new Map();
    this.adminCache = new Map();
    this.loadGroupSettings();
  }

  _prefixBoxLines(content = "") {
    const raw = String(content ?? "");
    const lines = raw.split(/\r?\n/);
    return lines.map(l => {
      const line = String(l ?? "");
      if (line.startsWith("│")) return line;
      return "│" + line;
    }).join("\n");
  }

  unwrapMessageContent(message = {}) {
    let content = message || {};

    while (
      content?.ephemeralMessage?.message ||
      content?.viewOnceMessage?.message ||
      content?.viewOnceMessageV2?.message ||
      content?.viewOnceMessageV2Extension?.message
    ) {
      content =
        content?.ephemeralMessage?.message ||
        content?.viewOnceMessage?.message ||
        content?.viewOnceMessageV2?.message ||
        content?.viewOnceMessageV2Extension?.message ||
        content;
    }

    return content || {};
  }

  getMessageType(message = {}) {
    const content = this.unwrapMessageContent(message);
    return Object.keys(content || {})[0] || "";
  }

  formatResponse(title, content) {
    const boxed = this._prefixBoxLines(content);
    return `╭─${title}
│ ʙᴏᴛ: Error-MD 
│ ᴅᴇᴠᴇʟᴏᴘᴇʀ: Errorking404
│ ᴛʏᴘᴇ .ᴍᴇɴᴜ ᴛᴏ ɢᴇᴛ sᴛᴀʀᴛᴇᴅ
│
${boxed}
╰──────────￫`;
  }

  formatError(title, message) {
    return this.formatResponse(`🚫 ${title}`, message);
  }

  formatSuccess(title, message) {
    return this.formatResponse(`✅ ${title}`, message);
  }

  formatInfo(title, message) {
    return this.formatResponse(`📋 ${title}`, message);
  }

  loadGroupSettings() {
    try {
      const settingsFile = path.join(__dirname, 'group-settings.json');
      if (fs.existsSync(settingsFile)) {
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        for (const [jid, settings] of Object.entries(data)) {
          this.groupSettings.set(jid, settings);
        }
      }
    } catch (error) {}
  }

  saveGroupSettings() {
    try {
      const settingsFile = path.join(__dirname, 'group-settings.json');
      const data = {};
      for (const [jid, settings] of this.groupSettings.entries()) {
        data[jid] = settings;
      }
      fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2));
    } catch (error) {}
  }

  async isAdmin(groupJid, userJid) {
    try {
      groupJid = this.cleanJid(groupJid);
      userJid = this.cleanJid(userJid);
      if (this.adminCache.has(groupJid)) {
        const cached = this.adminCache.get(groupJid);
        return cached.has(userJid);
      }
      
      const metadata = await this.sock.groupMetadata(groupJid);
      const admins = metadata.participants.filter(p => 
        p.admin === 'admin' || p.admin === 'superadmin'
      ).map(p => this.cleanJid(p.id));
      
      const adminSet = new Set(admins);
      this.adminCache.set(groupJid, adminSet);
      
      return adminSet.has(userJid);
    } catch (error) {
      return false;
    }
  }

  async isGroupAdmin(groupJid, userJid) {
    try {
      groupJid = this.cleanJid(groupJid);
      userJid = this.cleanJid(userJid);

      const ownerDigits = String(settings?.ownerNumber || "").replace(/\D/g, "");
      const userDigits = String(userJid || "").replace(/\D/g, "");
      
      if (ownerDigits && userDigits && userDigits.endsWith(ownerDigits)) {
        return true;
      }
      
      if (userJid === this.sock.user?.id) return true;
      return await this.isAdmin(groupJid, userJid);
    } catch (error) {
      return false;
    }
  }

  clearAdminCache(jid) {
    this.adminCache.delete(this.cleanJid(jid));
  }

  getMentionString(userId) {
    const phone = userId.split('@')[0];
    return `@${phone}`;
  }

  isAdminCommand(command) {
    const adminCommands = [
      'tagall', 'hidetag', 'mute', 'unmute', 'promote', 'demote', 'kick', 
      'setdesc', 'setpp', 'revoke', 'warn', 'resetwarn', 'antilink', 
      'antisticker', 'antiaudio', 'antivideo', 'antifile', 'welcome', 'vv2'
    ];
    return adminCommands.includes(command);
  }

  async executeCommand(jid, originalMessage, commandHandler, command) {
    const prefix = settings.prefix || ".";
    const text = this.extractText(originalMessage);
    if (!text || !text.startsWith(prefix)) return;

    const args = text.slice(prefix.length).trim().split(/\s+/);
    const cmd = command || args[0].toLowerCase();

    try {
      await commandHandler();
      // Reaction is usually handled within the handler via sendSuccess/sendError or specifically
    } catch (error) {
      console.error(`Command execution error (${command}):`, error);
      await this.reactToMessage(originalMessage, 'failure');
    }
  }

  async reactToMessage(m, command = 'default') {
    try {
      const emoji = commandEmojis[command] || commandEmojis.default;
      await this.sock.sendMessage(m.key.remoteJid, {
        react: { text: emoji, key: m.key }
      });
    } catch (error) {}
  }

  extractText(m) {
    const message = this.unwrapMessageContent(m.message);
    m.message = message;
    const type = this.getMessageType(message);
    if (type === "conversation") return message.conversation;
    if (type === "extendedTextMessage") return message.extendedTextMessage?.text || "";
    if (type === "imageMessage" && message.imageMessage?.caption) return message.imageMessage.caption;
    if (type === "videoMessage" && message.videoMessage?.caption) return message.videoMessage.caption;
    if (type === "buttonsResponseMessage") return message.buttonsResponseMessage?.selectedButtonId || "";
    if (type === "templateButtonReplyMessage") return message.templateButtonReplyMessage?.selectedId || "";
    return "";
  }

  async sendImageMessage(jid, caption, buttons = [], options = {}) {
    try {
      const message = {
        image: { url: BOT_IMAGE_URL },
        caption: caption,
        contextInfo: buildChannelContextInfo()
      };
      const sendOptions = { ...options, quoted: options.quoted || this._lastQuoted || fakeMetaQuote };
      const res = await this.sock.sendMessage(jid, message, sendOptions);
      if (options.quoted) await this.reactToMessage(options.quoted, 'success');
      return res;
    } catch (error) {
      if (options.quoted) await this.reactToMessage(options.quoted, 'failure');
      return this.sendTextMessage(jid, caption, [], options);
    }
  }

  async sendTextMessage(jid, text, buttons = [], options = {}) {
    try {
      const message = {
        text: text,
        contextInfo: buildChannelContextInfo()
      };
      const sendOptions = { ...options, quoted: options.quoted || this._lastQuoted || fakeMetaQuote };
      const res = await this.sock.sendMessage(jid, message, sendOptions);
      if (options.quoted) await this.reactToMessage(options.quoted, 'success');
      return res;
    } catch (error) {
      if (options.quoted) await this.reactToMessage(options.quoted, 'failure');
      return this.sendSimpleText(jid, text, options);
    }
  }

  async sendSimpleText(jid, text, options = {}) {
    try {
      const payload = { text: text, contextInfo: buildChannelContextInfo() };
      const res = await this.sock.sendMessage(jid, payload, { ...options, quoted: options.quoted || fakeMetaQuote });
      if (options.quoted && !options.noReact) await this.reactToMessage(options.quoted, 'success');
      return res;
    } catch (error) {
      if (options.quoted && !options.noReact) await this.reactToMessage(options.quoted, 'failure');
    }
  }

  async sendError(jid, title, message, originalMessage) {
    await this.reactToMessage(originalMessage, 'failure');
    return this.sendSimpleText(jid, this.formatError(title, message), { quoted: originalMessage || fakeMetaQuote, noReact: true });
  }

  async sendSuccess(jid, title, message, originalMessage) {
    await this.reactToMessage(originalMessage, 'success');
    return this.sendSimpleText(jid, this.formatSuccess(title, message), { quoted: originalMessage || fakeMetaQuote, noReact: true });
  }

  async sendInfo(jid, title, message, originalMessage) {
    await this.reactToMessage(originalMessage, 'success');
    return this.sendSimpleText(jid, this.formatInfo(title, message), { quoted: originalMessage || fakeMetaQuote, noReact: true });
  }

  async sendWelcomeToUser(jid) {
    try {
      const uptimeSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;

      const welcomeText = this.formatResponse('👋 𝗪𝗘𝗟𝗖𝗢𝗠𝗘',
`ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ: ✅
ᴜᴘᴛɪᴍᴇ: ${hours}ʜ ${minutes}ᴍ ${seconds}s

ᴛʏᴘᴇ .ᴍᴇɴᴜ ᴛᴏ sᴇᴇ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs
ʀᴇᴀᴅʏ ᴛᴏ ʀᴇᴄᴇɪᴠᴇ ᴄᴏᴍᴍᴀɴᴅs`);

      return await this.sendImageMessage(jid, welcomeText, []);
    } catch (error) {
      const fallbackMsg = this.formatResponse('👋 𝗪𝗘𝗟𝗖𝗢𝗠𝗘',
`ʙᴏᴛ sᴜᴄᴄᴇssғᴜʟʟʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ
sᴛᴀᴛᴜs: ᴏɴʟɪɴᴇ ✅
ᴛʏᴘᴇ .ᴍᴇɴᴜ ғᴏʀ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs`);
      return await this.sendSimpleText(jid, fallbackMsg);
    }
  }

  async handleMessage(m) {
    const rawJid = m?.key?.remoteJid;
    const jid = this.cleanJid(rawJid);
    if (!jid || jid === "status@broadcast") return;

    const prefix = settings.prefix || ".";
    this.stats.messagesProcessed++;

    const isGroup = jid.endsWith("@g.us");
    const sender = isGroup ? this.cleanJid(m?.key?.participant || "") || jid : jid;
    
    if (isGroup && !this.groupSettings.has(jid)) {
      this.groupSettings.set(jid, { ...settings.defaultGroupSettings });
      this.saveGroupSettings();
    }

    let message = this.unwrapMessageContent(m.message);
    m.message = message;

    if (message?.buttonsResponseMessage) {
      const btnId = message.buttonsResponseMessage.selectedButtonId;
      await this.reactToMessage(m, btnId.replace(prefix, ''));
      await delay(80);
      if (btnId.startsWith(prefix)) {
        await this.routeCommand(jid, m, btnId.slice(prefix.length), { args: [], isGroup, sender });
      }
      return;
    }

    if (message?.templateButtonReplyMessage) {
      const btnId = message.templateButtonReplyMessage.selectedId;
      await this.reactToMessage(m, btnId.replace(prefix, ''));
      await delay(80);
      if (btnId.startsWith(prefix)) {
        await this.routeCommand(jid, m, btnId.slice(prefix.length), { args: [], isGroup, sender });
      }
      return;
    }

    const text = this.extractText(m);
    if (!text || !text.startsWith(prefix)) return;


    const isBotEcho = m.key.fromMe && message.extendedTextMessage?.contextInfo?.stanzaId;
    if (isBotEcho) return;

    const args = text.slice(prefix.length).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const cmdArgs = args.slice(1);

    const ownerJid = String(settings.ownerNumber || "").replace(/\D/g, "") + "@s.whatsapp.net";
    const currentMode = (settings.mode || "public").toLowerCase();
    const isOwner = sender === ownerJid || m.key.fromMe;

    if (isGroup) {
      const gs = this.groupSettings.get(jid) || { ...settings.defaultGroupSettings };
      const isGroupAdmin = await this.isGroupAdmin(jid, sender);
      if (gs.muted && !(isOwner || isGroupAdmin)) return;
    }

    if (currentMode === "private" && !isOwner) return;

    this._lastQuoted = m;
    
    let targetUsers = [];
    let quotedMessage = null;
    
    if (message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      quotedMessage = message.extendedTextMessage.contextInfo.quotedMessage;
      const quotedParticipant = message.extendedTextMessage?.contextInfo?.participant;
      if (quotedParticipant) targetUsers = [quotedParticipant];
    } else {
      targetUsers = message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    }

    this.stats.commandsExecuted++;

    // Allow built-in commands
    const builtInCommands = ['alive', 'ping', 'menu', 'help', 'info', 'stats', 'worm', 'groq', 'ai', 'vv', 'vv2', 'song', 'video', 'ytdl'];
    
    const commands = uniqueCommandList(settings.commands || []);
    const enabledCommand = commands.find(c => String(c.name || "").toLowerCase() === command);
    
    const isBuiltIn = builtInCommands.includes(command);

    if (!isBuiltIn) {
       // Check if it's a legacy command first
       const legacyCmd = events.commands.find(c => {
         if (c.pattern instanceof RegExp) return c.pattern.test(text.slice(prefix.length));
         if (typeof c.pattern === 'string') {
            const patternWord = c.pattern.split(/\s+/)[0].replace(/[\?\(].*/, '');
            return command === patternWord.toLowerCase();
         }
         return false;
       });

       if (legacyCmd) {
          return await this.handleLegacyCommand(jid, m, legacyCmd, text.slice(prefix.length));
       }

       // If not legacy, check if it's an enabled custom command in settings.json
       if (commands.length > 0 && !enabledCommand) {
          return;
       }
    }

    if (isGroup) await this.checkAntiFeatures(jid, m);

    // Handle 'on: text' legacy commands
    const textCommands = events.commands.filter(c => c.on === 'text');
    for (const c of textCommands) {
       if (c.fromMe && !isOwner) continue;
       try {
          const legacyMsg = this.wrapLegacyMessage(jid, m);
          // Safely execute the handler, catching specific database errors
          await c.handler(legacyMsg, text).catch(e => {
             // Silently ignore known DB/module errors from legacy plugins
             if (e.message.includes('FiltersDB') || e.message.includes('sequelize')) return;
             console.error("Legacy handler error:", e.message);
          });
       } catch (e) {
          // Ignore
       }
    }

    // If it's a legacy custom text command, handle it
    if (enabledCommand && enabledCommand.response && enabledCommand.response !== "built-in") {
       return await this.executeCommand(jid, m, async () => {
          return this.sendSuccess(jid, '🤖 ' + enabledCommand.name.toUpperCase(), enabledCommand.response, m);
       }, command);
    }

    await this.routeCommand(jid, m, command, { args: cmdArgs, isGroup, sender, targetUsers, quotedMessage });
  }

  async handleLegacyCommand(jid, m, legacyCmd, matchText) {
    try {
       await this.reactToMessage(m, 'default');
       const legacyMsg = this.wrapLegacyMessage(jid, m);
       const patternStr = legacyCmd.pattern instanceof RegExp ? legacyCmd.pattern.source : legacyCmd.pattern.split(' ')[0];
       const match = matchText.replace(patternStr, '').trim();
       await legacyCmd.handler(legacyMsg, match);
       await this.reactToMessage(m, 'success');
    } catch (error) {
       console.error("Legacy command error:", error);
       await this.reactToMessage(m, 'failure');
    }
  }

  wrapLegacyMessage(jid, m) {
    const sock = this.sock;
    const isGroup = jid.endsWith("@g.us");

    const normalizeParticipants = (meta = {}) =>
      (meta.participants || []).map((p) => ({
        ...p,
        jid: p.id,
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
      }));

    const fetchParticipants = async (gJid) => {
      const meta = await sock.groupMetadata(gJid || jid);
      return normalizeParticipants(meta);
    };

    const client = {
       ...sock,
       user: sock.user,
       groupMetadata: fetchParticipants,
       groupAdd: async (gJid, users) => await sock.groupParticipantsUpdate(gJid, users, "add"),
       groupRemove: async (gJid, users) => await sock.groupParticipantsUpdate(gJid, users, "remove"),
       groupMakeAdmin: async (gJid, users) => await sock.groupParticipantsUpdate(gJid, users, "promote"),
       groupDemoteAdmin: async (gJid, users) => await sock.groupParticipantsUpdate(gJid, users, "demote"),
       groupUpdateSubject: async (gJid, subject) => await sock.groupUpdateSubject(gJid, subject),
       groupUpdateDescription: async (gJid, desc) => await sock.groupUpdateDescription(gJid, desc),
       groupInviteCode: async (gJid) => await sock.groupInviteCode(gJid),
       groupRevokeInvite: async (gJid) => await sock.groupRevokeInvite(gJid),
       revokeInvite: async (gJid) => await sock.groupRevokeInvite(gJid),
       groupAcceptInvite: async (code) => await sock.groupAcceptInvite(code),
       acceptInvite: async (code) => await sock.groupAcceptInvite(code),
       getProfilePicture: async (gJid, type = "image") => await sock.profilePictureUrl(gJid, type),
       getStatus: async (gJid) => {
         const status = await sock.fetchStatus(gJid).catch(() => null);
         return status?.status?.status || status?.status || "";
       },
       blockUser: async (gJid, action = "add") => await sock.updateBlockStatus(gJid, action),
       updateProfilePicture: async (content) =>
         sock.updateProfilePicture(sock.user?.id, content),
       updateProfileStatus: async (status) => sock.updateProfileStatus(status),
       setStatus: async (status) => sock.updateProfileStatus(status),
       groupLeave: async (gJid) => await sock.groupLeave(gJid),
       chats: { all: () => [] },
       sendMessage: async (gJid, content, options) => await sock.sendMessage(gJid, content, options)
    };

    return {
      client: client,
      data: m,
      jid: jid,
      fromMe: m.key.fromMe,
      participant: m.key.participant || jid,
      id: m.key.id,
      isGroup: isGroup,
      message: m.message,
      mention: m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      
      downloadAndSaveMediaMessage: async (name = 'media') => {
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }) });
          const filename = `${name}_${Date.now()}.png`;
          fs.writeFileSync(filename, buffer);
          return filename;
      },
      
      // Helper methods on message object
      groupMetadata: fetchParticipants,
      groupRemove: async (gJid, users) => await sock.groupParticipantsUpdate(gJid || jid, Array.isArray(users) ? users : [users], "remove"),
      groupAdd: async (gJid, users) => await sock.groupParticipantsUpdate(gJid || jid, Array.isArray(users) ? users : [users], "add"),
      groupMakeAdmin: async (gJid, users) => await sock.groupParticipantsUpdate(gJid || jid, Array.isArray(users) ? users : [users], "promote"),
      groupDemoteAdmin: async (gJid, users) => await sock.groupParticipantsUpdate(gJid || jid, Array.isArray(users) ? users : [users], "demote"),
      groupInviteCode: async (gJid) => await sock.groupInviteCode(gJid || jid),
      inviteCodeInfo: async (code) => await sock.groupGetInviteInfo(code),
      GroupMuteSettingsChange: async (gJid, mute) => await sock.groupSettingUpdate(gJid || jid, mute ? 'announcement' : 'not_announcement'),

      reply_message: m.message?.extendedTextMessage?.contextInfo?.quotedMessage ? {
         text: m.message.extendedTextMessage.contextInfo.quotedMessage.conversation || m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || "",
         jid: m.message.extendedTextMessage.contextInfo.participant,
         image: !!m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage,
         video: !!m.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage,
         audio: !!m.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage,
         sticker: !!m.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage,
         data: { key: { remoteJid: jid, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant }, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
         downloadAndSaveMediaMessage: async (name = 'quoted') => {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const quoted = { key: { remoteJid: jid, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant }, message: m.message.extendedTextMessage.contextInfo.quotedMessage };
            const buffer = await downloadMediaMessage(quoted, 'buffer', {}, { logger: pino({ level: 'silent' }) });
            const filename = `${name}_${Date.now()}.png`;
            fs.writeFileSync(filename, buffer);
            return filename;
         },
         downloadMediaMessage: async () => {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            return await downloadMediaMessage({ key: { remoteJid: jid, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant }, message: m.message.extendedTextMessage.contextInfo.quotedMessage }, 'buffer', {}, { logger: pino({ level: 'silent' }) });
         }
      } : false,
      sendMessage: async (content, options = {}, type = 'text') => {
         if (typeof content === 'object' && !Buffer.isBuffer(content)) {
            // Convert legacy list/button/template messages to modern text structure
            if (type === 'listMessage' || type === 'buttonsMessage' || type === 'templateMessage') {
               let text = content.text || content.caption || "Choose an option:";
               if (content.sections) {
                  content.sections.forEach(s => {
                     text += `\n\n*${s.title}*`;
                     s.rows.forEach(r => text += `\n- ${r.title}: ${r.description || ''}`);
                  });
               }
               if (content.buttons) {
                  content.buttons.forEach(b => text += `\n[ ${b.buttonText.displayText} ]`);
               }
               return sock.sendMessage(jid, { text, ...options });
            }

            if (type === 'image' || type === 'imageMessage') return sock.sendMessage(jid, { image: content, ...options });
            if (type === 'video' || type === 'videoMessage') return sock.sendMessage(jid, { video: content, ...options });
            if (type === 'audio' || type === 'audioMessage') return sock.sendMessage(jid, { audio: content, ...options });
            if (type === 'sticker' || type === 'stickerMessage') return sock.sendMessage(jid, { sticker: content, ...options });
            if (type === 'document' || type === 'documentMessage') return sock.sendMessage(jid, { document: content, ...options });
            
            return sock.sendMessage(jid, content, options);
         }
         if (Buffer.isBuffer(content)) {
            const isImage = type === 'image' || type === 'imageMessage' || !type || type === 'text';
            const isVideo = type === 'video' || type === 'videoMessage';
            const isAudio = type === 'audio' || type === 'audioMessage';
            const isSticker = type === 'sticker' || type === 'stickerMessage';
            const isDoc = type === 'document' || type === 'documentMessage';

            if (isVideo) return sock.sendMessage(jid, { video: content, ...options });
            if (isAudio) return sock.sendMessage(jid, { audio: content, ...options });
            if (isSticker) return sock.sendMessage(jid, { sticker: content, ...options });
            if (isDoc) return sock.sendMessage(jid, { document: content, ...options });
            return sock.sendMessage(jid, { image: content, ...options });
         }
         return sock.sendMessage(jid, { text: content, ...options });
      },
      reply: async (text) => {
         return sock.sendMessage(jid, { text: text }, { quoted: m });
      }
    };
  }

  async saveViewOnceImage(jid, m, quotedMessage) {
    const message = quotedMessage || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!message) {
      return this.sendError(jid, "🪟 𝗩𝗜𝗘𝗪 𝗢𝗡𝗖𝗘", "Reply to a view-once message with .vv", m);
    }

    let content = this.unwrapMessageContent(message);
    const type = this.getMessageType(content);

    if (type !== "imageMessage" && type !== "videoMessage") {
      return this.sendError(jid, "🪟 𝗩𝗜𝗘𝗪 𝗢𝗡𝗖𝗘", "Reply to a view-once image or video message with .vv", m);
    }

    const media = content[type];
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      // Reconstruct a proper message object for downloadMediaMessage
      const msgToDownload = {
        key: {
          remoteJid: jid,
          id: m.message?.extendedTextMessage?.contextInfo?.stanzaId,
          participant: m.message?.extendedTextMessage?.contextInfo?.participant
        },
        message: message
      };

      const buffer = await downloadMediaMessage(
        msgToDownload,
        'buffer',
        {},
        { logger: pino({ level: 'silent' }), rekey: false }
      );

      if (!buffer || !buffer.length) {
        throw new Error("Empty media data received.");
      }

      if (type === 'imageMessage') {
        return this.sock.sendMessage(jid, { image: buffer, caption: "✅ View-once image decrypted.", contextInfo: buildChannelContextInfo() }, { quoted: m });
      } else {
        return this.sock.sendMessage(jid, { video: buffer, caption: "✅ View-once video decrypted.", contextInfo: buildChannelContextInfo() }, { quoted: m });
      }
    } catch (error) {
      console.error("VV Error:", error);
      return this.sendError(jid, "🪟 𝗩𝗜𝗘𝗪 𝗢𝗡𝗖𝗘", `Failed to decrypt: ${error.message}`, m);
    }
  }

  async routeCommand(jid, m, command, options = {}) {
    const { args = [], isGroup = false, sender = '', targetUsers = [], quotedMessage = null } = options;
    
    const isOwner = sender === (String(settings.ownerNumber || "").replace(/\D/g, "") + "@s.whatsapp.net") || m.key.fromMe;

    if (isGroup && this.isAdminCommand(command)) {
      const isAdmin = await this.isGroupAdmin(jid, sender);
      if (!isAdmin) {
        await this.reactToMessage(m, command);
        await delay(120);
        return await this.sendError(jid, '🛑 𝗣𝗘𝗥𝗠𝗜𝗦𝗦𝗜𝗢𝗡 𝗗𝗘𝗡𝗜𝗘𝗗', 
          `ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ʀᴇǫᴜɪʀᴇs ᴀᴅᴍɪɴ ᴘʀɪᴠɪʟᴇɢᴇs\nᴜsᴇʀ: ${this.getMentionString(sender)}\nᴄᴏᴍᴍᴀɴᴅ: .${command}\nᴏɴʟʏ ᴀᴅᴍɪɴs ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ`, 
          m);
      }
    }
    
    switch(command) {
      case 'alive': return await this.executeCommand(jid, m, () => this.handleAlive(jid, m), command);
      case 'ping': return await this.executeCommand(jid, m, () => this.handlePing(jid, m), command);
      case 'menu': return await this.executeCommand(jid, m, () => this.handleMenu(jid, m), command);
      case 'help': return await this.executeCommand(jid, m, () => this.handleMenu(jid, m), command);
      case 'info': return await this.executeCommand(jid, m, () => this.sendInfo(jid, '📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡', `Bot Name: ${settings.botName}\nOwner: ${settings.ownerNumber}\nVersion: ${settings.version || '3.0.0'}`, m), command);
      case 'stats': return await this.executeCommand(jid, m, () => this.sendInfo(jid, '📊 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦', `Commands: ${this.stats.commandsExecuted}\nMessages: ${this.stats.messagesProcessed}\nGroups: ${this.stats.groupsActive}`, m), command);
      case 'owner': return await this.executeCommand(jid, m, () => this.sendInfo(jid, '👑 𝗢𝗪𝗡𝗘𝗥', `Name: Errorking404\nNumber: ${settings.ownerNumber}`, m), command);
      case 'runtime': return await this.executeCommand(jid, m, () => {
         const uptime = formatUptime(Math.floor((Date.now() - this.stats.startTime) / 1000));
         return this.sendInfo(jid, '⏱️ 𝗥𝗨𝗡𝗧𝗜𝗠𝗘', `Uptime: ${uptime}`, m);
      }, command);
      case 'worm': return await this.executeCommand(jid, m, () => this.handleWorm(jid, m, args), command);
      case 'groq': return await this.executeCommand(jid, m, () => this.handleGroq(jid, m, args), command);
      case 'data': return await this.executeCommand(jid, m, () => this.handleSIMDB(jid, m, args), command);
      case 'song': return await this.executeCommand(jid, m, () => this.handleYTDL(jid, m, args, 'mp3'), command);
      case 'video': return await this.executeCommand(jid, m, () => this.handleYTDL(jid, m, args, 'mp4'), command);
      case 'ytdl': return await this.executeCommand(jid, m, () => this.handleYTDL(jid, m, args, 'mp3'), command);
      case 'tagall': 
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            const metadata = await this.sock.groupMetadata(jid);
            const participants = metadata.participants;
            let message = `📢 *TAG ALL*\n\n`;
            if (args.length > 0) message += `📝 Message: ${args.join(" ")}\n\n`;
            participants.forEach((p, i) => {
               message += `${i + 1}. @${p.id.split('@')[0]}\n`;
            });
            return await this.sock.sendMessage(jid, { text: message, mentions: participants.map(p => p.id) }, { quoted: m });
         }, command);
      case 'hidetag':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            const metadata = await this.sock.groupMetadata(jid);
            const participants = metadata.participants;
            const message = args.join(" ") || "Attention!";
            return await this.sock.sendMessage(jid, { text: message, mentions: participants.map(p => p.id) }, { quoted: m });
         }, command);
      case 'mute':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            await this.sock.groupSettingUpdate(jid, 'announcement');
            return this.sendSuccess(jid, '🔇 GROUP MUTE', 'Group has been muted. Only admins can send messages.', m);
         }, command);
      case 'unmute':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            await this.sock.groupSettingUpdate(jid, 'not_announcement');
            return this.sendSuccess(jid, '🔊 GROUP UNMUTE', 'Group has been unmuted. Everyone can send messages.', m);
         }, command);
      case 'promote':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            if (targetUsers.length === 0) return this.sendError(jid, '🔼 PROMOTE', 'Tag or reply to a user to promote.', m);
            await this.sock.groupParticipantsUpdate(jid, targetUsers, 'promote');
            return this.sendSuccess(jid, '🔼 PROMOTE', `Promoted ${targetUsers.length} user(s) to admin.`, m);
         }, command);
      case 'demote':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            if (targetUsers.length === 0) return this.sendError(jid, '🔽 DEMOTE', 'Tag or reply to a user to demote.', m);
            await this.sock.groupParticipantsUpdate(jid, targetUsers, 'demote');
            return this.sendSuccess(jid, '🔽 DEMOTE', `Demoted ${targetUsers.length} user(s) from admin.`, m);
         }, command);
      case 'kick':
         if (!isGroup) return;
         return await this.executeCommand(jid, m, async () => {
            if (targetUsers.length === 0) return this.sendError(jid, '👢 KICK', 'Tag or reply to a user to kick.', m);
            await this.sock.groupParticipantsUpdate(jid, targetUsers, 'remove');
            return this.sendSuccess(jid, '👢 KICK', `Kicked ${targetUsers.length} user(s) from group.`, m);
         }, command);
      case 'vv':
      case 'vv2':
        return await this.executeCommand(
          jid,
          m,
          () => this.saveViewOnceImage(jid, m, quotedMessage),
          command
        );
      default:
        // Try legacy commands
        const legacyCmd = events.commands.find(c => {
           if (typeof c.pattern === 'string') return command === c.pattern.split(' ')[0];
           return false;
        });
        if (legacyCmd) {
           return await this.handleLegacyCommand(jid, m, legacyCmd, command + " " + args.join(" "));
        }
        break;
    }
  }

  async handleYTDL(jid, originalMessage, args = [], type = 'mp3') {
    const query = args.join(" ").trim();
    if (!query) {
       return this.sendError(jid, '📥 YTDL', `Please provide a YouTube URL or search query.\nExample: .song Faded Alan Walker`, originalMessage);
    }

    try {
       await this.reactToMessage(originalMessage, 'default');
       await this.sendInfo(jid, '📥 YTDL', `Searching for: ${query}...`, originalMessage);

       if (type === 'mp3') {
          const res = await ytDownloader.downloadMusic(query);
          await this.sock.sendMessage(jid, {
             audio: { url: res.path },
             mimetype: 'audio/mpeg',
             fileName: `${res.meta.title}.mp3`,
             contextInfo: {
                externalAdReply: {
                   title: res.meta.title,
                   body: res.meta.artist,
                   thumbnailUrl: res.meta.image,
                   mediaType: 1,
                   renderLargerThumbnail: true
                }
             }
          }, { quoted: originalMessage });
          if (fs.existsSync(res.path)) fs.unlinkSync(res.path);
       } else {
          let videoId = query;
          if (!ytDownloader.isYTUrl(query)) {
             const searchResults = await ytDownloader.search(query);
             if (!searchResults || searchResults.length === 0) {
                throw new Error(`No videos found for query: ${query}`);
             }
             videoId = searchResults[0].id;
          }
          const res = await ytDownloader.mp4(videoId);
          await this.sock.sendMessage(jid, {
             video: { url: res.videoUrl },
             caption: `🎥 *${res.title}*\n\nChannel: ${res.channel}\nDuration: ${res.duration}s`,
             mimetype: 'video/mp4'
          }, { quoted: originalMessage });
       }
       await this.reactToMessage(originalMessage, 'success');
    } catch (error) {
       console.error("YTDL Error:", error);
       await this.sendError(jid, '📥 YTDL', `Failed to download: ${error.message}`, originalMessage);
    }
  }

  async handlePing(jid, originalMessage) {
    const start = Date.now();
    try { await this.sock.sendPresenceUpdate("composing", jid); } catch {}
    const latency = Date.now() - start;

    const pingText = this.formatResponse('⚡ 𝗣𝗜𝗡𝗢', 
`ʟᴀᴛᴇɴᴄʏ: ${latency}ᴍs
sᴛᴀᴛᴜs: ${latency < 1000 ? "ʜᴇᴀʟᴛʜʏ" : "ʜɪɢʜ ʟᴏᴀᴅ"}`);

    return this.sendSimpleText(jid, pingText, { quoted: originalMessage });
  }

  async handleAlive(jid, originalMessage) {
    const uptime = formatUptime(Math.floor((Date.now() - this.stats.startTime) / 1000));
    const aliveText = this.formatResponse('🟢 𝗔𝗟𝗜𝗩𝗘', 
`ʙᴏᴛ ɪs ᴏɴʟɪɴᴇ ᴀɴᴅ ʀᴇᴀᴅʏ!

⚡ ᴘɪɴɢ: ${Math.floor(Math.random() * 100)}ᴍs
⏱️ ᴜᴘᴛɪᴍᴇ: ${uptime}
👤 ᴏᴡɴᴇʀ: Errorking404
📦 ᴠᴇʀsɪᴏɴ: ${settings.version || '3.0.0'}

ᴛʏᴘᴇ .ᴍᴇɴᴜ ғᴏʀ ᴄᴏᴍᴍᴀɴᴅs.`);

    if (fs.existsSync(BOT_IMAGE_URL)) {
        return await this.sock.sendMessage(jid, {
            image: fs.readFileSync(BOT_IMAGE_URL),
            caption: aliveText,
            contextInfo: buildChannelContextInfo()
        }, { quoted: originalMessage });
    }

    return this.sendSimpleText(jid, aliveText, { quoted: originalMessage });
  }

  async handleWorm(jid, originalMessage, args = []) {
    let model = "small";
    let prompt = "";

    const firstArg = String(args[0] || "").toLowerCase();
    if (["small", "medium", "large"].includes(firstArg)) {
      model = firstArg;
      prompt = args.slice(1).join(" ").trim();
    } else {
      prompt = args.join(" ").trim();
    }

    const isGroup = Boolean(originalMessage?.key?.remoteJid && String(originalMessage.key.remoteJid).endsWith("@g.us"));

    if (!prompt) {
      return this.sendError(
        jid,
        "🧠 𝗪𝗢𝗥𝗠",
        WORM_USAGE,
        originalMessage
      );
    }

    if (model === "large" && isGroup) {
      return this.sendError(
        jid,
        "🧠 𝗪𝗢𝗥𝗠",
        "Large model is disabled in groups.\nUse it in private chat only.",
        originalMessage
      );
    }

    const normalizedModel = model.replace(/[^a-z0-9_-]/g, "");
    if (!normalizedModel) {
      return this.sendError(
        jid,
        "🧠 𝗪𝗢𝗥𝗠",
        WORM_USAGE,
        originalMessage
      );
    }

    try {
      const endpoint = `${WORM_API_URL}?prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(normalizedModel)}`;
      const response = await axios.get(endpoint, {
        headers: {
          "Accept": "application/json,text/plain,*/*",
          "User-Agent": "Error-MD/1.0",
        },
        timeout: 30000
      });

      const payload = response.data;
      const text =
        typeof payload === "string"
          ? payload
          : payload?.response ||
            payload?.result ||
            payload?.text ||
            payload?.message ||
            "";

      const finalText = String(text || "").trim();
      if (!finalText) {
        return this.sendError(
          jid,
          "🧠 𝗪𝗢𝗥𝗠",
          "Empty response from WORM API.",
          originalMessage
        );
      }

      return this.sendSimpleText(
        jid,
        finalText.length > 3500 ? `${finalText.slice(0, 3500)}\n\n[truncated]` : finalText,
        { quoted: originalMessage }
      );
    } catch (error) {
      return this.sendError(
        jid,
        "🧠 𝗪𝗢𝗥𝗠",
        `Request failed: ${error?.response?.data?.error || error?.message || error}`,
        originalMessage
      );
    }
  }

  async handleSIMDB(jid, originalMessage, args = []) {
    let num = args[0] ? args[0].replace(/\D/g, "") : "";
    if (!num) {
      return this.sendError(jid, "📁 𝗦𝗜𝗠 𝗗𝗕", "Please provide a phone number.\nExample: .data 03001234567", originalMessage);
    }

    // Ensure it starts with 03 (format as 03xxx)
    if (num.startsWith("92")) {
      num = "0" + num.slice(2);
    } else if (num.startsWith("3")) {
      num = "0" + num;
    } else if (!num.startsWith("03")) {
       // Optional: you might want to enforce 03 strictly or just try prepending 0 if missing
       if (num.length === 10 && !num.startsWith("0")) num = "0" + num;
    }

    try {
      await this.reactToMessage(originalMessage, 'default');
      const response = await axios.get(`https://new-db-xi.vercel.app/api/index.php?num=${num}`, {
        timeout: 15000,
        headers: { "User-Agent": "Error-MD/1.0" }
      });

      const data = response.data;
      if (!data || (typeof data === 'string' && data.includes("No Record Found"))) {
         return this.sendError(jid, "📁 𝗦𝗜𝗠 𝗗𝗕", `No record found for ${num}`, originalMessage);
      }

      let resultText = "";
      if (typeof data === 'object') {
         for (const [key, value] of Object.entries(data)) {
            resultText += `${key.toUpperCase()}: ${value}\n`;
         }
      } else {
         resultText = String(data).replace(/<br\s*\/?>/gi, "\n").trim();
      }

      if (!resultText || resultText === "null") {
          return this.sendError(jid, "📁 𝗦𝗜𝗠 𝗗𝗕", `No data available for ${num}`, originalMessage);
      }

      return this.sendSimpleText(jid, this.formatResponse("📁 𝗦𝗜𝗠 𝗗𝗕", resultText), { quoted: originalMessage });

    } catch (error) {
      console.error("SIM DB Error:", error);
      return this.sendError(jid, "📁 𝗦𝗜𝗠 𝗗𝗕", `Failed to fetch data: ${error.message}`, originalMessage);
    }
  }

  async handleGroq(jid, originalMessage, args = []) {
    const prompt = args.join(" ").trim();
    if (!prompt) {
      return this.sendError(jid, "⚡ 𝗚𝗥𝗢𝗤 𝗔𝗜", "Please provide a prompt.\nExample: .groq What is quantum physics?", originalMessage);
    }

    try {
      await this.sock.sendPresenceUpdate("composing", jid);
      
      const { ErrorMDChat } = require('./libsAndPlugins/libpre/groq');
      const response = await ErrorMDChat(prompt);

      return this.sendSimpleText(
        jid,
        `⚡ *GROQ AI*\n\n${response}`,
        { quoted: originalMessage }
      );
    } catch (error) {
      return this.sendError(jid, "⚡ 𝗚𝗥𝗢𝗤 𝗔𝗜", `Failed to get response: ${error.message}`, originalMessage);
    }
  }

  async handleMenu(jid, originalMessage) {
    if (!cachedMenuText) {
      const prefix = settings.prefix || ".";
      
      // Get all legacy commands
      const legacyCmdList = (events.commands || []).map(c => {
        if (typeof c.pattern === 'string') {
          return c.pattern.split(/\s+/)[0].replace(/[\?\(].*/, '').trim();
        }
        if (c.pattern instanceof RegExp) {
          return c.pattern.source.replace(/[^a-zA-Z0-9]/g, '').trim();
        }
        return '';
      }).filter(name => name.length > 0);

      // Filter duplicates and empty strings
      const allCommandNames = new Set([
        'ping', 'alive', 'worm', 'groq', 'data', 'song', 'video', 'ytdl', 'vv', 'info', 'stats', 'menu',
        ...legacyCmdList
      ]);
      allCommandNames.delete('jail');


      const categories = {
        '🤖 AI COMMANDS': [],
        '📁 SIM DB': [],
        '📥 DOWNLOAD COMMANDS': [],
        '👥 ADMIN COMMANDS': [],
        '🎨 UTILITY & MEDIA': [],
        '⚙️ SYSTEM COMMANDS': [],
        '🔮 MISC COMMANDS': []
      };

      const categoryMapping = {
        // AI
        'worm': '🤖 AI COMMANDS',
        'groq': '🤖 AI COMMANDS',

        // SIM DB
        'data': '📁 SIM DB',

        // Downloaders
        'song': '📥 DOWNLOAD COMMANDS',
        'video': '📥 DOWNLOAD COMMANDS',
        'ytdl': '📥 DOWNLOAD COMMANDS',
        'ytv': '📥 DOWNLOAD COMMANDS',
        'yta': '📥 DOWNLOAD COMMANDS',
        'instagram': '📥 DOWNLOAD COMMANDS',
        'insta': '📥 DOWNLOAD COMMANDS',
        'tiktok': '📥 DOWNLOAD COMMANDS',
        'tt': '📥 DOWNLOAD COMMANDS',
        'twitter': '📥 DOWNLOAD COMMANDS',
        'pinterest': '📥 DOWNLOAD COMMANDS',
        'fb': '📥 DOWNLOAD COMMANDS',
        'facebook': '📥 DOWNLOAD COMMANDS',

        // Admin
        'kick': '👥 ADMIN COMMANDS',
        'add': '👥 ADMIN COMMANDS',
        'promote': '👥 ADMIN COMMANDS',
        'demote': '👥 ADMIN COMMANDS',
        'mute': '👥 ADMIN COMMANDS',
        'unmute': '👥 ADMIN COMMANDS',
        'tagall': '👥 ADMIN COMMANDS',
        'hidetag': '👥 ADMIN COMMANDS',
        'warn': '👥 ADMIN COMMANDS',
        'resetwarn': '👥 ADMIN COMMANDS',
        'welcome': '👥 ADMIN COMMANDS',
        'goodbye': '👥 ADMIN COMMANDS',
        'antilink': '👥 ADMIN COMMANDS',
        'antisticker': '👥 ADMIN COMMANDS',
        'antiaudio': '👥 ADMIN COMMANDS',
        'antivideo': '👥 ADMIN COMMANDS',
        'antifile': '👥 ADMIN COMMANDS',

        // Utility / Media
        'vv': '🎨 UTILITY & MEDIA',
        'vv2': '🎨 UTILITY & MEDIA',
        'sticker': '🎨 UTILITY & MEDIA',
        'removebg': '🎨 UTILITY & MEDIA',
        'meme': '🎨 UTILITY & MEDIA',
        'ocr': '🎨 UTILITY & MEDIA',
        'weather': '🎨 UTILITY & MEDIA',
        'calc': '🎨 UTILITY & MEDIA',
        'qr': '🎨 UTILITY & MEDIA',
        'shorten': '🎨 UTILITY & MEDIA',

        // System
        'ping': '⚙️ SYSTEM COMMANDS',
        'alive': '⚙️ SYSTEM COMMANDS',
        'info': '⚙️ SYSTEM COMMANDS',
        'stats': '⚙️ SYSTEM COMMANDS',
        'menu': '⚙️ SYSTEM COMMANDS',
        'help': '⚙️ SYSTEM COMMANDS',
      };

      for (const name of allCommandNames) {
        const lower = name.toLowerCase();
        let matched = false;
        for (const [key, cat] of Object.entries(categoryMapping)) {
          if (lower === key || lower.startsWith(key)) {
            categories[cat].push(name);
            matched = true;
            break;
          }
        }
        if (!matched) {
          if (lower.includes('admin') || lower.includes('group')) {
            categories['👥 ADMIN COMMANDS'].push(name);
          } else if (lower.includes('download') || lower.includes('dl') || lower.includes('play')) {
            categories['📥 DOWNLOAD COMMANDS'].push(name);
          } else if (lower.includes('ai') || lower.includes('gpt') || lower.includes('bot')) {
            categories['🤖 AI COMMANDS'].push(name);
          } else {
            categories['🔮 MISC COMMANDS'].push(name);
          }
        }
      }

      let menuBody = "";
      for (const [catName, cmdList] of Object.entries(categories)) {
        if (cmdList.length === 0) continue;
        const uniqueSorted = [...new Set(cmdList)].sort();
        menuBody += `\n*${catName}*\n`;
        for (const cmd of uniqueSorted) {
          menuBody += `│  ${prefix}${cmd}\n`;
        }
      }

      // Add Custom commands
      const customCmds = uniqueCommandList(settings.commands || []).map(c => c.name);
      if (customCmds.length > 0) {
        menuBody += `\n*✨ CUSTOM COMMANDS*\n`;
        for (const cmd of customCmds.sort()) {
          menuBody += `│  ${prefix}${cmd}\n`;
        }
      }

      cachedMenuText = this.formatResponse('📜 𝗠𝗘𝗡𝗨', menuBody.trim());
    }

    if (!cachedBotImage && fs.existsSync(BOT_IMAGE_URL)) {
      try {
        cachedBotImage = fs.readFileSync(BOT_IMAGE_URL);
      } catch (e) {
        console.error("Error reading bot image:", e);
      }
    }

    if (cachedBotImage) {
      return await this.sock.sendMessage(jid, {
        image: cachedBotImage,
        caption: cachedMenuText,
        contextInfo: buildChannelContextInfo()
      }, { quoted: originalMessage });
    }

    return this.sendSimpleText(jid, cachedMenuText, { quoted: originalMessage });
  }

  async checkAntiFeatures(jid, m) {
    // Basic anti feature stub implemented in full version
  }
}

module.exports = CommandHandler;
