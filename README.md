# Vision 2033 — Christians in Cambodia

One church leader per province submits two figures — roughly how many Christians
they think are in their province, and how many of its villages have a church —
plus **how sure they are**, 1 to 10.

Four screens:

- **Total** — the running number, villages reached, and which provinces have reported
- **Submit** — province, the two figures, confidence, your name, team passcode
- **Villages** — the full registry: mark village by village which ones have a church
- **2033** — secondary: how far the reported provinces are from the 10% goal

Available in English and Khmer.

## Two numbers, kept apart

The app carries two counts of villages with a church and never blends them:

- **Estimated** — the leader's own figure from the Submit form, available immediately
- **Confirmed** — the count of villages actually ticked in the registry, which grows
  slowly and is only as complete as the work behind it

Both appear on the Total screen, labelled. Early on the confirmed number will be far
lower — that gap is real information about coverage, not an error to be smoothed over.

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
- Two Netlify Functions backed by [Netlify Blobs](https://docs.netlify.com/blobs/overview/):
  `entries.mjs` (`/api/entries`) for province reports, `villages.mjs`
  (`/api/villages`) for registry ticks
- `public/provinces.js` — the 25 provinces with Khmer names and reference populations
- `public/data/villages/*.json` — the NCDD gazetteer, one file per province,
  district → commune → village with Khmer and Latin names

The registry never renders what isn't being looked at. Districts and communes stay
collapsed until opened, and search replaces the tree rather than adding to it, so
Kampong Speu's 1,363 villages cost nothing until someone drills into them.

## Local development

```
npm install
netlify dev
```

## Earlier version

The v1 app also had research-based seed estimates per province and importers that
pulled church locations from OpenStreetMap, Google Places and cambodiachurches.org.
Those are still in git history at `e8a8dfb` and can come back:

```
git checkout e8a8dfb -- scripts                      # the church importers
git checkout e8a8dfb -- public/data/seed-estimates.js
```
