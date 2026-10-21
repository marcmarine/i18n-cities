import {
	type BaseData,
	LOCALES,
	type Locale,
	type LocaleData,
	SIZES,
	type Size,
} from './data.ts'
import { normalize } from './normalize.ts'

export type { Locale, Size }
export { LOCALES, SIZES }

export type City = {
	// GeoNames id
	id: number
	name: string
	region: string
	country: string
	// ISO 3166-1 alpha-2
	countryCode: string
	latitude: number
	longitude: number
	population: number
	// IANA time zone, e.g. "Europe/Madrid"
	timezone: string
}

export type LoadOptions = {
	// BCP 47 tag; only the language is used ("es-MX" → "es"). Unsupported
	// languages fall back to English
	locale?: string
	// Smallest population of the listed cities. The larger list is heavier but
	// finds small towns
	size?: Size
}

export type Cities = {
	locale: Locale
	size: Size
	// Every city, largest first
	all: readonly City[]
	// Cities whose name, region or country (in the chosen language or the base
	// one) contain every word of the query. Exact names go first, then names
	// that start with the query, then the rest; ties by population
	search(query: string, options?: { limit?: number }): City[]
}

// Literal paths so bundlers split each list into its own chunk
function importBase(size: Size): Promise<BaseData> {
	switch (size) {
		case 1000:
			return import('../data/cities-1000.json').then(
				(module) => module.default as unknown as BaseData,
			)
		case 10000:
			return import('../data/cities-10000.json').then(
				(module) => module.default as unknown as BaseData,
			)
	}
}

function importLocale(locale: Locale): Promise<LocaleData> {
	switch (locale) {
		case 'en':
			return import('../data/locales/en.json').then(
				(module) => module.default as LocaleData,
			)
		case 'es':
			return import('../data/locales/es.json').then(
				(module) => module.default as LocaleData,
			)
	}
}

export function resolveLocale(locale = 'en'): Locale {
	const language = locale.split(/[-_]/)[0].toLowerCase()
	return (LOCALES as readonly string[]).includes(language)
		? (language as Locale)
		: 'en'
}

const loaded = new Map<string, Promise<Cities>>()

/**
 * Loads the city list for a language and size. The index is built once per
 * combination and reused by later calls.
 *
 * @example
 * const cities = await loadCities({ locale: 'es', size: 10000 })
 * cities.search('londres') // [{ name: 'Londres', region: 'Inglaterra', … }]
 */
export function loadCities({
	locale,
	size = 10000,
}: LoadOptions = {}): Promise<Cities> {
	const resolved = resolveLocale(locale)
	const key = `${resolved}:${size}`
	let cities = loaded.get(key)
	if (!cities) {
		cities = Promise.all([importBase(size), importLocale(resolved)]).then(
			([base, translations]) =>
				createCities(resolved, size, base, translations),
		)
		cities.catch(() => loaded.delete(key))
		loaded.set(key, cities)
	}
	return cities
}

function createCities(
	locale: Locale,
	size: Size,
	base: BaseData,
	translations: LocaleData,
): Cities {
	const count = base.cities.length
	const all: City[] = new Array(count)
	// Normalized names (translated and base) used to rank the matches
	const names: string[][] = new Array(count)
	// Every searchable field joined by newlines. Query words never contain
	// whitespace, so a word can only match within one field
	const haystacks: string[] = new Array(count)

	for (let i = 0; i < count; i++) {
		const [
			id,
			baseName,
			latitude,
			longitude,
			countryCode,
			admin1,
			population,
			timezone,
		] = base.cities[i]
		const regionCode = `${countryCode}.${admin1}`
		const baseRegion = base.regions[regionCode] ?? ''
		const baseCountry = base.countries[countryCode] ?? countryCode
		const city: City = {
			id,
			name: translations.cities[id] ?? baseName,
			region: translations.regions[regionCode] ?? baseRegion,
			country: translations.countries[countryCode] ?? baseCountry,
			countryCode,
			latitude,
			longitude,
			population,
			timezone,
		}
		all[i] = city

		const cityNames = unique([normalize(city.name), normalize(baseName)])
		names[i] = cityNames
		haystacks[i] = unique([
			...cityNames,
			normalize(city.region),
			normalize(baseRegion),
			normalize(city.country),
			normalize(baseCountry),
		]).join('\n')
	}

	return {
		locale,
		size,
		all,

		search(query, { limit = 20 } = {}) {
			const words = normalize(query).split(/\s+/).filter(Boolean)
			if (!words.length) return []

			// The list is sorted by population, so a stable sort by rank keeps the
			// largest cities first within each rank
			const matches: { index: number; rank: number }[] = []
			for (let i = 0; i < count; i++) {
				const haystack = haystacks[i]
				if (words.every((word) => haystack.includes(word))) {
					matches.push({ index: i, rank: rank(names[i], words) })
				}
			}
			return matches
				.sort((a, b) => a.rank - b.rank)
				.slice(0, limit)
				.map(({ index }) => all[index])
		},
	}
}

function unique(values: string[]) {
	return [...new Set(values.filter(Boolean))]
}

// 0 when a name is the query (or its leading words, so "madrid spain" ranks
// Madrid as exact), 1 when a name starts with them, 2 otherwise
function rank(names: string[], words: string[]) {
	let best = 2
	for (let length = words.length; length > 0; length--) {
		const prefix = words.slice(0, length).join(' ')
		for (const name of names) {
			if (name === prefix) return 0
			if (name.startsWith(prefix)) best = 1
		}
	}
	return best
}
