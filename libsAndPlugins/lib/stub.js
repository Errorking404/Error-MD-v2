module.exports = class Stub {
  constructor() {}
  async get() { return { data: {} }; }
  async patch() {}
  async delete() {}
  async download() {}
  async convert() {}
};
