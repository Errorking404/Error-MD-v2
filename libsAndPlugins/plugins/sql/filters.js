const fs = require("fs");
const path = require("path");

const filterFile = path.join(__dirname, "../../../data/filters.json");

function loadFilters() {
  try {
    if (fs.existsSync(filterFile)) {
      return JSON.parse(fs.readFileSync(filterFile, "utf8"));
    }
  } catch {}
  return {};
}

function saveFilters(data) {
  const dir = path.dirname(filterFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filterFile, JSON.stringify(data, null, 2));
}

function wrapEntry(entry) {
  return { dataValues: entry, update: async (patch) => Object.assign(entry, patch) };
}

async function getFilter(jid = null) {
  const data = loadFilters();
  const items = data[jid] || [];
  if (!items.length) return false;
  return items.map(wrapEntry);
}

async function setFilter(jid = null, pattern = null, text = null, regex = false) {
  const data = loadFilters();
  if (!data[jid]) data[jid] = [];
  const idx = data[jid].findIndex((f) => f.pattern === pattern);
  const entry = { chat: jid, pattern, text, regex };
  if (idx === -1) data[jid].push(entry);
  else data[jid][idx] = entry;
  saveFilters(data);
  return wrapEntry(entry);
}

async function deleteFilter(jid = null, pattern) {
  const data = loadFilters();
  if (!data[jid]) return false;
  const idx = data[jid].findIndex((f) => f.pattern === pattern);
  if (idx === -1) return false;
  data[jid].splice(idx, 1);
  saveFilters(data);
  return true;
}

module.exports = {
  FiltersDB: { findAll: getFilter, create: setFilter },
  getFilter,
  setFilter,
  deleteFilter,
};
