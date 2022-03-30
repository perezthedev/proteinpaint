const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const fs = require('fs')
const imagesize = require('image-size')
const serverconfig = require('./serverconfig')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')

/*
q {}
.regressionType
.filter
.outcome{}
	.id
	.type // type will be required later to support molecular datatypes
	.term{} // rehydrated
	.q{}
		.computableValuesOnly:true // always added
	.refGrp
.independent[{}]
	.id
	.type
	.term{} // rehydrated
	.q{}
		.scale
		.computableValuesOnly:true // always added
	.refGrp
	.interactions[] // always added; empty if no interaction
	.snpidlst[] // list of snp ids, for type=snplst, added when parsing cache file

input to R is an json object, with an array of variables (first being outcome)
rtype with values numeric/factor is used instead of actual term type
so that R script will not need to interpret term type

***  function cascade  ***
get_regression()
	parse_q
		mayAlterFilterByAncestryRestriction
	getSampleData
		divideTerms
		getSampleData_dictionaryTerms
		mayAddAncestryPCs
		getSampleData_snplstOrLocus
			doImputation
			applyGeneticModel
	makeRinput
	validateRinput
	replaceTermId
	... run R ...
	parseRoutput
*/

// minimum number of samples to run analysis
const minimumSample = 1

export async function get_regression(q, ds) {
	try {
		parse_q(q, ds)

		const [sampledata, snpgt2count] = await getSampleData(q, [q.outcome, ...q.independent], ds)
		/* each element is one sample with a key-val map for all its annotations:
		{sample, id2value:Map( tid => {key,value}) }
		*/

		// build the input for R script
		const Rinput = makeRinput(q, sampledata)
		/* details described in server/utils/regression.R
		Rinput {
			data: [{}] per-sample data values
			metadata: {
				type: regression type (linear/logistic/cox)
				variables: [{}] variable metadata
			}
		}

		- snps from snplst and snplocus terms are added as elements into variables[] array
		- PCs from q.restrictAncestry.pcs are added as elements into variables[] array
		*/

		const sampleSize = Rinput.data.length
		validateRinput(Rinput, sampleSize)
		const [id2originalId, originalId2id] = replaceTermId(Rinput)

		// run regression analysis in R
		const Rinputfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
		await utils.write_file(Rinputfile, JSON.stringify(Rinput))
		const Routput = await lines2R(path.join(serverconfig.binpath, 'utils', 'regression.R'), [], [Rinputfile])

		// parse the R output
		fs.unlink(Rinputfile, () => {})
		return await parseRoutput(Rinput, Routput, id2originalId, snpgt2count)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function parse_q(q, ds) {
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds

	// client to always specify regressionType
	if (!q.regressionType) throw 'regressionType missing'
	if (!['linear', 'logistic', 'cox'].includes(q.regressionType)) throw 'unknown regressionType'

	// outcome
	if (!q.outcome) throw `missing 'outcome' parameter`
	if (!q.outcome) throw `empty 'outcome' parameter`
	if (!('id' in q.outcome)) throw 'outcome.id missing'
	if (!q.outcome.q) throw 'outcome.q missing'
	q.outcome.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
	// outcome is always a dictionary term
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id

	// independent
	if (!q.independent) throw 'independent[] missing'
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	// tw = termWrapper
	for (const tw of q.independent) {
		if (!tw.q) throw `missing q for term.id='${tw.id}'`

		checkTwAncestryRestriction(tw, q, ds)

		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			// !!!!!!!!!QUICK FIX!! detect non-dict term and do not query termdb
			// tw for these terms lacks tw.term{}
			// tw.snpidlst[] will be added when parsing cache file
			if (!tw.q.cacheid) throw 'q.cacheid missing'
			if (tw.q.cacheid.match(/[^\w]/)) throw 'invalid cacheid'
			if (typeof tw.q.snp2effAle != 'object') throw 'q.snp2effAle{} is not object'
			if (!Number.isInteger(tw.q.alleleType)) throw 'q.alleleType is not integer'
			if (!Number.isInteger(tw.q.geneticModel)) throw 'q.geneticModel is not integer'
			if (tw.q.geneticModel == 3) {
				if (typeof tw.q.snp2refGrp != 'object') throw 'q.snp2refGrp{} is not object when geneticMode=3'
			}
			if (tw.type == 'snplst') {
				// missingGenotype is not needed for snplocus
				if (!Number.isInteger(tw.q.missingGenotype)) throw 'q.missingGenotype is not integer for snplst'
			}
			continue
		}
		// tw is dictionary term
		tw.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
		if (!tw.id) throw '.id missing for an independent term'
		tw.term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
		if (!tw.term) throw `invalid independent term='${tw.id}'`
	}
	// interaction of independent
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			// TODO allow tw.interactions[] array to contain snpid instead of snplst term id
			if (!q.independent.find(y => y.id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}
}

function checkTwAncestryRestriction(tw, q, ds) {
	if (!tw.q.restrictAncestry) {
		// should only be present for snplocus
		return
	}
	if (!ds.cohort.termdb.restrictAncestries) throw 'ds.restrictAncestries missing'
	// attach ancestry obj {tvs,pcs} for access later
	const a = ds.cohort.termdb.restrictAncestries.find(i => i.name == tw.q.restrictAncestry.name)
	if (!a) throw 'unknown ancestry: ' + tw.q.restrictAncestry.name
	tw.q.restrictAncestry.pcs = a.pcs
}

function makeRinput(q, sampledata) {
	// build R metadata
	const metadata = { type: q.regressionType }
	const variables = [] // [ {outcome}, {ind1}, {ind2}, ...]

	// outcome variable
	const outcome = {
		id: q.outcome.id,
		name: q.outcome.term.name,
		type: 'outcome',
		rtype: 'numeric' // always numeric because (1) linear regression: values are continuous, (2) logistic regression: values get converted to 0/1, (3) cox regression: time-to-event is continuous and event is 0/1
	}
	if (q.regressionType == 'logistic') {
		// for logistic regression, if spline terms are present, the spline plot needs to have label for nonref category of outcome
		outcome.categories = {
			ref: q.outcome.refGrp,
			nonref: getLogisticOutcomeNonref(q.outcome)
		}
	}
	if (q.regressionType == 'cox') {
		// for cox regression, outcome needs to be time-to-event data
		if (q.outcome.q.timeScale == 'year') {
			// calendar year time scale
			outcome.timeToEvent = {
				timeId: q.outcome.id + '_time',
				eventId: q.outcome.id + '_event',
				timeScale: q.outcome.q.timeScale
			}
		} else if (q.outcome.q.timeScale == 'age') {
			// age time scale
			outcome.timeToEvent = {
				agestartId: q.outcome.id + '_agestart',
				ageendId: q.outcome.id + '_ageend',
				eventId: q.outcome.id + '_event',
				timeScale: q.outcome.q.timeScale
			}
		} else {
			throw 'unknown cox regression time scale'
		}
	}
	variables.push(outcome)

	// independent terms, tw = termWrapper
	for (const tw of q.independent) {
		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			makeRvariable_snps(tw, variables, q)
		} else {
			makeRvariable_dictionaryTerm(tw, variables, q)
		}
	}
	metadata.variables = variables

	// build R dataset
	// per-sample data values
	// for each sample, determine if it has value for all terms
	// if so, the sample can be included for analysis
	const data = []
	for (const { sample, id2value } of sampledata) {
		if (!id2value.has(q.outcome.id)) continue
		const out = id2value.get(q.outcome.id)

		let skipsample = false
		for (const tw of q.independent) {
			// tw = termWrapper
			if (tw.type == 'snplocus') {
				// snplocus snps are analyzed separately from each other
				// therefore samples need to be filtered separately for each snplocus snp
				// this filtering will be done in the R script
				continue
			}
			if (tw.type == 'snplst') {
				for (const snpid of tw.snpidlst) {
					if (!id2value.get(snpid)) {
						skipsample = true
						break
					}
				}
			} else {
				const independent = id2value.get(tw.id)
				if (!independent) {
					skipsample = true
					break
				}
			}
		}
		if (skipsample) continue

		// this sample has values for all variables and is eligible for regression analysis
		// fill entry with data of sample for each variable
		const entry = {} // { variable1: value, variable2: value, variable3: value, ...}
		for (const t of variables) {
			if (t.type == 'outcome') {
				// outcome variable
				if (q.regressionType == 'linear') {
					// linear regression, therefore continuous outcome
					// use value
					entry[t.id] = out.value
				}
				if (q.regressionType == 'logistic') {
					// logistic regression, therefore categorical outcome
					// use key
					// convert ref/non-ref to 0/1
					entry[t.id] = out.key === q.outcome.refGrp ? 0 : 1
				}
				if (q.regressionType == 'cox') {
					// cox regression, therefore time-to-event outcome
					// use both key and value
					if (q.outcome.q.timeScale == 'year') {
						// calendar year time scale
						entry[t.timeToEvent.timeId] = out.value
						entry[t.timeToEvent.eventId] = out.key
					} else if (q.outcome.q.timeScale == 'age') {
						// age time scale
						const ages = JSON.parse(out.value)
						entry[t.timeToEvent.agestartId] = ages.age_start
						entry[t.timeToEvent.ageendId] = ages.age_end
						entry[t.timeToEvent.eventId] = out.key
					} else {
						throw 'unknown cox regression time scale'
					}
				}
			} else {
				// independent variable
				const v = id2value.get(t.id)
				if (!v) {
					// sample has no value for this variable
					// set value to 'null' because R script will
					// convert 'null' to 'NA' during json import
					entry[t.id] = null
				} else {
					entry[t.id] = t.rtype === 'numeric' ? v.value : v.key
				}
			}
		}
		data.push(entry)
	}

	const Rinput = {
		data,
		metadata
	}

	return Rinput
}

function makeRvariable_dictionaryTerm(tw, variables, q) {
	// tw is a dictionary term
	const thisTerm = {
		id: tw.id,
		name: tw.term.name,
		type: tw.q.mode == 'spline' ? 'spline' : 'independent',
		rtype: tw.q.mode == 'continuous' || tw.q.mode == 'spline' ? 'numeric' : 'factor',
		interactions: []
	}
	// map tw.interactions into thisTerm.interactions
	for (const id of tw.interactions) {
		const tw2 = q.independent.find(i => i.id == id)
		if (tw2.type == 'snplst') {
			// this term is interacting with a snplst term, fill in all snps from this list into thisTerm.interactions
			for (const s of tw2.snpidlst) thisTerm.interactions.push(s)
		} else if (tw2.type == 'snplocus') {
			// snplocus interactions should not be handled here because each snp needs to be analyzed separately
			// snplocus interactions will be specified separately for each snp in makeRvariable_snps()
			continue
		} else {
			// this term is interacting with another dictionary term
			thisTerm.interactions.push(id)
		}
	}
	if (thisTerm.rtype === 'factor') thisTerm.refGrp = tw.refGrp
	if (tw.q.mode == 'spline') {
		thisTerm.spline = {
			knots: tw.q.knots.map(x => Number(x.value))
		}
		if (!q.independent.find(i => i.type == 'snplocus')) {
			// when there isn't the snplocus variable, can make spline plot
			thisTerm.spline.plotfile = path.join(serverconfig.cachedir, Math.random().toString() + '.png')
		}
	}
	if (tw.q.scale) thisTerm.scale = tw.q.scale
	variables.push(thisTerm)
}

function makeRvariable_snps(tw, variables, q) {
	// tw is either snplst or snplocus
	// create one independent variable for each snp
	for (const snpid of tw.snpidlst) {
		const thisSnp = {
			id: snpid,
			name: snpid,
			type: 'independent',
			interactions: []
		}
		if (tw.type == 'snplocus') {
			// setting "snplocus" to .type allows R to make special treatment to these
			// to do model-fitting separately for each variant from a snplocus term
			thisSnp.type = 'snplocus'
		}
		if (tw.q.geneticModel == 3) {
			// by genotype
			thisSnp.rtype = 'factor'
			// assign ref grp
			thisSnp.refGrp = tw.q.snp2refGrp[snpid]
		} else {
			// treat as numeric and do not assign refGrp
			thisSnp.rtype = 'numeric'
		}
		// find out any other variable that's interacting with either this snp or this snplst term
		// and fill into interactions array
		// for now, do not support interactions between snps in the same snplst term
		for (const tw2 of q.independent) {
			if (tw2.interactions.includes(tw.id)) {
				// another term (tw2) is interacting with this snplst term
				// in R input establish tw2's interaction with this snp
				thisSnp.interactions.push(tw2.id)
			}
		}
		variables.push(thisSnp)
	}
	if (tw.q.restrictAncestry) {
		/* add PCs as variables
		for(const pcid of tw.q.restrictAncestry.pcs) {
			variables.push({
				id: pcid,
				name: pcid,
				type:'independent',
				rtype:'numeric',
				interactions:[]
			})
		}
		*/
	}
}

function getLogisticOutcomeNonref(outcome) {
	// outcome is q.outcome{}, the term-wrapper {q{}, refGrp, term{}}
	if (outcome.term.type == 'condition') {
		// condition term does not use q.type
		// from q.groupNames[], return the str name that's not refgrp
		for (const i of outcome.q.groupNames) {
			if (i != outcome.q.refGrp) return i
		}
		throw 'nonref group not found for logistic outcome'
	}
	// not condition term;
	// depending on q.type, find the non-ref group and return its name, to be used in Y axis of spline plot
	if (outcome.q.type == 'predefined-groupset') {
		if (!outcome.q.groupsetting) throw 'outcome.q.groupsetting{} missing when type=predefined-groupset'
		if (!Number.isInteger(outcome.q.groupsetting.predefined_groupset_idx))
			throw 'outcome.q.predefined_groupset_idx not integer when q.type is "predefined-groupset"'
		if (!outcome.term.groupsetting) throw 'outcome.term.groupsetting missing'
		const grpset = outcome.term.groupsetting.lst[outcome.q.groupsetting.predefined_groupset_idx]
		if (!grpset) throw 'groupset not found by outcome.q.predefined_groupset_idx'
		const nonrefgrp = grpset.groups.find(i => i.name != outcome.refGrp)
		if (!nonrefgrp) throw 'non-ref group not found for predefined-groupset'
		return nonrefgrp.name
	}
	if (outcome.q.type == 'custom-groupset') {
		if (!outcome.q.groupsetting) throw 'outcome.q.groupsetting{} missing when type=predefined-groupset'
		if (!outcome.q.groupsetting.customset) throw 'outcome.q.customset missing'
		const nonrefgrp = outcome.q.groupsetting.customset.groups.find(i => i.name != outcome.refGrp)
		if (!nonrefgrp) throw 'non-ref group not found for custom-groupset'
		return nonrefgrp.name
	}
	if (outcome.q.type == 'values') {
		if (!outcome.term.values) throw 'outcome.term.values{} missing'
		for (const k in outcome.term.values) {
			const v = outcome.term.values[k]
			if (v.label != outcome.refGrp) return v.label
		}
		throw 'unknown nonref group from outcome.term.values'
	}
	if (outcome.q.type == 'custom-bin') {
		const nonrefbin = outcome.q.lst.find(i => i.label != outcome.refGrp)
		if (!nonrefbin) throw 'non-ref bin is not found for custom-bin'
		return nonrefbin.label
	}
	if (outcome.q.type == 'regular-bin') {
		throw 'do not know a way to find computed bin list for type=regular-bin'
	}
	throw 'unknown outcome.q.type'
}

function validateRinput(Rinput, sampleSize) {
	// validate R input
	// Data values will be validated in R script

	// validate sample size
	if (sampleSize < minimumSample) throw 'too few samples to fit model'

	// validate data table
	const regressionType = Rinput.metadata.type
	const outcome = Rinput.metadata.variables.find(variable => variable.type == 'outcome')
	let nvariables = Rinput.metadata.variables.length
	if (regressionType == 'cox') {
		if (outcome.timeToEvent.timeScale == 'year') {
			nvariables = nvariables + 1
		} else if (outcome.timeToEvent.timeScale == 'age') {
			nvariables = nvariables + 2
		} else {
			throw 'unknown cox regression time scale'
		}
	}
	if (Rinput.data.find(entry => Object.keys(entry).length != nvariables)) {
		throw 'unequal number of variables in data entries'
	}

	// validate independent variables
	for (const variable of Rinput.metadata.variables) {
		if (variable.type == 'outcome') continue
		if (variable.rtype == 'numeric') {
			if (variable.refGrp) throw `reference group given for '${variable.id}'`
		} else {
			if (!variable.refGrp) throw `reference group not given for '${variable.id}'`
		}
	}
}

async function parseRoutput(Rinput, Routput, id2originalId, snpgt2count) {
	if (Routput.length != 1) throw 'expected 1 json line in R output'
	const out = JSON.parse(Routput[0])

	/*
	out (linear/logistic) 
	[
	  {
		id: id of snplocus term (empty if no snplocus terms)
		data: { sampleSize, residuals: {}, coefficients: {}, type3: {}, other: {}, warnings: [] }
	  }
	]

	out (cox) 
	[
	  {
		id: id of snplocus term (empty if no snplocus terms)
		data: { sampleSize, eventCnt, coefficients: {}, type3: {}, tests: {}, other: {}, warnings: [] }
	  }
	]
	*/

	const result = [] // same structure as out[]

	for (const analysis of out) {
		// to be pushed to result[]
		const analysisResults = {
			data: {
				sampleSize: analysis.data.sampleSize,
				eventCnt: analysis.data.eventCnt ? analysis.data.eventCnt : null
			}
		}

		if (analysis.id) {
			// id must be snpid from snplocus
			analysisResults.id = id2originalId[analysis.id]
			const gt2count = snpgt2count.get(analysisResults.id)
			if (gt2count) {
				const lst = []
				for (const [gt, c] of gt2count) lst.push(gt + '=' + c)
				analysisResults.data.headerRow = {
					k: 'Genotypes:',
					v: lst.join(', ')
				}
			}
		}

		const data = analysis.data

		// residuals
		if (data.residuals) {
			analysisResults.data.residuals = data.residuals
			analysisResults.data.residuals.label = Rinput.metadata.type == 'linear' ? 'Residuals' : 'Deviance residuals'
		}

		// coefficients
		if (Rinput.metadata.type == 'cox') {
			if (data.coefficients.rows.length < 1) throw 'fewer than 1 row in coefficients table'
		} else {
			if (data.coefficients.rows.length < 2) throw 'fewer than 2 rows in coefficients table'
		}
		analysisResults.data.coefficients = {
			header: data.coefficients.header,
			intercept: Rinput.metadata.type == 'cox' ? null : data.coefficients.rows.shift(),
			terms: {}, // individual independent terms, not interaction
			interactions: [] // interactions
		}
		for (const row of data.coefficients.rows) {
			if (row[0].indexOf(':') != -1) {
				// is an interaction
				const interaction = {}
				const [id1, id2] = row.shift().split(':')
				const [cat1, cat2] = row.shift().split(':')
				// row is now only data fields
				interaction.term1 = id2originalId[id1]
				interaction.category1 = cat1
				interaction.term2 = id2originalId[id2]
				interaction.category2 = cat2
				interaction.lst = row
				analysisResults.data.coefficients.interactions.push(interaction)
			} else {
				// not interaction, individual variable
				const id = row.shift()
				const category = row.shift()
				// row is now only data fields
				const termid = id2originalId[id]
				if (!analysisResults.data.coefficients.terms[termid]) analysisResults.data.coefficients.terms[termid] = {}
				if (category) {
					// has category
					if (!analysisResults.data.coefficients.terms[termid].categories)
						analysisResults.data.coefficients.terms[termid].categories = {}
					analysisResults.data.coefficients.terms[termid].categories[category] = row
				} else {
					// no category
					analysisResults.data.coefficients.terms[termid].fields = row
				}
			}
		}
		analysisResults.data.coefficients.label = 'Coefficients'

		// type III statistics
		analysisResults.data.type3 = {
			header: data.type3.header,
			intercept: data.type3.rows.shift(),
			terms: {}, // individual independent terms, not interaction
			interactions: [] // interactions
		}
		for (const row of data.type3.rows) {
			if (row[0].indexOf(':') != -1) {
				// is an interaction
				const interaction = {}
				const [id1, id2] = row.shift().split(':')
				// row is now only data fields
				interaction.term1 = id2originalId[id1]
				interaction.term2 = id2originalId[id2]
				interaction.lst = row
				analysisResults.data.type3.interactions.push(interaction)
			} else {
				// not interaction, individual variable
				const id = row.shift()
				// row is now only data fields
				const termid = id2originalId[id]
				if (!analysisResults.data.type3.terms[termid]) analysisResults.data.type3.terms[termid] = row
			}
		}
		analysisResults.data.type3.label = 'Type III statistics'

		// statistical tests
		if (data.tests) {
			analysisResults.data.tests = data.tests
			analysisResults.data.tests.label = 'Statistical tests'
		}

		// other summary statistics
		analysisResults.data.other = data.other
		analysisResults.data.other.label = 'Other summary statistics'

		// plots
		for (const tw of Rinput.metadata.variables) {
			if (tw.spline && tw.spline.plotfile) {
				if (!analysisResults.data.splinePlots) analysisResults.data.splinePlots = []
				const file = tw.spline.plotfile
				const plot = await fs.promises.readFile(file)
				analysisResults.data.splinePlots.push({
					src: 'data:image/png;base64,' + new Buffer.from(plot).toString('base64'),
					size: imagesize(file)
				})
				fs.unlink(file, err => {
					if (err) throw err
				})
			}
		}

		// warnings
		if (data.warnings) analysisResults.data.warnings = data.warnings

		result.push(analysisResults)
	}
	return result
}

/*
may move to termdb.sql.js later

works for only termdb terms; non-termdb attributes will not work
gets data for regression analysis, one row for each sample

Arguments
q{}
	.filter
	.ds

terms[]
	array of {id, term, q}

Returns two data structures
1.
	[
		{
	  	sample: STRING,

			// one or more entries by term id
			id2value: Map[
				term.id,
				{
					// depending on term type and desired 
					key: either (a) bin or groupsetting label, or (b) precomputed or annotated value if no bin/groupset is used, 
					value: precomputed or annotated value
				}
			]
		},
		...
	]
2.
*/
async function getSampleData(q, terms, ds) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, nonDictTerms] = divideTerms(terms)

	const samples = getSampleData_dictionaryTerms(q, dictTerms)
	// sample data from all terms are loaded into "samples"

	const snpgt2count = new Map()
	// k: snpid, v:{gt:INT}
	// filled for snplst and snplocus terms
	// to append genotype samplecount breakdown as result.headerRow

	for (const tw of nonDictTerms) {
		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"

		mayAddAncestryPCs(tw, samples, ds)

		if (tw.type == 'snplst' || tw.type == 'snplocus') {
			// each snp is one indepedent variable
			// record list of snps on term.snpidlst
			await getSampleData_snplstOrLocus(tw, samples, snpgt2count)
		} else {
			throw 'unknown type of independent non-dictionary term'
		}
	}

	return [samples.values(), snpgt2count]
}

function mayAddAncestryPCs(tw, samples, ds) {
	if (!tw.q.restrictAncestry) return
	/* add sample pc values from tw.q.restrictAncestry.pcs to samples
	for(const [pcid, s] of tw.q.restrictAncestry.pcs) {
		for(const [sampleid, v] of s) {
			if(!samples.has(sampleid)) continue
			samples.get(sampleid).id2value.set( pcid, {key:v, value:v})
		}
	}
	*/
}

function getSampleData_dictionaryTerms(q, terms) {
	// outcome can only be dictionary term so terms array must have at least 1 term
	const samples = new Map()
	// k: sample name, v: {sample, id2value:Map( tid => {key,value}) }
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const CTEs = terms.map((t, i) => get_term_cte(q, values, i, filter, t))
	values.push(...terms.map(d => d.id))

	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTEs.map(t => t.sql).join(',\n')}
		${CTEs.map(
			t => `
			SELECT sample, key, value, ? as term_id
			FROM ${t.tablename}
			${filter ? `WHERE sample IN ${filter.CTEname}` : ''}
			`
		).join(`UNION ALL`)}`

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)

	for (const { sample, term_id, key, value } of rows) {
		if (!samples.has(sample)) {
			samples.set(sample, { sample, id2value: new Map() })
		}

		if (samples.get(sample).id2value.has(term_id)) {
			// can duplication happen?
			throw `duplicate '${term_id}' entry for sample='${sample}'`
		}
		samples.get(sample).id2value.set(term_id, { key, value })
	}

	/* drop samples that are missing value for any term
	as those are ineligible for analysis
	*/
	const deletesamples = new Set()
	for (const o of samples.values()) {
		for (const t of terms) {
			if (!o.id2value.has(t.id)) {
				deletesamples.add(o.sample)
				break
			}
		}
	}
	for (const s of deletesamples) {
		samples.delete(s)
	}

	return samples
}

/*
tw{}
	type
	q{}
		cacheid
		alleleType: 0/1
		geneticModel: 0/1/2/3
		missingGenotype: 0/1/2
		snp2effAle{}
		snp2refGrp{}
	snpidlst[]
		// list of snpid; tricky!! added in this function
samples {Map}
	contains all samples that have valid data for all dict terms
	only get genotype data for these samples,
	but do not introduce new samples to this map
	as those will miss value for dict terms and ineligible for analysis
*/
async function getSampleData_snplstOrLocus(tw, samples, snpgt2count) {
	tw.snpidlst = [] // snpid are added to this list while reading cache file

	const lines = (await utils.read_file(path.join(serverconfig.cachedir_snpgt, tw.q.cacheid))).split('\n')
	// cols: snpid, chr, pos, ref, alt, eff, <s1>, <s2>,...

	// array of sample ids from the cache file; note cache file contains all the samples from the dataset
	const cachesampleheader = lines[0]
		.split('\t')
		.slice(6) // from 7th column
		.map(Number) // sample ids are integer

	// make a list of true/false, same length of cachesampleheader, to tell if a sample is in use
	// do not apply q.filter here
	// as samples{} is already computed with q.filter in getSampleData_dictionaryTerms
	const sampleinfilter = cachesampleheader.map(i => samples.has(i))

	const snp2sample = new Map()
	// k: snpid
	// v: { effAle, refAle, altAles, samples: map { k: sample id, v: gt } }

	// load cache file to snp2sample
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')

		const snpid = l[0] // snpid is used as "term id"
		tw.snpidlst.push(snpid)

		snp2sample.set(snpid, {
			// get effect allele from q, but not from cache file
			// column [5] is for user-assigned effect allele
			effAle: tw.q.snp2effAle[snpid],
			refAle: l[3],
			altAles: l[4].split(','),
			samples: new Map()
		})
		for (const [j, sampleid] of cachesampleheader.entries()) {
			if (!sampleinfilter[j]) {
				// this sample is filtered out
				continue
			}
			const gt = l[j + 6]
			if (gt) {
				snp2sample.get(snpid).samples.set(sampleid, gt)
			}
		}
	}

	// imputation
	// do not impute for snplocus
	if (tw.type != 'snplocus') {
		doImputation(snp2sample, tw, cachesampleheader, sampleinfilter)
	}

	for (const [snpid, o] of snp2sample) {
		const gt2count = new Map()

		for (const [sampleid, gt] of o.samples) {
			// count gt for this snp
			gt2count.set(gt, 1 + (gt2count.get(gt) || 0))

			// for this sample, convert gt to value
			const [gtA1, gtA2] = gt.split('/') // assuming diploid
			const v = applyGeneticModel(tw, o.effAle, gtA1, gtA2)

			// sampleid must be present in samples{map}, no need to check
			samples.get(sampleid).id2value.set(snpid, { key: v, value: v })
		}
		snpgt2count.set(snpid, gt2count)
	}
}

function doImputation(snp2sample, tw, cachesampleheader, sampleinfilter) {
	if (tw.q.missingGenotype == 0) {
		// as homozygous major/ref allele, which is not effect allele
		for (const o of snp2sample.values()) {
			// { effAle, refAle, altAles, samples }
			// find an allele from this snp that is not effect allele
			let notEffAle
			if (o.refAle != o.effAle) {
				notEffAle = o.refAle
			} else {
				for (const a of o.altAles) {
					if (a != o.effAle) {
						notEffAle = a
						break
					}
				}
			}
			if (!notEffAle) throw 'not finding a non-effect allele' // not possible
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!o.samples.has(sampleid)) {
					// this sample is missing gt call for this snp
					o.samples.set(sampleid, notEffAle + '/' + notEffAle)
				}
			}
		}
		return
	}
	if (tw.q.missingGenotype == 1) {
		// numerically as average value
		throw 'not done'
	}
	if (tw.q.missingGenotype == 2) {
		// drop sample
		const incompleteSamples = new Set() // any samples with missing gt
		for (const { samples } of snp2sample.values()) {
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!samples.has(sampleid)) {
					// this sample is missing gt
					incompleteSamples.add(sampleid)
				}
			}
		}
		// delete incomplete samples from all snps
		for (const { samples } of snp2sample.values()) {
			for (const s of incompleteSamples) {
				samples.delete(s)
			}
		}
		return
	}
	throw 'invalid missingGenotype value'
}

function applyGeneticModel(tw, effAle, a1, a2) {
	switch (tw.q.geneticModel) {
		case 0:
			// additive
			return (a1 == effAle ? 1 : 0) + (a2 == effAle ? 1 : 0)
		case 1:
			// dominant
			if (a1 == effAle || a2 == effAle) return 1
			return 0
		case 2:
			// recessive
			return a1 == effAle && a2 == effAle ? 1 : 0
		case 3:
			// by genotype
			return a1 + '/' + a2
		default:
			throw 'unknown geneticModel option'
	}
}

function divideTerms(lst) {
	// quick fix to divide list of term to two lists
	// TODO ways to generalize; may use `shared/usecase2termtypes.js` with "regression":{nonDictTypes:['snplst','prs']}
	// shared between server and client
	const dict = [],
		nonDict = []
	for (const t of lst) {
		if (t.type == 'snplst' || t.type == 'snplocus') {
			nonDict.push(t)
		} else {
			dict.push(t)
		}
	}
	return [dict, nonDict]
}

function replaceTermId(Rinput) {
	// replace term IDs with custom IDs (to avoid spaces/commas in R)
	// make conversion table between IDs
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	for (const [i, t] of Rinput.metadata.variables.entries()) {
		// custom IDs need a trailing '_' to serve as separator
		// between ID and category in coefficents table in R
		id2originalId['id' + i + '_'] = t.id
		originalId2id[t.id] = 'id' + i + '_'
		if (t.timeToEvent) {
			// time-to-event variable
			id2originalId['id' + i + '_event' + '_'] = t.timeToEvent.eventId
			originalId2id[t.timeToEvent.eventId] = 'id' + i + '_event' + '_'
			if (t.timeToEvent.timeScale == 'year') {
				id2originalId['id' + i + '_time' + '_'] = t.timeToEvent.timeId
				originalId2id[t.timeToEvent.timeId] = 'id' + i + '_time' + '_'
			} else if (t.timeToEvent.timeScale == 'age') {
				id2originalId['id' + i + '_agestart' + '_'] = t.timeToEvent.agestartId
				id2originalId['id' + i + '_ageend' + '_'] = t.timeToEvent.ageendId
				originalId2id[t.timeToEvent.agestartId] = 'id' + i + '_agestart' + '_'
				originalId2id[t.timeToEvent.ageendId] = 'id' + i + '_ageend' + '_'
			} else {
				throw 'unknown cox regression time scale'
			}
		}
	}

	// replace IDs of terms and interacting terms in metadata
	for (const t of Rinput.metadata.variables) {
		t.id = originalId2id[t.id]
		if (t.timeToEvent) {
			// time-to-event variable
			t.timeToEvent.eventId = originalId2id[t.timeToEvent.eventId]
			if (t.timeToEvent.timeScale == 'year') {
				t.timeToEvent.timeId = originalId2id[t.timeToEvent.timeId]
			} else if (t.timeToEvent.timeScale == 'age') {
				t.timeToEvent.agestartId = originalId2id[t.timeToEvent.agestartId]
				t.timeToEvent.ageendId = originalId2id[t.timeToEvent.ageendId]
			} else {
				throw 'unknown cox regression scale'
			}
		}
		if (t.interactions && t.interactions.length > 0) {
			// assuming no interactions with time-to-event variables
			for (const [i, it] of t.interactions.entries()) {
				t.interactions[i] = originalId2id[it]
			}
		}
	}

	// replace IDs of terms in data
	for (const entry of Rinput.data) {
		for (const tid in entry) {
			entry[originalId2id[tid]] = entry[tid]
			delete entry[tid]
		}
	}

	return [id2originalId, originalId2id]
}
