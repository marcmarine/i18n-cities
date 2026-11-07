// Letters with diacritics in the data, by the letters they stand for. A table
// instead of String.prototype.normalize and \p{Diacritic}, which some
// JavaScript engines and bundlers leave unchanged ("merida" would not find
// "Mérida"). Some letters are not a base letter plus a diacritic ("ł", "ø",
// "ß"), so NFD would not change them anyway
const groups: Record<string, string> = {
	a: 'àáâãäåāăąạảấầẩẫậắằẳẵặǎ',
	ae: 'æǣ',
	c: 'çćĉċč',
	d: 'ðďđḍḏḑ',
	e: 'èéêëēĕėęěǝəẹẻẽếềểễệ',
	g: 'ğġģǧ',
	h: 'ħḥḩẖ',
	i: 'ìíîïĩīĭįıǐḯỉị',
	ij: 'ĳ',
	j: 'ǰ',
	k: 'ķḳḵ',
	l: 'ĺļľł',
	n: 'ñńņňṅṇṉ',
	o: 'òóôõöøōŏőơǒǫǭọỏốồổỗộớờởỡợ',
	oe: 'œ',
	r: 'ŕŗřṛṟ',
	s: 'śŝşšșṣ',
	ss: 'ß',
	t: 'ţťțṭṯ',
	th: 'þ',
	u: 'ùúûüũūŭůűųưǔụủứừửữự',
	y: 'ýÿŷỳỵỷỹ',
	z: 'źżžẓẕ',
	υ: 'ύ',
	и: 'й',
	і: 'ї',
	// Marks written on their own ("Al-`Ula", "Hawaiʻi")
	'': '`´·ʻʼʾʿ',
}

// Character code → replacement
const replacements = new Map<number, string>()
for (const [base, group] of Object.entries(groups)) {
	for (let i = 0; i < group.length; i++) {
		replacements.set(group.charCodeAt(i), base)
	}
}
// Combining marks, which follow the letter in text typed in decomposed form,
// and the Arabic kasratan and kasra of some transliterations
for (let code = 0x300; code <= 0x36f; code++) replacements.set(code, '')
replacements.set(0x64d, '').set(0x650, '')

const GRAVE_ACCENT = 0x60

// Lowercases and strips diacritics so "japon" matches "Japón", "tokyo"
// matches "Tōkyō" and "lodz" matches "Łódź". A loop instead of regular
// expressions: it builds the search index, and it is several times faster
export function normalize(value: string) {
	const lower = value.toLowerCase()
	let result = ''
	let start = 0
	for (let i = 0; i < lower.length; i++) {
		const code = lower.charCodeAt(i)
		// Only the grave accent among ASCII characters
		if (code < 0x80 && code !== GRAVE_ACCENT) continue
		const replacement = replacements.get(code)
		if (replacement === undefined) continue
		result += lower.slice(start, i) + replacement
		start = i + 1
	}
	// Concatenation makes a rope; toLowerCase returns a flat string, which the
	// search goes through faster
	return start === 0 ? lower : (result + lower.slice(start)).toLowerCase()
}
