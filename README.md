# Flaccid Sails

A static guild site for World of Warcraft: Forever. The roster, equipment and raid results are demo data until the game and its APIs are ready.

## Run locally

Use Node 24 or newer.

```sh
npm run dev
```

The dev server serves the site at `/`; use the local URL printed by Vite.

Site styles are maintained in `site/src` as SCSS.

The first request loads only roster summaries, logs, zones, and file references from `data/snapshot.json`. Reports use a small index and load full report details when hovered. The dashboard loads a precomputed summary. Equipment, statistics, and talent builds live in per-character files; the talent catalog loads when the talent window opens. GitHub Pages serves these static JSON files without a server-side API.

Other commands:

```sh
npm run data:refresh
npm test
npm run build
npm run preview
```

## Talent updates

Source: [Talents Forever](https://talentsforever.com/), [public JSON](https://talentsforever.com/data.json), by Chris Baldwin. The source explicitly licenses its export under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Game text and artwork belong to Blizzard Entertainment.

## When Forever launches

This policy is a tested scheduling contract, not an implemented Forever API integration. Demo generation and talent refresh make zero requests to Blizzard or Warcraft Logs. When the APIs are confirmed, add the live provider behind this policy and retain the generated static JSON contract.
