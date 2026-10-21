import { describe, expect, test } from 'bun:test'
import { type City, loadCities, resolveLocale, SIZES } from '.'

const label = (city: City) => [city.name, city.region, city.country].join(', ')

describe.each(SIZES)('loadCities, size %d', (size) => {
	const english = loadCities({ locale: 'en', size })
	const spanish = loadCities({ locale: 'es', size })

	test('returns nothing for an empty query', async () => {
		expect((await english).search('  ')).toEqual([])
	})

	test('translates city, region and country names', async () => {
		const [enCity] = (await english).search('barcelona')
		const [esCity] = (await spanish).search('barcelona')
		expect(label(enCity)).toBe('Barcelona, Catalonia, Spain')
		expect(label(esCity)).toBe('Barcelona, Cataluña, España')
	})

	test('finds cities by their translated name', async () => {
		const [city] = (await spanish).search('Londres')
		expect(label(city)).toBe('Londres, Inglaterra, Reino Unido')
	})

	test('keeps finding cities by their base name', async () => {
		expect((await spanish).search('London')[0].name).toBe('Londres')
	})

	test('matches translated and base country names', async () => {
		expect((await spanish).search('Madrid España')[0].name).toBe('Madrid')
		expect((await spanish).search('Madrid Spain')[0].name).toBe('Madrid')
	})

	test('ignores diacritics and case', async () => {
		const [city] = (await spanish).search('kyoto japon')
		expect(city.name).toBe('Kioto')
		expect(city.country).toBe('Japón')
	})

	test('ranks exact names before names that start with the query', async () => {
		// Every city called Paris goes before "Parish" or "Parisot"
		const results = (await english).search('Paris')
		expect(results[0].name).toBe('Paris')
		expect(results[0].countryCode).toBe('FR')
		const firstPrefixed = results.findIndex((city) => city.name !== 'Paris')
		expect(
			results.slice(firstPrefixed).every((city) => city.name !== 'Paris'),
		).toBe(true)
	})

	test('ranks larger cities first among equal matches', async () => {
		const results = (await english).search('Córdoba')
		expect(results[0].countryCode).toBe('AR')
	})

	test('limits the number of results', async () => {
		expect((await english).search('san', { limit: 3 })).toHaveLength(3)
	})

	test('includes coordinates, population and time zone', async () => {
		const [city] = (await english).search('barcelona')
		expect(city.timezone).toBe('Europe/Madrid')
		expect(city.countryCode).toBe('ES')
		expect(city.latitude).toBeCloseTo(41.39, 1)
		expect(city.longitude).toBeCloseTo(2.16, 1)
		expect(city.population).toBeGreaterThan(1_000_000)
	})
})

describe('loadCities', () => {
	test('reuses the index for the same locale and size', () => {
		expect(loadCities({ locale: 'es', size: 10000 })).toBe(
			loadCities({ locale: 'es-ES', size: 10000 }),
		)
	})

	test('only the 1000 list includes towns under 10000 people', async () => {
		const from1000 = await loadCities({ size: 1000 })
		const from10000 = await loadCities({ size: 10000 })
		expect(from1000.all.length).toBeGreaterThan(from10000.all.length)
		expect(from10000.all.every((city) => city.population >= 10000)).toBe(true)
	})
})

describe('resolveLocale', () => {
	test('keeps only the language', () => {
		expect(resolveLocale('es-MX')).toBe('es')
	})

	test('falls back to English', () => {
		expect(resolveLocale('xx')).toBe('en')
		expect(resolveLocale()).toBe('en')
	})
})
