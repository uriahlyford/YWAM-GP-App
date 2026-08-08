#!/usr/bin/env node
/**
 * Import per-province church counts from cambodiachurches.org into Vision 2033.
 *
 * That directory is derived from Mission Kampuchea 2021 data and is organised by
 * province -> district -> commune using the same NCDD gazetteer this app already
 * uses for its village lists. That shared geography is what makes this import
 * possible: rather than guessing at their HTML structure, the parser uses the real
 * district and commune names we already have as anchors, and reads the numbers
 * that appear next to them.
 *
 * Run this from a normal network connection. It is deliberately split into steps so
 * you can verify what was found before anything is written.
 *
 *   node scripts/import-churches.mjs fetch              # download + cache the pages
 *   node scripts/import-churches.mjs inspect kampot     # eyeball one cached page
 *   node scripts/import-churches.mjs parse --dry-run    # show what it extracted
 *   node scripts/import-churches.mjs parse              # write public/data/church-counts.js
 *
 * Before running `fetch`: please check the site's terms and, better still, just ask.
 * The Evangelical Fellowship of Cambodia (efc.org.kh) and the MK2021 team are the
 * people behind this data. A direct request for the underlying dataset is faster,
 * more accurate and more respectful than scraping — treat this script as the
 * fallback, not the first move.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VILLAGE_DIR = path.join(ROOT, "public", "data", "villages");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache", "churches");
const OUT_FILE = path.join(ROOT, "public", "data", "church-counts.js");

const BASE = "https://cambodiachurches.org/directory/EN/s/area/";
const DELAY_MS = 1500; // be polite — this is a small ministry site, not an API
const USER_AGENT =
  "Vision2033-import/1.0 (church growth tracker for Cambodian provincial pastors; contact via repository)";

/** Their province slugs don't exactly match ours, so try a few spellings. */
const SLUG_CANDIDATES = {
  "banteay-meanchey": ["Banteay Meanchey"],
  battambang: ["Battambang"],
  "kampong-cham": ["Kampong Cham"],
  "kampong-chhnang": ["Kampong Chhnang"],
  "kampong-speu": ["Kampong Speu"],
  "kampong-thom": ["Kampong Thom"],
  kampot: ["Kampot"],
  kandal: ["Kandal"],
  kep: ["Kep"],
  "koh-kong": ["Koh Kong"],
  kratie: ["Kratie", "Kracheh", "Kratié"],
  mondulkiri: ["Mondul Kiri", "Mondulkiri"],
  "oddar-meanchey": ["Oddar Meanchey", "Otdar Meanchey"],
  pailin: ["Pailin"],
  "phnom-penh": ["Phnom Penh", "Phnom Penh Capital"],
  "preah-sihanouk": ["Preah Sihanouk", "Sihanoukville"],
  "preah-vihear": ["Preah Vihear"],
  "prey-veng": ["Prey Veng"],
  pursat: ["Pursat", "Pouthisat"],
  ratanakiri: ["Ratanak Kiri", "Ratanakiri"],
  "siem-reap": ["Siem Reap", "Siemreap"],
  "stung-treng": ["Stung Treng", "Stueng Treng"],
  "svay-rieng": ["Svay Rieng"],
  takeo: ["Takeo", "Takaev"],
  "tboung-khmum": ["Tboung Khmum"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function provinceIds() {
  return Object.keys(SLUG_CANDIDATES);
}

function loadGazetteer(id) {
  return JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, `${id}.json`), "utf8"));
}

function cachePath(id) {
  return path.join(CACHE_DIR, `${id}.html`);
}

// ---------------------------------------------------------------- fetch

async function checkRobots() {
  try {
    const res = await fetch("https://cambodiachurches.org/robots.txt", {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return;
    const txt = await res.text();
    console.log("--- robots.txt ---\n" + txt.trim() + "\n------------------");
    if (/Disallow:\s*\/\s*$/m.test(txt)) {
      console.log("\n!! robots.txt disallows crawling. Stop here and contact EFC/MK2021 instead.\n");
      process.exit(1);
    }
  } catch {
    console.log("(could not read robots.txt — check the site's terms manually)");
  }
}

async function cmdFetch() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await checkRobots();

  const results = [];
  for (const id of provinceIds()) {
    if (fs.existsSync(cachePath(id))) {
      console.log(`· ${id} — already cached, skipping`);
      results.push({ id, ok: true, cached: true });
      continue;
    }

    let got = null;
    for (const slug of SLUG_CANDIDATES[id]) {
      const url = BASE + encodeURIComponent(slug);
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (res.ok) {
          got = { slug, url, html: await res.text() };
          break;
        }
        console.log(`  ${id}: ${res.status} for "${slug}"`);
      } catch (err) {
        console.log(`  ${id}: ${err.message} for "${slug}"`);
      }
      await sleep(DELAY_MS);
    }

    if (got) {
      fs.writeFileSync(cachePath(id), got.html);
      console.log(`✓ ${id} — ${Math.round(got.html.length / 1024)}kb from "${got.slug}"`);
      results.push({ id, ok: true, slug: got.slug });
    } else {
      console.log(`✗ ${id} — no URL spelling worked; add one to SLUG_CANDIDATES`);
      results.push({ id, ok: false });
    }
    await sleep(DELAY_MS);
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nCached ${ok}/${results.length} provinces into ${path.relative(ROOT, CACHE_DIR)}`);
  console.log("Next: node scripts/import-churches.mjs parse --dry-run");
}

// ---------------------------------------------------------------- inspect

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cmdInspect(id) {
  if (!id) return console.log("usage: inspect <province-id>   e.g. inspect kampot");
  if (!fs.existsSync(cachePath(id))) return console.log(`No cache for "${id}" — run fetch first.`);
  const text = htmlToText(fs.readFileSync(cachePath(id), "utf8"));
  console.log(text.slice(0, 4000));
  console.log(`\n... (${text.length} chars total)`);
}

// ---------------------------------------------------------------- parse

/**
 * Find an integer near a known place name. Their pages show a place followed by a
 * count, so we scan a short window after the name and take the first plain integer.
 *
 * Uses the FIRST occurrence deliberately. A district name often reappears further
 * down the page as one of its own commune names (Banteay Meas district contains a
 * Banteay Meas commune, Dang Tong contains Dang Tong, and so on), and those child
 * rows carry much smaller numbers. The heading — with the figure we actually want —
 * always comes first. Returns every occurrence too, so --verbose can show the
 * ambiguity rather than hiding it.
 */
function countNear(text, name, windowChars = 60) {
  const hits = [];
  const needle = name.toLowerCase();
  const hay = text.toLowerCase();
  let from = 0;
  while (true) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    const window = text.slice(at + name.length, at + name.length + windowChars);
    const m = window.match(/\b(\d{1,4})\b/);
    if (m) hits.push(Number(m[1]));
    from = at + needle.length;
  }
  if (!hits.length) return { value: null, occurrences: [] };
  return { value: hits[0], occurrences: hits };
}

function parseProvince(id) {
  if (!fs.existsSync(cachePath(id))) return null;
  const text = htmlToText(fs.readFileSync(cachePath(id), "utf8"));
  const gaz = loadGazetteer(id);

  const districts = {};
  const communes = {};
  const detail = [];
  let matchedDistricts = 0;
  let matchedCommunes = 0;

  for (const d of gaz.districts) {
    const n = countNear(text, d.latin);
    if (n.value !== null) {
      districts[d.code] = n.value;
      matchedDistricts++;
      detail.push({ kind: "district", name: d.latin, value: n.value, occurrences: n.occurrences });
    }
    for (const c of d.communes) {
      const cn = countNear(text, c.latin);
      if (cn.value !== null) {
        communes[c.code] = cn.value;
        matchedCommunes++;
      }
    }
  }

  const districtSum = Object.values(districts).reduce((a, b) => a + b, 0);
  return {
    id,
    total: districtSum || null,
    districts,
    communes,
    detail,
    matchedDistricts,
    totalDistricts: gaz.districts.length,
    matchedCommunes,
    totalCommunes: gaz.communeCount,
  };
}

function cmdParse(dryRun, force, verbose) {
  const parsed = [];
  for (const id of provinceIds()) {
    const p = parseProvince(id);
    if (p) parsed.push(p);
  }

  if (!parsed.length) {
    console.log("Nothing cached. Run `fetch` first.");
    return;
  }

  console.log("province".padEnd(19) + "districts".padEnd(12) + "communes".padEnd(12) + "churches");
  console.log("-".repeat(56));
  parsed.forEach((p) => {
    console.log(
      p.id.padEnd(19) +
        `${p.matchedDistricts}/${p.totalDistricts}`.padEnd(12) +
        `${p.matchedCommunes}/${p.totalCommunes}`.padEnd(12) +
        (p.total ?? "—")
    );
    if (verbose) {
      p.detail.forEach((d) => {
        const ambiguous = d.occurrences.length > 1 ? `   (name appears ${d.occurrences.length}x: ${d.occurrences.join(", ")} — took the first)` : "";
        console.log(`    ${d.name.padEnd(24)} ${String(d.value).padStart(5)}${ambiguous}`);
      });
    }
  });

  const totalMatched = parsed.reduce((a, p) => a + p.matchedDistricts, 0);
  const totalPossible = parsed.reduce((a, p) => a + p.totalDistricts, 0);
  const rate = totalMatched / totalPossible;
  const grand = parsed.reduce((a, p) => a + (p.total || 0), 0);

  console.log("-".repeat(56));
  console.log(`district match rate: ${(rate * 100).toFixed(0)}%   national total: ${grand} churches`);
  console.log(
    "\nSanity check: published national figures are ~1,609 churches (1,544 Protestant\n" +
      "+ 65 Catholic), or ~2,335 by another government count. If the total above is\n" +
      "wildly off, the number-extraction heuristic is grabbing the wrong figures —\n" +
      "run `inspect <province>` and adjust countNear()."
  );

  if (rate < 0.5 && !force) {
    console.log(`\nRefusing to write: only ${(rate * 100).toFixed(0)}% of districts matched.`);
    console.log("Inspect a page and fix the parser, or re-run with --force if the numbers look right.");
    return;
  }
  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  const out = {};
  parsed.forEach((p) => {
    out[p.id] = {
      total: p.total,
      districts: p.districts,
      communes: p.communes,
      coverage: { districts: `${p.matchedDistricts}/${p.totalDistricts}`, communes: `${p.matchedCommunes}/${p.totalCommunes}` },
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const body =
    "// Per-province church counts imported from cambodiachurches.org (Mission Kampuchea 2021\n" +
    "// data, NCDD gazetteer geography). Generated by scripts/import-churches.mjs — do not edit\n" +
    "// by hand; re-run the importer instead.\n" +
    "//\n" +
    "// Keyed by the same district/commune codes used in public/data/villages/*.json, so these\n" +
    "// line up directly with the Village Registry.\n" +
    `//\n// Imported: ${stamp}\n` +
    "window.CHURCH_COUNTS = " +
    JSON.stringify(out, null, 2) +
    ";\n\nwindow.CHURCH_COUNTS_META = " +
    JSON.stringify({ source: "cambodiachurches.org", basis: "Mission Kampuchea 2021", importedAt: stamp }, null, 2) +
    ";\n";

  fs.writeFileSync(OUT_FILE, body);
  console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
  console.log("Add it to public/index.html after seed-estimates.js, then commit.");
}

// ---------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "fetch") await cmdFetch();
else if (cmd === "inspect") cmdInspect(rest[0]);
else if (cmd === "parse") cmdParse(rest.includes("--dry-run"), rest.includes("--force"), rest.includes("--verbose"));
else {
  console.log("Vision 2033 — church directory importer\n");
  console.log("  node scripts/import-churches.mjs fetch");
  console.log("  node scripts/import-churches.mjs inspect <province-id>");
  console.log("  node scripts/import-churches.mjs parse [--dry-run] [--verbose] [--force]\n");
  console.log("Read the header comment before running fetch.");
}
