import { select } from 'd3-selection'

export default function svgLegend(opts) {
	let currlinex = 0
	let currliney = 0
	let currG

	const defaultSettings = {
		ontop: false,
		lineh: 25,
		padx: 5,
		padleft: 0, //150,
		padright: 20,
		padbtm: 30,
		fontsize: 12,
		iconh: 10,
		iconw: 10,
		hangleft: 1,
		linesep: false,
		mutationorder: [
			'M',
			'E',
			'F',
			'N',
			'S',
			'D',
			'I',
			'P',
			'L',
			'Intron',
			'ITD',
			'DEL',
			'NLOSS',
			'CLOSS',
			'Utr3',
			'Utr5',
			'X',
			'noncoding',
			'Fuserna',
			'SV',
			'CNV_amp',
			'CNV_loss',
			'snv',
			'mnv'
		],
		itemOpacity: 1
	}

	const settings = Object.assign(defaultSettings, opts.settings || {})

	function render(data, overrides = {}) {
		Object.assign(settings, overrides.settings || {})
		currlinex = settings.padleft
		currliney = 0

		opts.holder.selectAll('g').remove()
		const d = settings.dimensions
		if (!opts.holder.attr('transform')) {
			// d.yOffset should be used instead of settings.svgh ???
			opts.holder.attr('transform', settings.ontop ? null : `translate(${d.xOffset},${settings.svgh})`)
		}

		const l = opts.holder.selectAll('g').data(data)

		l.exit().remove()
		l.enter()
			.append('g')
			.each(addGroup)

		return currliney + settings.lineh + settings.padbtm
	}

	function addGroup(d, i) {
		if (!d.items || !d.items.length) return
		currlinex = 0
		currliney += settings.lineh

		let g = select(this)
		const leftdist = settings.hangleft ? settings.padleft + settings.hangleft - settings.padx : settings.padleft

		const grplabel = g
			.append('text')
			.attr('transform', 'translate(' + leftdist + ',' + (currliney + settings.iconh / 2) + ')')
			.attr('text-anchor', settings.hangleft ? 'end' : 'start')
			.attr('font-weight', 700)
			.attr('font-size', settings.fontsize)
			.attr('dominant-baseline', 'central')
			.text(d.name)

		if (settings.linesep) {
			currlinex = settings.padleft
			currliney += settings.lineh
		} else if (settings.hangleft) {
			currlinex = leftdist + 2 * settings.padx
		} else {
			currlinex += settings.padleft + grplabel.node().getBBox().width + 2 * settings.padx
		}

		if (d.sorter) d.items.sort(d.sorter)

		if (d.d && d.d.renderAs == 'colorScale') {
			setColorBarLegend(g, d, i)
		} else {
			g.selectAll('g')
				.data(d.items)
				.enter()
				.append('g')
				//.attr('transform', 'translate(0,'+i*20+')')
				.each(addItem)
		}

		const bbox = grplabel.node().getBBox()
		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			grplabel.attr('y', bbox.height / 4)
		}
	}

	function addItem(d, i) {
		let g = select(this)
			.attr('transform', 'translate(' + currlinex + ',' + currliney + ')')
			.style('opacity', settings.itemOpacity)

		const itemlabel = g
			.append('text')
			.attr('transform', 'translate(' + (settings.iconw + settings.padx / 2) + ',' + settings.iconh / 2 + ')')
			.attr('font-size', settings.fontsize)
			.attr('dominant-baseline', 'central')
			.style('cursor', 'default')
			.style(
				'text-decoration',
				settings.exclude && settings.exclude.classes && settings.exclude.classes.includes(d.class) ? 'line-through' : ''
			)

		itemlabel.each(function(d) {
			const t = select(this)
			if (typeof d.text == 'string') {
				t.text(d.text)
			} else if (Array.isArray(d.text)) {
				t.selectAll('tspan')
					.data(d.text)
					.enter()
					.append('tspan')
					.text(d => d)
					.attr('dominant-baseline', 'central')
					.attr('x', function(dd, i) {
						if (i == 0) {
							select(this).attr('font-weight', 700)
							d.lastx =
								select(this)
									.node()
									.getComputedTextLength() + 10
							return 0
						} else if (d.lastx) {
							return d.lastx
						}
					})
			}
		})

		const bbox = itemlabel.node().getBBox()
		currlinex += settings.iconw + bbox.width + 2.5 * settings.padx
		if (settings.linesep || currlinex > settings.svgw - settings.padright) {
			currliney += settings.lineh
			const leftdist = !settings.hangleft ? settings.padleft : settings.padleft + settings.hangleft + settings.padx

			g.attr('transform', 'translate(' + leftdist + ',' + currliney + ')')
			currlinex = settings.iconw + bbox.width + 2.5 * settings.padx + settings.padleft
			if (settings.hangleft) currlinex = settings.iconw + bbox.width + 2.5 * settings.padx + leftdist
			else currlinex = settings.iconw + bbox.width + 2.5 * settings.padx + settings.padleft
		}

		const rect = g
			.append('rect')
			.attr('height', settings.iconh)
			.attr('width', settings.iconw)
			.attr('y', settings.fontsize - bbox.height + (bbox.height - settings.iconh) / 2)
			.attr('fill', opts.rectFillFxn)
			.attr('stroke', opts.iconStroke)
			.attr('shape-rendering', 'crispEdges')

		if (Math.abs(bbox.y + bbox.height / 2) > 1) {
			// dominant-baseline is not supported, manually position
			itemlabel.attr('y', bbox.height / 4)
		}
	}

	return render
}
