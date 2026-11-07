# i18n-cities

Offline city search with translated city, region and country names. Every city comes with its coordinates, population and time zone.

[![npm version](https://img.shields.io/npm/v/i18n-cities)](https://www.npmjs.com/package/i18n-cities)
[![Release](https://github.com/marcmarine/i18n-cities/actions/workflows/release.yml/badge.svg)](https://github.com/marcmarine/i18n-cities/actions/workflows/release.yml)
[![Types](https://img.shields.io/npm/types/i18n-cities)](https://www.npmjs.com/package/i18n-cities)
[![License](https://img.shields.io/npm/l/i18n-cities)](LICENSE)

The data comes from [GeoNames](https://www.geonames.org/) and is bundled with the package, so searches need no network or API key.

## Usage

```ts
import { loadCities } from 'i18n-cities'

const cities = await loadCities({ locale: 'es', size: 10000 })

cities.search('londres')
// [{ id: 2643743, name: 'Londres', region: 'Inglaterra',
//    country: 'Reino Unido', countryCode: 'GB', latitude: 51.50853,
//    longitude: -0.12574, population: 8961989, timezone: 'Europe/London' }, …]
```

## Languages

| locale | language   |
| ------ | ---------- |
| `en`   | English    |
| `ca`   | Catalan    |
| `de`   | German     |
| `es`   | Spanish    |
| `fr`   | French     |
| `it`   | Italian    |
| `nl`   | Dutch      |
| `pt`   | Portuguese |

English uses the GeoNames names, which are already in English for most places.

## API

### `loadCities({ locale?, size? })`

Loads a city list and builds its search index. The list is imported dynamically, so bundlers put it in its own chunk. Calls with the same locale and size share the index.
- `locale`: BCP 47 tag; only the language is used (`es-MX` → `es`). Supported: see [Languages](#languages). Anything else falls back to `en`. Defaults to `en`.
- `size`: the smallest population of the listed cities, `1000` or `10000`. Defaults to `10000`.

| size    | cities  | data   | gzip    |
| ------- | ------- | ------ | ------- |
| `10000` | 41,917  | 3.0 MB | 1.25 MB |
| `1000`  | 138,976 | 9.8 MB | 3.95 MB |

Each language but English adds its own file, from 65 to 137 KB (30 to 58 KB gzip). See [Languages](#languages).

### `i18n-cities/10000` and `i18n-cities/1000`

Bundlers keep both lists and every translation from `i18n-cities`, each in its own chunk, even when they are never loaded. These keep only their list and the translations you pass in `locales`, so they also suit bundlers that do not split chunks, such as Metro in React Native.

```ts
import { loadCities } from 'i18n-cities/10000'

const cities = await loadCities({
	locale: navigator.language,
	locales: {
		es: () => import('i18n-cities/locales/es'),
	},
})
```

- `locale`: as in `loadCities` above, but anything not in `locales` falls back to `en`.
- `locales`: an import for each translation the app ships. English needs none.

They share the index with `i18n-cities`.

### `cities.search(query, { limit? })`

Cities whose name, region or country contain every word of the query, in the chosen language or in the base one, ignoring case and diacritics (`"japon"` finds `"Japón"`). Exact names go first, then names that start with the query, then the rest; ties go to the larger city. `limit` defaults to 20.

### `cities.all`

Every city in the list, largest first.

### `City`

```ts
type City = {
	id: number // GeoNames id
	name: string
	region: string
	country: string
	countryCode: string // ISO 3166-1 alpha-2
	latitude: number
	longitude: number
	population: number
	timezone: string // IANA, e.g. "Europe/Madrid"
}
```

Names without a translation keep the GeoNames name.

## Data

`data/` is generated from the GeoNames dumps and committed:

```sh
bun run build:data
```

The script downloads `cities1000`, `admin1CodesASCII`, `countryInfo` and `alternateNamesV2` (about 220 MB) into `.cache/` and prints the size of each generated file. To add a language, add it to `LOCALES` in `src/data.ts` and run it again.

## License

The code is MIT. The data in `data/` is derived from [GeoNames](https://www.geonames.org/) and licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
