import * as rx from '../common/rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import * as client from '../client'
import { display as termui_display, numeric_bin_edit } from '../mds.termdb.termsetting.ui'
import { configUiInit } from './plot.controls.config'

const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'
let i = 0 // track controls "instances" for assigning unambiguous unique input names

class TdbPlotControls {
	constructor(app, opts) {
		this.opts = opts
		this.type = 'plot'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.app = app
		this.isVisible = true
		this.setDom()

		setInteractivity(this)
		setRenderers(this)

		this.features = {
			config: configUiInit({
				id: this.id,
				holder: this.dom.config_div,
				dispatch: this.app.dispatch
			})
		}
	}

	getState(appState) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${this.id}' found.`
		}
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			termfilter: appState.termfilter,
			config: appState.tree.plots[this.id]
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

	main() {
		this.render()
		for (const name in this.features) {
			if (typeof this.features[name].update !== 'function') {
				this.features[name].main(this.state.config, { isOpen: this.isVisible })
			}
		}
		return { state: this.state } //, data }
	}
}

export const controlsInit = rx.getInitFxn(TdbPlotControls)

function setRenderers(self) {
	self.render = function() {
		self.dom.holder.style('background', self.isVisible ? panel_bg_color : '')
	}
}

function setInteractivity(self) {
	self.toggleVisibility = isVisible => {
		self.isVisible = isVisible
		self.main()
	}
}
