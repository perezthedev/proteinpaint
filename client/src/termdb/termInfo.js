import * as rx from '../common/rx.core'
import { dofetch3 } from '../client'

class TdbTermInfo {
	constructor(opts) {
		this.type = 'termInfo'
		// set this.id, .app, .opts, .api
		rx.prepComponent(this, opts)
		this.dom = {
			holder: opts.holder
		}
		setRenderers(this)
		this.initUI()
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found.`
		}
		return {
			isVisible: config.settings.termInfo.isVisible,
			term: config.term
		}
	}

	async main() {
		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'block')
		const data = await this.app.vocabApi.getTermInfo(this.state.term.id)
		this.render(data)
	}
}

export const termInfoInit = rx.getInitFxn(TdbTermInfo)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.holder
			.attr('class', 'term_info_div')
			.style('width', '80vh')
			.style('padding-bottom', '20px')
			.style('display', 'block')

		self.dom.tbody = self.dom.holder
			.append('table')
			.style('white-space', 'normal')
			.append('tbody')
	}

	self.render = function(data) {
		self.dom.tbody.selectAll('*').remove()
		if (data.terminfo.src) {
			for (let s of data.terminfo.src) {
				const source_td = self.dom.tbody
					.append('tr')
					.append('td')
					.style('padding', '5px 0')

				source_td
					.append('div')
					.style('font-weight', 'bold')
					.text('Source')

				source_td
					.append('div')
					.style('margin-left', '20px')
					.text(s.pub)

				source_td
					.append('div')
					.style('margin-left', '20px')
					.html(s.title + ':&nbsp;<i>' + s.section + '</i>')
			}
		}

		if (data.terminfo.rubric) {
			const grade_td = self.dom.tbody
				.append('tr')
				.append('td')
				.style('padding', '5px 0')
				.append('div')
				.style('font-weight', 'bold')
				.text('Grading Rubric')
				.append('ol')
				.style('margin', '0px')

			for (let grade of data.terminfo.rubric) {
				grade_td
					.append('li')
					.style('font-weight', 'normal')
					.text(grade)
			}
		}

		if (data.terminfo.description) {
			const header = self.dom.holder
				.append('div')
				.style('padding-top', '40px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text('Description')
			for (const d of data.terminfo.description) {
				self.renderDetail(d, self.dom.holder.append('div').style('padding-bottom', '3px'))
			}
			self.dom.holder.append('div').style('padding-bottom', '20px')
		}
	}

	self.renderDetail = function(d, div) {
		if (Array.isArray(d.value)) {
			div.append('span').html('<i>' + d.label + '</i>')
			const section = div.append('div').style('padding-left', '20px')
			for (const v of d.value) {
				v.label = '- ' + v.label
				self.renderDetail(v, section.append('div'))
			}
		} else {
			div.html('<i>' + d.label + ':' + '</i>' + '&nbsp;')
			if (d.label === 'PGS catalog id') {
				//if (typeof d.value === 'string' && d.value.startsWith('http')) {
				div
					.append('a')
					.attr('href', 'https://www.pgscatalog.org/score/' + d.value)
					.text(d.value)
			} else if (d.label === '- PMID') {
				div
					.append('a')
					.attr('href', 'https://pubmed.ncbi.nlm.nih.gov/' + d.value)
					.text(d.value)
			} else if (d.label === '- DOI') {
				div
					.append('a')
					.attr('href', 'https://doi.org/' + d.value)
					.text(d.value)
			} else {
				div.append('span').text(d.value)
			}
		}
	}
}
