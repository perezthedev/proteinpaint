import { select as d3select, event as d3event } from 'd3-selection'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from './common'
import * as client from './client'
import { makeTk } from './block.mds3.makeTk'
import { update as update_legend } from './block.mds3.legend'
import { may_render_skewer } from './block.mds3.skewer'

/*
********************** EXPORTED
loadTk
get_parameter
********************** INTERNAL

*/

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish_closure(tk, block) // function used at multiple places

	try {
		if (tk.uninitialized) {
			await makeTk(tk, block)
			delete tk.uninitialized
		}

		tk.tklabel.each(function() {
			tk.leftLabelMaxwidth = this.getBBox().width
		}) // do this when querying each time

		const par = get_parameter(tk, block)
		const data = await client.dofetch2('mds3?' + par)
		if (data.error) throw data.error

		tk.clear()
		console.log(data)

		tk.height_main += may_render_skewer(data, tk, block)
		// add new subtrack type

		_finish(data)
	} catch (e) {
		// if the error is thrown upon initiating the track, clear() function may not have been added
		if (tk.clear) tk.clear()
		tk.height_main = 50
		_finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
		return
	}
}

function loadTk_finish_closure(tk, block) {
	return data => {
		update_legend(data, tk, block)
		block.tkcloakoff(tk, { error: data.error })
		block.block_setheight()
		block.setllabel()
	}
}

export function get_parameter(tk, block) {
	// to get data for current view range

	const par = [
		'genome=' + block.genome.name,
		'forTrack=1' // instructs server to return data types associated with tracks
	]
	if (tk.mds.label) {
		// official
		par.push('dslabel=' + tk.mds.label)
	} else {
		throw 'how to deal with custom track'
	}

	//rangequery_add_variantfilters(par, tk)

	rangequery_rglst(tk, block, par)

	if (tk.legend.mclass.hiddenvalues.size) {
		// todo
	}
	return par.join('&')
}

function rangequery_rglst(tk, block, par) {
	let rglst = []
	if (block.usegm) {
		/* to merge par.rglst[] into one region
		this does not apply to subpanels
		*/
		const r = {
			chr: block.rglst[0].chr,
			reverse: block.rglst[0].reverse,
			width: 0,
			start: null,
			stop: null
		}
		for (let i = block.startidx; i <= block.stopidx; i++) {
			const j = block.rglst[i]
			r.width += j.width + block.regionspace
			r.start = r.start == null ? j.start : Math.min(r.start, j.start)
			r.stop = r.stop == null ? j.stop : Math.min(r.stop, j.stop)
		}
		rglst.push(r)
		par.push('isoform=' + block.usegm.isoform)
	} else {
		rglst = block.tkarg_rglst(tk)
	}
	// append xoff to each r from block
	let xoff = 0
	for (const r of rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const r of block.subpanels) {
			rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				xoff: xoff
			})
			xoff += r.width + r.leftpad
		}
	}
	par.push('rglst=' + JSON.stringify(rglst))
}

function rangequery_add_variantfilters(par, tk) {
	/*
	todo
may add filter parameter for range query
by info_fields[] and variantcase_fields[]
*/
	if (tk.info_fields) {
		par.info_fields = tk.info_fields.reduce((lst, i) => {
			if (i.isfilter) {
				if (i.iscategorical) {
					// for categorical term, always register in parameter
					// server will collect #variants for each category
					const j = {
						key: i.key,
						iscategorical: true,
						unannotated_ishidden: i.unannotated_ishidden,
						hiddenvalues: {}
					}
					for (const v of i.values) {
						if (v.ishidden) j.hiddenvalues[v.key] = 1
					}
					lst.push(j)
				} else if (i.isinteger || i.isfloat) {
					// numerical
					if (i.isactivefilter) {
						// only apply when the numerical filter is in use
						lst.push({
							key: i.key,
							isnumerical: true,
							missing_value: i.missing_value,
							range: i.range
						})
					}
				} else if (i.isflag) {
					// always register flag to collect counts
					lst.push({
						key: i.key,
						isflag: true,
						remove_no: i.remove_no,
						remove_yes: i.remove_yes
					})
				} else {
					throw 'unknown type of info filter'
				}
			}
			return lst
		}, [])
	}
}
