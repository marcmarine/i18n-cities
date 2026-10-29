import { loadCities as load1000 } from './1000.ts'
import { loadCities as load10000 } from './10000.ts'
import type { Cities, Locales } from './cities.ts'
import type { Size } from './data.ts'

export type { Cities, City, Locale, Size } from './cities.ts'
export { LOCALES, resolveLocale, SIZES } from './cities.ts'

export type LoadOptions = {
	// BCP 47 tag; only the language is used ("es-MX" → "es"). Unsupported
	// languages fall back to English
	locale?: string
	// Smallest population of the listed cities. The larger list is heavier but
	// finds small towns
	size?: Size
}

// Every translation, each in its own chunk
const locales: Required<Locales> = {
	es: () => import('./locales/es.ts'),
}

/**
 * Loads the city list for a language and size. The index is built once per
 * combination and reused by later calls.
 *
 * Bundlers keep both lists and every translation, each in its own chunk. To
 * ship only one list and the translations an app uses, import `loadCities`
 * from `i18n-cities/10000` or `i18n-cities/1000` instead.
 *
 * @example
 * const cities = await loadCities({ locale: 'es', size: 10000 })
 * cities.search('londres') // [{ name: 'Londres', region: 'Inglaterra', … }]
 */
export function loadCities({
	locale,
	size = 10000,
}: LoadOptions = {}): Promise<Cities> {
	return (size === 1000 ? load1000 : load10000)({ locale, locales })
}
