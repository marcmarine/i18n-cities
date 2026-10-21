// Builds the city lists in data/ from the GeoNames dumps
// (https://download.geonames.org/export/dump/, CC BY 4.0)
//
// Run with `bun run build:data`. Downloads are kept in .cache/ and only
// fetched again when they are missing

import { mkdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import {
	type BaseData,
	type CityRow,
	LOCALES,
	type LocaleData,
	SIZES,
} from '../src/data.ts'
import { normalize } from '../src/normalize.ts'

const DUMP_URL = 'https://download.geonames.org/export/dump/'
const root = new URL('../', import.meta.url)
const cacheDir = new URL('.cache/', root)
const dataDir = new URL('data/', root)

async function download(file: string) {
	const target = new URL(file, cacheDir)
	if (await Bun.file(target).exists()) return target.pathname

	console.log(`Downloading ${file}…`)
	const response = await fetch(DUMP_URL + file)
	if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
	await Bun.write(target, response)
	return target.pathname
}

// Yields the lines of a text file, or of one file inside a zip, without
// loading it whole into memory (alternateNamesV2.txt is over 700 MB)
async function* lines(path: string, entry?: string) {
	const stream = entry
		? Bun.spawn(['unzip', '-p', path, entry], { stdout: 'pipe' }).stdout
		: Bun.file(path).stream()
	const decoder = new TextDecoder()
	let buffer = ''
	for await (const chunk of stream) {
		buffer += decoder.decode(chunk, { stream: true })
		const parts = buffer.split('\n')
		buffer = parts.pop() ?? ''
		yield* parts
	}
	buffer += decoder.decode()
	if (buffer) yield buffer
}

await mkdir(cacheDir, { recursive: true })
await mkdir(new URL('locales/', dataDir), { recursive: true })

const [citiesZip, admin1File, countryFile, alternateNamesZip] =
	await Promise.all(
		[
			'cities1000.zip',
			'admin1CodesASCII.txt',
			'countryInfo.txt',
			'alternateNamesV2.zip',
		].map(download),
	)

// Countries: ISO code → name, and geonameid → ISO code
const countries: Record<string, string> = {}
const countryIds = new Map<string, string>()
for await (const line of lines(countryFile)) {
	if (!line || line.startsWith('#')) continue
	const cols = line.split('\t')
	countries[cols[0]] = cols[4]
	countryIds.set(cols[16], cols[0])
}

// Regions: "ES.56" → name, and geonameid → "ES.56"
const allRegions: Record<string, string> = {}
const regionIds = new Map<string, string>()
for await (const line of lines(admin1File)) {
	if (!line) continue
	const [code, name, , id] = line.split('\t')
	allRegions[code] = name
	regionIds.set(id, code)
}

// Cities, largest first so the lists read naturally and ties keep that order
const cities: CityRow[] = []
for await (const line of lines(citiesZip, 'cities1000.txt')) {
	if (!line) continue
	const cols = line.split('\t')
	cities.push([
		Number(cols[0]),
		cols[1],
		Number(cols[4]),
		Number(cols[5]),
		cols[8],
		cols[10],
		Number(cols[14]),
		cols[17],
	])
}
cities.sort((a, b) => b[6] - a[6])
const cityIds = new Set(cities.map((city) => String(city[0])))

// Every usable alternate name, per locale and place, in file order
type Candidate = { name: string; preferred: boolean; short: boolean }
const candidates = new Map<string, Map<string, Candidate[]>>(
	LOCALES.map((locale) => [locale, new Map()]),
)

// Abbreviations such as "UK", "RU" or "EE. UU."
const abbreviation = /^[\p{Lu}. ]{1,6}$/u

console.log('Reading alternate names…')
for await (const line of lines(alternateNamesZip, 'alternateNamesV2.txt')) {
	const cols = line.split('\t')
	const names = candidates.get(cols[2])
	if (!names) continue
	const id = cols[1]
	if (!cityIds.has(id) && !regionIds.has(id) && !countryIds.has(id)) continue
	// Colloquial and historic names
	if (cols[6] === '1' || cols[7] === '1') continue
	const name = cols[3]
	if (abbreviation.test(name)) continue

	const list = names.get(id) ?? []
	list.push({ name, preferred: cols[4] === '1', short: cols[5] === '1' })
	names.set(id, list)
}

// Cities: the preferred name; failing that, the first one that is not a
// short name. Regions and countries often have the official name as the
// preferred one, so a short name wins when it is a shortened form of it
// ("Cataluña" over "Comunidad Autónoma de Cataluña", "Türkiye" over
// "Republic of Türkiye"), but not when it is another name ("República
// Dominicana" over "Santo Domingo")
function choose(id: string, list: Candidate[]) {
	const preferred = list.find((candidate) => candidate.preferred)
	if (cityIds.has(id)) {
		return (preferred ?? list.find((candidate) => !candidate.short) ?? list[0])
			.name
	}
	const preferredShort = list.find(
		(candidate) => candidate.preferred && candidate.short,
	)
	if (preferredShort) return preferredShort.name
	const shorts = list.filter((candidate) => candidate.short)
	if (!preferred) return (shorts[0] ?? list[0]).name
	const official = normalize(preferred.name)
	const shortened = shorts.find((candidate) =>
		official.includes(normalize(candidate.name)),
	)
	return (shortened ?? preferred).name
}

const stripDiacritics = (value: string) =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.normalize('NFC')

// Only names that differ from the base ones are kept. A translation that is
// just the base name without diacritics ("Karditsa" for "Kardítsa") is not
// worth it
function differs(name: string, base: string) {
	if (name === base) return false
	return !(
		normalize(name) === normalize(base) && name === stripDiacritics(name)
	)
}

async function writeJson(file: string, data: unknown) {
	const url = new URL(file, dataDir)
	const json = JSON.stringify(data)
	await Bun.write(url, json)
	const size = (await stat(url)).size
	const gzipped = gzipSync(json).length
	const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
	console.log(
		`${file.padEnd(22)} ${mb(size).padStart(9)} ${mb(gzipped).padStart(9)} gzip`,
	)
}

console.log()
for (const size of SIZES) {
	const list = cities.filter((city) => city[6] >= size)
	const regions: Record<string, string> = {}
	for (const city of list) {
		const code = `${city[4]}.${city[5]}`
		if (allRegions[code]) regions[code] = allRegions[code]
	}
	const data: BaseData = { countries, regions, cities: list }
	await writeJson(`cities-${size}.json`, data)
	console.log(`  ${list.length} cities`)
}

// Locale files cover the largest list, so they work with any size.
// cities1000 also has some smaller towns (administrative seats), which no
// list includes
for (const [locale, names] of candidates) {
	const data: LocaleData = { countries: {}, regions: {}, cities: {} }
	for (const [id, list] of names) {
		const name = choose(id, list)
		const country = countryIds.get(id)
		const region = regionIds.get(id)
		if (country) {
			if (differs(name, countries[country])) data.countries[country] = name
		} else if (region) {
			if (differs(name, allRegions[region])) data.regions[region] = name
		}
	}
	for (const city of cities) {
		if (city[6] < SIZES[0]) continue
		const list = names.get(String(city[0]))
		if (!list) continue
		const name = choose(String(city[0]), list)
		if (differs(name, city[1])) data.cities[city[0]] = name
	}
	await writeJson(`locales/${locale}.json`, data)
}
