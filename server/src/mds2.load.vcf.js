const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn
const utils = require('./utils')
const vcf = require('../shared/vcf')
const common = require('../shared/common')
const termdbsql = require('./termdb.sql')

/*
********************** EXPORTED
handle_vcfbyrange
handle_ssidbyonem
handle_getcsq
********************** INTERNAL
set_querymode
	get_columnidx_byterms
	filter_samples_by_termvalue
	get_pop2average
query_vcf_applymode
vcfbyrange_collect_result
_m_is_filtered
parseline_AFtest
	AFtest_getdata_onem
		getallelecount_samplegroup_vcfline
*/

const serverconfig = require('./serverconfig')

export async function handle_ssidbyonem(q, genome, ds, result) {
	/*
ssid: sample set id
get ssid by one m from vcf
*/
	if (ds.iscustom) throw 'custom ds not allowed'
	const tk = ds.track.vcf
	if (!tk) throw 'ds.track.vcf missing'
	if (!q.m) throw 'q.m missing'

	// query for this variant
	const coord = (tk.nochr ? q.m.chr.replace('chr', '') : q.m.chr) + ':' + (q.m.pos + 1) + '-' + (q.m.pos + 1)

	let m
	await utils.get_lines_tabix([tk.file, coord], tk.dir, line => {
		const [e, mlst, e2] = vcf.vcfparseline(line, tk)
		for (const m2 of mlst) {
			if (m2.pos == q.m.pos && m2.ref == q.m.ref && m2.alt == q.m.alt) {
				m = m2
				return
			}
		}
	})

	if (!m) throw 'variant not found'

	// divide samples by genotype
	const rr = [], // hom ref
		ra = [], // het
		aa = [] // hom alt
	for (const sample of m.sampledata) {
		if (!sample.genotype) continue
		const hasref = sample.genotype.indexOf(q.m.ref) != -1
		const hasalt = sample.genotype.indexOf(q.m.alt) != -1
		if (hasref) {
			if (hasalt) ra.push(sample.sampleobj.name)
			else rr.push(sample.sampleobj.name)
		} else {
			if (hasalt) aa.push(sample.sampleobj.name)
		}
	}
	const filename = Math.random().toString()
	result.ssid = filename
	result.groups = {}
	const lines = []
	if (rr.length) {
		const k = 'Homozygous reference'
		result.groups[k] = { size: rr.length }
		lines.push(k + '\t' + rr.join(','))
	}
	if (ra.length) {
		const k = 'Heterozygous'
		result.groups[k] = { size: ra.length }
		lines.push(k + '\t' + ra.join(','))
	}
	if (aa.length) {
		const k = 'Homozygous alternative'
		result.groups[k] = { size: aa.length }
		lines.push(k + '\t' + aa.join(','))
	}
	await utils.write_file(path.join(serverconfig.cachedir, 'ssid', filename), lines.join('\n'))
}

export async function handle_vcfbyrange(q, genome, ds, result) {
	/*
	for range query

	ds is either official or custom

	genotype matrix export piggybacks on this route
	*/
	if (!q.rglst) throw '.rglst[] missing'

	const tk0 = ds.track.vcf
	if (!tk0) throw 'ds.track.vcf missing'

	// temporary vcf tk object, may with altered .samples[]
	const vcftk = {
		info: tk0.info,
		format: tk0.format,
		samples: tk0.samples
	}

	set_querymode(q, vcftk, ds)

	query_vcf_applymode(vcftk, q)

	if (q.exportgenotype) {
		result.mlst = []
	}

	for (const r of q.rglst) {
		if (tk0.viewrangeupperlimit && r.stop - r.start >= tk0.viewrangeupperlimit) {
			r.rangetoobig = 'Zoom in under ' + common.bplen(tk0.viewrangeupperlimit) + ' to view VCF data'
			continue
		}

		const mockblock = make_mockblock(r)
		const m_is_filtered = _m_is_filtered(q, result, mockblock)

		const coord = (tk0.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop

		await utils.get_lines_tabix([tk0.file, coord], tk0.dir, line => {
			if (q.exportgenotype) {
				// parsing full line is too slow
				// for each line, only parse first 8 columns
				// for each sample, only parse GT
				// XXX buggy! parsed variant doesn't have full array of alleles, so if there are more than 1 alt, the gt index will be off
				// solution is tell vcfparseline to keep .alleles[] array
				const l = line.split('\t')
				const [e, mlst, e2] = vcf.vcfparseline(l.slice(0, 8).join('\t'), vcftk)
				for (const m of mlst) {
					if (m_is_filtered(m)) continue
					const row = [m.chr + '.' + (m.pos + 1) + '.' + m.ref + '.' + m.alt, m.name || '']
					for (let i = 9; i < l.length; i++) {
						const str = l[i].split(':', 1)[0]
						if (str == '.') {
							row.push('.')
							continue
						}
						const tmp = str.split(str.indexOf('/') == -1 ? '|' : '/')
						row.push((tmp[0] == '0' ? m.ref : m.alt) + (tmp[1] == '0' ? m.ref : m.alt))
					}
					result.mlst.push(row.join('\t'))
				}
				return
			}

			let mlst

			if (q.querymode.range_variantonly) {
				if (q.querymode.slicecolumnindex) {
					// TODO do slicing, parse reduced line with samples, and decide if the variant exist in the sliced samples
				} else {
					// no sample filtering, do not look at sample, just the variant
					const newline = line.split('\t', 8).join('\t')
					const [e, mlst2, e2] = vcf.vcfparseline(newline, vcftk)
					mlst = []
					for (const m of mlst2) {
						if (!m_is_filtered(m)) mlst.push(m)
					}
				}
			} else if (q.querymode.range_AFtest) {
				mlst = parseline_AFtest(line, q, vcftk, ds, m_is_filtered)
			}

			if (mlst) {
				for (const m of mlst) {
					if (m.csq) {
						// not to release the whole csq, only to show number of interpretations
						m.csq_count = m.csq.length
						delete m.csq
					}
					delete m._m
					delete m.vcf_ID
					delete m.sampledata

					if (tk0.nochr) m.chr = 'chr' + m.chr

					r.variants.push(m)
				}
			}
		})
	}

	await may_apply_fishertest(q)

	vcfbyrange_collect_result(result, q, tk0, ds)
}

function set_querymode(q, vcftk, ds) {
	/*
generate the "querymode" object that drives subsequent queries
*/

	q.querymode = {}

	if (q.AFtest) {
		if (ds.iscustom) throw 'custom track does not support AFtest'
		for (const g of q.AFtest.groups) {
			if (g.is_infofield) {
				continue
			}
			if (g.is_termdb) {
				g.columnidx = get_columnidx_byterms(g.filter, ds)
				continue
			}
			if (g.is_population) {
				if (!ds.track.populations) throw 'ds.track.populations missing'
				const p = ds.track.populations.find(i => i.key == g.key)
				if (!p) throw 'unknown population key: ' + g.key
				g.population = JSON.parse(JSON.stringify(p)) // as the population data structure can be modified later
				if (q.AFtest.termfilter) {
					// termfilter hardcode to be just one term
					if (q.AFtest.termfilter[0].term.id == g.population.termfilter) {
						// this population can be filtered by this term
						const popset = g.population.sets.find(i => i.termfilter_value == q.AFtest.termfilter[0].values[0].key)
						if (!popset) throw 'no matching set found for a termfilter from a population'
						g.population.sets = [popset] // only keep this set
					}
				}
				continue
			}
			throw 'Cannot set query mode: unknown group type'
		}

		if (q.AFtest.testby_fisher) {
			if (q.AFtest.groups.find(i => i.is_infofield)) throw 'cannot do fisher test for an INFO field'
		}

		// after validating each single group, validate adjust race
		{
			const popg = q.AFtest.groups.find(i => i.is_population)
			if (popg && popg.adjust_race) {
				// need termdb group
				const tg = q.AFtest.groups.find(i => i.is_termdb)
				if (!tg) throw 'cannot adjust race: termdb group missing'
				// compute pop average
				tg.pop2average = get_pop2average(popg.population.sets, tg.columnidx, ds, vcftk)
			}
		}

		q.querymode.range_AFtest = true
		return
	}

	q.querymode.range_variantonly = true
	/*
	slicecolumnindex
	in case of sample filtering
	from tk0.samples[], decide samples to keep
	update that to vcftk.samples
	and get the column indices for these samples for slicing
	*/
}

function get_pop2average(popsets, columnidx, ds, vcftk) {
	/*
using adjust race, when combining a population and a termdb group
for the set of samples defined by termdb,
get population admix average, initiate 0 for each population

popsets:
	.sets[] from the population

columnidx:

ds:
vcftk
*/
	const pop2average = new Map()
	let poptotal = 0 // sum for all sets, across all samples
	for (const p of popsets) {
		const o = {
			infokey_AC: p.infokey_AC,
			infokey_AN: p.infokey_AN,
			average: 0
		}

		// for this race grp, issue one query to get percentage value of all samples, and sum up
		const lst = termdbsql.get_rows_by_one_key({ ds, key: p.key })
		for (const i of lst) {
			if (!ds.track.vcf.sample2arrayidx.has(i.sample)) continue
			const v = Number(i.value)
			if (Number.isFinite(v)) {
				o.average += v
				poptotal += v
			}
		}

		pop2average.set(p.key, o)
	}
	// after sum, make average
	for (const [k, v] of pop2average) {
		v.average /= poptotal
	}
	return pop2average
}

function get_columnidx_byterms(filter, ds) {
	/*
filter is the filter of the group
a sample must meet all term conditions
*/

	if (!ds.track) throw 'ds.track{} missing'
	const samples = termdbsql.get_samples(filter, ds)
	return samples.reduce((lst, samplename) => {
		const i = ds.track.vcf.sample2arrayidx.get(samplename)
		if (i >= 0) lst.push(i)
		return lst
	}, [])
}

function filter_samples_by_termvalue(sampleidx, ds, termfilter) {
	/*
	not in use
for a termdb group from AFtest

sampleidx[]
	list of array index of the VCF samples as input,
	output a smaller list of samples who matches with termfilter
ds:
termfilter{}
	tvs structure
	though it is hardcoded to be categorical only
*/
	const allmatching = termdbsql.get_samples(termfilter, ds)
	const sampleset = new Set(allmatching)
	const newlst = []
	for (const i of sampleidx) {
		if (sampleset.has(ds.track.vcf.samples[i].name)) {
			newlst.push(i)
		}
	}
	return newlst
}

function vcfbyrange_collect_result(result, q, tk, ds) {
	/*
done querying, collect result, also clear rglst which is shared by others

for specific type of query mode, send additional info
*/

	if (q.exportgenotype) {
		result.exportgenotype =
			'variant\tSNP\t' +
			tk.samples.map(i => (ds.sampleidmap ? ds.sampleidmap.get(i.name) : i.name)).join('\t') +
			'\n' +
			result.mlst.join('\n')
		delete result.mlst
		return
	}

	result.vcf = {
		rglst: []
	}
	for (const r of q.rglst) {
		const r2 = {
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			reverse: r.reverse,
			xoff: r.xoff
		}
		result.vcf.rglst.push(r2)
		if (r.rangetoobig) {
			r2.rangetoobig = r.rangetoobig
			delete r.rangetoobig
		} else if (r.variants) {
			r2.variants = r.variants
			delete r.variants
		} else if (r.canvas) {
			r2.img = r.canvas.toDataURL()
			delete r.canvas
		}
	}

	if (q.AFtest) {
		if (q.AFtest.groups.find(i => i.is_termdb)) {
			// has termdb group
			// return number of samples; did adjustment, return back average admix
			result.AFtest_termdbgroup = []

			let g = q.AFtest.groups[0]
			if (g.is_termdb) {
				result.AFtest_termdbgroup[0] = {
					samplecount: g.columnidx.length
				}
				if (g.pop2average) {
					result.AFtest_termdbgroup[0].popsetaverage = []
					for (const [k, v] of g.pop2average) {
						result.AFtest_termdbgroup[0].popsetaverage.push([k, v.average])
					}
				}
			}

			g = q.AFtest.groups[1]
			if (g.is_termdb) {
				result.AFtest_termdbgroup[1] = {
					samplecount: g.columnidx.length
				}
				if (g.pop2average) {
					result.AFtest_termdbgroup[1].popsetaverage = []
					for (const [k, v] of g.pop2average) {
						result.AFtest_termdbgroup[1].popsetaverage.push([k, v.average])
					}
				}
			}
		}
	}
}

function query_vcf_applymode(vcftk, q) {
	/* at variant only mode, apply changes and prepare for querying
	 */
	if (q.querymode.range_variantonly || q.querymode.range_AFtest) {
		delete vcftk.samples // not to parse samples
		for (const r of q.rglst) {
			r.variants = []
			/* if r.variants[] is valid, store variants here
			if number of variants is above cutoff, render them into image
			in that case
			will create r.canvas
			render all current r.variants into canvas
			and delete r.variants
			so that subsequent variants will all be rendered into canvas
			canvas rendering will mimick client-side display
			*/
		}
	}
}

function make_mockblock(r) {
	if (r.usegm_isoform) return { gmmode: 'protein', usegm: { isoform: r.usegm_isoform } }
	return {}
}

export async function handle_getcsq(q, genome, ds, result) {
	/*
get csq from one variant
*/
	const tk = ds.track.vcf
	if (!tk) throw 'ds.track.vcf missing'
	if (!q.m) throw 'q.m missing'

	// query for this variant
	const coord = (tk.nochr ? q.m.chr.replace('chr', '') : q.m.chr) + ':' + (q.m.pos + 1) + '-' + (q.m.pos + 1)

	await utils.get_lines_tabix([tk.file, coord], tk.dir, line => {
		const [e, mlst, e2] = vcf.vcfparseline(line, tk)
		for (const m2 of mlst) {
			if (m2.pos == q.m.pos && m2.ref == q.m.ref && m2.alt == q.m.alt) {
				result.csq = m2.csq
				return
			}
		}
	})
}

function parseline_AFtest(line, q, vcftk, ds, m_is_filtered) {
	/*
	there may be 2 or more groups
	a group can be determined by termdb, or info field
	*/
	const l = line.split('\t')
	const [e, mlst, e2] = vcf.vcfparseline(l.slice(0, 8).join('\t'), vcftk)
	// get those passing filter
	const mlstpass = mlst.filter(m => !m_is_filtered(m))
	if (mlstpass.length == 0) {
		// stop, no need to parse samples
		return
	}
	const alleles = [l[3], ...l[4].split(',')]

	// exclude m with no alt alleles in both groups
	const mlstpass2 = []

	for (const m of mlstpass) {
		const mgroups = AFtest_getdata_onem(l, m, alleles, q)

		if (AFtest_allow_m(mgroups)) {
			mlstpass2.push(m)
		} else {
			continue
		}

		// hardcoded to deal with 2 groups
		if (q.AFtest.testby_AFdiff) {
			for (const g of mgroups) {
				if (g.is_infofield) {
					g.v = g.infofieldvalue
				} else if (g.is_termdb || g.is_population) {
					g.v = g.altcount / (g.refcount + g.altcount)
				} else {
					throw 'unknown group type'
				}
			}
			m.AFtest_group_values = [mgroups[0].v, mgroups[1].v]
			m.nm_axis_value = mgroups[0].v - mgroups[1].v // for axis
		} else if (q.AFtest.testby_fisher) {
			m.contigencytable = [mgroups[0].altcount, mgroups[0].refcount, mgroups[1].altcount, mgroups[1].refcount]
			// collect table from all variants and run one test
		}

		// if adjusted race, for the population group, append the set2value to m
		{
			const g = q.AFtest.groups.find(i => i.is_population)
			if (g && g.adjust_race) {
				const g = mgroups.find(i => i.is_population)
				// g must have set2value
				m.popsetadjvalue = []
				for (const [s, v] of g.set2value) {
					m.popsetadjvalue.push([
						s,
						v.ACraw,
						v.ANraw - v.ACraw,
						Number.parseInt(v.ACadj),
						Number.parseInt(v.ANadj - v.ACadj)
					])
				}
			}
		}
	}
	return mlstpass2
}

function AFtest_allow_m(mgroups) {
	if (mgroups.find(i => i.is_infofield)) {
		// has an info field, do not restrict by presence of alt allele
		return true
	}
	// hardcoded to be two groups
	const altsum = mgroups[0].altcount + mgroups[1].altcount
	return altsum > 0
}

function AFtest_getdata_onem(l, m, alleles, q) {
	/*
AFtest
for one variant, get data for each group
return an array of same length and group typing of AFtest.groups[]
*/
	return q.AFtest.groups.reduce((lst, g) => {
		if (g.is_infofield) {
			lst.push({
				is_infofield: true,
				infofieldvalue: get_infovalue(m, g)
			})
		} else if (g.is_termdb) {
			const _ = getallelecount_samplegroup_vcfline(alleles, l, g.columnidx)
			lst.push({
				is_termdb: true,
				allref: _.allref,
				refcount: _.alleles.get(m.ref) || 0,
				altcount: _.alleles.get(m.alt) || 0
			})
		} else if (g.is_population) {
			const set2value = new Map()
			/*  k: population set key
				v: { ACraw, ANraw, ACadj, ANadj }
			*/
			for (const aset of g.population.sets) {
				set2value.set(aset.key, {
					ACraw: get_infovalue(m, { key: aset.infokey_AC, missing_value: 0 }),
					ANraw: get_infovalue(m, { key: aset.infokey_AN, missing_value: 0 })
				})
			}
			// for a population group, if to adjust race
			let refcount = 0,
				altcount = 0
			if (g.adjust_race) {
				;[refcount, altcount] = AFtest_adjust_race(set2value, q.AFtest.groups.find(i => i.is_termdb))
			} else {
				// not adjust race, add up AC AN
				for (const v of set2value.values()) {
					altcount += v.ACraw
					refcount += v.ANraw - v.ACraw
				}
			}
			lst.push({
				is_population: true,
				refcount,
				altcount,
				set2value
			})
		} else {
			throw 'unknown group type'
		}
		return lst
	}, [])
}

function AFtest_adjust_race(set2value, group_termdb) {
	if (!group_termdb) throw 'group_termdb missing'
	if (!group_termdb.pop2average) throw 'group_termdb.pop2average missing'
	let controltotal = 0
	for (const v of set2value.values()) {
		controltotal += v.ANraw
	}
	// adjust control population based on pop2average
	let ACadj = 0,
		ANadj = 0
	for (const [k, v] of set2value) {
		// record adjusted value per set for sending back to client
		v.ANadj = controltotal * group_termdb.pop2average.get(k).average
		v.ACadj = v.ANadj == 0 ? 0 : (v.ACraw * v.ANadj) / v.ANraw

		ACadj += v.ACadj
		ANadj += v.ANadj
	}
	return [ANadj - ACadj, ACadj]
}

function get_infovalue(m, f) {
	// field is {key,missing_value}
	if (m.info) {
		const v = m.info[f.key]
		if (v != undefined) return v
	}
	if (m.altinfo) {
		const v = m.altinfo[f.key]
		if (v != undefined) return v
	}
	return f.missing_value
}

async function may_apply_fishertest(q) {
	if (!q.querymode.range_AFtest) return
	if (!q.AFtest.testby_fisher) return
	const lines = []
	const mlst = {}
	for (const r of q.rglst) {
		if (r.variants) {
			for (const m of r.variants) {
				if (m.contigencytable) {
					const kstr = m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt
					lines.push(kstr + '\t' + m.contigencytable.join('\t'))
					mlst[kstr] = m
				}
			}
		}
	}
	if (lines.length == 0) {
		// no data
		return
	}
	const plines = await utils.lines2R('fisher.R', lines)
	for (const line of plines) {
		const l = line.split('\t')
		const m = mlst[l[0]]
		if (m) {
			const v = Number.parseFloat(l[5])
			m.AFtest_pvalue = v
			m.nm_axis_value = Number.isNaN(v) ? 0 : -Math.log10(v) // for axis
		}
	}
}

function _m_is_filtered(q, result, mockblock) {
	return m => {
		let todrop = false
		// ***warning*** down here, can only set todrop to true, must not set it to false...

		if (q.info_fields) {
			for (const i of q.info_fields) {
				const re = result.info_fields[i.key]

				// get info field value
				let value = undefined
				if (m.info) value = m.info[i.key]
				if (value == undefined && m.altinfo) value = m.altinfo[i.key]

				if (i.iscategorical) {
					if (value == undefined) {
						re.unannotated_count = 1 + (re.unannotated_count || 0)
						if (i.unannotated_ishidden) {
							todrop = true
						}
					} else {
						re.value2count[value] = 1 + (re.value2count[value] || 0)
						if (i.hiddenvalues[value]) {
							todrop = true
						}
					}
				} else if (i.isnumerical) {
					if (value == undefined) {
						if (i.missing_value != undefined) value = i.missing_value
					}

					// test start
					if (!i.range.startunbounded) {
						if (i.range.startinclusive) {
							if (value < i.range.start) todrop = true
						} else {
							if (value <= i.range.start) todrop = true
						}
					}
					// test stop
					if (!i.range.stopunbounded) {
						if (i.range.stopinclusive) {
							if (value > i.range.stop) todrop = true
						} else {
							if (value >= i.range.stop) todrop = true
						}
					}
					if (todrop) re.filteredcount++
				} else if (i.isflag) {
					if (value) {
						re.count_yes++
					} else {
						re.count_no++
					}
					if ((i.remove_yes && value) || (i.remove_no && !value)) {
						todrop = true
					}
				} else {
					throw 'unknown info type'
				}
			}
		}

		// final step is mclass
		if (todrop) {
			// this variant has been filtered, do not add to mclass counter
			return true
		}

		common.vcfcopymclass(m, mockblock)

		// m.class is decided, add to counter
		result.mclass2count[m.class] = (result.mclass2count[m.class] || 0) + 1

		// if to drop this variant
		if (q.hidden_mclass && q.hidden_mclass.has(m.class)) {
			todrop = true
		}

		return todrop
	}
}

function prep_termdbgrp(terms) {
	// not in use
	for (const t of terms) {
		if (t.term.type == 'categorical') {
			// convert values[{key,label}] to set
			t.valueset = new Set(t.values.map(i => i.key))
		}
	}
}

function getallelecount_samplegroup_vcfline(alleles, l, columnidx) {
	let allref = true

	const allele2count = new Map()
	// k: allele, v: count
	for (const a of alleles) {
		allele2count.set(a, 0)
	}

	for (const i of columnidx) {
		if (!l[9 + i]) continue
		const gt = l[9 + i].split(':')[0]
		if (gt == '.') continue
		gt.split(gt.indexOf('/') == -1 ? '|' : '/').forEach(s => {
			const i = Number.parseInt(s)
			if (Number.isNaN(i)) return
			const allele = alleles[i]
			if (!allele) return
			if (i != 0) {
				allref = false
			}
			allele2count.set(allele, 1 + allele2count.get(allele))
		})
	}
	return {
		allref,
		alleles: allele2count
	}
}
