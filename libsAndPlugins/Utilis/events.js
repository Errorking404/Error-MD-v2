const { EventEmitter } = require("events");

const bus = new EventEmitter();
const commands = [];

function addCommand(meta = {}, handler = async () => {}) {
  commands.push({ ...meta, handler });
  return handler;
}

module.exports = {
  commands,
  addCommand,
  on: bus.on.bind(bus),
  once: bus.once.bind(bus),
  off: bus.off.bind(bus),
  emit: bus.emit.bind(bus),
};
