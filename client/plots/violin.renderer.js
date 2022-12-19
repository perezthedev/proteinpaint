import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { area, curveBumpX, curveBumpY } from 'd3-shape'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { brushX, brushY } from 'd3'
import { renderTable } from '#dom/table'
import { filterJoin, getFilterItemByTag } from '../filter/filter'
import { drag as d3drag } from 'd3-drag'

export default function violinRenderer(self) {
	const k2c = scaleOrdinal(schemeCategory10)

	self.render = function() {
		if (self.data.plots.length === 0) {
			self.dom.holder.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			self.dom.tableHolder.selectAll('*').remove()
			return
		} else self.dom.holder.select('*').remove()

		// append the svg object to the body of the page
		self.dom.holder.select('.sjpp-violin-plot').remove()

		const violinDiv = self.dom.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const svg = violinDiv.append('svg')

		// test render all labels to get max label width
		let maxLabelSize = 0
		for (const p of self.data.plots) {
			const l = svg.append('text').text(p.label)
			maxLabelSize = Math.max(maxLabelSize, l.node().getBBox().width)
			l.remove()
		}

		const isH = self.config.settings.violin.orientation == 'horizontal'
		const axisHeight = 80

		// Render the violin plot
		let margin
		if (isH) {
			margin = { left: maxLabelSize + 5, top: axisHeight, right: 50, bottom: 10 }
		} else {
			margin = { left: axisHeight, top: 50, right: 50, bottom: maxLabelSize }
		}

		const plotLength = 500, // span length of a plot, not including margin
			// thickness of a plot
			plotThickness =
				self.data.plots.length < 2
					? 150
					: self.data.plots.length >= 2 && self.data.plots.length < 5
					? 120
					: self.data.plots.length >= 5 && self.data.plots.length < 8
					? 90
					: self.data.plots.length >= 8 && self.data.plots.length < 11
					? 75
					: 60

		svg
			.attr(
				'width',
				margin.left +
					margin.top +
					(isH ? plotLength : plotThickness * self.data.plots.length + self.config.term.term.name.length)
			)
			.attr(
				'height',
				margin.bottom +
					margin.top +
					(isH ? plotThickness * self.data.plots.length : plotLength + self.config.term.term.name.length)
			)
			.classed('sjpp-violin-plot', true)

		// a <g> in which everything is rendered into
		const svgG = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		// creates numeric axis
		const axisScale = scaleLinear()
			.domain([self.data.min, self.data.max + self.data.max / 20])
			.range(isH ? [0, plotLength] : [plotLength, 0])

		{
			// <g>: holder of numeric axis
			const g = svgG.append('g')
			g.call((isH ? axisTop : axisLeft)().scale(axisScale))

			let lab

			// TODO need to add term2 label onto the svg
			if (self.config.term2?.q?.mode == 'continuous') lab = svgG.append('text').text(self.config.term2.term.name)
			else lab = svgG.append('text').text(self.config.term.term.name)

			if (isH) {
				lab
					.attr('x', plotLength / 2)
					.attr('y', -30)
					.attr('text-anchor', 'middle')
			} else {
				lab
					.attr('y', 0 - margin.top - 5)
					.attr('x', -plotLength / 2)
					.attr('text-anchor', 'middle')
					.attr('transform', 'rotate(-90)')
			}
		}

		for (const [plotIdx, plot] of self.data.plots.entries()) {
			// <g> of one plot
			// adding .5 to plotIdx allows to anchor each plot <g> to the middle point

			const violinG = svgG
				.append('g')
				.datum(plot)
				.attr(
					'transform',
					isH
						? 'translate(0,' + plotThickness * (plotIdx + 0.5) + ')'
						: 'translate(' + plotThickness * (plotIdx + 0.5) + ',0)'
				)
				.attr('class', 'sjpp-violinG')

			// create label
			const label = violinG
				.append('text')
				.text(plot.label)
				.style('cursor', self.config.term2 ? 'pointer' : 'default')
				.on('click', function(event) {
					if (!event) return
					self.displayLabelClickMenu(plot, event)
				})

			if (isH) {
				label
					.attr('x', -5)
					.attr('y', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
			} else {
				label
					.attr('x', 0 - plotLength - 5)
					.attr('y', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.attr('transform', 'rotate(-90)')
			}

			// times 0.45 will leave out 10% as spacing between plots
			const wScale = scaleLinear()
				.domain([-plot.biggestBin, plot.biggestBin])
				.range([-plotThickness * 0.45, plotThickness * 0.45])

			let areaBuilder
			if (isH) {
				areaBuilder = area()
					.y0(d => wScale(-d.binValueCount))
					.y1(d => wScale(d.binValueCount))
					.x(d => axisScale(d.x0))
					.curve(curveBumpX)
			} else {
				areaBuilder = area()
					.x0(d => wScale(-d.binValueCount))
					.x1(d => wScale(d.binValueCount))
					.y(d => axisScale(d.x0))
					.curve(curveBumpY)
			}

			violinG
				.append('path')
				.attr('class', 'sjpp-vp-path')
				.style('fill', plot.color ? plot.color : k2c(plotIdx))
				.style('opacity', '0.8')
				.attr('d', areaBuilder(plot.plotValueCount > 3 ? plot.bins : 0)) //do not build violin plots for values 3 or less than 3.

			violinG
				.append('image')
				.attr('xlink:href', plot.src)
				.attr('transform', isH ? 'translate(0, -10)' : 'translate(-10, 0)')

			//render median values on plots
			if (plot.plotValueCount >= 2) {
				violinG
					.append('line')
					.attr('class', 'sjpp-median-line')
					.style('stroke-width', '3')
					.style('stroke', 'red')
					.style('opacity', '1')
					.attr('y1', isH ? -7 : axisScale(plot.median))
					.attr('y2', isH ? 7 : axisScale(plot.median))
					.attr('x1', isH ? axisScale(plot.median) : -7)
					.attr('x2', isH ? axisScale(plot.median) : 7)
			} else return

			violinG
				.append('g')
				.classed('sjpp-brush', true)
				.call(
					isH
						? brushX()
								.extent([[0, -20], [plotLength, 20]])
								.on('end', async event => {
									const selection = event.selection
									// console.log(209,axisScale.invert(selection[0]));
									// console.log(210,axisScale.invert(selection[1]));

									if (!selection) return

									// self.displayBrushMenu(plot, selection)
								})
						: brushY()
								.extent([[-20, 0], [20, plotLength]])
								.on('end', async event => {
									const selection = event.selection

									if (!selection) return

									// self.displayBrushMenu(plot, selection)
								})
				)
		}
	}

	self.displayLabelClickMenu = function(plot, event) {
		self.app.tip.d.selectAll('*').remove()

		const options = []

		if (self.config.term2) {
			if (self.config.term.term.type === 'categorical') {
				options.push({
					label: `Add filter: ${plot.label.split(',')[0]}`,
					callback: self.getAddFilterCallback(plot, 'term1')
				})
			} else {
				options.push({
					label: `Add filter: ${plot.label.split(',')[0]}`,
					callback: self.getAddFilterCallback(plot, 'term2')
				})
			}
			self.app.tip.d
				.append('div')
				.selectAll('div')
				.data(options)
				.enter()
				.append('div')
				.attr('class', 'sja_menuoption')
				.html(d => d.label)
				.on('click', (event, d) => {
					self.app.tip.hide()
					d.callback()
					self.dom.tableHolder.style('display', 'none')
				})

			//show median values as text under menu options
			self.app.tip.d
				.append('div')
				.text(`Median Value: ${plot.median}`)
				.style('padding-left', '10px')
				.style('font-size', '15px')

			self.app.tip.show(event.clientX, event.clientY)
		} else if (plot.divideTwBins != null) {
			self.app.tip.style('display', 'none')
		}
	}

	// self.displayBrushMenu = function(plot, selection) {
	// 	self.app.tip.d.selectAll('*').remove()

	// 	const options = [
	// 		{
	// 			label: 'Add filter: term only',
	// 			callback: self.getAddFilterCallback(plot, selection, 'term1')
	// 		}
	// 	]

	// 	if (self.config.term2) {
	// 		options.push(
	// 			{
	// 				label: 'Add filter: overlay only',
	// 				callback: self.getAddFilterCallback(plot, selection, 'term2')
	// 			},
	// 			{
	// 				label: 'Add filter: both term and overlay',
	// 				callback: self.getAddFilterCallback(plot, selection)
	// 			}
	// 		)
	// 	}

	// 	self.app.tip.d
	// 		.append('div')
	// 		.selectAll('div')
	// 		.data(options)
	// 		.enter()
	// 		.append('div')
	// 		.attr('class', 'sja_menuoption')
	// 		.html(d => d.label)
	// 		.on('click', (event, d) => {
	// 			self.app.tip.hide()
	// 			d.callback()
	// 		})
	// 	self.app.tip.show(event.clientX, event.clientY) //self.dom.holder.select('.sjpp-brush'))
	// }

	self.getAddFilterCallback = (plot, term = '') => {
		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		if (!term || term === 'term1') {
			tvslst.lst.push({
				type: 'tvs',
				tvs: {
					term: self.config.term.term
				}
			})

			tvslst.lst[0].tvs.values = [
				{
					key: plot.seriesId
				}
			]
		}

		if ((!term || term == 'term2') && self.config.term2) {
			const t2 = self.config.term2
			tvslst.lst.push({
				type: 'tvs',
				tvs: {
					term: t2.term
				}
			})
			const item = tvslst.lst[1] || tvslst.lst[0]
			if (
				t2.q?.mode === 'continuous' ||
				((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.divideTwBins != null)
			) {
				item.tvs.ranges = [
					{
						start: structuredClone(plot.divideTwBins?.start) || null,
						stop: structuredClone(plot.divideTwBins?.stop) || null,
						startinclusive: structuredClone(plot.divideTwBins?.startinclusive) || null,
						stopinclusive: structuredClone(plot.divideTwBins?.stopinclusive) || null,
						startunbounded: structuredClone(plot.divideTwBins?.startunbounded)
							? structuredClone(plot.divideTwBins?.startunbounded)
							: null,
						stopunbounded: structuredClone(plot.divideTwBins?.stopunbounded)
							? structuredClone(plot.divideTwBins?.stopunbounded)
							: null
					}
				]
			} else {
				item.tvs.values = [
					{
						key: plot.seriesId
					}
				]
			}
		}

		return () => {
			const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
			const filter = filterJoin([filterUiRoot, tvslst])
			filter.tag = 'filterUiRoot'
			self.app.dispatch({
				type: 'filter_replace',
				filter
			})
		}
	}

	self.renderBrushValues = function() {
		const range = self.config.settings.violin.brushRange
		if (!range) return //also delete the table
	}

	self.renderPvalueTable = function() {
		this.dom.tableHolder
			.style('vertical-align', 'top')
			.selectAll('*')
			.remove()

		const t2 = this.config.term2

		if (t2 == undefined || t2 == null) {
			// no term2, no table to show
			this.dom.tableHolder.style('display', 'none')
			return
		}

		this.dom.tableHolder
			.append('div')
			.attr('class', 'sjpp-pvalue-title')
			.style('font-weight', 'bold')
			.text("Group comparisons (Wilcoxon's rank sum test)")

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = this.data.pvalues

		renderTable({ columns, rows, div: this.dom.tableHolder, showLines: false, maxWidth: '25vw', maxHeight: '20vh' })
	}
}
