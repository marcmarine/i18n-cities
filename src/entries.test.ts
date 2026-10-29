import { describe, expect, test } from 'bun:test'
import { loadCities as load1000 } from './1000.ts'
import { loadCities as load10000 } from './10000.ts'
import { loadCities } from './index.ts'

const locales = { es: () => import('./locales/es.ts') }

async function bundle(entry: string) {
	const { success, outputs } = await Bun.build({
		entrypoints: [new URL(entry, import.meta.url).pathname],
		splitting: true,
		target: 'browser',
		naming: { chunk: '[name]-[hash].[ext]' },
	})
	expect(success).toBe(true)
	// File names, e.g. "es-1x08hz9s.js"
	return outputs.map((output) => output.path.split('/').pop() ?? '')
}

describe.each([
	[10000, load10000, 'cities-1000-'],
	[1000, load1000, 'cities-10000-'],
] as const)('i18n-cities/%d', (size, load, otherList) => {
	test('loads its own list in English', async () => {
		const cities = await load()
		expect(cities.size).toBe(size)
		expect(cities.locale).toBe('en')
	})

	test('translates to the locales it is given', async () => {
		const cities = await load({ locale: 'es-ES', locales })
		expect(cities.locale).toBe('es')
		expect(cities.search('londres')[0]?.name).toBe('Londres')
	})

	test('falls back to English for locales it is not given', async () => {
		expect((await load({ locale: 'es' })).locale).toBe('en')
		expect((await load({ locale: 'xx', locales })).locale).toBe('en')
	})

	test('shares the index with the main entry point', () => {
		expect(load({ locale: 'es', locales })).toBe(
			loadCities({ locale: 'es', size }),
		)
	})

	test('bundles only its list and no translations', async () => {
		const files = await bundle(`./${size}.ts`)
		expect(files.some((file) => file.startsWith(`cities-${size}-`))).toBe(true)
		expect(files.some((file) => file.startsWith(otherList))).toBe(false)
		expect(files.some((file) => file.startsWith('es-'))).toBe(false)
	})
})

describe('i18n-cities', () => {
	test('bundles every list and translation', async () => {
		const files = await bundle('./index.ts')
		for (const name of ['cities-1000-', 'cities-10000-', 'es-']) {
			expect(files.some((file) => file.startsWith(name))).toBe(true)
		}
	})
})
