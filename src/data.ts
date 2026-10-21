// Shapes of the generated files in data/, shared by the build script and the
// runtime

export const LOCALES = ['en', 'es'] as const
export const SIZES = [1000, 10000] as const

export type Locale = (typeof LOCALES)[number]
export type Size = (typeof SIZES)[number]

// Tuples instead of objects so keys are not repeated thousands of times:
// geonameid, name, latitude, longitude, country code, admin1 code,
// population, timezone
export type CityRow = [
	id: number,
	name: string,
	latitude: number,
	longitude: number,
	countryCode: string,
	regionCode: string,
	population: number,
	timezone: string,
]

export type BaseData = {
	// ISO 3166-1 alpha-2 code → name
	countries: Record<string, string>
	// "<country code>.<admin1 code>" → name
	regions: Record<string, string>
	// Sorted by population, largest first
	cities: CityRow[]
}

// Only the names that differ from the base data
export type LocaleData = {
	countries: Record<string, string>
	regions: Record<string, string>
	// geonameid → name
	cities: Record<string, string>
}
