import { loadCities as load1000 } from './1000.ts'
import { loadCities as load10000 } from './10000.ts'
import type { Cities, LoadOptions as LocaleOptions } from './cities.ts'
import type { Size } from './data.ts'

export type { Cities, City, Locale, Size } from './cities.ts'
export { LOCALES, resolveLocale, SIZES } from './cities.ts'

export type LoadOptions = LocaleOptions & {
	// Smallest population of the listed cities. The larger list is heavier but
	// finds small towns
	size?: Size
}

/**
 * Loads the city list for a language and size. The index is built once per
 * combination and reused by later calls.
 *
 * Bundlers keep both lists, each in its own chunk. To ship only one, import
 * `loadCities` from `i18n-cities/10000` or `i18n-cities/1000` instead.
 *
 * @example
 * const cities = await loadCities({ locale: 'es', size: 10000 })
 * cities.search('londres') // [{ name: 'Londres', region: 'Inglaterra', … }]
 */
export function loadCities({
	size = 10000,
	...options
}: LoadOptions = {}): Promise<Cities> {
	return size === 1000 ? load1000(options) : load10000(options)
}
