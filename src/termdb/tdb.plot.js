import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
import {barInit} from "./tdb.barchart"

class TdbPlot {
	constructor(app, holder, arg) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.id = arg.id
		this.config = this.app.state({type: 'plot', id: this.id})
		
		this.dom = {
			holder: holder
				.style("margin-top", "-1px")
				.style("white-space", "nowrap")
				.style("overflow-x", "scroll"),

			// will hold no data notice or the page title in multichart views
			banner: holder.append("div").style("display", "none"),

			// dom.controls will hold the config input, select, button elements
			controls: holder
				.append("div")
				.attr("class", "pp-termdb-plot-controls")
				.style("display", "inline-block"),

			// dom.viz will hold the rendered view
			viz: holder
				.append("div")
				.attr("class", "pp-termdb-plot-viz")
				.style("display", "inline-block")
				.style("min-width", "300px")
				.style("margin-left", "50px")
		}
		
		this.components = {
			barchart: barInit(this.app, this.dom.viz.append('div'), this.config)
		}

		this.app.dispatch({
			type: "plot_add",
			id: this.id, 
			config: this.config
		})

		this.bus = new rx.Bus('plot', ['postInit', 'postNotify'], this.app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] != "plot") return 
		if (action.id != this.id) return
		if (action.type == "plot_hide") return
		return true
	}

	async main(action) {
		this.config = this.app.state({type: 'plot', id: this.id})
		const data = await this.requestData(this.config)
		this.syncParams(this.config, data)
		this.render(this.config, data)
	}

	async requestData(config) {
		const dataName = this.getDataName(this.config)
		const route = config.settings.currViews.includes("scatter") ? "/termdb" : "/termdb-barsql"
		return await dofetch2(route + dataName, {}, this.app.opts.fetchOpts)
	}

	// creates URL search parameter string, that also serves as
	// a unique request identifier to be used for caching server response
	getDataName(config) {
		const obj = this.app.state()
		const params = ["genome=" + obj.genome, "dslabel=" + obj.dslabel]

		const isscatter = config.settings.currViews.includes("scatter")
		if (isscatter) params.push("scatter=1")
		;["term", "term2", "term0"].forEach(_key => {
			// "term" on client is "term1" at backend
			const term = config[_key]
			if (!term) return
			const key = _key == "term" ? "term1" : _key
			params.push(key + "_id=" + encodeURIComponent(term.term.id))
			if (isscatter) return
			if (term.term.iscondition && !term.q) term.q = {}
			if (term.q && typeof term.q == "object") {
				let q = {}
				if (term.term.iscondition) {
					q = Object.keys(term.q).length ? Object.assign({}, term.q) : { bar_by_grade: 1, value_by_max_grade: 1 }
				}
				if (term.q.binconfig) {
					q = Object.assign({}, term.q)
					delete q.binconfig.results
				}
				params.push(key + "_q=" + encodeURIComponent(JSON.stringify(q)))
			}
		})

		if (!isscatter) {
			if (obj.modifier_ssid_barchart) {
				params.push(
					"term2_is_genotype=1",
					"ssid=" + obj.modifier_ssid_barchart.ssid,
					"mname=" + obj.modifier_ssid_barchart.mutation_name,
					"chr=" + obj.modifier_ssid_barchart.chr,
					"pos=" + obj.modifier_ssid_barchart.pos
				)
			}
		}

		if (obj.termfilter && obj.termfilter.terms && obj.termfilter.terms.length) {
			params.push("tvslst=" + encodeURIComponent(JSON.stringify(tvslst_to_parameter(obj.termfilter.terms))))
		}

		return "?" + params.join("&")
	}

	syncParams(config, data) {
		if (!data || !data.refs) return
		for (const [i, key] of ["term0", "term", "term2"].entries()) {
			const term = config[key]
			if (!term || term == "genotype") continue
			term.bins = data.refs.bins[i]
			if (data.refs.q && data.refs.q[i]) {
				if (!term.q) term.q = {}
				const q = data.refs.q[i]
				if (q !== term.q) {
					for (const key in term.q) delete term.q[key]
					Object.assign(term.q, q)
				}
			}
		}
		// when the server response includes default parameters
		// that was not in the request parameters, the dataName
		// will be different even though the config state is technically
		// the same except now with explicit defaults. So store
		// the response data under the alternative dataname
		// that includes the defaults.
		/*
		const altDataName = this.getDataName(config)
		if (!(altDataName in serverData)) {
			serverData[altDataName] = data
		}
		*/
	}

	render(config, data) {
		for (const name in this.components) {
			this.components[name].render(config, data)
		}
		this.bus.emit("postRender")
	}
}

exports.plotInit = rx.getInitFxn(TdbPlot)
