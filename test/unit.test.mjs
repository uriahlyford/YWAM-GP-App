// Exercise the auth primitives against a fake blob store.
globalThis.Netlify = { env: { get: (k) => process.env[k] } };

const A = await import("../netlify/shared/auth.mjs");

const mem = new Map();
const s = {
  get: async (k, o) => (mem.has(k) ? (o?.type === "json" ? JSON.parse(mem.get(k)) : mem.get(k)) : null),
  set: async (k, v) => void mem.set(k, v),
  setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)),
  list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
};

let fails = 0;
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; };

// --- phone normalization: every way a Cambodian number gets written ---
const forms = ["012345678", "012 345 678", "+855 12 345 678", "85512345678", "+85512345678", "00855 12 345 678", "(012) 345-678"];
const norm = forms.map(A.normalizePhone);
ok("all seven spellings of one number collapse to the same key", new Set(norm).size === 1 && norm[0] === "85512345678");
ok("9-digit number works", A.normalizePhone("097 1234 567") === "855971234567");
ok("too short rejected", A.normalizePhone("01234") === "");
ok("too long rejected", A.normalizePhone("0123456789012") === "");
ok("empty rejected", A.normalizePhone("") === "" && A.normalizePhone(null) === "");
ok("display is dialable", A.displayPhone("85512345678") === "012 345 678");
ok("director phone read from env", A.directorPhone() === "85512111222");
ok("join code from env beats fallback", A.joinCode() === "cambodia2033");

// --- PINs ---
ok("4 digits ok", A.validPin("1234"));
ok("8 digits ok", A.validPin("12345678"));
ok("3 digits rejected", !A.validPin("123"));
ok("9 digits rejected", !A.validPin("123456789"));
ok("letters rejected", !A.validPin("12a4") && !A.validPin("abcd"));

const h = await A.hashPin("1234");
const u = { phone: "85512345678", name: "Pastor Sok Dara", role: "pastor", pinSalt: h.salt, pinHash: h.hash };
ok("correct PIN matches", await A.pinMatches("1234", u));
ok("wrong PIN rejected", !(await A.pinMatches("1235", u)));
ok("PIN is salted (same pin, different hash)", (await A.hashPin("1234")).hash !== h.hash);
ok("no PIN set never matches", !(await A.pinMatches("1234", { phone: "x" })));

// --- tokens ---
await A.putUser(s, u);
const token = await A.signToken(s, u);
const req = (t) => ({ headers: { get: (k) => (k.toLowerCase() === "authorization" && t ? "Bearer " + t : "") } });
ok("valid token resolves the user", (await A.currentUser(s, req(token)))?.phone === u.phone);
ok("no header -> null", (await A.currentUser(s, req(null))) === null);
ok("garbage token -> null", (await A.currentUser(s, req("nonsense"))) === null);

// Tamper with the payload but keep the signature.
const [p, sig] = token.split(".");
const forgedPayload = Buffer.from(JSON.stringify({ p: "855999999999", r: "director", e: Date.now() + 1e9 })).toString("base64url");
ok("re-signed payload with old signature -> null", (await A.currentUser(s, req(forgedPayload + "." + sig))) === null);
ok("flipped signature -> null", (await A.currentUser(s, req(p + "." + sig.slice(0, -2) + "AA"))) === null);

// Expiry: forge a payload that IS correctly signed but expired, using the stored secret.
const { createHmac } = await import("node:crypto");
const secret = await s.get("auth:secret", { type: "text" });
const expiredPayload = Buffer.from(JSON.stringify({ p: u.phone, r: "pastor", e: Date.now() - 1000 })).toString("base64url");
const expiredSig = createHmac("sha256", secret).update(expiredPayload).digest("base64url");
ok("correctly signed but expired -> null", (await A.currentUser(s, req(expiredPayload + "." + expiredSig))) === null);

// Role escalation must not survive in the token: role comes from storage.
const roleForged = Buffer.from(JSON.stringify({ p: u.phone, r: "director", e: Date.now() + 1e9 })).toString("base64url");
const roleSig = createHmac("sha256", secret).update(roleForged).digest("base64url");
const resolved = await A.currentUser(s, req(roleForged + "." + roleSig));
ok("role in token is ignored, storage wins", resolved?.role === "pastor");

// --- lockout ---
let v = { ...u };
for (let i = 0; i < 7; i++) await A.noteFailedPin(s, v);
ok("7 wrong PINs: not locked", A.lockedFor(v) === 0);
await A.noteFailedPin(s, v);
ok("8 wrong PINs: locked", A.lockedFor(v) > 14 * 60 * 1000);
await A.clearFailedPin(s, v);
ok("successful sign-in clears the lock", A.lockedFor(v) === 0);

// --- shaping: PIN material must never leave the server ---
const full = { ...u, congregation: { men: 40, women: 55, children: 30 }, villages: [{ code: "1", name: "Thmei" }], provinceId: "kampot" };
const self = A.selfView(full);
ok("selfView carries no pinHash/pinSalt", !("pinHash" in self) && !("pinSalt" in self));
ok("congregation total = men+women+children", self.congregationTotal === 125);
const contact = A.contactView(full);
ok("contactView has a number but no congregation", contact.phone === u.phone && !("congregation" in contact));
ok("contactView carries no pinHash", !("pinHash" in contact));
ok("rosterView carries congregation split", A.rosterView(full).congregation.women === 55);
ok("rosterView carries no pinHash", !("pinHash" in A.rosterView(full)));
ok("congregationTotal tolerates junk", A.congregationTotal(null) === 0 && A.congregationTotal({ men: "x" }) === 0);

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
