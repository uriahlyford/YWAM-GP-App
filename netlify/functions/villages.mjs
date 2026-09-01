import { getStore } from "@netlify/blobs";
import { currentUser, joinCode } from "../shared/auth.mjs";

const STORE_NAME = "cambodia-tracker";

function store() {
  return getStore(STORE_NAME);
}

// A signed-in account or the shared code — see the same note in entries.mjs.
// Any signed-in account may tick villages: recording that a village has a church
// is local knowledge every pastor has, unlike the province total.
async function authorize(s, req, body) {
  const me = await currentUser(s, req);
  if (me) return { ok: true, by: me };
  if (body.passcode === joinCode()) return { ok: true, by: null };
  return { ok: false };
}

async function handleGet(s, req) {
  const url = new URL(req.url);

  // ?summary=1 — one call returning marked-village counts for every province, so the
  // registry picker doesn't have to make 25 separate requests.
  if (url.searchParams.get("summary")) {
    const { blobs } = await s.list({ prefix: "village-status:" });
    const counts = {};
    for (const b of blobs) {
      const provinceId = b.key.slice("village-status:".length);
      const statuses = (await s.get(b.key, { type: "json" })) || {};
      counts[provinceId] = Object.keys(statuses).filter((code) => statuses[code]?.hasChurch).length;
    }
    return Response.json({ counts });
  }

  const provinceId = url.searchParams.get("province");
  if (!provinceId) {
    return Response.json({ error: "Missing province." }, { status: 400 });
  }
  const statuses = (await s.get(`village-status:${provinceId}`, { type: "json" })) || {};
  return Response.json({ statuses });
}

async function handlePost(s, req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const auth = await authorize(s, req, body);
  if (!auth.ok) {
    return Response.json({ error: "Incorrect team passcode." }, { status: 401 });
  }
  const updatedBy = (auth.by?.name || String(body.updatedBy || "")).slice(0, 200);

  const provinceId = String(body.provinceId || "").trim();
  if (!provinceId) {
    return Response.json({ error: "Missing province." }, { status: 400 });
  }

  const key = `village-status:${provinceId}`;
  const statuses = (await s.get(key, { type: "json" })) || {};

  // Bulk confirm — used when a pastor accepts a batch of directory-sourced entries at once,
  // rather than firing one request per village.
  if (Array.isArray(body.entries)) {
    if (body.entries.length > 5000) {
      return Response.json({ error: "Too many entries in one request." }, { status: 400 });
    }
    let written = 0;
    for (const e of body.entries) {
      const code = String(e?.villageCode || "").trim();
      if (!code) continue;
      statuses[code] = {
        hasChurch: Boolean(e.hasChurch),
        note: String(e.note || "").slice(0, 300),
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString(),
      };
      written++;
    }
    await s.setJSON(key, statuses);
    return Response.json({ ok: true, written });
  }

  const villageCode = String(body.villageCode || "").trim();
  if (!villageCode) {
    return Response.json({ error: "Missing village." }, { status: 400 });
  }

  const hasChurch = Boolean(body.hasChurch);
  const note = String(body.note || "").slice(0, 300);

  if (!hasChurch && !note) {
    delete statuses[villageCode];
  } else {
    statuses[villageCode] = {
      hasChurch,
      note,
      updatedBy: updatedBy,
      updatedAt: new Date().toISOString(),
    };
  }

  await s.setJSON(key, statuses);
  return Response.json({ ok: true, status: statuses[villageCode] || null });
}

export default async (req) => {
  const s = store();
  if (req.method === "GET") return handleGet(s, req);
  if (req.method === "POST") return handlePost(s, req);
  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/villages" };
