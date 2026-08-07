import { getStore } from "@netlify/blobs";

const STORE_NAME = "cambodia-tracker";
const DEFAULT_PASSCODE = "ywam2033";
const MAX_HISTORY_PER_PROVINCE = 500;
const MAX_NATIONAL_HISTORY = 1000;

function store() {
  return getStore(STORE_NAME);
}

function getPasscode() {
  return Netlify.env.get("ENTRY_PASSCODE") || DEFAULT_PASSCODE;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function handleGet(s) {
  const { blobs } = await s.list({ prefix: "province:" });
  const provinces = await Promise.all(
    blobs.map(async (b) => {
      const data = await s.get(b.key, { type: "json" });
      return { id: b.key.slice("province:".length), name: data?.name || "", history: data?.history || [] };
    })
  );
  const nationalHistory = (await s.get("national-history", { type: "json" })) || [];
  return Response.json({ provinces, nationalHistory });
}

async function recomputeNationalSnapshot(s, entryDate, submittedAt) {
  const { blobs } = await s.list({ prefix: "province:" });
  let totalPop = 0,
    totalChristians = 0,
    totalVillages = 0,
    totalVillagesWithChurches = 0,
    reporting = 0;

  for (const b of blobs) {
    const data = await s.get(b.key, { type: "json" });
    const latest = data?.history?.[0];
    if (latest) {
      reporting += 1;
      totalPop += latest.population || 0;
      totalChristians += latest.sundayAttendance || 0;
      totalVillages += latest.totalVillages || 0;
      totalVillagesWithChurches += latest.villagesWithChurches || 0;
    }
  }

  const snapshot = {
    date: entryDate,
    submittedAt,
    totalPopulation: totalPop,
    totalChristians,
    totalVillages,
    totalVillagesWithChurches,
    reportingProvinces: reporting,
    percentChristian: totalPop > 0 ? (totalChristians / totalPop) * 100 : 0,
  };

  const nationalHistory = (await s.get("national-history", { type: "json" })) || [];
  nationalHistory.push(snapshot);
  await s.setJSON("national-history", nationalHistory.slice(-MAX_NATIONAL_HISTORY));
  return snapshot;
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

  const population = toNumber(body.population);
  const totalVillages = toNumber(body.totalVillages);
  const villagesWithChurches = toNumber(body.villagesWithChurches);
  const sundayAttendance = toNumber(body.sundayAttendance);

  if (population < 0 || totalVillages < 0 || villagesWithChurches < 0 || sundayAttendance < 0) {
    return Response.json({ error: "Numbers can't be negative." }, { status: 400 });
  }
  if (villagesWithChurches > totalVillages) {
    return Response.json({ error: "Villages with a church can't exceed total villages." }, { status: 400 });
  }
  if (sundayAttendance > population) {
    return Response.json({ error: "Sunday attendance can't exceed total population." }, { status: 400 });
  }

  const entry = {
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    enteredBy: String(body.enteredBy || "").slice(0, 200),
    population,
    totalVillages,
    villagesWithChurches,
    sundayAttendance,
    churches: toNullableNumber(body.churches),
    baptisms: toNullableNumber(body.baptisms),
    newBelievers: toNullableNumber(body.newBelievers),
    smallGroups: toNullableNumber(body.smallGroups),
    trainedLeaders: toNullableNumber(body.trainedLeaders),
    notes: String(body.notes || "").slice(0, 2000),
    submittedAt: String(body.submittedAt || new Date().toISOString()),
  };

  const key = `province:${provinceId}`;
  const existing = (await s.get(key, { type: "json" })) || { name: provinceName, history: [] };
  existing.name = provinceName;
  existing.history = [entry, ...existing.history].slice(0, MAX_HISTORY_PER_PROVINCE);
  await s.setJSON(key, existing);

  const snapshot = await recomputeNationalSnapshot(s, entry.date, entry.submittedAt);

  return Response.json({ ok: true, entry, snapshot });
}

export default async (req, context) => {
  const s = store();
  if (req.method === "GET") return handleGet(s);
  if (req.method === "POST") return handlePost(s, req);
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/entries" };
