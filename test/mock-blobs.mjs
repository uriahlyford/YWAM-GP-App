// Stand-in for @netlify/blobs: one in-memory store, same surface the functions use.
const stores = new Map();
export function getStore(name) {
  const key = typeof name === "string" ? name : name?.name || "default";
  if (!stores.has(key)) stores.set(key, new Map());
  const mem = stores.get(key);
  return {
    async get(k, o) {
      if (!mem.has(k)) return null;
      const raw = mem.get(k);
      return o?.type === "json" ? JSON.parse(raw) : raw;
    },
    async set(k, v) { mem.set(k, String(v)); },
    async setJSON(k, v) { mem.set(k, JSON.stringify(v)); },
    async delete(k) { mem.delete(k); },
    async list({ prefix = "" } = {}) {
      return { blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}
export const _stores = stores;
