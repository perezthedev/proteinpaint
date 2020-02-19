import * as rx from '../common/rx.core'
import { searchInit } from './search'
import { select } from 'd3-selection'
import { dofetch2 } from '../client'

class TdbNav {
	constructor(app, opts) {
		this.type = 'nav'
		this.app = app
		this.opts = opts
		this.id = opts.id

		this.api = rx.getComponentApi(this)
		this.api.getDom = () => {
			return {
				searchDiv: this.dom.searchDiv,
				subheader: this.dom.subheader,
				filterTab: this.dom.tds.filter(d => d.colNum === 1)
			}
		}
		this.api.clearSubheader = () => {
			this.searching = true
			this.dom.subheaderDiv.style('display', 'block')
			for (const key in this.dom.subheader) {
				this.dom.subheader[key].style('display', key == 'search' ? 'block' : 'none')
			}
			// assumes search results are rendered in a table
			this.dom.subheaderDiv.style('display', this.dom.subheader.search.select('table').size() ? 'block' : 'none')
		}

		const header = opts.holder.append('div').style('border-bottom', '1px solid #000')
		this.dom = {
			holder: opts.holder.style('display', this.opts.enabled ? 'block' : 'none').style('margin-bottom', '20px'),
			searchDiv: header
				.append('div')
				.style('display', 'inline-block')
				.style('width', '300px')
				.style('margin', '10px')
				.style('vertical-align', 'top'),
			tabDiv: header.append('div').style('display', 'inline-block'),
			sessionDiv: header.append('div'),
			subheaderDiv: opts.holder
				.append('div')
				.style('display', 'none')
				.style('padding-top', '5px')
				.style('border-bottom', '1px solid #000')
		}
		this.dom.subheader = Object.freeze({
			search: this.dom.subheaderDiv.append('div'),
			cohort: this.dom.subheaderDiv.append('div'),
			filter: this.dom.subheaderDiv.append('div'),
			cart: this.dom.subheaderDiv
				.append('div')
				.html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>')
		})
		setInteractivity(this)
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']

		this.activeTab = 0 // filter tab, will switch to cohort tab during init if exists
		this.searching = false
		this.hideSubheader = false
		this.components = {}
		this.samplecounts = {}
		this.initUI()
	}
	getState(appState) {
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			searching: this.searching,
			activeTab: appState.activeTab,
			activeCohort: appState.activeCohort,
			termdbConfig: {}, //appState.termdbConfig,
			filter: appState.termfilter.filter
		}
	}
	reactsTo(action) {
		return true // console.log(58, action.type == 'app_refresh')
		return action.type.startsWith('tab_') || action.type == 'app_refresh'
	}
	async main() {
		if (!this.opts.enabled) return
		this.activeTab = this.state.activeTab
		this.activeCohort = this.state.activeCohort
		if (!this.dom.cohortTable) this.initCohort()
		if (this.cohortNames) this.activeCohortName = this.cohortNames[this.activeCohort]
		this.hideSubheader = false
		await this.getSampleCount()
		this.updateUI()
	}
	async getSampleCount() {
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getsamplecount=' + this.activeCohortName,
			'filter=' + encodeURIComponent(JSON.stringify(this.state.filter))
		]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		for (const row of data) {
			this.samplecounts[row.subcohort] = row.samplecount
		}
	}
}

export const navInit = rx.getInitFxn(TdbNav)

function setRenderers(self) {
	self.initUI = () => {
		const table = self.dom.tabDiv.append('table').style('border-collapse', 'collapse')
		self.tabs = [
			{ top: 'COHORT', mid: 'SJLIFE', btm: '' }, //, hidetab: !self.state.termdbConfig.selectCohort },
			{ top: 'FILTER', mid: '+NEW', btm: '' },
			{ top: 'CART', mid: 'NONE', btm: '' }
		]
		table
			.selectAll('tr')
			.data(['top', 'mid', 'btm'])
			.enter()
			.append('tr')
			.style('font-size', (d, i) => (i == 1 ? '20px' : '12px'))
			.selectAll('td')
			.data((key, i) =>
				self.tabs
					.filter(d => !d.hidetab)
					.map((row, colNum) => {
						return { rowNum: i, key, colNum, label: row[key] }
					})
			)
			.enter()
			.append('td')
			// hide the cohort tab until there is termdbConfig.selectCohort
			.style('display', d => (d.colNum === 0 ? 'none' : ''))
			.style('width', '100px')
			.style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('border-left', '1px solid #ccc')
			.style('border-right', '1px solid #ccc')
			.style('color', '#aaa')
			.style('cursor', 'pointer')
			.html(d => d.label)
			.on('click', self.setTab)

		self.dom.trs = table.selectAll('tr')
		self.dom.tds = table.selectAll('td')
		self.subheaderKeys = ['cohort', 'filter', 'cart']
	}
	self.updateUI = () => {
		//self.dom.trs.style('color', d => (d.rowNum == 0 ? '#aaa' : '#000'))
		self.dom.tds
			.style('color', d => (d.colNum == self.activeTab && !self.hideSubheader ? '#000' : '#aaa'))
			.html(function(d, i) {
				if (d.key == 'top') return this.innerHTML
				if (d.colNum === 0) {
					return d.key == 'mid' ? self.activeCohortName : 'n=' + self.samplecounts[self.activeCohortName]
				} else if (d.colNum === 1) {
					if (self.state.filter.lst.length === 0) {
						return d.key === 'mid' ? '+NEW' : ''
					} else {
						return d.key === 'mid' ? self.state.filter.lst.length : 'n=' + self.samplecounts['FILTERED_COHORT']
					}
				} else {
					return d.key === 'mid' ? this.innerHTML : ''
				}
			})

		self.dom.subheaderDiv.style(
			'display',
			self.hideSubheader
				? 'none'
				: self.searching || (self.activeTab === 1 && !self.state.filter.lst.length)
				? 'none'
				: 'block'
		)

		for (const key in self.dom.subheader) {
			self.dom.subheader[key].style(
				'display',
				key == 'search' || self.activeTab == self.subheaderKeys.indexOf(key) ? 'block' : 'none'
			)
		}
	}
	self.initCohort = () => {
		const selectCohort = self.state.termdbConfig && self.state.termdbConfig.selectCohort
		if (!selectCohort) {
			if (self.activeTab === 0) self.activeTab = 1
			return
		}
		self.dom.tds.filter(d => d.colNum === 0).style('display', '')
		self.cohortNames = selectCohort.values.map(d => d.keys.join(','))
		self.dom.cohortOpts = self.dom.subheader.cohort.append('div')
		const trs = self.dom.cohortOpts
			.append('table')
			.style('margin', '20px')
			.selectAll('tr')
			.data(selectCohort.values)
			.enter()
			.append('tr')
			.each(function(d, i) {
				const tr = select(this)
				const td0 = tr.append('td')
				td0
					.append('input')
					.attr('type', 'radio')
					.attr('name', 'sja-termdb-cohort')
					.attr('id', 'sja-termdb-cohort' + i)
					.attr('value', i)
					.property('checked', i === self.activeCohort)
					.style('margin-right', '3px')
					.on('change', () => self.app.dispatch({ type: 'cohort_set', activeCohort: i }))

				td0
					.append('label')
					.attr('for', 'sja-termdb-cohort' + i)
					.style('cursor', 'pointer')
					.html(d => d.label)

				if (!d.note) {
					td0.attr('colspan', 2)
				} else {
					tr.append('td').html(d.note)
				}

				tr.selectAll('td')
					.style('max-width', '600px')
					.style('padding', '10px')
					.style('vertical-align', 'top')
			})

		self.dom.cohortTable = self.dom.subheader.cohort.append('div').html(selectCohort.htmlinfo)

		self.dom.cohortTable
			.select('table')
			.style('border-collapse', 'collapse')
			.style('margin', '20px')

		self.dom.cohortTable
			.select('thead')
			.selectAll('tr')
			.style('text-align', 'center')
			.style('background-color', 'rgba(20, 20, 180, 0.8)')
			.style('color', '#fff')

		self.dom.cohortTable
			.select('tbody')
			.selectAll('tr')
			.style('background-color', (d, i) => (i % 2 == 0 ? 'rgba(220, 180, 0, 0.4)' : '#fff'))

		self.dom.cohortTable.selectAll('td').style('padding', '5px')

		self.dom.cohortTable.selectAll('td').style('border', 'solid 2px rgba(220, 180, 0, 1)')
	}
}

function setInteractivity(self) {
	self.setTab = d => {
		if (d.colNum == self.activeTab && !self.searching) {
			self.hideSubheader = !self.hideSubheader //; console.log(248, self.hideSubheader)
			self.updateUI()
			return
		}
		self.activeTab = d.colNum
		self.searching = false
		self.app.dispatch({ type: 'tab_set', activeTab: self.activeTab })
	}
}
