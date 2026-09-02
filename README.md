# Vision 2033 — Christians in Cambodia

One church leader per province submits two figures — roughly how many Christians
they think are in their province, and how many of its villages have a church —
plus **how sure they are**, 1 to 10.

Five screens:

- **Total** — the running number, villages reached, and which provinces have reported
- **Submit** — province, the two figures, confidence, your name, team passcode
- **Villages** — the full registry: mark village by village which ones have a church
- **My Church** — sign in, keep your church's profile, and see who to call
- **2033** — secondary: how far the reported provinces are from the 10% goal

Available in English and Khmer.

## Two numbers, kept apart

The app carries two counts of villages with a church and never blends them:

- **Estimated** — the leader's own figure from the Submit form, available immediately
- **Confirmed** — the count of villages actually ticked in the registry, which grows
  slowly and is only as complete as the work behind it

Both appear on the Total screen, labelled. Early on the confirmed number will be far
lower — that gap is real information about coverage, not an error to be smoothed over.

## A third count: gathered

The Total screen also carries an **Estimated vs. gathered** table, imported once from a
2026 national Christian committee roster spreadsheet — a province-by-province rollup of
committee leaders and church membership (`public/data/gathered-2026.js`). It sits next
to the leader's own Submit estimate for the same province, never averaged or merged into
it: two independent counts, so a reader can see where they agree and where they don't.
Provinces the roster left blank (Tboung Khmum) are omitted rather than shown as zero.
Phnom Penh has no province committee and reports through five denominations instead — its
row is their combined total.

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

## Accounts

Sign-in is **phone number plus a PIN the pastor chooses** — not email. Provincial
pastors have phones, sometimes shared ones, and often no working email address.
A number is written locally as `012 345 678` and internationally as `+855 12 345
678`; both are stored as one canonical form, so signing up one way and signing in
the other way reaches the same account.

Anyone with the team code can create an account. There is no email confirmation,
no SMS gateway and nothing for a coordinator to approve — the code is the gate.

### Three roles

| | Can do |
|---|---|
| **Pastor** | Keep their own church profile. See their provincial leader's number and the director's number. Tick villages in the registry. |
| **Provincial leader** | All of the above, plus the roster of every church in their province with congregation figures, and sending their province's total. |
| **Committee director** | The full roster across all 25 provinces, naming each province's leader, and reporting for any province. |

A pastor becomes a **provincial leader** when the director names them, from the
roster on the My Church screen. One leader per province: naming a new one demotes
the old one, because the province total is a single number and two people
authorised to overwrite it would quietly overwrite each other.

The **director** is whoever holds the number in the `DIRECTOR_PHONE` environment
variable, set in the Netlify dashboard. That role is deliberately not handed out
from inside the app — if it were, whoever held it could pass on their own
authority and there would be no way to take it back. Setting `DIRECTOR_PHONE`
after that person has already signed up promotes them on their next sign-in.

### Congregations feed the province total

A pastor records their Sunday congregation as **men, women and children**
separately. Their provincial leader sees those figures summed across every church
in the province, next to the province total they last reported, with a button that
carries the sum into the Submit form.

The sum is a floor, not the province — it only counts churches whose pastor has
signed up. The screen says so rather than presenting it as the answer.

### What each person is allowed to see

Decided on the server, not in the browser. A pastor's response contains their own
record, their provincial leader's contact card and the director's contact card —
the other pastors in their province are not in the payload at all, so the app
cannot leak a contact list it was never sent. Contact cards carry a name, a church
and a number to ring, never congregation figures. PIN hashes never leave the
server in any response.

PINs are salted and hashed with scrypt. Eight wrong PINs locks an account for
fifteen minutes, which is the only thing standing between a four-digit PIN and a
brute force. Sessions are HMAC-signed tokens valid for 60 days; the role is read
from storage on every request rather than trusted from the token, so a promotion
or demotion takes effect on the next request instead of the next sign-in.

## Tests

```
npm test
```

Runs the auth primitives (phone forms, PIN hashing, token forgery, lockout, and
that no view leaks PIN material) and then an API suite against the real function
handlers, mounted on a plain Node server with an in-memory stand-in for Netlify
Blobs — so the tests exercise the code that gets deployed rather than a
reimplementation of it. The suite covers the permission model directly: that a
pastor cannot promote themselves, that a leader cannot report for another
province, that a demoted leader loses the roster, and that one province ends up
with exactly one leader.

## Data entry access

`ENTRY_PASSCODE` in the Netlify site settings is both the team code for creating
an account and the older shared passcode for submitting without one. It falls
back to `vision2033` if unset — set it in Netlify rather than editing the default
here, so the real code stays out of this public repository.

Both routes still work. A signed-in provincial leader submits with their session
and is never shown a passcode field; the shared passcode continues to work for
anyone who was given it before accounts existed. Viewing the total is open to
anyone with the link.

### Environment variables

| | |
|---|---|
| `ENTRY_PASSCODE` | Team code for signing up, and the legacy shared passcode. |
| `DIRECTOR_PHONE` | The committee director's number, in any format. **Must be set** or no account gets the director role. |
| `AUTH_SECRET` | Optional. Session signing key. Left unset, one is generated on first use and kept in the blob store, so there is nothing to configure and nothing to lose. |

## Language

The Khmer translation uses standard Cambodian Protestant vocabulary
(`គ្រិស្តបរិស័ទ` for Christians, `គ្រូគង្វាល` for pastor). It's a small set of
strings now — **recommend a native Khmer-speaking leader read through
`public/i18n.js` before wide distribution**.

Province names come from the official NCDD gazetteer's Khmer spellings.

## Tech

- Static frontend in `public/` — vanilla JS, no framework, no build step, no CDN
  scripts, so it works on a patchy connection
- Four Netlify Functions backed by [Netlify Blobs](https://docs.netlify.com/blobs/overview/):
  `entries.mjs` (`/api/entries`) for province reports, `villages.mjs`
  (`/api/villages`) for registry ticks, `auth.mjs` (`/api/auth`) for sign-up and
  sign-in, and `me.mjs` (`/api/me`) for the My Church screen
- `netlify/shared/auth.mjs` — phone normalization, PIN hashing, session tokens
  and the response shaping that decides what each role is allowed to see
- `public/provinces.js` — the 25 provinces with Khmer names and reference populations
- `public/data/villages/*.json` — the NCDD gazetteer, one file per province,
  district → commune → village with Khmer and Latin names

The registry never renders what isn't being looked at. Districts and communes stay
collapsed until opened, and search replaces the tree rather than adding to it, so
Kampong Speu's 1,363 villages cost nothing until someone drills into them.

## Reaching it on a Cambodian phone

The site will need a custom domain before it goes out to provincial leaders.
Cellcard filters `*.netlify.app` at the DNS level: on Cellcard mobile data Safari
reports "the server stopped responding", while the same phone loads the site fine
over WiFi, over a VPN, and over Cloudflare's 1.1.1.1 encrypted DNS. Netlify itself
is healthy — the block is on the shared free-hosting hostname, not on this project.

Because 1.1.1.1 resolves it, the filtering keys on the name rather than on Netlify's
IP ranges, so pointing a domain of our own at the same Netlify project is enough.
Every request the frontend makes is same-origin and relative (`/api/entries`,
`/api/villages`, `/data/villages/*.json`), so moving to a custom domain needs no
code change at all — add the domain in Netlify, set DNS, done.

Two things worth doing before a wide rollout:

- Test on a phone on each carrier leaders actually use — Cellcard, Smart, Metfone.
  One carrier filtering the hostname says nothing about the others.
- Keep the app's only external dependency optional. Google Fonts is loaded
  non-blocking with a system-font fallback, so a blocked or slow font host costs
  nothing but a change of typeface.

Network calls time out after 20 seconds (`REQUEST_TIMEOUT_MS` in `public/app.js`)
rather than hanging, so a dropped provincial connection surfaces as an error a
leader can retry instead of a spinner that never resolves.

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
