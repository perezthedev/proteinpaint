import * as rx from '../common/rx.core'
import { getNormalRoot } from '../common/filter'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, curveStepAfter } from 'd3-shape'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '../client'

class TdbCumInc {
	constructor(app, opts) {
		this.type = 'cuminc'
		this.id = opts.id
		this.app = app
		this.api = rx.getComponentApi(this)
		this.dom = {
			div: opts.holder.style('margin', '10px')
		}
		// hardcode for now, but may be set as option later
		this.settings = {
			radius: 3,
			fill: '#fff',
			stroke: '#000',
			fillOpacity: 0,
			svgw: 400,
			svgh: 300,
			svgPadding: {
				top: 10,
				left: 30,
				right: 10,
				bottom: 30
			},
			axisTitleFontSize: 16
		}
		this.pj = getPj(this)
		this.lineFxn = line()
			.curve(curveStepAfter)
			.x(c => c.scaledX)
			.y(c => c.scaledY)
		setInteractivity(this)
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		if (!(this.id in appState.tree.cuminc)) {
			throw `No cumulative incidence with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const config = appState.tree.cuminc[this.id]
		return {
			isVisible: appState.tree.visibleCumIncIds.includes(this.id),
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter
		}
	}

	async main(data) {
		if (!this.state.isVisible) {
			this.dom.div.style('display', 'none')
			return
		}
		console.log(59, 'main() update')
		this.pj.refresh({ data: await this.getData() })
		this.render()
	}

	async getData() {
		console.log(this.state.termfilter)
		try {
			const grade = 3 // HARDCODED, TODO: create a user input
			const data = await dofetch3(
				'incidence?' +
					'genome=' +
					this.state.genome +
					'&dslabel=' +
					this.state.dslabel +
					'&grade=' +
					grade +
					'&term_id=' +
					this.id +
					'&filter=' +
					encodeURIComponent(JSON.stringify(getNormalRoot(this.state.termfilter.filter)))
			)
			const rows = []
			for (const d of data.case) {
				const obj = { seriesKeys: ['cuminc', 'low', 'high'] }
				data.keys.forEach((k, i) => {
					obj[k] = +d[i]
				})
				rows.push(obj)
			}
			return rows
		} catch (e) {
			throw e
		}
	}
}

export const cumincInit = rx.getInitFxn(TdbCumInc)

function setRenderers(self) {
	self.render = function() {
		const chartDivs = self.dom.div.selectAll('.pp-cuminc-chart').data(self.pj.tree.charts, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.div.style('display', 'block')
		self.dom.div.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function(d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-cuminc-chart')
			.style('opacity', 0)
			//.style("position", "absolute")
			.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
			.style('border', '1px solid #eee')
			.style('box-shadow', '0px 0px 1px 0px #ccc')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.append('div')
			.attr('class', 'sjpcb-cuminc-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(d.chartId)
			.html(d.chartId)

		const svg = div.append('svg').attr('class', 'pp-cuminc-svg')
		renderSVG(svg, d, s, 0)

		div
			.transition()
			.duration(s.duration)
			.style('opacity', 1)
	}

	self.updateCharts = function(d) {
		const s = self.settings
		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			.style('width', s.svgw + 50 + 'px')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.select('.sjpcb-cuminc-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(d.chartId)
			.html(d.chartId)

		div.selectAll('.sjpcb-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), d, s, s.duration)
	}

	function renderSVG(svg, chart, s, duration) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw)
			.attr('height', s.svgh)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);

		mainG.attr('transform', 'translate(' + s.svgPadding.left + ',' + s.svgPadding.top + ')')
		const serieses = mainG.selectAll('.sjpcb-cuminc-series').data(chart.serieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function(series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpcb-cuminc-series')
			.each(function(series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (!svg.select('.sjpcb-cuminc-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpcb-cuminc-mainG')
			axisG = mainG.append('g').attr('class', 'sjpcb-cuminc-axis')
			xAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-y-title')
		} else {
			mainG = svg.select('.sjpcb-cuminc-mainG')
			axisG = mainG.select('.sjpcb-cuminc-axis')
			xAxis = axisG.select('.sjpcb-cuminc-x-axis')
			yAxis = axisG.select('.sjpcb-cuminc-y-axis')
			xTitle = axisG.select('.sjpcb-cuminc-x-title')
			yTitle = axisG.select('.sjpcb-cuminc-y-title')
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		// remove all circles as there is no data id for privacy
		g.selectAll('circle').remove()

		const circles = g.selectAll('circle').data(series.data, b => b.x)

		circles.exit().remove()

		circles
			.transition()
			.duration(duration)
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('fill', s.fill)
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', s.stroke)

		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('opacity', 0)
			.style('fill', s.fill)
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', s.stroke)
			.transition()
			.duration(duration)

		g.selectAll('path').remove()
		g.append('path')
			.attr('d', self.lineFxn(series.data))
			.style('fill', 'none')
			.style('stroke', '#000')
			.style('opacity', 1)
			.style('stroke-opacity', d => (d.seriesId == 'cuminc' ? 1 : 0.2))
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
		xAxis
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom) + ')')
			.call(axisBottom(d.xScale).ticks(5))

		yAxis.call(
			axisLeft(
				d3Linear()
					.domain(d.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const xTitleLabel = 'Time to Event (years)'
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

		const yTitleLabel = 'Cumulative Incidence'
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
}

function setInteractivity(self) {
	self.mouseover = function() {
		if (event.target.tagName == 'circle') {
			const d = event.target.__data__
			const rows = [
				`<tr><td style='padding:3px; color:#aaa'>X:</td><td style='padding:3px; text-align:center'>${d.x}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>Y:</td><td style='padding:3px; text-align:center'>${d.y}</td></tr>`
			]
			self.app.tip
				.show(event.clientX, event.clientY)
				.d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		} else {
			self.app.tip.hide()
		}
	}

	self.mouseout = function() {
		self.app.tip.hide()
	}
}

function getPj(self) {
	const s = self.settings

	const pj = new Partjson({
		template: {
			//"__:charts": "@.byChc.@values",
			yMin: '>$cuminc',
			yMax: '<$cuminc',
			charts: [
				{
					chartId: '@key',
					xMin: '>$time',
					xMax: '<$time',
					yMin: '>$cuminc',
					yMax: '<$cuminc',
					'__:xScale': '=xScale()',
					'__:yScale': '=yScale()',
					serieses: [
						{
							chartId: '@parent.@parent.@key',
							seriesId: '@key',
							data: [
								{
									'__:seriesId': '@parent.@parent.seriesId',
									//color: "$color",
									x: '$time',
									y: '=y()',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'$time'
							]
						},
						'$seriesKeys[]'
					]
				},
				'=chartTitle()'
			]
		},
		'=': {
			chartTitle(row) {
				return 'Test'
			},
			y(row, context) {
				return row[context.context.parent.seriesId]
			},
			xScale(row, context) {
				return d3Linear()
					.domain([context.self.xMin, context.self.xMax])
					.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				return context.context.context.context.parent.yScale(context.self.y)
			},
			yScale(row, context) {
				const yMax = s.scale == 'byChart' ? context.self.yMax : context.root.yMax
				const domain = [Math.min(1, 2 * yMax), 0]
				return d3Linear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			}
		}
	})

	return pj
}
