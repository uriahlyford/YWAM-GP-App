import { getStore } from "@netlify/blobs";

const STORE_NAME = "cambodia-tracker";
const DEFAULT_PASSCODE = "ywam2033";
const MAX_HISTORY_PER_PROVINCE = 200;

// Cambodia's population is ~17.4M; anything above this is a typo, not a report.
const MAX_CHRISTIANS = 20_000_000;

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

  const confidence = Number(body.confidence);
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 10) {
    return Response.json({ error: "Confidence must be between 1 and 10." }, { status: 400 });
  }

  const entry = {
    christians: Math.round(christians),
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
