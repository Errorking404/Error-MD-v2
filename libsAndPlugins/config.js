const path = require("path");
const fs = require("fs");

let settings = {};
try {
  settings = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../settings.json"), "utf8")
  );
} catch {}

module.exports = {
  HANDLERS: settings.prefix || ".",
  BRANCH: process.env.BRANCH || "main",
  LANG: "en",
  PRIVATE: (settings.mode || "public").toLowerCase() === "private",
  WARN_COUNT: 3,
  HEROKU: {
    API_KEY: process.env.HEROKU_API_KEY || "",
    APP_NAME: process.env.HEROKU_APP_NAME || "",
    HEROKU: Boolean(process.env.HEROKU_API_KEY && process.env.HEROKU_APP_NAME),
  },
  REMOVEBG: process.env.REMOVEBG_KEY || "oTVGrLfgziwrkLAWETfbFrGp",
  DATABASE: {
    define: async () => ({ map: () => [], dataValues: {} }),
    findAll: async () => [],
    create: async () => ({ update: async () => ({}) }),
    update: async () => ({}),
    destroy: async () => ({}),
    DataTypes: { STRING: "STRING", TEXT: "TEXT", BOOLEAN: "BOOLEAN" },
  },
};
