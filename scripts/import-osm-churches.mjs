#!/usr/bin/env node
/**
 * Import Christian places of worship in Cambodia from OpenStreetMap, and place them at
 * individual villages in the Village Registry.
 *
 * WHY OPENSTREETMAP AND NOT GOOGLE MAPS
 *
 * Google Maps Platform's terms specifically prohibit the thing this app would need to do.
 * Section 3.2.3(b) forbids customers from "pre-fetch, index, store, resharing or rehosting
 * Google Maps Content", and names "copy and save business names, addresses" explicitly. Only
 * the opaque place_id may be stored indefinitely; coordinates may be cached for at most 30
 * days. Building a permanent church-counts.js out of Google Places data and shipping it in a
 * public app is therefore not something the licence allows — regardless of how good the data
 * is or how good the cause is.
 *
 * OpenStreetMap is licensed ODbL: free to bulk download, store and redistribute, with two
 * obligations this project can meet easily — attribute OpenStreetMap contributors, and if you
 * publish a derived *database* keep it under ODbL. Overpass is free and needs no API key. OSM
 * also carries Khmer names (name:km), which matter here: matching Khmer place names against
 * the NCDD gazetteer is far more reliable than matching Latin transliterations, where the same
 * village is spelled three different ways.
 *
 * USAGE — needs a normal internet connection (this build environment has Overpass blocked):
 *
 *   node scripts/import-osm-churches.mjs fetch     # download churches + villages from Overpass
 *   node scripts/import-osm-churches.mjs match     # show what it matched, writes nothing
 *   node scripts/import-osm-churches.mjs match --write
 *
 * `--write` merges into public/data/church-counts.js alongside anything imported from
 * cambodiachurches.org rather than replacing it, so the two sources combine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VILLAGE_DIR = path.join(ROOT, "public", "data", "villages");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache", "osm");
const OUT_FILE = path.join(ROOT, "public", "data", "church-counts.js");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const MAX_MATCH_KM = 4; // a church further than this from any known settlement is left unplaced

/**
 * ISO 3166-2:KH codes. Used as the primary way to find a province boundary in OSM.
 *
 * Name matching is fragile here: the gazetteer stores "កំពត" while OSM tags the boundary
 * "ខេត្តកំពត" (literally "Kampot Province"), so an exact name match returns nothing for every
 * province — a silent, total failure after a slow crawl. ISO codes are stable and OSM tags
 * them on admin_level=4 boundaries, so they are tried first and names only as a fallback.
 */
const ISO = {
  "banteay-meanchey": "KH-1", battambang: "KH-2", "kampong-cham": "KH-3",
  "kampong-chhnang": "KH-4", "kampong-speu": "KH-5", "kampong-thom": "KH-6",
  kampot: "KH-7", kandal: "KH-8", "koh-kong": "KH-9", kratie: "KH-10",
  mondulkiri: "KH-11", "phnom-penh": "KH-12", "preah-vihear": "KH-13",
  "prey-veng": "KH-14", pursat: "KH-15", ratanakiri: "KH-16", "siem-reap": "KH-17",
  "preah-sihanouk": "KH-18", "stung-treng": "KH-19", "svay-rieng": "KH-20",
  takeo: "KH-21", "oddar-meanchey": "KH-22", kep: "KH-23", pailin: "KH-24",
  "tboung-khmum": "KH-25",
};

const CHURCH_AND_PLACES = `
(
  node["amenity"="place_of_worship"]["religion"="christian"](area.p);
  way["amenity"="place_of_worship"]["religion"="christian"](area.p);
  relation["amenity"="place_of_worship"]["religion"="christian"](area.p);
  node["place"~"^(village|hamlet|town|suburb|neighbourhood|isolated_dwelling)$"](area.p);
);
out center tags;`;

/** Every way we know of to select one province's boundary, best first. */
function areaStrategies(id, gaz) {
  const out = [];
  if (ISO[id]) out.push({ how: `ISO ${ISO[id]}`, sel: `area["ISO3166-2"="${ISO[id]}"]` });
  if (gaz.khmer) {
    // Both the bare name and the ខេត្ត- ("province") prefixed form OSM actually uses.
    out.push({ how: `km "ខេត្ត${gaz.khmer}"`, sel: `area["admin_level"="4"]["name"="ខេត្ត${gaz.khmer}"]` });
    out.push({ how: `km "${gaz.khmer}"`, sel: `area["admin_level"="4"]["name"="${gaz.khmer}"]` });
    out.push({ how: `km regex`, sel: `area["admin_level"="4"]["name"~"${gaz.khmer}"]` });
  }
  if (gaz.latin) {
    out.push({ how: `en "${gaz.latin}"`, sel: `area["admin_level"="4"]["name:en"~"^${gaz.latin}",i]` });
  }
  return out;
}

function provinceQuery(selector) {
  return `
[out:json][timeout:300];
${selector}->.p;
${CHURCH_AND_PLACES}`;
}

async function overpass(query, label) {
  for (const url of ENDPOINTS) {
    try {
      console.log(`  querying ${new URL(url).host} …`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        console.log(`  ${res.status} from ${new URL(url).host}`);
        continue;
      }
      const json = await res.json();
      console.log(`  ✓ ${label}: ${json.elements.length} elements`);
      return json;
    } catch (err) {
      console.log(`  ${err.message}`);
    }
  }
  throw new Error(`Could not reach any Overpass endpoint for ${label}.`);
}

function provinceIds() {
  return fs.readdirSync(VILLAGE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

function loadGaz(id) {
  return JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, `${id}.json`), "utf8"));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cmdFetch(only) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const targets = only ? [only] : provinceIds();
  let ok = 0;

  for (const id of targets) {
    const dest = path.join(CACHE_DIR, `${id}.json`);
    if (fs.existsSync(dest)) {
      console.log(`· ${id} — cached`);
      ok++;
      continue;
    }
    const gaz = loadGaz(id);
    let got = null;
    for (const strat of areaStrategies(id, gaz)) {
      try {
        const r = await overpass(provinceQuery(strat.sel), `${id} via ${strat.how}`);
        if (r && r.elements.length) { got = r; break; }
      } catch (err) {
        console.log(`  ${id}: ${err.message}`);
      }
      await sleep(2000);
    }
    if (got) {
      fs.writeFileSync(dest, JSON.stringify(got));
      ok++;
    } else {
      console.log(`✗ ${id} — every lookup strategy came back empty`);
    }
    // Overpass is a free volunteer service — do not hammer it.
    await sleep(3000);
  }

  console.log(`\nCached ${ok}/${targets.length} provinces into ${path.relative(ROOT, CACHE_DIR)}`);
  console.log("Next: node scripts/import-osm-churches.mjs match");
}

/**
 * Fast sanity check: does province lookup work at all, and does OSM have anything there?
 * Ten seconds of answer instead of a 25-province crawl that might return nothing.
 */
async function cmdProbe(id) {
  const target = id || "kampot";
  if (!fs.existsSync(path.join(VILLAGE_DIR, `${target}.json`))) {
    console.log(`Unknown province id "${target}".`);
    return;
  }
  const gaz = loadGaz(target);
  console.log(`Probing ${target} (${gaz.latin} / ${gaz.khmer})\n`);

  for (const strat of areaStrategies(target, gaz)) {
    try {
      const r = await overpass(provinceQuery(strat.sel), `${strat.how}`);
      const churches = r.elements.filter((e) => e.tags?.amenity === "place_of_worship").length;
      const places = r.elements.filter((e) => e.tags?.place).length;
      if (r.elements.length) {
        console.log(`\n✓ ${strat.how} works — ${churches} churches, ${places} settlements`);
        console.log("\nGood to run: node scripts/import-osm-churches.mjs fetch");
        return;
      }
      console.log(`  ${strat.how} — empty`);
    } catch (err) {
      console.log(`  ${strat.how} — ${err.message}`);
    }
    await sleep(1500);
  }
  console.log("\nEvery strategy came back empty. Either Overpass is unreachable, or the");
  console.log("province boundary is tagged differently — inspect it on openstreetmap.org.");
}

// ---------------------------------------------------------------- matching

/** Normalise a name for comparison — Khmer passes through, Latin loses case/diacritics/spacing. */
function norm(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zក-៿0-9]/g, "");
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function elementLatLon(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function cmdMatch(write) {
  const ids = provinceIds().filter((id) => fs.existsSync(path.join(CACHE_DIR, `${id}.json`)));
  if (!ids.length) {
    console.log("Nothing cached. Run `fetch` first.");
    return;
  }

  const result = {};
  let placed = 0, noSettlement = 0, noVillageMatch = 0, ambiguous = 0, totalChurches = 0;

  for (const id of ids) {
    const raw = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${id}.json`), "utf8")).elements;

    const churches = [];
    const places = [];
    for (const el of raw) {
      const pos = elementLatLon(el);
      if (!pos) continue;
      const tags = el.tags || {};
      if (tags.amenity === "place_of_worship") {
        churches.push({ name: tags["name:en"] || tags.name || "", nameKm: tags["name:km"] || "", pos });
      } else if (tags.place) {
        if (tags.name || tags["name:km"]) places.push({ name: tags.name || "", nameKm: tags["name:km"] || "", pos });
      }
    }
    totalChurches += churches.length;

    // Village name index scoped to this province only.
    const byName = new Map();
    const gaz = loadGaz(id);
    for (const d of gaz.districts) {
      for (const c of d.communes) {
        for (const v of c.villages) {
          for (const key of [norm(v.khmer), norm(v.latin)]) {
            if (!key) continue;
            if (!byName.has(key)) byName.set(key, []);
            if (!byName.get(key).includes(v.code)) byName.get(key).push(v.code);
          }
        }
      }
    }

    for (const ch of churches) {
      let best = null, bestKm = Infinity;
      for (const pl of places) {
        const km = haversineKm(ch.pos, pl.pos);
        if (km < bestKm) { bestKm = km; best = pl; }
      }
      if (!best || bestKm > MAX_MATCH_KM) { noSettlement++; continue; }

      const codes = byName.get(norm(best.nameKm)) || byName.get(norm(best.name)) || null;
      if (!codes || !codes.length) { noVillageMatch++; continue; }
      if (codes.length > 1) {
        // Still ambiguous inside the province — a wrong placement is worse than a missing one.
        ambiguous++;
        continue;
      }

      result[id] = result[id] || {};
      if (!result[id][codes[0]]) {
        result[id][codes[0]] = { church: ch.name || ch.nameKm || "" };
        placed++;
      }
    }
  }

  console.log(`${ids.length} provinces cached, ${totalChurches} churches\n`);
  console.log(`placed at a village          ${placed}`);
  console.log(`no settlement within ${MAX_MATCH_KM}km     ${noSettlement}`);
  console.log(`settlement not in gazetteer  ${noVillageMatch}`);
  console.log(`ambiguous within province    ${ambiguous}`);
  console.log("");
  Object.keys(result).sort().forEach((id) => {
    console.log("  " + id.padEnd(20) + Object.keys(result[id]).length + " villages");
  });

  if (!write) {
    console.log("\n(dry run — re-run with --write to merge into public/data/church-counts.js)");
    return;
  }

  let existing = {};
  if (fs.existsSync(OUT_FILE)) {
    const m = fs.readFileSync(OUT_FILE, "utf8").match(/window\.CHURCH_COUNTS\s*=\s*(\{[\s\S]*?\});/);
    if (m) {
      try { existing = JSON.parse(m[1]); } catch { console.log("! could not parse existing file — writing fresh"); }
    }
  }
  for (const [id, villages] of Object.entries(result)) {
    existing[id] = existing[id] || { total: null, districts: {}, communes: {}, villages: {} };
    existing[id].villages = Object.assign({}, existing[id].villages || {}, villages);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    OUT_FILE,
    "// Church locations for the Village Registry.\n" +
      "// Generated by scripts/import-osm-churches.mjs and/or scripts/import-churches.mjs.\n" +
      "// Do not edit by hand — re-run the importers instead.\n" +
      "//\n// OpenStreetMap data \u00a9 OpenStreetMap contributors, licensed ODbL.\n" +
      `//\n// Updated: ${stamp}\n` +
      "window.CHURCH_COUNTS = " + JSON.stringify(existing, null, 2) + ";\n\n" +
      "window.CHURCH_COUNTS_META = " + JSON.stringify({ sources: ["OpenStreetMap (ODbL)"], updatedAt: stamp }, null, 2) + ";\n"
  );
  console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const provArg = rest.find((r) => r.startsWith("--province="));
if (cmd === "fetch") {
  try {
    await cmdFetch(provArg ? provArg.split("=")[1] : null);
  } catch (err) {
    console.log("\n" + err.message);
    console.log("\nOverpass is unreachable from here. Either the network blocks it, or every");
    console.log("mirror is busy — it is a free volunteer service and does rate-limit.");
    console.log("Try again in a few minutes, or from a different connection.");
    process.exit(1);
  }
}
else if (cmd === "probe") {
  try {
    await cmdProbe(provArg ? provArg.split("=")[1] : rest[0]);
  } catch (err) {
    console.log("\n" + err.message);
    process.exit(1);
  }
}
else if (cmd === "match") cmdMatch(rest.includes("--write"));
else {
  console.log("Vision 2033 — OpenStreetMap church importer\n");
  console.log("  node scripts/import-osm-churches.mjs probe [--province=kampot]   # 10s check");
  console.log("  node scripts/import-osm-churches.mjs fetch");
  console.log("  node scripts/import-osm-churches.mjs match [--write]\n");
  console.log("Uses OpenStreetMap rather than Google Maps: Google's terms forbid storing");
  console.log("place names and addresses, which is exactly what this app would need to do.");
  console.log("OSM is ODbL — free to store and redistribute with attribution.");
}
