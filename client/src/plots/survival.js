import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'
import { select, event } from 'd3-selection'
import { scaleLinear, scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { rgb } from 'd3-color'
import htmlLegend from '../html.legend'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '../client'
import { fillTermWrapper } from '../common/termsetting'

class TdbSurvival {
	constructor(opts) {
		this.type = 'survival'
	}

	async init() {
		const opts = this.opts
		const controls = this.opts.controls ? null : opts.holder.append('div')
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		this.dom = {
			header: opts.header,
			controls,
			holder,
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		if (this.dom.header) this.dom.header.html('Survival Plot')
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({}, opts.settings)
		this.pj = getPj(this)
		this.lineFxn = line()
			.curve(curveStepAfter)
			.x(c => c.scaledX)
			.y(c => c.scaledY)
		setInteractivity(this)
		setRenderers(this)
		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: {
				legend: {
					click: this.legendClick
				}
			}
		})
		await this.setControls()
	}

	async setControls() {
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.boxplot', this.download)
		} else {
			this.dom.holder
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')

			this.components = {
				controls: await controlsInit({
					app: this.app,
					id: this.id,
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')
				})
			}

			this.components.controls.on('downloadClick.boxplot', this.download)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			isVisible: config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival'),
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: JSON.parse(JSON.stringify(config.term)),
				term0: config.term0 ? JSON.parse(JSON.stringify(config.term0)) : null,
				term2: config.term2 ? JSON.parse(JSON.stringify(config.term2)) : null,
				settings: config.settings.survival
			},
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		try {
			if (!this.state.isVisible) {
				this.dom.holder.style('display', 'none')
				return
			}

			if (this.dom.header) this.dom.header.html(this.state.config.term.term.name + ` plot`)

			Object.assign(this.settings, this.state.config.settings)
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			this.serverData = data
			this.app.vocabApi.syncTermData(this.state.config, data)
			this.currData = this.processData(data)
			this.refs = data.refs
			this.pj.refresh({ data: this.currData })
			this.setTerm2Color(this.pj.tree.charts)
			this.symbol = this.getSymbol(7) // hardcode the symbol size for now
			this.render()
			if (!this.settings.atRiskInterval) this.legendRenderer(this.legendData)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.state.config
		const opts = {
			chartType: 'survival',
			term: c.term,
			filter: this.state.termfilter.filter
		}
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0

		const survTermIndex = c.term.term.type == 'survival' ? '' : 2
		c[`term${survTermIndex}`].q = {
			type: 'survival',
			timeFactor: this.settings.timeFactor,
			atRiskInterval: this.settings.atRiskInterval
		}

		if (this.state.ssid) opts.ssid = this.state.ssid
		return opts
	}

	processData(data) {
		this.uniqueSeriesIds = new Set()
		const rows = []
		const estKeys = ['survival', 'lower', 'upper']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? Number(d[i]) : d[i]
			})
			rows.push(obj)
			this.uniqueSeriesIds.add(obj.seriesId)
		}
		return rows
	}

	setTerm2Color(charts) {
		if (!charts) return
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				this.term2toColor[series.seriesId] = rgb(this.colorScale(series.seriesId))
				if (!legendItems.find(d => d.seriesId == series.seriesId)) {
					legendItems.push({
						seriesId: series.seriesId,
						text: series.seriesLabel,
						color: this.term2toColor[series.seriesId],
						isHidden: this.settings.hidden.includes(series.seriesId)
					})
				}
			}
		}
		if (this.refs.orderedKeys) {
			const s = this.refs.orderedKeys.series
			legendItems.sort((a, b) => s.indexOf(a.seriesId) - s.indexOf(b.seriesId))
		}
		const config = this.state.config
		if ((!config.term.term.type == 'survival' || config.term2) && legendItems.length) {
			const termNum = config.term.term.type == 'survival' ? 'term2' : 'term'
			this.legendData = [
				{
					name: config[termNum].term.name,
					items: legendItems
				}
			]
		} else {
			this.legendData = []
		}
	}
}

export const survivalInit = getCompInit(TdbSurvival)
// this alias will allow abstracted dynamic imports
export const componentInit = survivalInit

function setRenderers(self) {
	self.render = function() {
		const data = self.pj.tree.charts || [{ chartId: 'No survival data' }]
		const chartDivs = self.dom.chartsDiv.selectAll('.pp-survival-chart').data(data, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.holder.style('display', 'inline-block')
		self.dom.chartsDiv.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function(d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-survival-chart')
			.style('opacity', d.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			//.style("position", "absolute")
			.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
		//.style('border', '1px solid #eee')
		//.style('box-shadow', '0px 0px 1px 0px #ccc')

		div
			.append('div')
			.attr('class', 'sjpp-survival-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(d.chartId)
			.html(d.chartId)

		if (d.serieses) {
			const svg = div.append('svg').attr('class', 'pp-survival-svg')
			renderSVG(svg, d, s, 0)

			div
				.transition()
				.duration(s.duration)
				.style('opacity', 1)
		}
	}

	self.updateCharts = function(d) {
		if (!d.serieses) return
		const s = self.settings
		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			.style('width', s.svgw + 50 + 'px')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.select('.sjpp-survival-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(d.chartId)
			.html(d.chartId)

		div.selectAll('.sjpp-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpp-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), d, s, s.duration)
	}

	function renderSVG(svg, chart, s, duration) {
		const visibleSerieses = chart.serieses.filter(s => !self.settings.hidden.includes(s.seriesId))
		const atRiskTrend = self.serverData.atRiskByChart
			? self.serverData.atRiskByChart[chart.rawChartId]
			: { bySeries: {}, timepoints: [] }
		const extraHeight = Object.keys(atRiskTrend.bySeries).length * 20

		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw)
			.attr('height', s.svgh + extraHeight)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG] = getSvgSubElems(svg)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);

		mainG.attr('transform', 'translate(' + s.svgPadding.left + ',' + s.svgPadding.top + ')')

		const serieses = mainG
			.selectAll('.sjpp-survival-series')
			.data(visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function(series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpp-survival-series')
			.each(function(series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})

		// add at risk data
		if (s.xTickInterval) {
			chart.xTickValues = atRiskTrend.timepoints.filter(t => t % s.xTickInterval === 0)
		}

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
		renderAtRiskG(atRiskG, atRiskTrend, s, chart)
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG
		if (!svg.select('.sjpp-survival-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpp-survival-mainG')
			axisG = mainG.append('g').attr('class', 'sjpp-survival-axis')
			xAxis = axisG.append('g').attr('class', 'sjpp-survival-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpp-survival-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpp-survival-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpp-survival-y-title')
			atRiskG = mainG.append('g').attr('class', 'sjpp-survival-atrisk')
		} else {
			mainG = svg.select('.sjpp-survival-mainG')
			axisG = mainG.select('.sjpp-survival-axis')
			xAxis = axisG.select('.sjpp-survival-x-axis')
			yAxis = axisG.select('.sjpp-survival-y-axis')
			xTitle = axisG.select('.sjpp-survival-x-title')
			yTitle = axisG.select('.sjpp-survival-y-title')
			atRiskG = mainG.select('.sjpp-survival-atrisk')
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		// todo: allow update of exiting path instead of replacing
		g.selectAll('path').remove()
		g.append('path')
			.attr(
				'd',
				area()
					.curve(curveStepAfter)
					.x(c => c.scaledX)
					.y0(c => c.scaledY[1])
					.y1(c => c.scaledY[2])(series.data)
			)
			.style('display', s.ciVisible ? '' : 'none')
			.style('fill', self.term2toColor[series.seriesId].toString())
			.style('opacity', '0.15')
			.style('stroke', 'none')

		renderSubseries(
			s,
			g,
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.y,
					scaledX: d.scaledX,
					scaledY: d.scaledY[0],
					seriesName: 'survival',
					seriesLabel: series.seriesLabel,
					censored: d.censored
				}
			})
		)

		renderSubseries(
			s,
			g.append('g'),
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.lower,
					scaledX: d.scaledX,
					scaledY: d.scaledY[1],
					seriesName: 'lower',
					seriesLabel: series.seriesLabel
				}
			})
		)

		renderSubseries(
			s,
			g.append('g'),
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.upper,
					scaledX: d.scaledX,
					scaledY: d.scaledY[2],
					seriesName: 'upper',
					seriesLabel: series.seriesLabel
				}
			})
		)
	}

	function renderSubseries(s, g, data) {
		// todo: allow update of exiting g's instead of replacing
		g.selectAll('g').remove()
		const lastDataIndex = data.length - 1
		const lineData = data.filter((d, i) => !d.censored || i == lastDataIndex)
		const censoredData = data.filter(d => d.censored)
		const subg = g.append('g')
		const circles = subg.selectAll('circle').data(lineData, b => b.x)
		circles.exit().remove()

		// for mouseover only
		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX[0])
			.attr('cy', c => c.scaledY)
			.style('opacity', 0)
			.style('fill', s.fill)
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', s.stroke)

		const seriesName = data[0].seriesName
		const color = self.term2toColor[data[0].seriesId]
		if (seriesName == 'survival') {
			g.append('path')
				.attr('d', self.lineFxn(lineData))
				.style('fill', 'none')
				.style('stroke', color.darker())
				.style('opacity', 1)
				.style('stroke-opacity', 1)
		}

		const subg1 = g.append('g').attr('class', 'sjpp-survival-censored')
		const censored = subg1.selectAll('.sjpp-survival-censored-x').data(censoredData, d => d.x)
		censored.exit().remove()

		censored
			.attr('transform', c => `translate(${c.scaledX},${c.scaledY})`)
			.style('stroke', color.darker())
			.style('display', '')

		censored
			.enter()
			.append('path')
			.attr('class', 'sjpp-survival-censored-x')
			.attr('transform', c => `translate(${c.scaledX},${c.scaledY})`)
			.attr('d', self.symbol)
			.style('fill', 'transparent') //data.fill ? data.fill : colors[i])
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', color.darker()) //data.fill ? data.fill : colors[i])
			.style('display', '')
		//.transition()
		//.duration(1000)
		//.style('opacity', 1)
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart) {
		xAxis
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom) + ')')
			.call(
				chart.xTickValues ? axisBottom(chart.xScale).tickValues(chart.xTickValues) : axisBottom(chart.xScale).ticks(5)
			)

		yAxis.call(
			axisLeft(
				scaleLinear()
					.domain(chart.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
		const xUnit = s.timeUnit ? s.timeUnit : self.state.config[termNum].term.unit
		const xTitleLabel = `Time to Event (${xUnit})`
		const xText = xTitle
			.attr(
				'transform',
				'translate(' +
					(s.svgw - s.svgPadding.left - s.svgPadding.right) / 2 +
					',' +
					(s.svgh - s.axisTitleFontSize) +
					')'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(xTitleLabel)

		const yTitleLabel = 'Probability of Survival'
		yTitle.select('text, title').remove()
		const yText = yTitle
			.attr(
				'transform',
				'translate(' +
					(-s.svgPadding.left / 2 - s.axisTitleFontSize) +
					',' +
					(s.svgh - s.svgPadding.top - s.svgPadding.bottom) / 2 +
					')rotate(-90)'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(yTitleLabel)
	}

	function renderAtRiskG(g, trend, s, chart) {
		const { bySeries, timepoints } = trend
		const y = s.svgh - s.svgPadding.top - s.svgPadding.bottom + 60 // make y-offset option???
		// fully rerender, later may reuse previously rendered elements
		g.selectAll('*').remove()

		const sg = g
			.attr('transform', `translate(0,${y})`)
			.selectAll(':scope > g')
			.data(Object.keys(bySeries).sort(), seriesId => seriesId)

		sg.enter()
			.append('g')
			.each(function(seriesId, i) {
				const series = bySeries[seriesId]
				const reversed = series.slice().reverse()
				const y = (i + 1) * 20
				const g = select(this)
					.attr('transform', `translate(0,${y})`)
					.attr('fill', self.term2toColor[seriesId])

				const fontsize = `${s.axisTitleFontSize - 2}px`

				if (seriesId && seriesId != '*') {
					g.append('text')
						.attr('transform', `translate(${s.atRiskLabelOffset}, 0)`)
						.attr('text-anchor', 'end')
						.attr('font-size', fontsize)
						.text(seriesId)
				}

				const data = chart.xTickValues.map(tickVal => {
					if (tickVal === 0) return { tickVal, atRisk: series[0][1] }
					const d = reversed.find(d => d[0] < tickVal)
					return { tickVal, atRisk: d[1] }
				})
				const text = g
					.append('g')
					.selectAll('text')
					.data(data)
				text.exit().remove()
				text
					.enter()
					.append('text')
					.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
					.attr('text-anchor', 'middle')
					.attr('font-size', fontsize)
					.text(d => d.atRisk)
			})
	}

	self.getSymbol = function(size) {
		const s = size,
			h = s / 2

		switch (self.settings.symbol) {
			case 'x':
				return `M -${h},-${h} l ${s},${s} M ${h},-${h} l -${s},${s}`

			case 'vtick':
				return `M 0,-${h} L 0,${h}`

			default:
				throw `Unrecognized survival plot symbol='${self.settings.symbol}'`
		}
	}
}

function setInteractivity(self) {
	const labels = {
		survival: 'Survival',
		lower: 'Lower 95% CI',
		upper: 'Upper 95% CI'
	}

	self.mouseover = function() {
		const d = event.target.__data__
		if (event.target.tagName == 'circle') {
			const label = labels[d.seriesName]
			const x = d.x.toFixed(1)
			const y = d.y.toPrecision(2)
			const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
			const xUnit = self.state.config[termNum].term.unit
			const rows = [
				`<tr><td colspan=2 style='text-align: center'>${
					d.seriesLabel ? d.seriesLabel : self.state.config.term.term.name
				}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>Time to event:</td><td style='padding:3px; text-align:center'>${x} ${xUnit}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>${label}:</td><td style='padding:3px; text-align:center'>${y}%</td></tr>`
			]
			// may also indicate the confidence interval (lower%-upper%) in a new row
			self.app.tip
				.show(event.clientX, event.clientY)
				.d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		} else if (event.target.tagName == 'path' && d && d.seriesId) {
			self.app.tip.show(event.clientX, event.clientY).d.html(d.seriesLabel ? d.seriesLabel : d.seriesId)
		} else {
			self.app.tip.hide()
		}
	}

	self.mouseout = function() {
		self.app.tip.hide()
	}

	self.legendClick = function() {
		event.stopPropagation()
		const d = event.target.__data__
		if (d === undefined) return
		const hidden = self.settings.hidden.slice()
		const i = hidden.indexOf(d.seriesId)
		if (i == -1) hidden.push(d.seriesId)
		else hidden.splice(i, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					survival: {
						hidden
					}
				}
			}
		})
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'survival getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [barchart getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			currViews: ['survival'],
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			survival: {
				radius: 5,
				ciVisible: false,
				fill: '#fff',
				stroke: '#000',
				symbol: 'x', // 'x', 'vtick'
				fillOpacity: 0,
				chartMargin: 10,
				svgw: 400,
				svgh: 300,
				timeFactor: 1,
				atRiskInterval: 0,
				atRiskLabelOffset: -20,
				xTickValues: 0,
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				hidden: []
			},
			/* LEGACY SUPPORT 
				 DELETE once all chart code is removed from the termdb app
			*/
			barchart: {},
			cuminc: {}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

function getPj(self) {
	const pj = new Partjson({
		template: {
			yMin: '>=yMin()',
			yMax: '<=yMax()',
			charts: [
				{
					chartId: '@key',
					rawChartId: '$chartId',
					xMin: '>$time',
					xMax: '<$time',
					'__:xScale': '=xScale()',
					'__:yScale': '=yScale()',
					yMin: '>=yMin()',
					yMax: '<=yMax()',
					serieses: [
						{
							chartId: '@parent.@parent.@key',
							seriesId: '@key',
							'__:seriesLabel': '=seriesLabel()',
							data: [
								{
									'__:seriesId': '@parent.@parent.seriesId',
									//color: "$color",
									x: '$time',
									y: '$survival',
									censored: '$censored',
									lower: '$lower',
									upper: '$upper',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'=timeCensored()'
							]
						},
						'$seriesId'
					],
					'@done()': '=padAndSortSerieses()'
				},
				'=chartTitle()'
			],
			'@done()': '=sortCharts()'
		},
		'=': {
			chartTitle(row) {
				const s = self.settings
				if (!row.chartId || row.chartId == '-') {
					const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
					return self.state.config[termNum].term.name
				}
				const t0 = self.state.config.term0
				if (!t0 || !t0.term.values) return row.chartId
				if (t0.q && t0.q.groupsetting && t0.q.groupsetting.inuse) {
					return row.chartId
				}
				const value = self.state.config.term0.term.values[row.chartId]
				return value && value.label ? value.label : row.chartId
			},
			seriesLabel(row, context) {
				const t2 = self.state.config.term2
				if (!t2) return
				const seriesId = context.self.seriesId
				if (t2 && t2.q && t2.q.groupsetting && t2.q.groupsetting.inuse) return seriesId
				if (t2 && t2.term.values && seriesId in t2.term.values) return t2.term.values[seriesId].label
				return seriesId
			},
			timeCensored(row) {
				return row.time + '-' + row.censored
			},
			y(row, context) {
				const seriesId = context.context.parent.seriesId
				return seriesId == 'CI' ? [row.lower, row.upper] : row[seriesId]
			},
			yMin(row) {
				return row.lower
			},
			yMax(row) {
				return row.upper
			},
			xScale(row, context) {
				const s = self.settings
				const xMin = s.method == 2 ? 0 : context.self.xMin
				return (
					scaleLinear()
						// force x to start at 0, padAndSortSerieses() prepends this data point
						.domain([0, context.self.xMax])
						.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
				)
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				const yScale = context.context.context.context.parent.yScale
				const s = context.self
				return [yScale(s.y), yScale(s.lower), yScale(s.upper)]
			},
			yScale(row, context) {
				const s = self.settings
				const yMax = s.scale == 'byChart' ? context.self.yMax : context.root.yMax
				const domain = [1.05, 0]
				return scaleLinear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			},
			padAndSortSerieses(result) {
				const s = self.settings
				for (const series of result.serieses) {
					// prepend a starting prob=1 data point that survfit() does not include
					const d0 = series.data[0]
					series.data.unshift({
						seriesId: d0.seriesId,
						x: 0,
						y: 1,
						censored: 0,
						lower: 1,
						upper: 1,
						scaledX: 0, //result.xScale(0),
						scaledY: [result.yScale(1), result.yScale(1), result.yScale(1)]
					})
				}
				if (self.refs.orderedKeys) {
					const s = self.refs.orderedKeys.series
					result.serieses.sort((a, b) => s.indexOf(a.seriesId) - s.indexOf(b.seriesId))
				}
				if (self.refs.bins) {
					const labelOrder = self.refs.bins.map(b => b.label)
					result.serieses.sort((a, b) => labelOrder.indexOf(a.seriesId) - labelOrder.indexOf(b.seriesId))
				}
			},
			sortCharts(result) {
				if (!self.refs.orderedKeys) return
				const c = self.refs.orderedKeys.chart
				result.charts.sort((a, b) => c.indexOf(a.chartId) - c.indexOf(b.chartId))
			}
		}
	})

	return pj
}
