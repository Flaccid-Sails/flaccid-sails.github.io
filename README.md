# Flaccid Sails

A static guild site for World of Warcraft: Forever. The roster, equipment and raid results are demo data until the game and its APIs are ready.

## Run locally

Use Node 24 or newer.

```sh
npm run dev
```

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
