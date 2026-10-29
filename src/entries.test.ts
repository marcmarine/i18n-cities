import { describe, expect, test } from 'bun:test'
import { loadCities as load1000 } from './1000.ts'
import { loadCities as load10000 } from './10000.ts'
import { loadCities } from './index.ts'

describe.each([
	[10000, load10000, 'cities-1000-'],
	[1000, load1000, 'cities-10000-'],
] as const)('i18n-cities/%d', (size, load, otherList) => {
	test('loads its own list', async () => {
		const cities = await load({ locale: 'es' })
		expect(cities.size).toBe(size)
		expect(cities.locale).toBe('es')
		expect(cities.search('londres')[0]?.name).toBe('Londres')
	})

	test('defaults to English', async () => {
		expect((await load()).locale).toBe('en')
	})

	test('shares the index with the main entry point', () => {
		expect(load({ locale: 'es' })).toBe(loadCities({ locale: 'es', size }))
	})

	test('does not bundle the other list', async () => {
		const { success, outputs } = await Bun.build({
			entrypoints: [new URL(`./${size}.ts`, import.meta.url).pathname],
			splitting: true,
			target: 'node',
			naming: { chunk: '[name]-[hash].[ext]' },
		})
		expect(success).toBe(true)
		const files = outputs.map((output) => output.path)
		expect(files.some((file) => file.includes(`cities-${size}-`))).toBe(true)
		expect(files.some((file) => file.includes(otherList))).toBe(false)
	})
})
