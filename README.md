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

## Talent updates

Source: [Talents Forever](https://talentsforever.com/), [public JSON](https://talentsforever.com/data.json), by Chris Baldwin. Game text and artwork belong to Blizzard Entertainment.
