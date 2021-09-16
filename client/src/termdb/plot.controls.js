import * as rx from '../common/rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import * as client from '../client'
import { topBarInit } from './plot.controls.btns'
import { configUiInit } from './plot.controls.config'

const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'
let i = 0 // track controls "instances" for assigning unambiguous unique input names

class TdbPlotControls {
	constructor(opts) {
		this.type = 'plotControls'
		this.id = opts.id
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.customEvents = ['downloadClick', 'infoClick']
		this.api = rx.getComponentApi(this)
		this.setDom()

		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		try {
			this.components = await rx.multiInit({
				topbar: topBarInit({
					app: this.app,
					id: this.id,
					holder: this.dom.topbar,
					callback: this.toggleVisibility,
					downloadHandler: () => this.bus.emit('downloadClick'),
					infoHandler: isOpen =>
						this.app.dispatch({
							type: 'plot_edit',
							id: this.opts.id,
							config: {
								settings: {
									termInfo: {
										isVisible: isOpen
									}
								}
							}
						})
				}),
				config: configUiInit({
					app: this.app,
					id: this.id,
					holder: this.dom.config_div,
					tip: this.app.tip,
					isleaf: this.opts.isleaf,
					iscondition: this.opts.iscondition
				})
			})
		} catch (e) {
			throw e
		}
	}

	setDom() {
		const topbar = this.opts.holder.append('div')
		const config_div = this.opts.holder.append('div')

		this.dom = {
			holder: this.opts.holder.style('vertical-align', 'top').style('transition', '0.5s'),
			// these are listed in the displayed top-down order of input elements
			topbar,
			config_div
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. 73 33333`
		}
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config
		}
	}

	main(arg) {
		if (!this.state) return
		this.isOpen = this.state.config.settings.controls.isOpen
		this.render()
		for (const name in this.features) {
			this.features[name].main(this.state, this.isOpen)
		}
	}
}

export const controlsInit = rx.getInitFxn(TdbPlotControls)

function setRenderers(self) {
	self.render = function() {
		self.dom.holder.style('background', self.isOpen ? panel_bg_color : '')
	}
}

function setInteractivity(self) {
	self.toggleVisibility = () => {
		const isOpen = !self.isOpen
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					controls: { isOpen }
				}
			}
		})
	}
}
