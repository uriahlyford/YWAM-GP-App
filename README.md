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
report. `cambodiachurches.org` is the most promising lead: a
province/district/commune-browsable directory of evangelical churches derived
from Mission Kampuchea 2021 data, using the same NCDD gazetteer this app
already uses. It was unreachable from the build environment.

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
