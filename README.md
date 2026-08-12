# Vision 2033 — Christians in Cambodia

One church leader per province submits two figures — roughly how many Christians
they think are in their province, and how many of its villages have a church —
plus **how sure they are**, 1 to 10.

Three screens:

- **Total** — the running number, villages reached, and which provinces have reported
- **Submit** — province, the two figures, confidence, your name, team passcode
- **2033** — secondary: how far the reported provinces are from the 10% goal

Available in English and Khmer.

## The village figure

Leaders are never asked how many villages their province has — the app already
knows. Picking a province fills in the official NCDD gazetteer count (Kep has 18,
Kampong Speu has 1,363), and the leader only estimates how many of those have a
church. The count is validated against that official figure on both the client
and the server, so a province can't report more villages with churches than it
has villages.

## Why confidence

A rough guess from a leader who knows their province is worth having, but only
if you can tell it apart from a solid figure. The 1–10 rating travels with every
number, so a total of 400,000 built from mostly 8s and 9s means something
different from the same total built from 2s and 3s. Nothing is weighted or
adjusted behind the scenes — the confidence is shown, not applied.

## What it deliberately doesn't do

Provinces that haven't reported show as **Not yet reported** rather than an
estimate. No research priors are filled in, because a number on screen anchors
the next leader's guess. The total is honest about being partial: it always says
how many of the 25 provinces it's built from.

## Data entry access

Submitting requires a shared team passcode, set via the `ENTRY_PASSCODE`
environment variable in the Netlify site settings. It falls back to `vision2033`
if unset. Setting `ENTRY_PASSCODE` in Netlify overrides the fallback and keeps
the real passcode out of this public repository — prefer that to editing the
default here. Viewing the total is open to anyone with the link.

## Language

The Khmer translation uses standard Cambodian Protestant vocabulary
(`គ្រិស្តបរិស័ទ` for Christians, `គ្រូគង្វាល` for pastor). It's a small set of
strings now — **recommend a native Khmer-speaking leader read through
`public/i18n.js` before wide distribution**.

Province names come from the official NCDD gazetteer's Khmer spellings.

## Tech

- Static frontend in `public/` — vanilla JS, no framework, no build step, no CDN
  scripts, so it works on a patchy connection
- One Netlify Function backed by [Netlify Blobs](https://docs.netlify.com/blobs/overview/)
  — `netlify/functions/entries.mjs`, serving `GET`/`POST /api/entries`
- `public/provinces.js` — the 25 provinces with Khmer names and reference
  populations

## Local development

```
npm install
netlify dev
```

## Earlier version

Before v2 this app also had a per-village church registry (all 14,372 villages
from the NCDD gazetteer), a "Pace to 2033" projection page, research-based seed
estimates per province, and importers that pulled church locations from
OpenStreetMap, Google Places and cambodiachurches.org.

All of it is intact in git history and can come back. To retrieve any of it:

```
git log --oneline                              # find the commit before the v2 rewrite
git checkout <commit> -- public/data/villages  # e.g. the village gazetteer
git checkout <commit> -- scripts               # the church importers
```
