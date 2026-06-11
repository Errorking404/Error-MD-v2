const fs = require("fs");
const path = require("path");

const warnFile = path.join(__dirname, "../../data/warnings.json");

function loadWarnings() {
  try {
    if (fs.existsSync(warnFile)) {
      return JSON.parse(fs.readFileSync(warnFile, "utf8"));
    }
  } catch {}
  return {};
}

function saveWarnings(data) {
  try {
    const dir = path.dirname(warnFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(warnFile, JSON.stringify(data, null, 2));
  } catch {}
}

module.exports = {
  warn: async (jid, user) => {
    const data = loadWarnings();
    if (!data[jid]) data[jid] = {};
    data[jid][user] = (data[jid][user] || 0) + 1;
    saveWarnings(data);
    return data[jid][user];
  },
  getEachWarn: async (jid, user) => {
    const data = loadWarnings();
    return data[jid]?.[user] || 0;
  },
  getMessage: async (jid) => {
    const data = loadWarnings();
    return Object.entries(data[jid] || {}).map(([user, count]) => ({ user, count }));
  },
  deleteMessage: async (jid, user) => {
    const data = loadWarnings();
    if (data[jid]) {
      delete data[jid][user];
      saveWarnings(data);
    }
  },
};
