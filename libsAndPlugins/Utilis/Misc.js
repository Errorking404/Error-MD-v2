const axios = require('axios');
const fs = require('fs');

const checkImAdmin = async (participants, user) => {
  if (!participants || !user) return false;
  const p = participants.find(p => p.id === user || p.id === user.replace('@s.whatsapp.net', '@lid') || p.id === user.replace('@lid', '@s.whatsapp.net'));
  return p && (p.admin === 'admin' || p.admin === 'superadmin');
};

const textToStylist = (text = "", style = "mono") => {
  return text; 
};

const banner = async (path, type) => {
  try {
     const buffer = fs.readFileSync(path);
     // In a real scenario, this would use sharp/jimp to apply a filter
     return buffer;
  } catch {
     return Buffer.alloc(0);
  }
};

const SpeachToText = async (lang, text) => {
  try {
     const res = await axios.get(`https://api.v-v.icu/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, { responseType: 'arraybuffer' });
     return Buffer.from(res.data);
  } catch {
     return Buffer.alloc(0);
  }
};

module.exports = {
  addSpace: (i, total) => " ".repeat(String(total).length - String(i).length),
  arrRm: (arr = [], value) => Array.isArray(arr) ? arr.filter((item) => item !== value) : [],
  aliveMessage: async () => ({ buffer: Buffer.alloc(0), type: "text", msg: "Error-MD", text: "Error-MD" }),
  checkImAdmin,
  emoji: "✨",
  banner,
  SpeachToText,
  generateListMessage: (arr) => {
     let msg = "Results:\n";
     arr.slice(0, 10).forEach((v, i) => msg += `${i+1}. ${v.title}\n${v.url}\n`);
     return msg;
  },
  newsListMessage: (arr) => arr.map(v => `*${v.title}*\n${v.url}`).join("\n\n"),
  addAudioMetaData: async (buffer) => buffer,
  apkMirror: async (q) => ({ type: "text", buffer: `Search results for ${q}...` }),
  checkBroadCast: async () => ({ status: false }),
  stylishTextGen: (t) => t,
  getSticker: async () => [],
  ticTacToe: async () => ({ msg: "Game started", mentionedJid: [] }),
  isGameActive: () => ({ state: false }),
  deleteTicTacToe: async () => {},
  genButtons: (buttons = [], text = "", footer = "") => ({ buttons, text, footer }),
  fontType: (n) => "mono",
  iplscore: async (q) => "Match info for " + q,
  enableAntilink: async () => undefined,
  enableAntiFake: async () => undefined,
  enableAntiBad: async () => undefined,
  enableGreetings: async () => undefined,
  enableMention: async () => undefined,
  clearGreetings: async () => undefined,
  clearFiles: async () => undefined,
  genGreetingsPreView: async () => "",
  getAllMessageCount: async () => 0,
  getImgUrl: async () => "",
  getOneWallpaper: async () => "",
  isGroup: (jid) => jid.endsWith('@g.us'),
  isUrl: (text) => /https?:\/\/[^\s]+/.test(text),
  mentionMessage: async () => "",
  parseGistUrls: () => null,
  parseVote: () => null,
  participateInVote: async () => undefined,
  pluginList: () => [],
  pinterest: async () => [],
  promoteDemote: async () => undefined,
  prepareFilter: async (text = "") => ({ msg: text, MessageType: "text" }),
  removeUrl: (text = "") => text.replace(/https?:\/\/[^\s]+/g, ''),
  textToStylist,
  utt: () => "",
  UploadToImgur: async () => "",
  parsedJid: (text = "") => text.match(/[0-9]+@s\.whatsapp\.net/g) || [],
  twitter: async () => [],
  instagram: async () => [],
  warnMessage: "",
  checkGroup: (jid) => jid.endsWith('@g.us'),
  isAdmin: checkImAdmin,
  isOwner: (jid, owner) => jid === owner,
  isBanned: async () => false,
  isPremium: async () => false,
  pluginListByName: () => [],
  getRandom: (ext = "") => `${Math.floor(Math.random() * 10000)}${ext}`,
  toggle: async () => undefined,
  empties: () => ({}),
  photoEditor: async (path, type) => ({ status: true, result: "https://v-v.icu/placeholder.png" }),
  menu: () => "Photo Editor Menu"
};
