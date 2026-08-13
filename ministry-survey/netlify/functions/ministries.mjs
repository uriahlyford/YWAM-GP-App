import { getStore } from "@netlify/blobs";

const STORE_NAME = "ywam-ministry-survey";
const DEFAULT_PASSCODE = "ywam2026";

// A regional leader reports for a handful of provinces with a few ministries in
// each. These caps are far above any real report and exist only so a bug or a
// bored visitor can't fill the store.
const MAX_MINISTRIES = 60;
const MAX_SCHOOLS = 15;
const MAX_TEXT = 400;
const MAX_LONG_TEXT = 2000;
const MAX_COUNT = 1_000_000;

const PROVINCE_IDS = new Set([
  "banteay-meanchey", "battambang", "kampong-cham", "kampong-chhnang",
  "kampong-speu", "kampong-thom", "kampot", "kandal", "kep", "koh-kong",
  "kratie", "mondulkiri", "oddar-meanchey", "pailin", "phnom-penh",
  "preah-sihanouk", "preah-vihear", "prey-veng", "pursat", "ratanakiri",
  "siem-reap", "stung-treng", "svay-rieng", "takeo", "tboung-khmum",
]);

const MINISTRY_TYPE_IDS = new Set([
  "sports", "english", "education", "children", "youth", "training",
  "church-planting", "village-outreach", "media-arts", "music", "health",
  "vocational", "business", "agriculture", "community", "justice", "mercy",
  "prayer", "other",
]);

const SCHOOL_TYPE_IDS = new Set([
  "dts", "sbs", "leadership", "evangelism", "children-ministry", "vocational",
  "english-course", "other",
]);

// Counts collected as of today, whatever the reporting year.
const CURRENT_COUNTS = [
  "staffTotal", "staffCambodian", "staffInternational", "staffFullTime",
  "staffVolunteer", "youthDaily", "peopleWeekly", "currentStudents",
  "villagesReached", "churchesServed", "churchesLed",
];

// Counts that belong to the reporting year.
const YEAR_COUNTS = [
  "churchesPlanted", "newBelievers", "baptisms", "outreachTeams", "teamsHosted",
];

const SHORT_TEXTS = ["name", "leaderName", "town", "typeOther"];
const LONG_TEXTS = ["villageNames", "biggestNeed", "prayerRequest"];

function store() {
  return getStore(STORE_NAME);
}

function getPasscode() {
  return Netlify.env.get("SURVEY_PASSCODE") || DEFAULT_PASSCODE;
}

function text(v, max) {
  return String(v === undefined || v === null ? "" : v).slice(0, max).trim();
}

function count(v) {
  if (v === "" || v === undefined || v === null) return "";
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0) return "";
  return Math.round(Math.min(x, MAX_COUNT));
}

function cleanSchool(raw) {
  const typeId = SCHOOL_TYPE_IDS.has(raw?.typeId) ? raw.typeId : "";
  return {
    typeId,
    name: text(raw?.name, MAX_TEXT),
    students: count(raw?.students),
    cambodianStudents: count(raw?.cambodianStudents),
    graduates: count(raw?.graduates),
  };
}

function cleanMinistry(raw) {
  if (!raw || typeof raw !== "object") return null;

  const provinceId = PROVINCE_IDS.has(raw.provinceId) ? raw.provinceId : "";
  const name = text(raw.name, MAX_TEXT);
  const leaderName = text(raw.leaderName, MAX_TEXT);
  // Without these three the row can't be counted or followed up, so it isn't
  // stored at all rather than stored as a blank.
  if (!provinceId || !name || !leaderName) return null;

  const out = {
    provinceId,
    name,
    leaderName,
    placement: raw.placement === "campus" || raw.placement === "offsite" ? raw.placement : "",
    startedYear: count(raw.startedYear),
    types: Array.isArray(raw.types)
      ? [...new Set(raw.types.filter((t) => MINISTRY_TYPE_IDS.has(t)))]
      : [],
    schools: Array.isArray(raw.schools)
      ? raw.schools.slice(0, MAX_SCHOOLS).map(cleanSchool).filter((s) => s.typeId || s.name || s.students !== "")
      : [],
  };

  for (const key of SHORT_TEXTS) {
    if (key === "name" || key === "leaderName") continue;
    out[key] = text(raw[key], MAX_TEXT);
  }
  for (const key of LONG_TEXTS) out[key] = text(raw[key], MAX_LONG_TEXT);
  for (const key of CURRENT_COUNTS) out[key] = count(raw[key]);
  for (const key of YEAR_COUNTS) out[key] = count(raw[key]);

  return out;
}

// The leader's own name is the identity of the report, so sending a second time
// replaces the first rather than double-counting every ministry in it.
function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function handleGet(s, req) {
  const url = new URL(req.url);
  // Anyone with the link can read the totals. Contact details are the one thing
  // held back — they only come through with the team passcode.
  const trusted = url.searchParams.get("passcode") === getPasscode();

  const { blobs } = await s.list({ prefix: "report:" });
  const reports = await Promise.all(
    blobs.map(async (b) => {
      const data = await s.get(b.key, { type: "json" });
      if (!data) return null;
      if (trusted) return data;
      const { leaderContact, ...open } = data;
      return open;
    })
  );

  return Response.json(
    { reports: reports.filter(Boolean), trusted },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handlePost(s, req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.passcode !== getPasscode()) {
    return Response.json({ error: "Incorrect team passcode." }, { status: 401 });
  }

  const raw = body.report || {};
  const leaderName = text(raw.leaderName, MAX_TEXT);
  if (!leaderName) {
    return Response.json({ error: "Missing the name of the leader reporting." }, { status: 400 });
  }

  const ministries = (Array.isArray(raw.ministries) ? raw.ministries : [])
    .slice(0, MAX_MINISTRIES)
    .map(cleanMinistry)
    .filter(Boolean);

  if (!ministries.length) {
    return Response.json(
      { error: "Every ministry needs a name, a leader and a province." },
      { status: 400 }
    );
  }

  const key = `report:${slug(leaderName) || "unnamed"}`;
  const existing = await s.get(key, { type: "json" });

  const report = {
    leaderName,
    leaderRole: text(raw.leaderRole, MAX_TEXT),
    leaderContact: text(raw.leaderContact, MAX_TEXT),
    notes: text(raw.notes, MAX_LONG_TEXT),
    ministries,
    firstSubmittedAt: existing?.firstSubmittedAt || new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  };

  await s.setJSON(key, report);

  return Response.json({ ok: true, ministries: ministries.length, replaced: Boolean(existing) });
}

export default async (req) => {
  const s = store();
  if (req.method === "GET") return handleGet(s, req);
  if (req.method === "POST") return handlePost(s, req);
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/ministries" };
