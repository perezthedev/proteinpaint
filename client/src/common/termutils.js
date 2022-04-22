import { dofetch3 } from '../client'

/*
to retrieve the termjson object of one term, using its id
only works for a termdb-enabled dataset

if the function is attached to an instance with .state{ dslabel, genome }, then simply call:
	await instance.getterm( ? )

otherwise, do:
	await getterm( id, dslabel, genome )

*/

const cache = { serverData: {} }

export async function getterm(termid, dslabel = null, genome = null) {
	if (!termid) throw 'getterm: termid missing'
	if (this && this.state && this.state.vocab) {
		if (this.state.vocab.dslabel) dslabel = this.state.vocab.dslabel
		if (this.state.vocab.genome) genome = this.state.vocab.genome
	}
	if (!dslabel) throw 'getterm: dslabel missing'
	if (!genome) throw 'getterm: genome missing'
	const data = await dofetch3(`termdb?dslabel=${dslabel}&genome=${genome}&gettermbyid=${termid}`)
	if (data.error) throw 'getterm: ' + data.error
	if (!data.term) throw 'no term found for ' + termid
	return data.term
}

export function sample_match_termvaluesetting(row, filter) {
	// console.log(row, filter)
	const lst = !filter ? [] : filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if (item.type == 'tvslst') {
			if (sample_match_termvaluesetting(row, item)) {
				numberofmatchedterms++
			}
		} else {
			const t = item.tvs
			const samplevalue = row[t.term.id]

			let thistermmatch

			if (t.term.type == 'categorical') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count
				// t may be frozen, should not modify to attach valueset if missing
				const valueset = t.valueset ? t.valueset : new Set(t.values.map(i => i.key))
				thistermmatch = valueset.has(samplevalue)
			} else if (t.term.type == 'integer' || t.term.type == 'float') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count

				for (const range of t.ranges) {
					if ('value' in range) {
						thistermmatch = samplevalue === range.value // || ""+samplevalue == range.value || samplevalue == ""+range.value //; if (thistermmatch) console.log(i++)
						if (thistermmatch) break
					} else {
						// actual range
						if (t.term.values) {
							const v = t.term.values[samplevalue.toString()]
							if (v && v.uncomputable) {
								continue
							}
						}
						let left, right
						if (range.startunbounded) {
							left = true
						} else if ('start' in range) {
							if (range.startinclusive) {
								left = samplevalue >= range.start
							} else {
								left = samplevalue > range.start
							}
						}
						if (range.stopunbounded) {
							right = true
						} else if ('stop' in range) {
							if (range.stopinclusive) {
								right = samplevalue <= range.stop
							} else {
								right = samplevalue < range.stop
							}
						}
						thistermmatch = left && right
					}
					if (thistermmatch) break
				}
			} else if (t.term.type == 'condition') {
				const key = getPrecomputedKey(t)
				const anno = samplevalue && samplevalue[key]
				if (anno) {
					thistermmatch = Array.isArray(anno)
						? t.values.find(d => anno.includes(d.key))
						: t.values.find(d => d.key == anno)
				}
			} else if (t.term.type == 'survival') {
				// don't do anything?
			} else {
				throw 'unknown term type'
			}

			if (t.isnot) {
				thistermmatch = !thistermmatch
			}
			if (thistermmatch) numberofmatchedterms++
		}

		// if one tvslst is matched with an "or" (Set UNION), then sample is okay
		if (filter.join == 'or' && numberofmatchedterms) return true
	}

	// for join="and" (Set intersection)
	if (numberofmatchedterms == lst.length) return true
}
