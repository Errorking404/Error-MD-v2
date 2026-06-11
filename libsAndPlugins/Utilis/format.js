function formatTemplate(template, args = []) {
  let out = String(template ?? "");
  for (const arg of args) {
    out = out.replace(/\{\}/, String(arg));
  }
  return out;
}

function createLangValue(label) {
  return new Proxy(
    {
      format: (...args) => formatTemplate(label, args),
      toString: () => label,
      valueOf: () => label,
      [Symbol.toPrimitive]: () => label,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return createLangValue(`${label}.${String(prop)}`);
      },
    }
  );
}

module.exports = { formatTemplate, createLangValue };
