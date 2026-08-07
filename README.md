# Cambodia 10x2033 — Church Growth Tracker

A simple tool for senior pastors in each province of Cambodia to report on
church planting progress, tracking the movement toward **10% of the
population following Christ by 2033**.

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

## Data entry access

Submitting a report requires a shared team passcode, set via the
`ENTRY_PASSCODE` environment variable in the Netlify site settings (falls
back to `ywam2033` if unset — change this before sharing widely). Viewing the
dashboard is open to anyone with the link.

## Tech

- Static frontend in `public/` (vanilla JS + Chart.js via CDN)
- One Netlify Function (`netlify/functions/entries.mjs`) backed by
  [Netlify Blobs](https://docs.netlify.com/blobs/overview/) for storage —
  no external database required
- `GET /api/entries` returns all province data + national history
- `POST /api/entries` appends a new report (passcode-protected)

## Local development

```
npm install
netlify dev
```
