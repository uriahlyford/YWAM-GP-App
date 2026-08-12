import { getStore } from "@netlify/blobs";

const STORE_NAME = "cambodia-tracker";
const DEFAULT_PASSCODE = "vision2033";
const MAX_HISTORY_PER_PROVINCE = 200;

// Cambodia's population is ~17.4M; anything above this is a typo, not a report.
const MAX_CHRISTIANS = 20_000_000;

// Official village count per province, from the NCDD gazetteer. Mirrors
// referenceVillages in public/provinces.js — kept here so the server can reject a
// village figure that exceeds what the province actually has, rather than trusting
// the browser to have done it. 14,372 total.
const VILLAGE_COUNTS = {
  "banteay-meanchey": 652,
  battambang: 810,
  "kampong-cham": 916,
  "kampong-chhnang": 569,
  "kampong-speu": 1363,
  "kampong-thom": 765,
  kampot: 488,
  kandal: 1010,
  kep: 18,
  "koh-kong": 119,
  kratie: 258,
  mondulkiri: 92,
  "oddar-meanchey": 304,
  pailin: 90,
  "phnom-penh": 953,
  "preah-sihanouk": 111,
  "preah-vihear": 232,
  "prey-veng": 1149,
  pursat: 511,
  ratanakiri: 243,
  "siem-reap": 909,
  "stung-treng": 128,
  "svay-rieng": 690,
  takeo: 1119,
  "tboung-khmum": 873,
};

function store() {
  return getStore(STORE_NAME);
}

function getPasscode() {
  return Netlify.env.get("ENTRY_PASSCODE") || DEFAULT_PASSCODE;
}

async function handleGet(s) {
  const { blobs } = await s.list({ prefix: "province:" });
  const provinces = await Promise.all(
    blobs.map(async (b) => {
      const data = await s.get(b.key, { type: "json" });
      return {
        id: b.key.slice("province:".length),
        name: data?.name || "",
        history: data?.history || [],
      };
    })
  );
  return Response.json({ provinces });
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

  const provinceId = String(body.provinceId || "").trim();
  const provinceName = String(body.provinceName || "").trim();
  if (!provinceId || !provinceName) {
    return Response.json({ error: "Missing province." }, { status: 400 });
  }

  const christians = Number(body.christians);
  if (!Number.isFinite(christians) || christians < 0 || christians > MAX_CHRISTIANS) {
    return Response.json({ error: "That number doesn't look right." }, { status: 400 });
  }

  const villagesWithChurches = Number(body.villagesWithChurches);
  const villageMax = VILLAGE_COUNTS[provinceId];
  if (!Number.isFinite(villagesWithChurches) || villagesWithChurches < 0) {
    return Response.json({ error: "That village number doesn't look right." }, { status: 400 });
  }
  if (villageMax !== undefined && villagesWithChurches > villageMax) {
    return Response.json(
      { error: `That province has ${villageMax} villages.` },
      { status: 400 }
    );
  }

  const confidence = Number(body.confidence);
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 10) {
    return Response.json({ error: "Confidence must be between 1 and 10." }, { status: 400 });
  }

  const entry = {
    christians: Math.round(christians),
    villagesWithChurches: Math.round(villagesWithChurches),
    confidence,
    enteredBy: String(body.enteredBy || "").slice(0, 200),
    date: new Date().toISOString().slice(0, 10),
    submittedAt: new Date().toISOString(),
  };

  const key = `province:${provinceId}`;
  const existing = (await s.get(key, { type: "json" })) || { name: provinceName, history: [] };
  existing.name = provinceName;
  // Newest first — the app reads history[0] as the province's current number.
  existing.history = [entry, ...(existing.history || [])].slice(0, MAX_HISTORY_PER_PROVINCE);
  await s.setJSON(key, existing);

  return Response.json({ ok: true, entry });
}

export default async (req) => {
  const s = store();
  if (req.method === "GET") return handleGet(s);
  if (req.method === "POST") return handlePost(s, req);
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/entries" };
