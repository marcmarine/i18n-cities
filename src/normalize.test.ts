import { describe, expect, test } from 'bun:test'
import base from '../data/cities-1000.json'
import { BASE_LOCALE, type BaseData, LOCALES, type LocaleData } from './data.ts'
import { normalize } from './normalize.ts'

describe('normalize', () => {
	test('strips diacritics without String.prototype.normalize', () => {
		// Some engines (and bundler transforms) leave the string as it is
		const original = String.prototype.normalize
		String.prototype.normalize = function (this: string) {
			return this
		}
		try {
			expect(normalize('Mérida')).toBe('merida')
			expect(normalize('ŁÓDŹ')).toBe('lodz')
			expect(normalize('Tromsø')).toBe('tromso')
			expect(normalize('Straße')).toBe('strasse')
		} finally {
			String.prototype.normalize = original
		}
	})

	test('strips diacritics typed in decomposed form', () => {
		expect(normalize('Mérida')).toBe('merida')
	})

	// Fails when the data has a letter with diacritics that is not in the
	// table
	test('strips every diacritic in the data', async () => {
		const { cities, regions, countries } = base as unknown as BaseData
		const names = [
			...cities.map((city) => city[1]),
			...Object.values(regions),
			...Object.values(countries),
		]
		for (const locale of LOCALES) {
			if (locale === BASE_LOCALE) continue
			const data: LocaleData = (await import(`../data/locales/${locale}.json`))
				.default
			names.push(
				...Object.values(data.cities),
				...Object.values(data.regions),
				...Object.values(data.countries),
			)
		}
		const missed = new Set<string>()
		for (const name of names) {
			for (const char of normalize(name)) {
				if (char.normalize('NFD').replace(/\p{Diacritic}/gu, '') !== char) {
					missed.add(char)
				}
			}
		}
		expect([...missed]).toEqual([])
	})
})
