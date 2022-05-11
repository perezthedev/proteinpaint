import { event as d3event } from 'd3-selection'
import { init_sampletable } from './sampletable'
import { itemtable } from './itemtable'
import { skewer_sety } from './skewer.render'
import { trianglePath } from './numericmode'

const minoccur4sunburst = 10 // minimum occurrence for showing skewer, maybe ds specific
const highlight_color = 'red'

/*
************** EXPORT
click_variant()

************** tentative logic
custom method:
	if tk.click_snvindel() is set, call this; will also call highlight_one_disk()
built-in methods
	if d.occurrence is set, show sunburst
	else, call variant_details()

************** arguments
d{} 
	3 cases:
	1. if d.aa{}, is a group of skewer.data[0].groups[], and is one or multiple variants sharing the same mname (kras Q61H)
	2. is one of skewer.data[] (e.g clicking ssk box under a skewer),
	   variants may be of different data type
	   both case, use d.mlst[] for full list
	3. from numeric mode. d.mlst[] should have just a single m
tk
block
tippos{ left, top }
	suggested itemtip position, if not sunburst
eventTarget
	svg <circle> element of the kick cover of the clicked disc
	used by click_snvindel to highlight this disc
*/
export async function click_variant(d, tk, block, tippos, eventTarget) {
	try {
		if (tk.click_snvindel) {
			// custom handler overrides default behavior
			highlight_one_disk(d.mlst[0], eventTarget, tk)
			tk.click_snvindel(d.mlst[0])
			return
		}
		if ('occurrence' in d && d.occurrence >= minoccur4sunburst && tk.mds.variant2samples) {
			await click2sunburst(d, tk, block, tippos)
			return
		}
		// no sunburst, no matter occurrence, show details
		await variant_details({ mlst: d.mlst, tk, block, tippos })
	} catch (e) {
		block.error(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

async function click2sunburst(d, tk, block, tippos) {
	tk.glider.style('cursor', 'wait')
	const data = await tk.mds.variant2samples.get({ mlst: d.mlst, querytype: tk.mds.variant2samples.type_sunburst })
	tk.glider.style('cursor', 'auto')
	const arg = {
		nodes: data,
		occurrence: d.occurrence,
		boxyoff: tk.yoff,
		boxheight: tk.height,
		boxwidth: block.width,
		svgheight: Number.parseFloat(block.svg.attr('height')),
		g: tk.skewer.g.append('g'),
		pica: tk.pica,
		click_listbutton: (x, y) => {
			variant_details({ mlst: d.mlst, tk, block, tippos })
		},
		click_ring: d2 => {
			/* hardcoded attributes from d2.data{}, due to how stratinput structures the data
			.id0, v0 should exist for all levels
			.id1, v1 should exist for 2nd and next levels... etc
			add the key/values to tid2value{}
			*/
			tk.itemtip.clear().show(d3event.clientX - 10, d3event.clientY - 10)
			const arg = {
				mlst: d.mlst,
				tk,
				block,
				div: tk.itemtip.d,
				tid2value: {}
			}
			arg.tid2value[d2.data.id0] = d2.data.v0
			if (d2.data.id1) arg.tid2value[d2.data.id1] = d2.data.v1
			if (d2.data.id2) arg.tid2value[d2.data.id2] = d2.data.v2

			/*
			TEMP FIX to create a mock arg.mlst[]
			this wedge has less samples than d.mlst will have multiple.
			as mlst2samplesummary uses occurrence sum to decide what type of data to request
			must change occurrence sum to d2.value so mlst2samplesummary() can function based on sum of this wedge
			*/
			arg.mlst = d.mlst.map(m => {
				if (tk.mds.variant2samples.variantkey == 'ssm_id') {
					return { ssm_id: m.ssm_id, occurrence: 0 }
				}
				throw 'unknown variant2samples.variantkey'
			})
			arg.mlst[0].occurrence = d2.value
			/* do not call variant_details() as no need to show info on variants
			only need to show sample display
			*/
			init_sampletable(arg)
		}
	}
	if (d.aa) {
		arg.cx = d.aa.x
		arg.cy = skewer_sety(d, tk) + d.yoffset * (tk.aboveprotein ? -1 : 1)
	} else {
		arg.cx = d.x
		arg.cy = d.y + ((tk.aboveprotein ? 1 : -1) * tk.skewer.stem1) / 2
		// not to show list button in sunburst in case mlst has different data types
	}
	if (d.mlst.length == 1) {
		arg.chartlabel = d.mlst[0].mname
	} else {
		// multiple m, use mname of most recurrent variant
		arg.chartlabel = d.mlst.reduce((i, j) => (j.occurrence > i.occurrence ? j : i)).mname + ' etc'
	}
	const _ = await import('../sunburst')
	_.default(arg)
}

/*
if items of mlst are of same type, show table view of the variant itself, plus the sample summary table
if of multiple data types, do not show variant table view; only show the sample summary table
should work with skewer and non-skewer data types
arg{}
.mlst[]
.tk
.block
.tippos
.tid2value{}
*/
async function variant_details(arg) {
	arg.tk.itemtip.clear().show(arg.tippos.left - 10, arg.tippos.top - 10)
	arg.div = arg.tk.itemtip.d
	// count how many dt
	const dtset = new Set()
	for (const m of arg.mlst) dtset.add(m.dt)
	if (dtset.size > 1) {
		// more than 1 data types, won't print detail table for each variant
		if (arg.tk.mds.variant2samples) {
			// show sample summary
			await init_sampletable(arg)
		} else {
			throw 'no variant2samples, do not know what to show'
		}
		return
	}
	// mlst are of one data type
	await itemtable(arg)
}

function highlight_one_disk(m, dot, tk) {
	// remove highlight on all disc kick covers
	tk.skewer.discKickSelection
		.attr('r', m => m.radius - 0.5) // reset radius
		.attr('stroke', m => tk.color4disc(m))
		.attr('stroke-opacity', 0)
	tk.skewer.discKickSelection_triangle
		.attr('d', m => trianglePath(m.radius))
		.attr('stroke', m => tk.color4disc(m))
		.attr('stroke-opacity', 0)
	// dot is the kick <circle>; apply highlight styling on it
	if (m.shapeTriangle) {
		dot.setAttribute('d', trianglePath(m.radius * 1.4))
	} else {
		dot.setAttribute('r', m.radius * 1.4)
	}
	dot.setAttribute('stroke', highlight_color)
	dot.setAttribute('stroke-opacity', 1)
}
