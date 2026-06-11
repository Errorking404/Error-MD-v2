function formatTemplate(template, args = []) {
  let out = String(template ?? "");
  for (const arg of args) {
    out = out.replace(/\{\}/, String(arg));
  }
  return out;
}

function createValue(label = "") {
  const target = {
    label,
    format: (...args) => formatTemplate(label, args),
    toString: () => label,
    valueOf: () => label,
    [Symbol.toPrimitive]: () => label,
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return createValue(`${label}.${String(prop)}`);
    },
  });
}

function createStubFunction() {
  const fn = async () => undefined;
  return new Proxy(fn, {
    apply() {
      return Promise.resolve(undefined);
    },
    get(target, prop) {
      if (prop === "toString") return () => "[stub]";
      if (prop === Symbol.toPrimitive) return () => "[stub]";
      if (prop === "format") return (...args) => formatTemplate("", args);
      if (prop === "then") return undefined;
      return createValue(String(prop));
    },
  });
}

const stub = createStubFunction();

module.exports = new Proxy(stub, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return createStubFunction();
  },
});

module.exports.createValue = createValue;
