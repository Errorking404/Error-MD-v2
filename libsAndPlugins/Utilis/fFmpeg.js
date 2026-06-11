const fs = require("fs");
const path = require("path");
const converter = require("../lib/converter");
const { writeExif } = require("../lib/exif");

async function sticker(_type, filePath, variant = 1, packInfo = "") {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1) || "jpeg";
    const args =
      variant === 1
        ? ["-vf", "scale=512:512:force_original_aspect_ratio=decrease", "-f", "webp"]
        : ["-vf", "scale=512:512", "-f", "webp"];
    return await converter.ffmpeg(buffer, args, ext, "webp");
  } catch {
    return Buffer.alloc(0);
  }
}

async function addExif(filePath, packInfo = "Error-MD,Errorking404") {
  try {
    const buffer = fs.readFileSync(filePath);
    const [packname = "Error-MD", author = "Errorking404"] = String(packInfo || "")
      .split(",")
      .map((s) => s.trim());
    return await writeExif(buffer, packname, author);
  } catch {
    return Buffer.alloc(0);
  }
}

module.exports = {
  sticker,
  addExif,
  toAudio: converter.toAudio,
  toPTT: converter.toPTT,
  webpToMp4: async (filePath) => {
    try {
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
  addAudioMetaData: async (buffer) => buffer,
};
