// Accounts for Vision 2033.
//
// Sign-in is phone number + PIN. Not email: provincial pastors have phones, often
// shared ones, and frequently no working email address. A PIN they choose is the
// only credential that survives contact with the actual users.
//
// Everything lives in the same Netlify Blobs store as the province reports.
import { getStore } from "@netlify/blobs";
import { randomBytes, scrypt as _scrypt, createHmac, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt);

export const STORE_NAME = "cambodia-tracker";
export const ROLES = ["pastor", "leader", "director"];

// A 4-digit PIN is guessable in 10,000 tries, so the lockout below is doing real
// work — it is the only thing standing between a PIN and a brute force.
const MAX_FAILED = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_MS = 60 * 24 * 3600 * 1000; // 60 days — leaders check in rarely

export function store() {
  return getStore(STORE_NAME);
}

// ---------- phone numbers ----------

// Cambodian mobile numbers are written locally as 012 345 678 / 097 1234 567 and
// internationally as +855 12 345 678. All three are the same person, so everything
// is stored in one canonical form: 855 followed by the 8- or 9-digit subscriber
// number. Without this a pastor who signed up as 012... cannot sign in as +85512...
export function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("855")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  // Reject anything that isn't a plausible Cambodian subscriber number.
  if (d.length < 8 || d.length > 9) return "";
  return "855" + d;
}

// Back to the form Cambodians actually read and dial.
export function displayPhone(canonical) {
  const d = String(canonical || "").replace(/^855/, "");
  if (!d) return "";
  // 012 345 678 for an 8-digit subscriber number, 097 123 4567 for a 9-digit one.
  return "0" + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5);
}

// ---------- PINs ----------

export function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ""));
}

export async function hashPin(pin, salt) {
  const s = salt || randomBytes(16).toString("hex");
  const key = await scrypt(String(pin), s, 32);
  return { salt: s, hash: key.toString("hex") };
}

export async function pinMatches(pin, user) {
  if (!user?.pinHash || !user?.pinSalt) return false;
  const { hash } = await hashPin(pin, user.pinSalt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.pinHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------- session tokens ----------

// The signing secret is generated once and kept in the blob store rather than
// asked of whoever deploys this. A per-instance random secret would look secure
// and then reject tokens at random as Lambda spun up new instances; an env var
// would be one more thing to forget and one more way to lock everyone out.
let cachedSecret = null;

async function secret(s) {
  if (cachedSecret) return cachedSecret;
  const fromEnv = Netlify.env.get("AUTH_SECRET");
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const existing = await s.get("auth:secret", { type: "text" });
  if (existing) {
    cachedSecret = existing;
    return cachedSecret;
  }
  const fresh = randomBytes(32).toString("hex");
  await s.set("auth:secret", fresh);
  cachedSecret = fresh;
  return cachedSecret;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

export async function signToken(s, user) {
  const payload = b64url(
    JSON.stringify({ p: user.phone, r: user.role, e: Date.now() + SESSION_MS })
  );
  const sig = createHmac("sha256", await secret(s)).update(payload).digest("base64url");
  return payload + "." + sig;
}

async function verifyToken(s, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", await secret(s)).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.e !== "number" || payload.e < Date.now()) return null;
  return payload;
}

// Resolves the caller from the Authorization header. The role is re-read from the
// stored account rather than trusted from the token, so a pastor promoted to
// provincial leader gains access on their next request instead of their next
// sign-in — and a demoted one loses it just as fast.
export async function currentUser(s, req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = await verifyToken(s, token);
  if (!payload) return null;
  return await getUser(s, payload.p);
}

// ---------- accounts ----------

export const userKey = (phone) => `user:${phone}`;

export async function getUser(s, phone) {
  if (!phone) return null;
  return await s.get(userKey(phone), { type: "json" });
}

export async function putUser(s, user) {
  user.updatedAt = new Date().toISOString();
  await s.setJSON(userKey(user.phone), user);
  return user;
}

export async function allUsers(s) {
  const { blobs } = await s.list({ prefix: "user:" });
  const out = [];
  for (const b of blobs) {
    const u = await s.get(b.key, { type: "json" });
    if (u) out.push(u);
  }
  return out;
}

export function lockedFor(user) {
  if (!user?.lockedUntil) return 0;
  return Math.max(0, new Date(user.lockedUntil).getTime() - Date.now());
}

export async function noteFailedPin(s, user) {
  user.failedPins = (user.failedPins || 0) + 1;
  if (user.failedPins >= MAX_FAILED) {
    user.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
    user.failedPins = 0;
  }
  await putUser(s, user);
}

export async function clearFailedPin(s, user) {
  if (!user.failedPins && !user.lockedUntil) return;
  delete user.failedPins;
  delete user.lockedUntil;
  await putUser(s, user);
}

// ---------- shaping ----------

export function congregationTotal(c) {
  if (!c) return 0;
  return (Number(c.men) || 0) + (Number(c.women) || 0) + (Number(c.children) || 0);
}

// The caller's own record, PIN material stripped.
export function selfView(u) {
  if (!u) return null;
  return {
    phone: u.phone,
    phoneDisplay: displayPhone(u.phone),
    name: u.name || "",
    role: u.role || "pastor",
    provinceId: u.provinceId || "",
    churchName: u.churchName || "",
    denomination: u.denomination || "",
    congregation: {
      men: Number(u.congregation?.men) || 0,
      women: Number(u.congregation?.women) || 0,
      children: Number(u.congregation?.children) || 0,
    },
    congregationTotal: congregationTotal(u.congregation),
    villages: Array.isArray(u.villages) ? u.villages : [],
    createdAt: u.createdAt || "",
    updatedAt: u.updatedAt || "",
  };
}

// A contact card: name, role and a number to ring. Deliberately not the whole
// record — a pastor needs to reach their leader, not read their congregation.
export function contactView(u) {
  if (!u) return null;
  return {
    name: u.name || "",
    role: u.role || "pastor",
    phone: u.phone,
    phoneDisplay: displayPhone(u.phone),
    provinceId: u.provinceId || "",
    churchName: u.churchName || "",
  };
}

// A row in a provincial leader's roster. Includes the congregation split, which
// is the whole point of the roster: it is what the province total is built from.
export function rosterView(u) {
  return {
    phone: u.phone,
    phoneDisplay: displayPhone(u.phone),
    name: u.name || "",
    role: u.role || "pastor",
    churchName: u.churchName || "",
    denomination: u.denomination || "",
    provinceId: u.provinceId || "",
    congregation: {
      men: Number(u.congregation?.men) || 0,
      women: Number(u.congregation?.women) || 0,
      children: Number(u.congregation?.children) || 0,
    },
    congregationTotal: congregationTotal(u.congregation),
    villages: Array.isArray(u.villages) ? u.villages : [],
    updatedAt: u.updatedAt || "",
  };
}

export function joinCode() {
  return Netlify.env.get("ENTRY_PASSCODE") || "vision2033";
}

// The one account that cannot be created by signing up with the right code: the
// committee director is whoever holds this number, set in the Netlify dashboard.
export function directorPhone() {
  return normalizePhone(Netlify.env.get("DIRECTOR_PHONE") || "");
}
