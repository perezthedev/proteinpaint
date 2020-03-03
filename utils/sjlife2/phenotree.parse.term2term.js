/*
input is the "Phenotree Data Map" file:
names are case-sensitive


1	Root note	Cancer-related Variables
2	First Branch	Diagnosis 
3	Second Branch	Diagnosis Group
4	Third Branch	-
5	Fourth Branch	-
6	SJLIFE Variable Names	diaggrpb


for columns 1-5:
- blank cell or '-' means no value




column 6:
	if given, is the term id and will match with the column header at file 'test/matrix'
	if not given, use the term name as term id



special handling of chronic condition terms (3: organ system, 4: grouped condition, 5: condition):
- all under "CTCAE Graded Events"
- type:"condition"
- chart configs




second optional input is keep/termjson, 2 column:
1  term_id
2  {}

to override automatically generated contents in termjson file


outputs these files
* termdb    - load to "terms" table
* ancestry  - load to "ancestry" table
*/

const abort = m => {
	console.error('ERROR: ' + m)
	process.exit()
}

if (process.argv.length < 3) abort('<phenotree txt file> <keep/termjson file> outputs to: termdb, ancestry')
const infile_phenotree = process.argv[2]
const infile_keeptermjson = process.argv[3] // optional

const fs = require('fs')

/////////////////// helpers

const str2level = str => {
	// parses column 1-5
	const v = str.trim()
	if (!v || v == '-') return null
	if (v.indexOf('"') != -1) abort('Level name should not have double quote: ' + str)
	return v
}

/* unique words from levels 1-5, to be printed out in alphabetic order for identifying suspicious duplicated words
key: id
	if column 6 is given, use as key, else, use term name as key
value: term name
*/
const map1 = new Map()
const map2 = new Map()
const map3 = new Map()
const map4 = new Map()
const map5 = new Map()

/* keep a list of terms, by their order of appearance in the phenotree file
to be printed out and loaded to a small table
for ordering terms in phewas
*/
const allterms_byorder = new Set()

/* for recalling id from a non-leaf level name
k: name
v: id
*/
const name2id = new Map()

const t2t = new Map()
// k: parent id
// v: set of children id
const c2p = new Map() // ancestry
// k: child id
// v: map { k: parent id, v: level } parents from the entire ancestry
const c2immediatep = new Map()
// k: child id
// v: immediate parent id

const patientcondition_terms = new Set()
// the set of terms under CTCAE branch, to make its json differently

function termjson_outputoneset2(map, lines) {
	/*
arg is set of words from root or a level, e.g. set1
each word is a term
*/
	let leafcount = 0
	for (const id of [...map.keys()].sort()) {
		let j = keep_termjson.get(id)
		if (!j) {
			// this term not found in keep
			j = {
				name: map.get(id)
			}
		}
		j.id = id

		// test if it is leaf
		if (!t2t.has(id)) {
			j.isleaf = true
			leafcount++
		}

		if (patientcondition_terms.has(id)) {
			// belongs to patient conditions
			j.type = 'condition'
			addattributes_conditionterm(j)
		}

		lines.push(id + '\t' + j.name + '\t' + (c2immediatep.get(id) || '') + '\t' + JSON.stringify(j))
	}
	return map.size + ' terms, ' + leafcount + ' leaf terms'
}

function addattributes_conditionterm(t) {
	/* make graph config for a condition term
   options a bit different for leaf and non-leaf terms
*/

	t.values = {
		'0': { label: '0: No condition' },
		'1': { label: '1: Mild' },
		'2': { label: '2: Moderate' },
		'3': { label: '3: Severe' },
		'4': { label: '4: Life-threatening' },
		'5': { label: '5: Death' },
		'9': { label: 'Unknown status', uncomputable: true }
	}

	if (!t.isleaf) {
		// a non-leaf CHC term
		// collect sub-conditions, so that termsetting UI can generate list of subconditions for grouping
		t.subconditions = {}
		for (const c of t2t.get(t.id)) {
			// id and label is the same based on current data file
			// if not the case, must need id2name mapping
			t.subconditions[c] = { label: c }
		}
	}

	t.groupsetting = {
		useIndex: -1,
		lst: [
			{
				name: 'Any condition vs normal',
				is_grade: true,
				groups: [
					{
						name: 'No condition',
						values: [{ key: '0', label: 'No condition' }]
					},
					{
						name: 'Has condition',
						values: [
							{ key: '1', label: '1: Mild' },
							{ key: '2', label: '2: Moderate' },
							{ key: '3', label: '3: Severe' },
							{ key: '4', label: '4: Life-threatening' },
							{ key: '5', label: '5: Death' }
						]
					}
				]
			}
		]
	}
}

function output_termdb() {
	/* output "termdb" file

each term is one row

col1: term id
col2: {}
lines beginning with # are ignored

manual inspection:
	- terms are sorted alphabetically for inspecting suspicious similar names;
	- this is just a lookup table
	- the order of terms in this table does not impact the order of display
	- #### are level dividers also to assist inspection
*/
	const lines = []

	{
		const str = termjson_outputoneset2(map1, lines)
		console.log('ROOT: ' + str)
	}

	{
		const str = termjson_outputoneset2(map2, lines)
		console.log('Level 1: ' + str)
	}

	{
		const str = termjson_outputoneset2(map3, lines)
		console.log('Level 2: ' + str)
	}

	{
		const str = termjson_outputoneset2(map4, lines)
		console.log('Level 3: ' + str)
	}

	{
		const str = termjson_outputoneset2(map5, lines)
		console.log('Level 4: ' + str)
	}

	fs.writeFileSync('termdb', lines.join('\n') + '\n')
}

function output_ancestry() {
	const out = []
	for (const [c, m] of c2p) {
		for (const p of m.keys()) {
			out.push(c + '\t' + p)
		}
	}
	fs.writeFileSync('ancestry', out.join('\n') + '\n')
}
function output_alltermlst() {
	// may add term group and color etc
	fs.writeFileSync('alltermsbyorder', [...allterms_byorder].join('\n'))
}

//////////////// process file

const lines = fs
	.readFileSync(infile_phenotree, { encoding: 'utf8' })
	.trim()
	.split('\n')

for (let i = 1; i < lines.length; i++) {
	const line = lines[i]

	if (line.startsWith('\t')) abort('line ' + (i + 1) + ' starts with tab')

	const l = line.split('\t')

	let level1 = str2level(l[0]),
		level2 = str2level(l[1]),
		level3 = str2level(l[2]),
		level4 = str2level(l[3]),
		level5 = str2level(l[4])

	let leaflevel = 5 // which level is leaf: 1,2,3,4,5

	/* trim leaf
	if a leaf level is identical as its direct parent, trim this leaf
	*/
	if (!level2) {
		leaflevel = 1
		// no need to trim level1
	} else if (!level3) {
		// level2 is leaf
		leaflevel = 2
		if (level2 == level1) {
			// trim level2
			level2 = null
			leaflevel = 1
		}
	} else if (!level4) {
		// level3 is leaf
		leaflevel = 3
		if (level3 == level2) {
			level3 = null
			leaflevel = 2
		}
	} else if (!level5) {
		// level4 is leaf
		leaflevel = 4
		if (level4 == level3) {
			level4 = null
			leaflevel = 3
		}
	} else if (level5 == level4) {
		// trim level5
		level5 = null
		leaflevel = 4
	}

	/* this only applies to the leaf level of this line
	somehow a ctcae line at the end of file may not have 6 fields
	*/
	const tempid = l[5] ? str2level(l[5]) : null

	if (level1) {
		let id
		if (leaflevel == 1) {
			if (tempid) {
				id = tempid
				name2id.set(level1, id)
			} else {
				id = level1
			}
		} else {
			// not a leaf, so tempid doesn't apply to it, has to recall id
			id = name2id.get(level1) || level1
		}

		map1.set(id, level1)

		if (!t2t.has(id)) {
			t2t.set(id, new Set())
		}
		allterms_byorder.add(id)
	}

	if (level2) {
		let id
		if (leaflevel == 2) {
			if (tempid) {
				id = tempid
				name2id.set(level2, id)
			} else {
				id = level2
			}
		} else {
			// recall id
			id = name2id.get(level2) || level2
		}

		map2.set(id, level2)

		// child of level1
		t2t.get(name2id.get(level1) || level1).add(id)

		if (!t2t.has(id)) {
			t2t.set(id, new Set())
		}
		if (!c2p.has(id)) c2p.set(id, new Map())
		c2p.get(id).set(level1, 0)
		c2immediatep.set(id, level1)
		allterms_byorder.add(id)
	}

	if (level3) {
		let id
		if (leaflevel == 3) {
			if (tempid) {
				id = tempid
				name2id.set(level3, id)
			} else {
				id = level3
			}
		} else {
			id = name2id.get(level3) || level3
		}

		map3.set(id, level3)

		// child of level2
		t2t.get(name2id.get(level2) || level2).add(id)

		if (!t2t.has(id)) {
			t2t.set(id, new Set())
		}
		if (!c2p.has(id)) c2p.set(id, new Map())
		c2p.get(id).set(level1, 0)
		c2p.get(id).set(level2, 1)
		c2immediatep.set(id, level2)

		allterms_byorder.add(id)
		if (level2 == 'CTCAE Graded Events') patientcondition_terms.add(id)
	}

	if (level4) {
		let id
		if (leaflevel == 4) {
			if (tempid) {
				id = tempid
				name2id.set(level4, id)
			} else {
				id = level4
			}
		} else {
			id = name2id.get(level4) || level4
		}

		map4.set(id, level4)

		// child of level3
		t2t.get(name2id.get(level3) || level3).add(id)

		if (!t2t.has(id)) {
			t2t.set(id, new Set())
		}
		if (!c2p.has(id)) c2p.set(id, new Map())
		c2p.get(id).set(level1, 0)
		c2p.get(id).set(level2, 1)
		c2p.get(id).set(level3, 2)
		c2immediatep.set(id, level3)

		allterms_byorder.add(id)
		if (level2 == 'CTCAE Graded Events') patientcondition_terms.add(id)
	}

	if (level5) {
		let id
		if (leaflevel == 5) {
			if (tempid) {
				id = tempid
				name2id.set(level5, id)
			} else {
				id = level5
			}
		} else {
			id = name2id.get(level5) || level5
		}

		map5.set(id, level5)

		// child of level4
		t2t.get(name2id.get(level4) || level4).add(id)
		if (!c2p.has(id)) c2p.set(id, new Map())
		c2p.get(id).set(level1, 0)
		c2p.get(id).set(level2, 1)
		c2p.get(id).set(level3, 2)
		c2p.get(id).set(level4, 3)
		c2immediatep.set(id, level4)

		allterms_byorder.add(id)
		if (level2 == 'CTCAE Graded Events') patientcondition_terms.add(id)
	}
}

///////////// done parsing phenotree file

console.log(allterms_byorder.size + ' terms in total')
console.log(patientcondition_terms.size + ' terms for patient condition')

// clean t2t by removing leaf terms with no children; leaf should not appear in t2t
for (const [n, s] of t2t) {
	if (s.size == 0) {
		t2t.delete(n)
	}
}

// check if terms from different levels overlap
for (const n of map1.keys()) {
	if (map2.has(n)) abort(n + ': L1 and L2')
	if (map3.has(n)) abort(n + ': L1 and L3')
	if (map4.has(n)) abort(n + ': L1 and L4')
	if (map5.has(n)) abort(n + ': L1 and L5')
}
for (const n of map2.keys()) {
	if (map3.has(n)) abort(n + ': L2 and L3')
	if (map4.has(n)) abort(n + ': L2 and L4')
	if (map5.has(n)) abort(n + ': L2 and L5')
}
for (const n of map3.keys()) {
	if (map4.has(n)) abort(n + ': L3 and L4')
	if (map5.has(n)) abort(n + ': L3 and L5')
}
for (const n of map4.keys()) {
	if (map5.has(n)) abort(n + ': L4 and L5')
}

const keep_termjson = new Map()

if (infile_keeptermjson) {
	/* keep/termjson file is given
	this file is one single object, of key:value pairs
	key: term id
	value: term json definition
	*/
	const j = JSON.parse(fs.readFileSync(infile_keeptermjson, { encoding: 'utf8' }))
	for (const id in j) {
		keep_termjson.set(id, j[id])
	}
}

output_termdb()
output_ancestry()
output_alltermlst()
