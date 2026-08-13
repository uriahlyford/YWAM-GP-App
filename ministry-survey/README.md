# YWAM Cambodia — Ministry Survey

Six or so regional leaders each report the ministries they oversee. One of them
covers Phnom Penh, Kampot, Kampong Cham and Takeo; Kampot alone has three
ministries with three different leaders. Another covers Battambang, Pursat,
Preah Vihear and Kampong Chhnang. The Siem Reap base leader reports the campus
plus three ministries outside it, each with its own leader and its own villages.

So the form is shaped like the organisation, not like a flat questionnaire:

```
you  ->  the provinces you report for  ->  a card per ministry inside each
```

Every ministry card carries its own leader, staff, and reach. A leader with four
ministries in one province fills four cards under that province.

## Two reporting windows, kept apart

The totals screen labels these separately and never blends them.

- **Training schools, teams and fruit — calendar year 2025.** "How many students
  go through our schools in a year" only has a clean answer once the year is
  closed.
- **Everything else — as it stands today.** Staff, sports, English classes,
  villages, churches served and led. These are numbers a leader can give from
  memory without going back through records, and a stale figure helps nobody.

Change the year in one place, `public/options.js`, and every label follows.

## What it asks

Per ministry: name, its leader, province, whether it's on the base or a separate
location, the year it started, and what kind of ministry it is (sports, English,
kids clubs, church planting, media, health, vocational, justice, and a dozen
more — tick as many as apply).

Then **right now**: total staff, split Cambodian / international and
full-time / volunteer; children and youth reached on a normal day; students
enrolled in classes; people of all ages reached in a normal week; villages gone
into and their names; churches served and churches led, kept as separate
questions because supporting a church and pastoring one are different things.

Then **2025**: each school or course that ran, with students, Cambodian
students and graduates per school; teams hosted; outreach teams sent; new
believers; baptisms; churches planted.

Then in their own words: biggest need, one prayer request.

Only three fields are required — the ministry's name, who leads it, and the
staff count. Everything else can be left blank, because a report that gets
finished beats a report that's complete.

## Access

- **Reading the totals is open** to anyone with the link.
- **Submitting needs the shared team passcode**, set via the `SURVEY_PASSCODE`
  environment variable in the Netlify site settings. It falls back to `ywam2026`
  if unset — set the real one in Netlify so it stays out of this repository.
- Phone numbers and email addresses are the one thing held back from the open
  view. They're returned only to a request carrying the passcode, so the link can
  be shared without handing out contact details.

## Sending it again

A report is filed under the name of the leader who sent it, so sending a second
time replaces the first rather than doubling every ministry in it. Leaders can
correct a number a week later without anyone having to clean up after them.

## Drafts

Every keystroke is written to `localStorage`. These are long reports written on
phones over the course of a day on connections that drop, so a half-finished
report survives a closed tab, a dead battery, and a failed submit.

## Tech

- Static frontend in `public/` — vanilla JS, no framework, no build step, no CDN
  scripts, so it works on a patchy connection
- One Netlify Function backed by [Netlify Blobs](https://docs.netlify.com/blobs/overview/):
  `ministries.mjs` at `/api/ministries` — `GET` returns every report, `POST`
  files one
- The function re-validates everything the browser sends: unknown province and
  ministry-type ids are dropped, counts are clamped, text is length-capped, and
  a ministry without a name, leader and province is not stored at all
- `public/provinces.js` — the 25 provinces, NCDD gazetteer spellings
- `public/options.js` — the ministry and school vocabularies, and the reporting
  year. Adding an id here means adding it to the matching allow-list in
  `netlify/functions/ministries.mjs`, which drops ids it doesn't recognise.

The **Download as a spreadsheet** button on the totals screen writes one row per
ministry, with a UTF-8 BOM so Excel opens Khmer and accented names correctly, and
a leading quote on any cell starting with `=`, `+`, `-` or `@` so a spreadsheet
can't read a typed answer as a formula.

## Deploying

This folder is self-contained — its own `package.json`, `netlify.toml`, function
and static files — so it deploys as a Netlify site of its own, separate from
anything else in the repository around it. There's no build command; the
`netlify.toml` here publishes `public/` and picks up the function.

**As a second site on the same repository.** In Netlify, *Add new site → Import
an existing project*, choose this repository, and set **Base directory** to
`ministry-survey`. That gives a separate site, a separate URL, separate
environment variables and a separate blob store from any other site built off the
same repository. Nothing is shared between them.

Then set `SURVEY_PASSCODE` under **Site settings → Environment variables**.

**As its own repository.** Create an empty repository on GitHub, then lift this
folder into it, keeping the history of these files:

```
git subtree split --prefix=ministry-survey -b survey-only
git push git@github.com:<you>/ywam-cambodia-ministry-survey.git survey-only:main
```

Point Netlify at that repository instead and leave **Base directory** blank —
everything else is the same.

## Local development

```
npm install
netlify dev
```
