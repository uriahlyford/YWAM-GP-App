#!/usr/bin/env node
/**
 * Import churches in Cambodia from the Google Places API and place them at individual
 * villages in the Village Registry.
 *
 * BEFORE YOU RUN THIS — the licence position, stated once so it is on the record.
 *
 * Google Maps Platform's terms (3.2.3(b)) forbid customers to "pre-fetch, index, store,
 * reshare or rehost Google Maps Content", and name "copy and save business names, addresses"
 * explicitly. Only the opaque place ID may be stored indefinitely. Those terms are not scoped
 * to commercial use — they apply to every Maps Platform customer, free tier and non-profit
 * alike, so a non-commercial ministry purpose does not exempt this. The realistic consequence
 * of breaching them is Google suspending the API key or the project, not legal action.
 *
 * That is a decision for whoever owns the Google account, and this script exists because that
 * decision was made deliberately. Two things follow from it in the code:
 *
 *   - `scripts/import-osm-churches.mjs` remains the recommended importer. OpenStreetMap is
 *     ODbL, carries no such restriction, and its output merges with this one.
 *   - This script records `source: "google"` on everything it writes, so Google-derived rows
 *     can be found and removed later with a single filter if the position ever changes.
 *
 * SETUP
 *
 *   1. Enable "Places API (New)" in a Google Cloud project.
 *   2. Create an API key and restrict it to the Places API.
 *   3. export GOOGLE_MAPS_API_KEY=...        (never commit the key)
 *
 * Roughly 1,650 Text Search calls for the whole country — one per commune. Check current
 * Places pricing and your free monthly allowance before running it nationwide; start with a
 * single province to see both the cost and the data quality.
 *
 * USAGE
 *
 *   node scripts/import-google-churches.mjs fetch --province=kampot
 *   node scripts/import-google-churches.mjs fetch                  # all 25
 *   node scripts/import-google-churches.mjs match                  # writes nothing
 *   node scripts/import-google-churches.mjs match --write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VILLAGE_DIR = path.join(ROOT, "public", "data", "villages");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache", "google");
const OUT_FILE = path.join(ROOT, "public", "data", "church-counts.js");

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "nextPageToken",
].join(",");

const DELAY_MS = 400;
const PAGES_PER_COMMUNE = 2; // 20 results per page; 2 is plenty for a rural commune

// Cambodia's bounding box, used to bias results away from same-named places elsewhere.
const KH_BOUNDS = { low: { latitude: 9.9, longitude: 102.3 }, high: { latitude: 14.7, longitude: 107.7 } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiKey() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) {
    console.log("GOOGLE_MAPS_API_KEY is not set.\n");
    console.log("  export GOOGLE_MAPS_API_KEY=your-key-here\n");
    console.log("Create one in Google Cloud with the Places API (New) enabled, and restrict");
    console.log("it to that API. Do not commit it — .env is already gitignored.");
    process.exit(1);
  }
  return k;
}

function provinceIds() {
  return fs.readdirSync(VILLAGE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

function loadGaz(id) {
  return JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, `${id}.json`), "utf8"));
}

function communeCache(provinceId, communeCode) {
  return path.join(CACHE_DIR, provinceId, `${communeCode}.json`);
}

// ---------------------------------------------------------------- fetch

async function searchCommune(key, query) {
  const results = [];
  let pageToken = null;

  for (let page = 0; page < PAGES_PER_COMMUNE; page++) {
    const body = {
      textQuery: query,
      includedType: "church", // keeps Buddhist wats and other places of worship out
      languageCode: "en",
      locationBias: { rectangle: KH_BOUNDS },
      maxResultCount: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    if (Array.isArray(json.places)) results.push(...json.places);
    pageToken = json.nextPageToken || null;
    if (!pageToken) break;
    await sleep(DELAY_MS);
  }

  return results;
}

async function cmdFetch(only) {
  const key = apiKey();
  const targets = only ? [only] : provinceIds();
  let calls = 0;
  let found = 0;
  let errors = 0;

  for (const id of targets) {
    if (!fs.existsSync(path.join(VILLAGE_DIR, `${id}.json`))) {
      console.log(`✗ ${id} — unknown province id`);
      continue;
    }
    const gaz = loadGaz(id);
    fs.mkdirSync(path.join(CACHE_DIR, id), { recursive: true });
    const communes = gaz.districts.flatMap((d) => d.communes.map((c) => ({ d, c })));
    console.log(`\n${id} — ${communes.length} communes`);

    for (const { d, c } of communes) {
      const dest = communeCache(id, c.code);
      if (fs.existsSync(dest)) continue;

      const query = `church in ${c.latin}, ${d.latin}, ${gaz.latin}, Cambodia`;
      try {
        const places = await searchCommune(key, query);
        fs.writeFileSync(dest, JSON.stringify({ query, communeCode: c.code, districtLatin: d.latin, places }));
        calls++;
        found += places.length;
        process.stdout.write(places.length ? String(Math.min(places.length, 9)) : ".");
      } catch (err) {
        errors++;
        process.stdout.write("x");
        if (/API key|PERMISSION_DENIED|not authorized/i.test(err.message)) {
          console.log(`\n\n${err.message}\n`);
          console.log("Stopping — this looks like a key or billing problem rather than a bad query.");
          return;
        }
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n\n${calls} calls, ${found} raw results, ${errors} errors`);
  console.log("Next: node scripts/import-google-churches.mjs match");
}

// ---------------------------------------------------------------- match

function norm(s) {
  if (!s) return "";
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-zក-៿0-9]/g, "");
}

/**
 * Reject results that are clearly not Christian congregations.
 *
 * `includedType: "church"` does most of the work, but Google's church type is applied loosely
 * in Cambodia — Buddhist wats, pagodas and the occasional guesthouse still appear.
 */
function looksLikeChurch(place) {
  const name = (place.displayName?.text || "") + " " + (place.formattedAddress || "");
  if (/\b(wat|pagoda|temple|monastery|mosque|masjid)\b/i.test(name)) return false;
  if (/វត្ត|ព្រះវិហារព្រះពុទ្ធ/.test(name)) return false;
  return true;
}

function cmdMatch(write) {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log("Nothing cached. Run `fetch` first.");
    return;
  }
  const ids = provinceIds().filter((id) => fs.existsSync(path.join(CACHE_DIR, id)));
  if (!ids.length) {
    console.log("Nothing cached. Run `fetch` first.");
    return;
  }

  const result = {};
  let total = 0, kept = 0, atVillage = 0, atCommuneOnly = 0, rejected = 0;

  for (const id of ids) {
    const gaz = loadGaz(id);
    const communesByCode = new Map();
    gaz.districts.forEach((d) => d.communes.forEach((c) => communesByCode.set(c.code, c)));

    for (const file of fs.readdirSync(path.join(CACHE_DIR, id))) {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, id, file), "utf8"));
      const commune = communesByCode.get(data.communeCode);
      if (!commune) continue;

      for (const place of data.places || []) {
        total++;
        if (!looksLikeChurch(place)) {
          rejected++;
          continue;
        }
        kept++;

        // Because the query was scoped to one commune, a village name appearing in the
        // result's name or address is unambiguous — village names are effectively unique
        // within a commune (exactly one duplicate in all 14,372).
        const haystack = norm((place.displayName?.text || "") + " " + (place.formattedAddress || ""));
        const hit = commune.villages.find((v) => {
          const kh = norm(v.khmer), la = norm(v.latin);
          return (kh && haystack.includes(kh)) || (la && la.length >= 4 && haystack.includes(la));
        });

        result[id] = result[id] || { villages: {}, communes: {} };
        if (hit) {
          if (!result[id].villages[hit.code]) {
            result[id].villages[hit.code] = { church: place.displayName?.text || "", source: "google" };
            atVillage++;
          }
        } else {
          result[id].communes[commune.code] = (result[id].communes[commune.code] || 0) + 1;
          atCommuneOnly++;
        }
      }
    }
  }

  console.log(`${total} results  →  ${kept} kept, ${rejected} rejected as not a church\n`);
  console.log(`placed at a village   ${atVillage}`);
  console.log(`commune level only    ${atCommuneOnly}   (no village name in the address)`);
  console.log("");
  Object.keys(result).sort().forEach((id) => {
    console.log("  " + id.padEnd(20) + Object.keys(result[id].villages).length + " villages");
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

  for (const [id, data] of Object.entries(result)) {
    existing[id] = existing[id] || { total: null, districts: {}, communes: {}, villages: {} };
    // Existing entries win: an earlier source that already placed a church here is not
    // overwritten by a Google result for the same village.
    existing[id].villages = Object.assign({}, data.villages, existing[id].villages || {});
    for (const [code, n] of Object.entries(data.communes)) {
      if (existing[id].communes[code] === undefined) existing[id].communes[code] = n;
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    OUT_FILE,
    "// Church locations for the Village Registry.\n" +
      "// Generated by the importers in scripts/ — do not edit by hand.\n" +
      "//\n" +
      "// Sources may include: OpenStreetMap (ODbL, © OpenStreetMap contributors),\n" +
      "// cambodiachurches.org (Mission Kampuchea 2021), and Google Places.\n" +
      "// Rows carrying source:\"google\" are Google-derived; see the licence note at the top\n" +
      "// of scripts/import-google-churches.mjs before redistributing them.\n" +
      `//\n// Updated: ${stamp}\n` +
      "window.CHURCH_COUNTS = " + JSON.stringify(existing, null, 2) + ";\n\n" +
      "window.CHURCH_COUNTS_META = " + JSON.stringify({ updatedAt: stamp }, null, 2) + ";\n"
  );
  console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
}

// ---------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const provArg = rest.find((r) => r.startsWith("--province="));
if (cmd === "fetch") await cmdFetch(provArg ? provArg.split("=")[1] : null);
else if (cmd === "match") cmdMatch(rest.includes("--write"));
else {
  console.log("Vision 2033 — Google Places church importer\n");
  console.log("  export GOOGLE_MAPS_API_KEY=...\n");
  console.log("  node scripts/import-google-churches.mjs fetch --province=kampot");
  console.log("  node scripts/import-google-churches.mjs fetch");
  console.log("  node scripts/import-google-churches.mjs match [--write]\n");
  console.log("Read the licence note at the top of this file first. Google's terms restrict");
  console.log("storing place names and addresses, and are not scoped to commercial use.");
  console.log("scripts/import-osm-churches.mjs does the same job with no such restriction.");
}
