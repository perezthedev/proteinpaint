import * as rx from '../common/rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import { termsettingInit } from '../common/termsetting'
import { initRadioInputs } from '../common/dom'

class TdbOverlayInput {
	constructor(app, opts) {
		this.type = 'overlayInput'
		this.app = app
		this.opts = opts
		this.controls = opts.controls
		this.dom = { holder: opts.holder }
		setInteractivity(this)
		setRenderers(this)

		this.setUI()
		this.api = rx.getComponentApi(this)
	}

	main(arg = {}) {
		this.state = arg && arg.state
		this.plot = arg && arg.state && arg.state.config
		//this.data = arg && arg.data
		this.obj = arg & arg.obj ? arg.obj : this.opts.obj ? this.opts.obj : {}
		if (!this.pill) this.setPill()
		this.render()

		const disable_terms = [this.plot.term.term.id]
		if (this.plot.term0) disable_terms.push(this.plot.term0.term.id)
		// todo: may add computed data to pill.main argument
		this.pill.main({ term: this.plot.settings.controls.term2, disable_terms })
	}

	setPill() {
		this.pill = termsettingInit(this.app, {
			holder: this.pill_div,
			plot: this.plot,
			term_id: 'term2',
			id: this.controls.id,
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			callback: term => {
				const term2 = term ? { id: term.id, term } : null
				this.controls.dispatch({
					term2: term2,
					settings: {
						barchart: {
							overlay: term2 ? 'tree' : 'none'
						},
						controls: { term2 }
					}
				})
			}
		})
	}
}

export const overlayInputInit = rx.getInitFxn(TdbOverlayInput)

function setRenderers(self) {
	self.setUI = function() {
		const tr = self.dom.holder

		tr.append('td')
			.html('Overlay with')
			.attr('class', 'sja-termdb-config-row-label')

		const td = tr.append('td')

		this.radio = initRadioInputs({
			name: 'pp-termdb-overlay-' + this.controls.index,
			holder: td,
			options: [
				{ label: 'None', value: 'none' },
				{ label: 'Subconditions', value: 'bar_by_children' },
				{ label: 'Grade', value: 'bar_by_grade' },
				{ label: '', value: 'tree' },
				{ label: 'Genotype', value: 'genotype' }
			],
			listeners: {
				input: self.setOptionVal,
				click: self.showTree
			}
		})

		//add blue-pill for term2
		const treeInput = this.radio.dom.inputs
			.filter(d => {
				return d.value == 'tree'
			})
			.style('margin-top', '2px')

		this.pill_div = d3select(treeInput.node().parentNode.parentNode)
			.append('div')
			.style('display', 'inline-block')
	}

	self.render = function() {
		// hide all options when opened from genome browser view
		self.dom.holder.style('display', self.obj.modifier_ssid_barchart ? 'none' : 'table-row')

		const plot = self.plot
		// do not show genotype overlay option when opened from stand-alone page
		if (!plot.settings.barchart.overlay) {
			plot.settings.barchart.overlay = self.obj.modifier_ssid_barchart
				? 'genotype'
				: plot.term2 && plot.term2.term.id != plot.term.term.id
				? 'tree'
				: 'none'
		}

		self.radio.main(plot.settings.barchart.overlay)
		self.radio.dom.labels.html(self.updateRadioLabels)
		self.radio.dom.divs.style('display', self.getDisplayStyle)
	}

	self.updateRadioLabels = function(d) {
		const term1 = self.plot.term.term
		if (!term1.iscondition) return '&nbsp;' + d.label
		if (d.value == 'bar_by_children') return '&nbsp;' + term1.id + ' subconditions'
		if (d.value == 'bar_by_grade') return '&nbsp;' + term1.id + ' grades'
		return '&nbsp;' + d.label
	}

	self.getDisplayStyle = function(d) {
		const term1 = self.plot.term.term
		if (d.value == 'bar_by_children') {
			return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_grade ? 'block' : 'none'
		} else if (d.value == 'bar_by_grade') {
			return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_children ? 'block' : 'none'
		} else {
			const block = 'block' //term1.q.iscondition || (plot.term2 && plot.term2.term.iscondition) ? 'block' : 'inline-block'
			return d.value != 'genotype' || self.obj.modifier_ssid_barchart ? block : 'none'
		}
	}
}

function setInteractivity(self) {
	self.setOptionVal = d => {
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value == 'none') {
			self.controls.dispatch({
				term2: undefined,
				settings: {
					currViews: ['barchart'],
					barchart: { overlay: d.value }
				}
			})
		} else if (d.value == 'tree') {
			if (!plot.settings.controls.term2) {
				self.pill.showTree()
			} else {
				self.controls.dispatch({
					term2: plot.settings.controls.term2,
					settings: { barchart: { overlay: d.value } }
				})
			}
		} else if (d.value == 'genotype') {
			// to-do
			console.log('genotype overlay to be handled from term tree portal', d, d3event.target)
		} else if (d.value == 'bar_by_children') {
			if (plot.term.q.bar_by_children) {
				console.log('bar_by_children term1 should not allow subcondition overlay')
				return
			}
			const q = { bar_by_grade: 1 }
			self.controls.dispatch({
				term2: {
					term: plot.term.term,
					q: {
						bar_by_children: 1
					}
				},
				settings: { barchart: { overlay: d.value } }
			})
		} else if (d.value == 'bar_by_grade') {
			if (plot.term.q.bar_by_grade) {
				console.log('bar_by_grade term1 should not allow grade overlay')
				return
			}
			self.controls.dispatch({
				term2: {
					term: plot.term.term,
					q: {
						bar_by_grade: 1
					}
				},
				settings: { barchart: { overlay: d.value } }
			})
		} else {
			console.log('unhandled click event', d, d3event.target)
		}
	}

	self.showTree = d => {
		d3event.stopPropagation()
		const plot = self.plot
		if (d.value != 'tree' || d.value != plot.settings.barchart.overlay) return
		self.obj.showtree4selectterm([plot.term.id, plot.term2 ? plot.term2.term.id : null], tr.node(), term2 => {
			self.obj.tip.hide()
			self.controls.dispatch({ term2: { term: term2 } })
		})
	}
}
