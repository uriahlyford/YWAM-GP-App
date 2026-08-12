# Vision 2033 — Christians in Cambodia

One church leader per province submits **one number**: roughly how many
Christians they think are in their province. Plus **how sure they are**, 1 to 10.

That's the whole app. Two screens:

- **Total** — the running national number, and which provinces have reported
- **Submit** — province, the number, confidence, your name, team passcode

Available in English and Khmer.

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
environment variable in the Netlify site settings. It falls back to `ywam2033`
if unset — **change this before sharing widely**. Viewing the total is open to
anyone with the link.

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
