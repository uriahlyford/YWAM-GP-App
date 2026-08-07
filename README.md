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
