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

When Blizzard omits an equipped item's level, the collector looks up its base level in the Forever item catalog. Set `wowheadItemLevelFallback` in `config/collection-policy.json` to `true` to also consult public Wowhead Forever tooltips for missing values. The gear tooltip labels catalog values “Base Item Level”.

## Talent updates

Source: [Talents Forever](https://talentsforever.com/), [public JSON](https://talentsforever.com/data.json), by Chris Baldwin. Game text and artwork belong to Blizzard Entertainment.
