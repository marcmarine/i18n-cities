import { createLoader } from './cities.ts'
import type { BaseData } from './data.ts'

export type { Cities, City, LoadOptions, Locale } from './cities.ts'
export { LOCALES, resolveLocale } from './cities.ts'

/**
 * Loads the cities with at least 10000 people for a language. The index is
 * built once per language and reused by later calls.
 *
 * @example
 * import { loadCities } from 'i18n-cities/10000'
 *
 * const cities = await loadCities({ locale: 'es' })
 * cities.search('londres') // [{ name: 'Londres', region: 'Inglaterra', … }]
 */
export const loadCities = createLoader(10000, () =>
	import('../data/cities-10000.json').then(
		(module) => module.default as unknown as BaseData,
	),
)
