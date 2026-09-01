// /api/me — the My Church screen, in one round trip.
//
// GET  returns the caller's own profile, the people they're allowed to ring, and —
//      for a provincial leader or the committee director — the roster of churches
//      whose congregation figures add up to the province total.
// PUT  updates the caller's own profile, or their PIN.
// POST is the committee director's only lever: naming a province's leader.
//
// Visibility is decided here, not in the browser. A pastor's response contains
// their leader's number and the director's number and nothing else — the other
// pastors in their province are not in the payload at all, so the app cannot leak
// a contact list it was never sent.
import {
  store,
  currentUser,
  allUsers,
  getUser,
  putUser,
  normalizePhone,
  validPin,
  hashPin,
  pinMatches,
  selfView,
  contactView,
  rosterView,
  congregationTotal,
} from "../shared/auth.mjs";

const MAX_VILLAGES = 200;
const MAX_CONGREGATION = 100000;

function bad(error, status = 400) {
  return Response.json({ error }, { status });
}

function leaderOf(users, provinceId) {
  if (!provinceId) return null;
  return users.find((u) => u.role === "leader" && u.provinceId === provinceId) || null;
}

// Congregation figures summed per province, alongside how many churches they came
// from. A leader comparing 14,200 across 38 churches with their own estimate of
// 20,000 is exactly the comparison this screen exists to make possible.
function tallyByProvince(users) {
  const out = {};
  for (const u of users) {
    if (!u.provinceId) continue;
    const row = out[u.provinceId] || { men: 0, women: 0, children: 0, total: 0, churches: 0 };
    const men = Number(u.congregation?.men) || 0;
    const women = Number(u.congregation?.women) || 0;
    const children = Number(u.congregation?.children) || 0;
    row.men += men;
    row.women += women;
    row.children += children;
    row.total += men + women + children;
    // A profile with no numbers in it yet isn't a church that reported zero.
    if (men + women + children > 0) row.churches += 1;
    out[u.provinceId] = row;
  }
  return out;
}

async function handleGet(s, me) {
  const users = await allUsers(s);
  const director = users.find((u) => u.role === "director") || null;
  const leader = leaderOf(users, me.provinceId);

  const body = {
    me: selfView(me),
    // A leader looking at their own card doesn't need to be told to call themselves.
    leader: leader && leader.phone !== me.phone ? contactView(leader) : null,
    director: director && director.phone !== me.phone ? contactView(director) : null,
    leaderMissing: Boolean(me.provinceId && !leader),
  };

  if (me.role === "leader" || me.role === "director") {
    const scoped =
      me.role === "director" ? users : users.filter((u) => u.provinceId === me.provinceId);
    body.roster = scoped
      .map(rosterView)
      .sort((a, b) => b.congregationTotal - a.congregationTotal || a.name.localeCompare(b.name));
    body.rosterScope = me.role === "director" ? "all" : "province";
    body.tally = tallyByProvince(scoped);
  }

  if (me.role === "director") {
    body.leaders = users.filter((u) => u.role === "leader").map(contactView);
  }

  return Response.json(body);
}

function cleanCongregation(raw) {
  const one = (v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0) return null;
    if (n > MAX_CONGREGATION) return null;
    return n;
  };
  const men = one(raw?.men ?? 0);
  const women = one(raw?.women ?? 0);
  const children = one(raw?.children ?? 0);
  if (men === null || women === null || children === null) return null;
  return { men, women, children };
}

function cleanVillages(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const v of raw) {
    const code = String(v?.code || "").trim().slice(0, 40);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      name: String(v?.name || "").slice(0, 120),
      nameKhmer: String(v?.nameKhmer || "").slice(0, 120),
      communeName: String(v?.communeName || "").slice(0, 120),
    });
    if (out.length >= MAX_VILLAGES) break;
  }
  return out;
}

async function handlePut(s, me, req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }

  // Changing the PIN needs the old one, so a borrowed unlocked phone can't be
  // used to lock the real owner out of their own account.
  if (body.newPin !== undefined) {
    if (!(await pinMatches(body.currentPin, me))) return bad("Current PIN is wrong.", 401);
    if (!validPin(body.newPin)) return bad("Choose a PIN of 4 to 8 numbers.");
    const { salt, hash } = await hashPin(body.newPin);
    me.pinSalt = salt;
    me.pinHash = hash;
    await putUser(s, me);
    return Response.json({ me: selfView(me), pinChanged: true });
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 120);
    if (!name) return bad("Enter your name.");
    me.name = name;
  }
  if (body.provinceId !== undefined) me.provinceId = String(body.provinceId).trim().slice(0, 60);
  if (body.churchName !== undefined) me.churchName = String(body.churchName).trim().slice(0, 160);
  if (body.denomination !== undefined) {
    me.denomination = String(body.denomination).trim().slice(0, 120);
  }
  if (body.congregation !== undefined) {
    const c = cleanCongregation(body.congregation);
    if (!c) return bad("Those congregation numbers don't look right.");
    me.congregation = c;
  }
  if (body.villages !== undefined) me.villages = cleanVillages(body.villages);

  await putUser(s, me);
  return Response.json({ me: selfView(me), congregationTotal: congregationTotal(me.congregation) });
}

async function handlePost(s, me, req) {
  if (me.role !== "director") return bad("Only the committee director can do that.", 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }

  if (body.action !== "setRole") return bad("Unknown action.");

  const role = String(body.role || "");
  // The director role comes from DIRECTOR_PHONE in the Netlify settings and is
  // not handed out from inside the app — otherwise whoever holds it could quietly
  // hand out their own authority, and there'd be no way to take it back.
  if (role !== "pastor" && role !== "leader") return bad("Role must be pastor or leader.");

  const phone = normalizePhone(body.phone);
  const target = phone ? await getUser(s, phone) : null;
  if (!target) return bad("No account with that number.", 404);
  if (target.role === "director") return bad("The director's role can't be changed here.", 403);

  if (role === "leader") {
    if (!target.provinceId) {
      return bad("Set their province before making them provincial leader.");
    }
    // One leader per province: the province total is one number, and two people
    // authorised to overwrite it would quietly overwrite each other.
    const users = await allUsers(s);
    const previous = leaderOf(users, target.provinceId);
    if (previous && previous.phone !== target.phone) {
      previous.role = "pastor";
      await putUser(s, previous);
    }
  }

  target.role = role;
  await putUser(s, target);
  return Response.json({ ok: true, person: contactView(target) });
}

export default async (req) => {
  const s = store();
  const me = await currentUser(s, req);
  if (!me) return bad("Please sign in again.", 401);

  if (req.method === "GET") return handleGet(s, me);
  if (req.method === "PUT") return handlePut(s, me, req);
  if (req.method === "POST") return handlePost(s, me, req);
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/me" };
