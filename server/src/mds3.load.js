const app = require('./app')
const path = require('path')
const utils = require('./utils')
const snvindelByRangeGetter_bcf = require('./mds3.init').snvindelByRangeGetter_bcf

/*
method good for somatic variants, in skewer and gp queries:
1) query all data without filtering
2) generate totalcount for variant attr (mclass)
   and class breakdown for sampleSummaries
3) filter by variant/sample attr
4) generate post-filter showcount and hiddencount for variant attr
   and show/hidden class breakdown for sampleSummaries


************************* q{}
.hiddenmclass Set

************************* returned data {}
## if no data, return empty arrays, so that the presence of data.skewer indicate data has been queried

.skewer[]
	ssm, sv, fusion
	has following hardcoded attributes
	.occurrence INT
	.samples [{}]
		.sample_id
.genecnvNosample[]
 */

export function mds3_request_closure(genomes) {
	return async (req, res) => {
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'

			const q = init_q(req, genome)

			const ds = await get_ds(q, genome)

			may_validate_filters(q, ds)

			const result = await load_driver(q, ds)
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function summarize_mclass(mlst) {
	// should include cnv segment data here
	// ??? if to include genecnv data here?
	const cc = new Map() // k: mclass, v: {}
	for (const m of mlst) {
		// snvindel has m.class=str, svfusion has only dt=int
		const key = m.class || m.dt
		cc.set(key, 1 + (cc.get(key) || 0))
	}
	return [...cc].sort((i, j) => j[1] - i[1])
}

function init_q(req, genome) {
	const query = req.query

	if (req.get('X-Auth-Token')) {
		// user token may be provided from request header, the logic could be specific to gdc or another dataset
		query.token = req.get('X-Auth-Token')
	}
	if (req.cookies.sessionid) {
		// sessionid is available after user logs into gdc portal
		query.sessionid = req.cookies.sessionid
	}

	// cannot validate filter0 here as ds will be required and is not made yet
	if (query.hiddenmclasslst) {
		query.hiddenmclass = new Set(query.hiddenmclasslst.split(','))
		delete query.hiddenmclasslst
	}
	return query
}

function finalize_result(q, ds, result) {
	const sampleSet = new Set() // collects sample ids if present in data points

	if (result.skewer) {
		for (const m of result.skewer) {
			if (m.samples) {
				m.occurrence = m.samples.length

				mayAddSkewerRimCount(m, q, ds)
				mayAddFormatSampleCount(m, ds)

				for (const s of m.samples) {
					sampleSet.add(s.sample_id)
				}
				delete m.samples
			}
		}
	}

	if (sampleSet.size) {
		// has samples, report total number of unique samples across all data types
		result.sampleTotalNumber = sampleSet.size
	}
}

function mayAddSkewerRimCount(m, q, ds) {
	if (!q.skewerRim) return // not using rim
	// using rim; rim reflects number of samples, out of all harboring this variant, with a common attribute
	if (q.skewerRim.type == 'format') {
		m.rim1count = 0
		for (const s of m.samples) {
			if (s.formatK2v?.[q.skewerRim.formatKey] == q.skewerRim.rim1value) {
				m.rim1count++
			}
		}
		return
	}
	throw 'unknown skewerRim.type'
}

function mayAddFormatSampleCount(m, ds) {
	if (!ds.queries.snvindel?.format) return
	for (const formatKey in ds.queries.snvindel.format) {
		if (!ds.queries.snvindel.format[formatKey].isFilter) continue // this field is not filterable
		// has a filterable field
		if (!m.formatK2count) m.formatK2count = {} // key is formatKey
		if (!m.formatK2count[formatKey]) m.formatK2count[formatKey] = {} // k: format value, v: sample count
		for (const s of m.samples) {
			const v = s.formatK2v?.[formatKey]
			if (v == undefined) continue
			m.formatK2count[formatKey][v] = 1 + (m.formatK2count[formatKey][v] || 0)
		}
	}
}

async function get_ds(q, genome) {
	if (q.dslabel) {
		// is official dataset
		if (!genome.datasets) throw '.datasets{} missing from genome'
		const ds = genome.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		return ds
	}
	// for a custom dataset, a temporary ds{} obj is made for every query, based on q{}
	// may cache index files from url, thus the await
	const ds = { queries: {} }
	if (q.bcffile || q.bcfurl) {
		const [e, file, isurl] = app.fileurl({ query: { file: q.bcffile, url: q.bcfurl } })
		if (e) throw e
		const _tk = {}
		if (isurl) {
			_tk.url = file
			_tk.indexURL = q.bcfindexURL
		} else {
			_tk.file = file
		}
		ds.queries.snvindel = { byrange: { _tk } }
		ds.queries.snvindel.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
	}
	// add new file types

	return ds
}

async function load_driver(q, ds) {
	// various bits of data to be appended as keys to result{}
	// what other loaders can be if not in ds.queries?

	if (q.ssm2canonicalisoform) {
		// gdc-specific logic
		if (!ds.ssm2canonicalisoform) throw 'ssm2canonicalisoform not supported on this dataset'
		return { isoform: await ds.ssm2canonicalisoform.get(q) }
	}

	if (q.variant2samples) {
		if (!ds.variant2samples) throw 'not supported by server'
		const out = await ds.variant2samples.get(q)
		return { variant2samples: out }
	}

	if (q.m2csq) {
		if (ds.queries && ds.queries.snvindel && ds.queries.snvindel.m2csq) {
			return { csq: await ds.queries.snvindel.m2csq.get(q) }
		}
		throw 'm2csq not supported on this dataset'
	}

	if (q.forTrack) {
		// to load things for block track
		const result = {}

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track

			if (ds.queries.snvindel) {
				// the query will resolve to list of mutations, to be flattened and pushed to .skewer[]
				const mlst = await query_snvindel(q, ds)
				/* mlst=[], each element:
				{
					ssm_id:str
					mclass
					samples:[ {sample_id}, ... ]
				}
				*/
				result.skewer.push(...mlst)
			}

			if (ds.queries.svfusion) {
				// todo
				const d = await query_svfusion(q, ds)
				result.skewer.push(...d)
			}

			if (ds.queries.geneCnv) {
				// just a test; can allow gene-level cnv to be indicated as leftlabel
				// can disable this step if not to show it in skewer tk
				// trouble is that it's using case id as event.samples[].sample_id
				// compared to ssm where it is sample id for m.samples[].sample_id
				const lst = await query_geneCnv(q, ds)
				// this is not appended to result.skewer[]
				result.geneCnv = lst
			}

			filter_data(q, result)

			result.mclass2variantcount = summarize_mclass(result.skewer)
		}

		// add queries for new data types

		finalize_result(q, ds, result)
		return result
	}

	// other query type

	throw 'do not know what client wants'
}

async function query_snvindel(q, ds) {
	if (q.isoform) {
		// client supplies isoform, see if isoform query is supported
		if (q.atgenomic) {
			// in genomic mode
			if (!ds.queries.snvindel.byrange) throw '.atgenomic but missing byrange query method'
			return await ds.queries.snvindel.byrange.get(q)
		}
		if (ds.queries.snvindel.byisoform) {
			// querying by isoform is supported
			return await ds.queries.snvindel.byisoform.get(q)
		} else {
			// querying by isoform is not supported, continue to check if can query by range
		}
	}
	// not querying by isoform;
	if (q.rglst) {
		// provided range parameter
		if (!ds.queries.snvindel.byrange) throw 'q.rglst[] provided but .byrange{} is missing'

		if (q.skewerRim?.type == 'format') {
			// using a format field to get sample count as rim size
			// add this flag to return formatK2v with sample to allow to get rim count from samples of a variant
			q.addFormatValues = true
		}

		return await ds.queries.snvindel.byrange.get(q)
	}
	// may allow other query method (e.g. by gene name from a db table)
	throw 'insufficient query parameters for snvindel'
}

async function query_svfusion(q, ds) {
	if (q.rglst) {
		if (!ds.queries.svfusion.byrange) throw 'q.rglst provided but svfusion.byrange missing'
		return await ds.queries.svfusion.byrange.get(q)
	}
	throw 'insufficient query parameters for svfusion'
}
async function query_geneCnv(q, ds) {
	if (q.gene) {
		if (!ds.queries.geneCnv.bygene) throw 'q.gene provided but geneCnv.bygene missing'
		return await ds.queries.geneCnv.bygene.get(q)
	}
	throw 'insufficient query parameters for geneCnv'
}

// not in use
async function query_genecnv(q, ds) {
	if (q.isoform) {
		if (ds.queries.genecnv.byisoform) {
			let name = q.isoform
			if (ds.queries.genecnv.byisoform.sqlquery_isoform2gene) {
				// convert isoform to gene name
				const tmp = ds.queries.genecnv.byisoform.sqlquery_isoform2gene.query.get(q.isoform)
				if (tmp && tmp.gene) {
					name = tmp.gene
				} else {
					console.log('no gene found by ' + q.isoform)
					// do not crash the query! return no data
					return
				}
			}
			return await ds.queries.genecnv.byisoform.get(q, name)
		}
		throw '.byisoform missing for genecnv query'
	}
}

function filter_data(q, result) {
	// will not be needed when filters are combined into graphql query language
	if (result.skewer) {
		const newskewer = []

		for (const m of result.skewer) {
			if (q.hiddenmclass && q.hiddenmclass.has(m.class)) continue

			if (q.rglst) {
				/* when rglst[{chr/start/stop}] is given, filter skewer data points to only keep those in view range
				this is to address an issue that zooming in when gmmode=protein, tk shows "No samples"
				client has changed that will always issue request when zooming in on same isoform
				server will re-request data, though inefficient
				so as to calculate the number of samples with mutations in zoomed in region of protein
				*/
				if (!q.rglst.find(r => m.chr == r.chr && m.pos >= r.start && m.pos <= r.stop)) {
					// not in any region
					continue
				}
			}

			// filter by other variant attributes

			newskewer.push(m)
		}

		result.skewer = newskewer
	}

	if (result.genecnvAtsample) {
	}
	// other sample-level data types that need filtering
}

/* may validate q.filter0
the validation function is defined in ds
cannot do it in init_q() as ds is not available
this ensures filter0 and its validation is generic and not specific to gdc
*/
function may_validate_filters(q, ds) {
	if (q.filter0) {
		const f =
			typeof q.filter0 == 'object'
				? q.filter0
				: JSON.parse(
						typeof q.filter0 == 'string' && q.filter0.startsWith('%') ? decodeURIComponent(q.filter0) : q.filter0
				  )
		q.filter0 = ds.validate_filter0(f)
	}
	if (q.filterObj && typeof q.filterObj == 'string') {
		q.filterObj = JSON.parse(
			typeof q.filterObj == 'string' && q.filterObj.startsWith('%') ? decodeURIComponent(q.filterObj) : q.filterObj
		)
	}
	if (q.skewerRim) {
		if (q.skewerRim.type == 'format') {
			if (!q.skewerRim.formatKey) throw 'skewerRim.formatKey missing when type=format'
			if (!ds.queries?.snvindel?.byrange?._tk?.format) throw 'snvindel.byrange._tk.format{} not found when type=format'
			if (!ds.queries.snvindel.byrange._tk.format[q.skewerRim.formatKey]) throw 'invalid skewerRim.formatKey'
		} else {
			throw 'unknown skewerRim.type'
		}
		q.skewerRim.hiddenvalues = new Set()
		if (q.skewerRim.hiddenvaluelst) {
			if (!Array.isArray(q.skewerRim.hiddenvaluelst)) throw 'query.skewerRim.hiddenvaluelst is not array'
			for (const n of q.skewerRim.hiddenvaluelst) q.skewerRim.hiddenvalues.add(n)
			delete q.skewerRim.hiddenvaluelst
		}
	}
	if (q.formatFilter) {
		throw 'validate formatFilter'
	}
}
