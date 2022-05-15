import { mclass, dtsnvindel, dtfusionrna, dtsv } from '../../shared/common'
import { init_sampletable } from './sampletable'
import { get_list_cells } from '../dom/gridutils'
import { event as d3event } from 'd3-selection'

/*
********************** EXPORTED
itemtable
********************** INTERNAL
table_snvindel
table_snvindel_onevariant
table_snvindel_multivariant
add_csqButton
print_snv

table_fusionsv

.occurrence must be set for each variant
all mlst of one data type
should work for all types of data

TODO
similar to vcf, variant annotation should be kept in .info{}, e.g. consequence
describe these attributes in tk.mds.variantInfo
print each info as table row/column

*/

const cutoff_tableview = 10

/*
for a list of variants of *same type*, print details of both variant and samples
arg{}
.div
.mlst
.tk
.block
.disable_variant2samples:true
	set to true to not to issue variant2samples query for variants
*/
export async function itemtable(arg) {
	if (arg.mlst[0].dt == dtsnvindel) {
		await table_snvindel(arg)
		return
	}
	if (arg.mlst[0].dt == dtfusionrna || arg.mlst[0].dt == dtsv) {
		await table_fusionsv(arg)
		return
	}
	throw 'itemtable unknown dt'
}

/*
rendering may be altered by tk.mds config
may use separate scripts to code different table styles
*/
async function table_snvindel(arg) {
	const grid = arg.div
		.append('div')
		.style('display', 'inline-grid')
		.style('overflow-y', 'scroll')

	if (arg.mlst.length == 1) {
		// single variant, use two-column table to show key:value pairs
		grid.style('grid-template-columns', 'auto auto').style('max-height', '40vw')
		table_snvindel_onevariant(arg, grid)

		arg.variantDiv = grid // allow to append sample info to the same grid along with variant info
	} else {
		// make a multi-column table for all variants, one row for each variant
		// set of columns are based on available attributes in mlst
		grid
			.style('max-height', '30vw')
			.style('gap', '10px')
			.style('margin-bottom', '10px') // add space between new table created for samples
		table_snvindel_multivariant(arg, grid)
	}

	if (!arg.disable_variant2samples && arg.tk.mds.variant2samples) {
		await init_sampletable(arg)
	}
}

function table_snvindel_onevariant({ mlst, tk, block }, grid) {
	const m = mlst[0]
	{
		const [td1, td2] = get_list_cells(grid)
		td1.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		print_mname(td2, m)
		//add_csqButton(m, tk, td2, table)
	}
	{
		const [td1, td2] = get_list_cells(grid)
		// do not pretend m is mutation if ref/alt is missing
		td1.text(m.ref && m.alt ? 'Mutation' : 'Position')
		print_snv(td2, m, tk)
	}
	if ('occurrence' in m) {
		const [td1, td2] = get_list_cells(grid)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
	if (tk.skewer.mode == 'numeric') {
		const nm = tk.numericmode
		const [td1, td2] = get_list_cells(grid)
		td1.text(nm.valueName || 'Value')
		td2.text(m.__value_use)
	}
}

function print_mname(div, m) {
	div.append('span').text(m.mname)
	div
		.append('span')
		.style('margin-left', '5px')
		.style('color', mclass[m.class].color)
		.style('font-size', '.8em')
		.text(mclass[m.class].label.toUpperCase())
}

function print_snv(holder, m, tk) {
	let printto = holder
	if (tk.mds.queries && tk.mds.queries.snvindel.url && tk.mds.queries.snvindel.url.key in m) {
		const a = holder.append('a')
		a.attr('href', tk.mds.queries.snvindel.url.base + m[tk.mds.queries.snvindel.url.key])
		a.attr('target', '_blank')
		printto = a
	}
	printto.html(`${m.chr}:${m.pos + 1} ${m.ref && m.alt ? m.ref + '>' + m.alt : ''}`)
}

/* multiple variants, each with occurrence
one row for each variant
click a button from a row to show the sample summary/detail table for that variant
show a summary table across samples of all variants
*/
function table_snvindel_multivariant({ mlst, tk, block, div, disable_variant2samples }, grid) {
	/* flags to indicate if to show these columns in the grid
	column 1: mutation
	column 2: position
	... optional columns
	*/

	const showOccurrence = mlst.find(i => i.occurrence != undefined),
		showNumericmodeValue = tk.skewer.mode == 'numeric'

	grid.style('grid-template-columns', `repeat(${2 + (showOccurrence ? 1 : 0) + (showNumericmodeValue ? 1 : 0)}, auto)`)

	// header
	grid
		.append('div')
		.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		.style('opacity', 0.3)
	grid
		.append('div')
		.text(mlst.find(i => i.ref && i.alt) ? 'Mutation' : 'Position')
		.style('opacity', 0.3)
	if (showOccurrence) {
		grid
			.append('div')
			.style('opacity', 0.3)
			.text('Occurrence')
	}
	if (showNumericmodeValue) {
		grid
			.append('div')
			.style('opacity', 0.3)
			.text(tk.numericmode.valueName || 'Value')
	}

	// one row for each variant

	// temp array to collect subset of mlst[] for showing samples
	let mlst_render = []

	for (const m of mlst) {
		// column 1
		print_mname(grid.append('div'), m)
		// column 2
		print_snv(grid.append('div'), m, tk)

		if (showOccurrence) {
			const cell = grid.append('div')

			if (!disable_variant2samples && tk.mds.variant2samples) {
				cell
					.append('input')
					.property('type', 'checkbox')
					.on('change', async () => {
						if (d3event.target.checked) mlst_render.push(m)
						else {
							mlst_render = mlst_render.filter(mt => mt.ssm_id != m.ssm_id)
						}
						const multisample_div = div.select('.sj_sampletable_holder')
						multisample_div.selectAll('*').remove()
						await init_sampletable({
							mlst: mlst_render.length ? mlst_render : mlst,
							tk,
							block,
							div: multisample_div
						})
					})

				cell
					.append('div')
					.style('display', 'inline-block')
					.style('text-align', 'right')
					.style('margin-left', '5px')
					.attr('class', 'sja_clbtext')
					.text(m.occurrence)
			} else {
				cell.text(m.occurrence)
			}
		}

		if (showNumericmodeValue) {
			grid.append('div').text(m.__value_use)
		}
	}
}

async function table_fusionsv(arg) {
	/*
	table view, with svgraph for first ml
	svgraph(mlst[0])

	if(mlst.length==1) {
		// 2-column table view
	} else {
		// one row per sv, click each row to show its svgraph
	}
	*/
	if (arg.tk.mds.variant2samples) {
		// show sample summary
		await init_sampletable(arg)
	}
}

// function is not used
function add_csqButton(m, tk, td, table) {
	// m:
	// tk:
	// td: the <td> to show current csq label
	// table: 2-col
	if (tk.mds.queries && tk.mds.queries.snvindel.m2csq && m.csqcount > 1) {
		const a = td.append('a')
		a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9660;')
		// click link to query for csq list
		const tr = table.append('tr').style('display', 'none')
		const td2 = tr.append('td').attr('colspan', 2) // to show result of additional csq
		let first = true
		a.on('click', async () => {
			if (tr.style('display') == 'none') {
				tr.style('display', 'table-row')
				a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9650;')
			} else {
				tr.style('display', 'none')
				a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9660;')
			}
			if (!first) return
			first = false
			const wait = td2.append('div').text('Loading...')
			try {
				const data = await tk.mds.queries.snvindel.m2csq.get(m)
				if (data.error) throw data.error
				wait.remove()
				const table = td2.append('table').style('margin-bottom', '10px')
				const tr = table
					.append('tr')
					.style('font-size', '.7em')
					.style('opacity', 0.5)
				tr.append('td').text('AA change')
				tr.append('td').text('Isoform')
				tr.append('td').text('Consequence')
				for (const d of data.csq) {
					const tr = table.append('tr')
					tr.append('td').text(d.aa_change)
					tr.append('td').text(d.transcript_id)
					tr.append('td').text(d.consequence_type)
				}
			} catch (e) {
				wait.text(e.message || e)
			}
		})
	} else {
		// no showing additional csq
		print_mname(td, m)
	}
}
