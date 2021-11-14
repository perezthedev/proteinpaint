import { getInitFxn, copyMerge } from '../common/rx.core'
import { Menu } from '../dom/menu'
import { select } from 'd3-selection'

/*
constructor option and API are documented at
https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.qajstgcfxci

************** instance private properties
.opts{}
.term{}
.q{}
.disable_terms[]


************** introducing the atypical API
-- this.api{} is self-made, not generated by getComponentApi
-- api not registered in caller.components{}, not in the notify-cycle
-- no bus
-- upon init, termsetting constructor does not accept initial value of term/q
   term/q/disable_terms will only be set/updated through api.main()
-- termsetting opts.callback() will send caller updated term/q via user fiddling


************** explain behavior here:

initHandlerByType(self)
- this will create a handler{} for each known term.type and "subtype" ('discrete', 'binary', etc)
- a handler object will have the following methods
	- get_term_name(term): will return the term label to use in the pill, including potential abbreviation
	- get_status_msg(): either empty or error string, displayed on the right side of the pill
	- showEditMenu(div): content/inputs to show for editing a term's binning or groupsetting

NOTE: For numeric terms, there is an option to show a toggled edit menu, where continuous or binning
	inputs are supported. By default, only the binning menu is shown (no toggle buttons). 
*/

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.vocab = opts.vocab
		this.vocabApi = opts.vocabApi
		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder
		this.durations = { exit: 500 }
		this.disable_terms = opts.disable_terms
		this.usecase = opts.usecase
		this.abbrCutoff = opts.abbrCutoff

		// numqByTermIdModeType is used if/when a numeric pill term type changes:
		// it will track numeric term.q by term.id, q.mode, and q.type to enable
		// the "remember" input values when switching between
		// discrete, continuous, and binary edit menus for the same term
		this.numqByTermIdModeType = {}

		// detect if the holder is contained within a floating client Menu instance;
		// this will be useful in preventing premature closure of the menu in case
		// a submenu is clicked and is still visible
		// NOTE: the parent_menu value may be empty (undefined)
		this.parent_menu = this.opts.holder.node() && this.opts.holder.node().closest('.sja_menu_div')
		this.dom = {
			holder: opts.holder,
			tip: new Menu({ padding: '0px', parent_menu: this.parent_menu })
		}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()
		this.initHandlerByType()

		// this api will be frozen and returned by termsettingInit()
		this.hasError = false
		this.api = {
			main: async (data = {}) => {
				try {
					this.dom.tip.hide()
					this.hasError = false
					delete this.error
					this.validateMainData(data)
					// term is read-only if it comes from state, let it remain read-only
					this.term = data.term
					this.q = JSON.parse(JSON.stringify(data.q)) // q{} will be altered here and must not be read-only
					if ('disable_terms' in data) this.disable_terms = data.disable_terms
					if ('exclude_types' in data) this.exclude_types = data.exclude_types
					if ('filter' in data) this.filter = data.filter
					if ('activeCohort' in data) this.activeCohort = data.activeCohort
					if ('sampleCounts' in data) this.sampleCounts = data.sampleCounts
					await this.setHandler()
					this.updateUI()
					if (data.term && this.validateQ) this.validateQ(data)
					if (data.term && data.term.type !== 'integer' && data.term.type !== 'float') this.addCategory2sampleCounts()
				} catch (e) {
					this.hasError = true
					throw e
				}
			},
			showTree: this.showTree,
			hasError: () => this.hasError,
			validateQ: d => {
				if (!this.handler || !this.handler.validateQ) return
				try {
					this.handler.validateQ(d)
				} catch (e) {
					this.hasError = true
					throw e
				}
			}
		}
	}

	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.vocab) throw '.vocab missing'
		if (o.vocab.route && !o.vocab.genome) throw '.genome missing'
		if (o.vocab.route && !o.vocab.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if ('placeholder' in o && !o.placeholder && 'placeholderIcon' in o && !o.placeholderIcon)
			throw 'must specify a non-empty opts.placeholder and/or .placeholderIcon'
		if (!('placeholder' in o)) o.placeholder = 'Select term&nbsp;'
		if (!('placeholderIcon' in o)) o.placeholderIcon = '+'
		if (!('abbrCutoff' in o)) o.abbrCutoff = 18 //set the default to 18
		if (!o.numericEditMenuVersion) o.numericEditMenuVersion = ['discrete']
		return o
	}

	validateMainData(d) {
		if (d.term) {
			// term is optional
			if (!d.term.id) throw 'data.term.id missing'
			if (!d.term.name) throw 'data.term.name missing'
			if (!d.term.type) throw 'data.term.type missing'
		}
		if (!d.q) d.q = {}
		if (typeof d.q != 'object') throw 'data.q{} is not object'
		if (d.disable_terms) {
			if (!Array.isArray(d.disable_terms)) throw 'data.disable_terms[] is not array'
		}
	}

	initHandlerByType() {
		const defaultHandler = getDefaultHandler(this)
		this.handlerByType = {
			survival: defaultHandler,
			default: defaultHandler
		}
	}

	async setHandler() {
		if (!this.term) {
			this.handler = this.handlerByType.default
			return
		}
		const type = this.term.type == 'integer' || this.term.type == 'float' ? 'numeric' : this.term.type // 'categorical', 'condition', 'survival', etc
		const numEditVers = this.opts.numericEditMenuVersion
		const subtype = type != 'numeric' ? '' : numEditVers.length > 1 ? '.toggle' : '.' + numEditVers[0] // defaults to 'discrete'
		const typeSubtype = `${type}${subtype}`
		if (!this.handlerByType[typeSubtype]) {
			try {
				const _ = await import(`./termsetting.${typeSubtype}.js`)
				this.handlerByType[typeSubtype] = _.getHandler(this)
			} catch (e) {
				throw `error with handler='./termsetting.${typeSubtype}.js': ${e}`
			}
		}
		this.handler = this.handlerByType[typeSubtype]
	}
}

export const termsettingInit = getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		// run only once, upon init
		if (self.opts.$id) {
			self.dom.tip.d.attr('id', self.opts.$id + '-ts-tip')
		}

		// toggle the display of pilldiv and nopilldiv with availability of this.term
		self.dom.nopilldiv = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', self.showTree)
		self.dom.pilldiv = self.dom.holder.append('div')

		// nopilldiv - placeholder label
		if (self.opts.placeholder) {
			self.dom.nopilldiv
				.append('div')
				.html(self.placeholder)
				.attr('class', 'sja_clbtext2')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
		}

		// nopilldiv - plus button
		if (self.opts.placeholderIcon) {
			self.dom.nopilldiv
				.append('div')
				.attr('class', 'sja_filter_tag_btn add_term_btn')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
				.style('border-radius', '6px')
				.style('background-color', '#4888BF')
				.text(self.opts.placeholderIcon)
		}

		self.dom.btnDiv = self.dom.holder.append('div')
		if (self.opts.buttons) {
			self.dom.btnDiv
				.selectAll('div')
				.data(self.opts.buttons)
				.enter()
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '0px 5px')
				.style('cursor', 'pointer')
				.style('color', '#999')
				.style('font-size', '.8em')
				.html(d => d.toUpperCase())
				.on('click', d => {
					if (d == 'delete') self.removeTerm()
					else if (d == 'replace') self.showTree()
				})
		}
	}

	self.updateUI = () => {
		if (!self.term) {
			// no term
			self.dom.nopilldiv.style('display', 'block')
			self.dom.pilldiv.style('display', 'none')
			self.dom.btnDiv.style('display', 'none')
			return
		}

		// has term

		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', self.opts.buttons ? 'inline-block' : 'block')
		self.dom.btnDiv.style('display', 'inline-block')

		const pills = self.dom.pilldiv.selectAll('.ts_pill').data([self.term], d => d.id)

		// this exit is really nice
		pills.exit().each(self.exitPill)

		pills
			.transition()
			.duration(200)
			.each(self.updatePill)

		pills
			.enter()
			.append('div')
			.attr('class', 'ts_pill')
			.style('cursor', 'pointer')
			.style('margin', '2px')
			.on('click', self.showMenu)
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function() {
		const one_term_div = select(this)

		// left half of blue pill
		self.dom.pill_termname = one_term_div
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'term_name_btn  sja_filter_tag_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.html(self.handler.get_term_name)

		self.updatePill.call(this)
	}

	self.updatePill = async function() {
		// only modify right half of the pill
		const one_term_div = select(this)
		if (self.term.type == 'condition' && !self.q.bar_by_children && !self.q.bar_by_grade) {
			self.q.bar_by_grade = true
			self.q.value_by_max_grade = true
			self.q.groupsetting = {}
		}

		// if using group setting, will show right half
		// allow more than 1 flags for future expansion
		const grpsetting_flag = self.q.groupsetting && self.q.groupsetting.inuse

		const status_msg = self.handler.get_status_msg()

		self.dom.pill_termname.style(
			'border-radius',
			grpsetting_flag || self.term.type == 'condition' ? '6px 0 0 6px' : '6px'
		)

		const pill_settingSummary = one_term_div
			.selectAll('.ts_summary_btn')
			// bind d.txt to dom, is important in making sure the same text label won't trigger the dom update
			.data(status_msg ? [{ txt: status_msg }] : [], d => d.txt)

		// because of using d.txt of binding data, exitPill cannot be used here as two different labels will create the undesirable effect of two right halves
		pill_settingSummary.exit().remove()

		pill_settingSummary
			.enter()
			.append('div')
			.attr('class', 'ts_summary_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html(d => d.txt)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
	}

	self.exitPill = function() {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback(null)
	}

	self.showTree = async function(holder) {
		self.dom.tip
			.clear()
			.showunder(holder instanceof Element ? holder : this instanceof Element ? this : self.dom.holder.node())
		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: self.dom.tip.d,
			state: {
				vocab: self.opts.vocab,
				activeCohort: self.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					exclude_types: self.exclude_types,
					usecase: self.usecase
				}
			},
			tree: {
				disable_terms: self.disable_terms,
				click_term: term => {
					self.dom.tip.hide()
					const data = { id: term.id, term, q: {} }
					let _term = term
					if (self.opts.use_bins_less && (term.type == 'integer' || term.type == 'float') && term.bins.less) {
						// instructed to use bins.less which is present
						// make a decoy term replacing bins.default with bins.less
						_term = JSON.parse(JSON.stringify(term))
						_term.bins.default = _term.bins.less
					}
					termsetting_fill_q(data.q, _term)
					self.opts.callback(data)
				}
			}
		})
	}

	self.showMenu = () => {
		self.dom.tip.clear().showunder(self.dom.holder.node())
		if (self.opts.showFullMenu) {
			self.showEditReplaceRemoveMenu(self.dom.tip.d)
		} else {
			self.handler.showEditMenu(self.dom.tip.d)
		}
	}

	self.showEditReplaceRemoveMenu = async function(div) {
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.text('Edit')
			.on('click', () => {
				self.dom.tip.clear()
				self.handler.showEditMenu(self.dom.tip.d)
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.text('Replace')
			.on('click', () => {
				self.dom.tip.clear()
				self.showTree()
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}
}

export function termsetting_fill_q(q, term) {
	if (term.type == 'integer' || term.type == 'float') {
		if (!valid_binscheme(q)) {
			/*
			if q is already initiated, do not overwrite
			to be tested if can work with partially declared state
			always copies from .bins.default
			*/

			// rounding and label_offset may have to defined separately within bins.default or bins.less,
			// for now assume that the same values will apply to both bins.default and .less
			if (term.bins.rounding) term.bins.default.rounding = term.bins.rounding
			if (term.bins.label_offset) term.bins.default.label_offset = term.bins.label_offset
			copyMerge(q, term.bins.default)
		}
		set_hiddenvalues(q, term)
		// binconfig.termtype may be used to improve bin labels
		if (!q.termtype) q.termtype = term.type
		return
	}
	if (term.type == 'categorical' || term.type == 'condition') {
		set_hiddenvalues(q, term)
		if (!q.groupsetting) q.groupsetting = {}
		if (term.groupsetting.disabled) {
			q.groupsetting.disabled = true
			return
		}
		delete q.groupsetting.disabled
		if (!('inuse' in q.groupsetting)) q.groupsetting.inuse = false // do not apply by default

		if (term.type == 'condition') {
			/*
			for condition term, must set up bar/value flags before quiting for inuse:false
			*/
			if (q.value_by_max_grade || q.value_by_most_recent || q.value_by_computable_grade) {
				// need any of the three to be set
			} else {
				// set a default one
				q.value_by_max_grade = true
			}
			if (q.bar_by_grade || q.bar_by_children) {
			} else {
				q.bar_by_grade = true
			}
		}

		if (!q.groupsetting.inuse) {
			// inuse:false is either from automatic setup or predefined in state
			// then no need for additional setup
			return
		}
		// if to apply the groupsetting
		if (term.groupsetting.lst && term.groupsetting.useIndex >= 0 && term.groupsetting.lst[term.groupsetting.useIndex]) {
			q.groupsetting.predefined_groupset_idx = term.groupsetting.useIndex
		}
		return
	}
	if (term.type == 'survival') {
		q.type = 'survival'
		return
	}
	throw 'unknown term type'
}

function set_hiddenvalues(q, term) {
	if (!q.hiddenValues) {
		q.hiddenValues = {}
	}
	if (term.values) {
		for (const k in term.values) {
			if (term.values[k].uncomputable) q.hiddenValues[k] = 1
		}
	}
}

function valid_binscheme(q) {
	/*if (q.mode == 'continuous') { console.log(472, q)
		// only expect a few keys for now "mode", "scale", "transform" keys for now
		const supportedKeys = ['mode', 'scale', 'transform']
		const unsupportedKeys = Object.keys(q).filter(key => supportedKeys.includes(key))
		if (unsupportedKeys.length) return false 
		// throw `${JSON.stringify(unsupportedKeys)} not supported for q.mode='continuous'`
		return true
	}*/
	if (q.type == 'custom') {
		if (!Array.isArray(q.lst)) return false
		if (!q.mode) q.mode = 'discrete'
		return true
	}
	if (Number.isFinite(q.bin_size) && q.first_bin) {
		if (!q.mode) q.mode = 'discrete'
		if (q.first_bin.startunbounded) {
			if (Number.isInteger(q.first_bin.stop_percentile) || Number.isFinite(q.first_bin.stop)) {
				return true
			}
		} else {
			if (Number.isInteger(q.first_bin.start_percentile) || Number.isFinite(q.first_bin.start)) {
				return true
			}
		}
	}
	return false
}

function getDefaultHandler(self) {
	return {
		showEditMenu() {},
		get_status_msg() {},
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		}
	}
}

// termWrapper = {id, term?, q?}
// vocabApi
export async function fillTermWrapper(termWrapper, vocabApi) {
	const t = termWrapper
	if (!('id' in t)) {
		if (t.term && 'id' in t.term) t.id = t.term.id
		else throw 'term.id missing'
	}
	if (!t.term) {
		t.term = await vocabApi.getterm(t.id)
	}
	if (!t.q) t.q = {}
	if (!t.varClass) t.varClass = 'term'
	termsetting_fill_q(t.q, t.term)
}
