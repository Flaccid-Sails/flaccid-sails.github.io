# Flaccid Sails

A static guild site for World of Warcraft: Forever. It supports Blizzard-only guild snapshots without Warcraft Logs. A fresh checkout uses demo data until a live snapshot is collected.

## Run locally

Use Node 24 or newer.

```sh
npm run dev
```

Other commands:

```sh
npm run data:refresh
npm run data:live -- --allow-authenticated-blizzard
npm test
npm run build
npm run preview
```

When Blizzard omits an equipped item's level, the collector checks the Blizzard Forever item catalog, then public Wowhead Forever tooltips. Set `wowheadItemLevelFallback` in `config/collection-policy.json` to `false` for Blizzard-only lookups. The gear tooltip labels catalog values “Base Item Level”.

The roster uses Blizzard’s average item level when available, followed by its equipped item level. If both are missing and every equipped combat item has a known level, the roster shows “Est. item level”. This is the average of equipped combat gear, rounded down. A two-handed weapon counts for both hands when the off hand is empty. Shirts, tabards and ammunition are excluded.

## Talent updates

Source: [Talents Forever](https://talentsforever.com/), [public JSON](https://talentsforever.com/data.json), by Chris Baldwin. Game text and artwork belong to Blizzard Entertainment.
