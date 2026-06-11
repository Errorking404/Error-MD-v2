const axios = require('axios');

async function getBuffer(url, options = {}) {
  try {
    const res = await axios({
      method: "get",
      url,
      headers: {
        'DNT': 1,
        'Upgrade-Insecure-Request': 1
      },
      ...options,
      responseType: 'arraybuffer'
    })
    return { buffer: Buffer.from(res.data), size: res.data.length, url };
  } catch (e) {
    return { buffer: null, size: 0, url, emessage: e.message };
  }
}

async function getJson(url, options = {}) {
  try {
    const res = await axios({
      method: "get",
      url,
      ...options,
      responseType: 'json'
    })
    return res.data;
  } catch (e) {
    return null;
  }
}

// Generic downloader using Cobalt API (Open Source)
async function cobaltDownload(url) {
    try {
        const response = await axios.post('https://cobalt.tools/api/json', {
            url: url,
            vQuality: '720',
            filenamePattern: 'basic'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data.url;
    } catch (e) {
        console.error('Cobalt Error:', e.message);
        return null;
    }
}

module.exports = {
  getBuffer,
  getJson,
  getName: async (jid) => jid.split('@')[0],
  readmore: "\u200b".repeat(4001),
  readMore: (text) => text + "\u200b".repeat(4001),
  TiktokDownloader: async (url) => await cobaltDownload(url),
  UploadToImgur: async () => "",
  parsedJid: (t) => t.match(/[0-9]+@s\.whatsapp\.net/g) || [],
  getOneWallpaper: async () => "https://v-v.icu/wallpaper.jpg",
  getImgUrl: async () => "",
  isUrl: (t) => /https?:\/\/[^\s]+/.test(t),
  pinterest: async (url) => await cobaltDownload(url),
  twitter: async (url) => await cobaltDownload(url),
  instagram: async (url) => {
      const link = await cobaltDownload(url);
      return link ? [link] : [];
  },
  mediaFire: async () => "",
  pdf: async () => Buffer.alloc(0),
  removeBg: async () => ({ buffer: Buffer.alloc(0) }),
  downVideo: async (url) => {
      const link = await cobaltDownload(url);
      return link ? [link, "Download successful"] : [];
  },
  igStory: async () => [],
  getJsonText: async () => ({}),
  IdentifySong: async () => ({ title: "", artist: "" }),
  googleSearch: async () => [],
  y2mateMp3: async () => "",
  ytVidList: (search) => {
     let msg = "YouTube Results:\n";
     search.all.slice(0, 10).forEach((v, i) => msg += `${i+1}. ${v.title}\n${v.url}\n`);
     return msg;
  },
  dlY2mate: async () => "",
  getY2mate: async () => "",
  webpToMp4: async (filePath) => {
    try {
      const fs = require("fs");
      const converter = require("../lib/converter");
      const buffer = fs.readFileSync(filePath);
      return await converter.ffmpeg(
        buffer,
        ["-movflags", "faststart", "-pix_fmt", "yuv420p"],
        "webp",
        "mp4"
      );
    } catch {
      return Buffer.alloc(0);
    }
  },
};
