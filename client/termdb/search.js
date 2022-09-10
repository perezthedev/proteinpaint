import { getCompInit } from '#rx'
import { select, selectAll, event } from 'd3-selection'
import { dofetch3, sayerror } from '#src/client'
import { debounce } from 'debounce'
import { root_ID } from './tree'
import { isUsableTerm } from '#shared/termdb.usecase'
import { nonDictionaryTermTypes } from '#termsetting'

/*
steps:
user input at <input> will call doSearch()
doSearch() lets app dispatch an action, type: search_
but the action will NOT update app state
app notifies all components with the action
only main() of the "search component" will responds to the action to perform querying and display result

opts{}
.holder
.click_term()
.disable_terms[]

TODO
allow to search categories, e.g. hodgkin lymphoma from diaggrp, how to act upon clicking?

 */

class TermSearch {
	constructor(opts) {
		this.type = 'search'
		// currently postSearch is only used for testing
		this.customEvents = ['postSearch']
		// set this.id, .app, .opts, .api
		setRenderers(this)
		setInteractivity(this)
		this.dom = { holder: opts.holder }
	}

	async init() {
		this.state = this.getState(this.app.getState())
		this.initUI()
	}

	reactsTo(action) {
		if (action.type == 'app_refresh') return true
		const prefix = action.type.split('_')[0]
		return ['search', 'cohort', 'submenu'].includes(prefix)
	}

	getState(appState) {
		return {
			isVisible: !appState.submenu.term,
			cohortStr:
				appState.activeCohort == -1 || !appState.termdbConfig.selectCohort
					? ''
					: appState.termdbConfig.selectCohort.values[appState.activeCohort].keys
							.slice()
							.sort()
							.join(','),
			allowedTermTypes: appState.termdbConfig.allowedTermTypes || [],
			expandedTermIds: appState.tree.expandedTermIds,
			selectedTerms: appState.selectedTerms,
			usecase: appState.tree.usecase,
			search: appState.search
		}
	}

	async main() {
		// show/hide search input from the tree
		this.dom.holder.style('display', this.state.isVisible ? 'block' : 'none')
		this.renderSelectedNonDictTerms()
	}

	async doSearch(str) {
		if (!str) {
			this.clear()
			this.bus.emit('postSearch', [])
			return
		}
		const data = await this.app.vocabApi.findTerm(str, this.state.cohortStr, this.state.usecase)
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
		} else {
			// found terms
			this.showTerms(data)
		}
		this.bus.emit('postSearch', data)
	}
}

export const searchInit = getCompInit(TermSearch)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.holder.style('display', self.search && self.search.isVisible == false ? 'none' : 'block')
		const placeholderDetail = self.state.allowedTermTypes.includes('geneVariant') ? ' terms or genes' : '...'
		self.dom.input = self.dom.holder
			.style('text-align', 'left')
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.attr('placeholder', 'Search' + placeholderDetail)
			.style('width', '190px')
			.style('margin', '10px')
			.style('display', 'block')
			.on('input', debounce(self.onInput, 300))

		self.dom.resultDiv = self.opts.resultsHolder ? self.opts.resultsHolder : self.dom.holder.append('div')
		self.dom.resultDiv
			.style('border-left', self.opts.resultsHolder ? '' : 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')

		self.dom.nonDictDiv = self.dom.holder
			.append('div')
			.style('margin', '0px 0px 10px 10px')
			.style('display', 'none')

		self.dom.nonDictDiv
			.append('div')
			.style('font-weight', 600)
			.html('Selected genes')
		self.dom.selectedNonDictDiv = self.dom.nonDictDiv.append('div')
	}
	self.noResult = () => {
		self.clear()
		self.dom.resultDiv
			.append('div')
			.text('No match')
			.style('padding', '3px 3px 3px 0px')
			.style('opacity', 0.5)
	}
	self.showTerms = data => {
		// add disabled terms to opts.disable_terms
		if (self.opts.disable_terms)
			data.lst.forEach(t => {
				if (t.disabled) self.opts.disable_terms.push(t.id)
			})
		self.clear()
		self.dom.resultDiv
			.append('table')
			.selectAll()
			.data(data.lst)
			.enter()
			.append('tr')
			.each(self.showTerm)
	}
	self.showTerm = function(term) {
		const tr = select(this)
		const button = tr.append('td').text(term.name)
		const uses = isUsableTerm(term, self.state.usecase)

		/*
		below, both callbacks are made in app.js validateOpts()
		1. self.opts.click_term() is for selecting to tvs
		2. self.app.opts.tree.click_term_wrapper() is a wrapper for opts.tree.click_term()
		*/
		if ((self.opts.click_term || self.app.opts?.tree?.click_term_wrapper) && uses.has('plot')) {
			// to click a graphable term, show as blue button
			if ('id' in term && self.opts.disable_terms?.includes(term.id)) {
				// but it's disabled
				button
					.attr('class', 'sja_tree_click_term_disabled')
					.style('display', 'block')
					.style('padding', '5px 8px')
					.style('margin', '1px 0px')
					.style('opacity', 0.4)
			} else {
				// clickable button
				button
					.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
					.style('display', 'block')
					.style('color', 'black')
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('background-color', term.type == 'geneVariant' ? 'rgba(251,171,96,0.5)' : '#cfe2f3')
					.style('margin', '1px 0px')
					.style('cursor', 'default')
					.on('click', () => {
						if (self.opts.click_term) {
							self.opts.click_term(term)
						} else {
							self.app.opts.tree.click_term_wrapper(term)
						}
						self.clear()
						self.dom.input.property('value', '')
					})
			}
			//show sample count for a term
			if (term.samplecount !== undefined) {
				tr.append('td')
					.append('div')
					.style('font-size', '.8em')
					.style('display', 'inline-block')
					.style('margin-left', '5px')
					.style('color', term.samplecount ? '#777' : '#ddd')
					.text('n=' + term.samplecount)
			}
		} else {
			// as regular button, click to expand tree
			button.attr('class', 'sja_menuoption').on('click', () => {
				self.clear()
				self.dom.input.property('value', '')
				const expandedTermIds = [root_ID]

				if (term.type == 'geneVariant' && self.opts.handleGeneVariant) {
					self.opts.handleGeneVariant(term)
				} else if (nonDictionaryTermTypes.has(term.type)) {
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							selectedTerms: [...self.state.selectedTerms, term]
						}
					})
				} else {
					if (term.__ancestors) {
						expandedTermIds.push(...term.__ancestors)
					}
					// pre-expand non-selectable parent term
					if (!self.app.vocabApi.graphable(term)) expandedTermIds.push(term.id)
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							tree: { expandedTermIds }
						}
					})
				}
			})
		}
		tr.append('td')
			.text(term.type == 'geneVariant' ? 'gene variant' : (term.__ancestorNames || []).join(' > '))
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}
	self.clear = () => {
		self.dom.resultDiv.selectAll('*').remove()
	}
	self.renderSelectedNonDictTerms = function() {
		const lst = self.state.selectedTerms.filter(t => nonDictionaryTermTypes.has(t.type))
		self.dom.nonDictDiv.style('display', lst.length ? '' : 'none')

		const genes = self.dom.selectedNonDictDiv.selectAll('div').data(lst, d => d.name)

		genes.exit().remove()
		genes
			.enter()
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '1px')
			.style('padding', '5px 8px')
			.style('background-color', 'rgba(255, 194, 10,0.5)')
			.style('border-radius', '6px')
			.html(d => d.name)
		/*.each(function(){
				const div = select(this)
				div.append('')
			})*/
	}
}

function setInteractivity(self) {
	self.onInput = async () => {
		const str = self.dom.input.property('value')
		// do not trim space from input so that 'age ' will not match with 'agent'
		try {
			//await self.main({ str })
			await self.doSearch(str)
		} catch (e) {
			self.clear()
			sayerror(self.dom.resultDiv, 'Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}
}
