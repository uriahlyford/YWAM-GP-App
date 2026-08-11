# Vision 2033 — Cambodia Church Growth Tracker

A tool for senior pastors in each province of Cambodia to report on church
planting progress, tracking the movement toward **10% of the population
following Christ by 2033**. Available in English and Khmer.

## What it tracks

For each province, a pastor or designated leader submits:

- Total population of the province
- Total number of villages in the province
- Number of villages that have at least one church
- Number of Christians who attended church last Sunday

Optional, for a fuller picture:

- Total number of churches (a village can have more than one)
- Baptisms in the past year
- New believers in the past year
- Small groups / house churches / cell groups
- Trained or ordained local leaders
- Notes or prayer requests

Every submission is saved to that province's history, so the app can chart
trends over time — nationally and per province — against the pace needed to
reach 10% by January 2033.

### Village Registry

Beyond the province-level summary, each province has a **Village Registry**:
every real village in that province (from Cambodia's official commune/village
gazetteer), organized by district and commune, with a checkbox for "has a
church" and an optional note. This lets a province track its progress
village-by-village instead of guessing at an aggregate number — the count
feeds straight back into the main report.

### Reference data

- **Population**: 2024 Cambodia Inter-Censal Population Survey, National
  Institute of Statistics, Ministry of Planning.
- **Villages, communes, and districts**: the official NCDD commune/village
  gazetteer (`db.ncdd.gov.kh/gazetteer`), via the open-source extraction at
  [github.com/RathanakSreang/cambodia-gazetteer](https://github.com/RathanakSreang/cambodia-gazetteer)
  (MIT licensed). Both Khmer and Latin names for every district, commune, and
  village come from this dataset.

These are starting references, not the final word — provincial leaders
should confirm and update them with their own local knowledge.

### Starting estimates for Christian population

Before any pastor has reported, the dashboard and entry form show a
**research-based estimate** for each province's Sunday attendance / %
Christian, clearly badged "Estimated" (vs. "Confirmed" once a real report
comes in) and italicized in the table. These come from
`public/data/seed-estimates.js`, compiled from a multi-agent research pass
across Joshua Project, the World Religion Database, EFC/OMF/mission
estimates, Cambodia's 2008/2019 census religion-by-province tables, and
ethnic-minority concentration data.

Two facts drive the model:

1. **Cambodia's own government census (0.3% Christian, CIPS 2024) and
   independent research bodies (1.5–3.3%) disagree by roughly 10x** — a gap
   researchers attribute to under-reporting, since Khmer identity is
   culturally fused with Buddhism and declaring "Christian" on a government
   form carries social cost. The app shows both figures side by side rather
   than picking one and hiding the other.
2. **The census undercounts, but it is the same instrument applied in every
   province** — so while its absolute level is too low, its *relative*
   pattern across provinces is still informative.

So each province's estimate is its census figure plus a uniform offset:

```
estimate% = censusPrior% + 1.671 points
```

where the offset represents the ~289,700 believers the census misses,
distributed proportional to population. This reproduces the 2.0% national
figure to within 0.001 points, and yields a range of **1.77% (Kampong Cham,
Kampong Speu, Pursat, Svay Rieng, Tboung Khmum) to 5.67% (Mondulkiri)**.

The offset is **additive rather than multiplicative** because the undercount
mechanism is per-capita social pressure, not something proportional to
existing Christian presence — scaling multiplicatively (6.7x) would put
Mondulkiri at ~27%, which is plainly wrong.

**Limitations, stated plainly:**

- Distributing the uncounted by raw population is a neutral assumption, not a
  measured one. The undercount is probably heavier in Khmer-majority lowland
  provinces and in cities, but no data exists to weight it.
- This compresses the lowland provinces into a narrow 1.77–2.07% band. That
  is the honest output — the census puts them all within 0.1–0.4% of each
  other, and manufacturing more spread than the source contains would be
  fabrication.
- Every entry carries a `tier` field recording exactly how solid its prior is:
  `census-2019` and `census-clean` (best), `census-ambiguous` (year attribution
  uncertain), `census-residual` (derived from published Buddhist/Muslim
  shares), `inferred` (Phnom Penh and Stung Treng — no census reading, inferred
  from institutional/ethnic evidence, the softest numbers here), and `default`
  (Kep, Koh Kong, Oddar Meanchey, Pailin — no province signal of any kind).

**Mondulkiri (5.67%) and Ratanakiri (3.77%) are the most solid** — both the
government census and independent research on conversion among indigenous
highland peoples (Bunong/Phnong, Jarai, Tampuan, Kreung, Brao) independently
agree they are far above average.

If you can get real per-province numbers later, just edit that file — every
seeded value is replaced automatically the moment a pastor submits a real
report.

### Map data: OpenStreetMap, not Google Maps

Google Maps is the obvious place to look for church locations, but its terms
rule out the use this app needs. Google Maps Platform ToS 3.2.3(b) forbids
customers to "pre-fetch, index, store, reshare or rehost Google Maps Content"
and names "copy and save business names, addresses" explicitly. Only the opaque
`place_id` may be stored indefinitely; coordinates may be cached for 30 days.
Shipping a permanent `church-counts.js` built from Google Places would breach
that, so the automated import uses **OpenStreetMap** instead — ODbL licensed,
free to store and redistribute with attribution, no API key, and it carries
Khmer names, which match the gazetteer far more reliably than Latin
transliterations.

```
npm run osm:fetch      # one Overpass query per province
npm run osm:preview    # shows what it matched, writes nothing
npm run osm:import     # merges into public/data/church-counts.js
```

It fetches Christian places of worship and settlement nodes per province, snaps
each church to the nearest settlement within 4km, then matches that settlement
name to a gazetteer village.

**Province scoping is the whole trick.** Cambodian village names repeat badly:
15% occur in more than one province, and ថ្មី ("new") appears in 24 of the 25.
Matched nationwide, one in six churches would be ambiguous. Scoped to a single
province, 90.7% of names are unique — and the ~9% still ambiguous are skipped
rather than guessed at, because a church placed in the wrong village is worse
than one left unplaced. Results merge with the cambodiachurches.org import
rather than replacing it, so the two sources combine.

Google Maps still appears in the app in the one way its licence clearly allows:
every commune in the Village Registry has a **search Maps** link that opens
Google Maps searching for churches there — useful for checking a village you are
unsure about, with nothing stored.

### Google Places import

`scripts/import-google-churches.mjs` pulls churches from the Google Places API
and places them at villages the same way the other importers do.

```
export GOOGLE_MAPS_API_KEY=...                              # never commit this
npm run google:fetch -- --province=kampot                   # start with one province
npm run google:preview                                      # writes nothing
npm run google:import
```

One Text Search call per commune (~1,650 nationally), scoped to the commune, so
a village name appearing in a result's address is unambiguous. Results that are
clearly not Christian congregations — wats, pagodas, mosques, in Latin or Khmer
— are filtered out, since Google's `church` type is applied loosely in Cambodia.
Existing entries from other sources are never overwritten, and everything this
importer writes carries `source: "google"` so it can be filtered back out later.

**Licence position, stated plainly.** Google Maps Platform's terms (3.2.3(b))
forbid customers to "pre-fetch, index, store, reshare or rehost Google Maps
Content" and name "copy and save business names, addresses" explicitly. Only the
opaque place ID may be stored indefinitely. **Those terms are not scoped to
commercial use** — they apply to every Maps Platform customer, so a
non-commercial ministry purpose does not exempt this. The realistic consequence
of breaching them is Google suspending the API key or project, not legal action.
That is a decision for whoever owns the Google account; the `source: "google"`
tagging exists so it can be reversed cleanly. **`npm run osm:*` does the same job
under a licence with no such restriction and is the recommended importer.**

Check current Places pricing and your free monthly allowance before running it
nationwide — start with one province to see both the cost and the data quality.

### Importing the national church directory

`cambodiachurches.org` is the best available source of real per-province
numbers: a province → district → commune browsable directory of evangelical
churches, derived from Mission Kampuchea 2021 data and built on the **same
NCDD gazetteer this app already uses**. That shared geography is what makes an
automated import practical.

`scripts/import-churches.mjs` handles it. You need Node 18+ and a clone of this
repo; the script has no dependencies of its own, so no `npm install` is needed
just to run it.

**Route A — the script downloads the pages:**

```
npm run churches:fetch      # downloads + caches all 25 province pages
npm run churches:preview    # shows every number it extracted, writes nothing
npm run churches:import     # writes public/data/church-counts.js
```

**Route B — save the pages from your browser** (if the site blocks the script,
or you'd rather not have it hit their server):

```
npm run churches:urls       # prints the 25 links and the filename to save each as
                            # ...save each page into scripts/.cache/churches/
npm run churches:status     # shows which provinces you've saved and which are missing
npm run churches:preview
npm run churches:import
```

Both routes end at the same `parse` step, and partial imports are fine — save
five provinces, import, add more later. `npm run churches:preview` never writes
anything, so it's always safe to run first.

**Going one level deeper — pre-filling individual villages.** The province pages
only give district and commune totals. To pre-fill the Village Registry itself,
crawl the commune pages too:

```
node scripts/import-churches.mjs fetch --deep                    # all 25 provinces
node scripts/import-churches.mjs fetch --deep --province=kampot  # or one at a time
```

That's ~1,646 requests nationally at 1.5s apart, so budget around 40 minutes —
it resumes from cache, so it can be run across several sittings. The parser then
matches each commune page against just that commune's ~9 villages (scoping it
that tightly is what keeps the name matching safe) and records which villages
have a church.

Once village-level data exists, the registry arrives **pre-filled**: those
villages come in already ticked, tagged "from directory", with the church name
in the note where a single one could be attributed unambiguously. A pastor's own
entry always wins over the directory — including a deliberate "no church here",
which is never overwritten by a re-import. A **Confirm all N from the directory**
button accepts a whole province in one request. Pre-filled villages count toward
the totals but aren't treated as confirmed until a pastor accepts or corrects
them, which is the same estimated-vs-confirmed distinction used everywhere else
in the app.

Rather than guessing at their HTML structure, the parser uses the real district
and commune names already in `public/data/villages/*.json` as anchors and reads
the number next to each. It deliberately takes the **first** occurrence of a
name: districts frequently contain a commune of the same name (Banteay Meas,
Dang Tong, Chhuk…) whose smaller number would otherwise win. `--verbose` prints
every extracted figure and flags each ambiguous match so you can check the work,
and `parse` refuses to write at all if under half the districts matched.

The importer is polite by design — it checks `robots.txt`, identifies itself,
waits 1.5s between requests, and caches so re-runs don't re-hit the site.
**Please ask before scraping.** The Evangelical Fellowship of Cambodia
(efc.org.kh) and the MK2021 team are the people behind this data; requesting the
underlying dataset directly is faster, more accurate and more respectful. Treat
the script as the fallback.

Once `public/data/church-counts.js` exists the app picks it up automatically —
a "Churches in Directory" figure on each province, and a per-commune badge in
the Village Registry showing how many churches are already known there, so
pastors can see where to start. Until then it's a clean no-op.

## Language

The app ships in English and Khmer (toggle in the top bar, remembered per
device). Place names (province/district/commune/village) come straight from
the official gazetteer's Khmer spellings. General interface text was
translated directly rather than through a translation API — this environment
didn't have one available — using standard Cambodian Protestant church
vocabulary. **Recommend a native Khmer-speaking pastor or leader proofread
the translations in `public/i18n.js` before wide distribution**, since
different networks sometimes prefer different words for the same idea (e.g.
"church" as ក្រុមជំនុំ vs. ព្រះវិហារ).

## Data entry access

Submitting a report, or marking a village in the registry, requires a shared
team passcode, set via the `ENTRY_PASSCODE` environment variable in the
Netlify site settings (falls back to `ywam2033` if unset — change this before
sharing widely). Viewing the dashboard is open to anyone with the link.

## Pace to 2033

The app models what the goal actually requires, and compares it to where the
current rate of growth lands. Assumptions live in `public/data/projection.js`
and are editable live in the UI, so the team can test how sensitive the plan is
rather than trusting one number.

**The headline arithmetic** (at the 1.2%/yr population default):

| | |
|---|---|
| Cambodia's population in 2033 | ~19.3 million |
| 10% of that | **~1,930,000 people** |
| Today (~2.0%) | ~355,000 people |
| Gap | ~1,575,000 people over 7 years |
| Required rate | **~27.4%/yr** — or **~2.03%/month** |
| Current observed rate | 8.8%/yr, landing at **~3.3%** in 2033 |

Two modelling choices worth knowing:

- **The goal is a moving target.** Population growth means the 10% threshold
  rises every year. Cambodia's own 2019–2024 intercensal figure was 2.1%/yr;
  the app defaults to a more conservative 1.2% because sustaining 2.1% for a
  decade is unlikely and part of it probably reflects improved census coverage.
  Setting it to 2.1 in the UI raises the target to ~2.09M — not a rounding error,
  which is exactly why it's exposed rather than buried.
- **Required growth is compounded, not linear**, because movements compound —
  and because the monthly form of a compound rate is the only version a local
  leader can act on.

**Three framings the page surfaces**, each falling out of the arithmetic rather
than being asserted:

1. *Bigger churches alone cannot get there.* If every church that already exists
   in Cambodia doubled its Sunday attendance, that closes only ~22% of the gap.
   The remainder — roughly 800+ new congregations a year — has to come from
   churches that don't exist yet. This is a church-planting goal before it is a
   church-growth goal.
2. *Yearly targets discourage; monthly targets move.* 27%/yr and 2%/month are
   the same number. A congregation of 100 adding two people a month is exactly
   on pace.
3. *Villages are the leading indicator.* Attendance only moves after a church
   exists, so it lags. The share of villages with any church at all moves first
   — which is what the Village Registry measures, turning a national percentage
   into a specific list of places with no church yet.

At 10%, an even spread works out to about **134 believers in every one of
Cambodia's 14,372 villages** — which is roughly the Mission Kampuchea 2021
vision of a believing community in every village, restated as a number.

## Design

Dark-first interface built for phones on patchy connections: high contrast,
large tap targets, and no heavy blur stacks or animation that would stutter on
older Android hardware. Type is Space Grotesk for text, JetBrains Mono for all
figures (so digits align in columns), and Noto Sans Khmer for Khmer script.
Motion respects `prefers-reduced-motion`.

## Tech

- Static frontend in `public/` (vanilla JS + Chart.js via CDN), with a small
  hand-rolled i18n layer (`public/i18n.js`)
- Two Netlify Functions backed by
  [Netlify Blobs](https://docs.netlify.com/blobs/overview/) for storage — no
  external database required:
  - `netlify/functions/entries.mjs` — `GET`/`POST /api/entries` (province
    reports + national history)
  - `netlify/functions/villages.mjs` — `GET`/`POST /api/villages` (per-village
    has-church status within a province's registry)
- `public/data/villages/<province-id>.json` — static per-province village
  hierarchy (district → commune → village), generated once from the NCDD
  gazetteer

## Local development

```
npm install
netlify dev
```
