# YWAM Siem Reap

> Parked here as an interim home. This directory is a self-contained repo in its
> own right and is meant to become one — nothing outside it is needed, and
> nothing in the Vision 2033 tracker around it refers to it. The root
> `netlify.toml` publishes the tracker, not this, so the site is not deployed
> from this repo. To split it out with its history intact:
> `git subtree split --prefix=ywam-siem-reap -b ywam-site`

The public website for YWAM Siem Reap — a missions base in northern Cambodia —
and its Discipleship Training School.

Bilingual English / Khmer, one page, no build step. Everything it needs is in
`public/`; a static host serves that directory and the site works.

```
public/
  index.html          the whole page: markup, styles and component logic
  assets/             photos, logos, fonts, and the design-system runtime
```

## Running it locally

There is nothing to compile. Serve `public/` over HTTP and open it — opening
`index.html` from the filesystem will not work, because the page fetches its
runtime and fonts as real requests.

```sh
npx serve public          # or: python3 -m http.server -d public 8000
```

## Deploying

`netlify.toml` publishes `public/` as-is. Any static host works the same way —
point it at `public/`, no build command.

## How the page is put together

It came out of a design tool as a single component, and it is still shaped that
way. Three parts of `public/index.html` matter:

| Where | What |
| --- | --- |
| `<style>` in `<helmet>` | Design-system tokens (`--color-accent`, `--font-heading`) and `@font-face` rules. The system's look is tuned here. |
| The markup under `<x-dc>` | Every section, top to bottom. `{{ name }}` is a binding filled in by the component below. |
| `<script type="text/x-dc">` at the bottom | The component: countdown, language toggle, the day timeline, the school list. |

`assets/ds-runtime.js` is the design system's runtime — it renders `<x-dc>`,
resolves `{{ }}` bindings, and handles the `sc-camel-*` and `style-hover`
attributes. It loads React from `assets/react*.js`, so the page has no network
dependencies beyond the hero clip below. Don't hand-edit the runtime; it is
generated output.

### Editing content

Copy lives directly in the markup, in paired spans:

```html
<span class="lang-en">Where you go</span><span class="lang-kh kh">ទីកន្លែង</span>
```

Both languages ship on every page load; `[data-lang="kh"]` decides which is
shown. If you add a line in one language, add it in the other — an untranslated
span simply vanishes when a reader switches.

Two lists at the top of the component script drive repeated sections:

- `DAY` — the six moments in the "day here" timeline (time + description).
- `SCHOOLS` — the nine village schools (name + which days they run).

The intake date is a prop, `nextIntake` (default `2026-09-26`); the countdown
in the hero is computed from it.

### Placeholders still to fill in

The design shipped with bracketed placeholders where real details go. All of
them are in `public/index.html`:

| Placeholder | Count | Where |
| --- | --- | --- |
| `[ Village name ]` | 9 | `SCHOOLS` list in the component script |
| `[ School fee ]` | 1 | Cost panel |
| `[ Street address ]`, `[ email ]`, `[ WhatsApp ]`, `[ Name ]` | 1 each | Practical / apply / footer |
| `[ year ]` | 1 | Footer |

Search for `[ ` to find them.

## The hero clip

The background video in the hero and the reel is a generated clip served from a
CloudFront URL we do not control. It is a single `CLIP` constant in the
component script.

Both `<video>` elements carry a poster image, so if that URL ever stops
resolving the page still looks right — you get the still instead of the motion.
To host the clip ourselves, save it as `public/assets/hero.mp4` and change the
constant to `"assets/hero.mp4"`.

## Known gaps

- A few strings in the hero and cost panels are English-only and stay English
  when the page is switched to Khmer — notably "Applications close 1 September".
- `DAY` and `SCHOOLS` each carry an unused `p:` key pointing at `assets/p-IMG_*.jpg`
  paths that were never part of the export. Nothing reads them; the section
  images are the `<img>` tags in the markup instead.
