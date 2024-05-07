import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { filterInit, getNormalRoot, filterPromptInit, getFilterItemByTag } from '#filter/filter'
import { appInit } from '#termdb/app'
import { renderTable } from '../dom/table.ts'
import { getSamplelstTW } from '../termsetting/handlers/samplelst.ts'
import { get$id } from '#termsetting'
import { getActiveCohortStr } from './charts'
import { getColors } from '#shared/common'
import { rgb } from 'd3-color'

/*
this
	app
		vocabApi
		opts
			genome{}
			state
				vocab{}
	state {}
		groups []
			group.name=str
			group.filter={}
		termfilter{}
			filter{}
		termdbConfig{}
*/
const colorScale = getColors(5)
class MassGroups {
	constructor(opts = {}) {
		this.type = 'groups'
		this.selectedGroupsIdx = new Set() // set of array index for this.state.groups[], for those selected in table ui
	}

	async init() {
		this.dom = {
			holder: this.opts.holder.append('div').style('margin', '10px')
		}
		initUI(this)
		this.tip = new Menu({ padding: '0px' })
	}

	getState(appState) {
		const cohortKey = getActiveCohortStr(appState)
		const state = {
			termfilter: appState.termfilter,
			groups: rebaseGroupFilter(appState),
			termdbConfig: appState.termdbConfig,
			customTerms: appState.customTerms,
			supportedChartTypes: appState.termdbConfig.supportedChartTypes[cohortKey],
			matrixplots: appState.termdbConfig.matrixplots
		}
		return state
	}

	async main() {
		await updateUI(this)
	}

	//////////////// rest are app-specific logic

	getMassFilter() {
		if (!this.state.termfilter.filter || this.state.termfilter.filter.lst.length == 0) {
			return { type: 'tvslst', in: true, join: '', lst: [] }
		}
		const f = getNormalRoot(structuredClone(this.state.termfilter.filter)) // strip tag
		return f
	}

	async groups2samplelst(groups) {
		const samplelstGroups = []
		const processedSamples = new Set(),
			overlap = []
		for (const g of groups) {
			const samples = await this.app.vocabApi.getFilteredSampleCount(g.filter, 'list')
			const items = []
			for (const sample of samples) {
				const item = { sampleId: sample.id }
				if ('name' in sample) {
					item.sample = sample.name
				}
				//items.push(item)
				if (!processedSamples.has(sample.id)) items.push(item)
				else {
					for (const pg of samplelstGroups) {
						//if (pg.name === g.name) continue
						const i = pg.items.findIndex(i => i.sampleId === sample.id)
						if (i !== -1) overlap.push(...pg.items.splice(i, 1))
					}
				}
				processedSamples.add(item.sampleId)
			}
			if (items.length) samplelstGroups.push({ name: g.name, items, color: g.color })
		}

		if (overlap.length) {
			const ok = confirm(
				'Overlap detected: 1 or more samples belong to >1 groups. A new group will be created for these "overlap" samples.'
			)
			if (!ok) return
			samplelstGroups.push({ name: 'Group overlap', items: overlap })
		}

		const name = samplelstGroups.length == 1 ? samplelstGroups[0].name : 'Sample groups'
		const tw = getSamplelstTW(samplelstGroups, name)

		// TEMP change, to be done elsewhere e.g. in getSamplelstTW()
		for (const g of tw.q.groups) {
			tw.term.values[g.name].list = g.values
			tw.term.values[g.name].inuse = g.inuse
		}

		return tw
	}

	updateLaunchButton() {
		// turn both off by default; selectively turn on
		this.dom.newTermSpan.style('display', 'none')
		this.dom.noGroupSelected.style('display', 'none')

		if (this.state.groups.length == 0) return // no groups

		if (this.state.groups.length == 1) {
			// only one group present, launch button is always on to work on this group
			this.dom.newTermSpan.style('display', '')
			this.dom.launchButton.text(`Create variable using "${this.state.groups[0].name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[0].name + ' vs others')
			return
		}

		// 2 or more groups, button is based on the number of selected groups
		const lst = [...this.selectedGroupsIdx]
		if (lst.length == 0) {
			// none selected
			this.dom.noGroupSelected.style('display', '')
			return
		}
		// at least 1 selected, display button
		this.dom.newTermSpan.style('display', '')
		if (lst.length == 1) {
			// only 1 selected
			this.dom.launchButton.text(`Create  variable using "${this.state.groups[lst[0]]?.name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[lst[0]].name + ' vs others')
			return
		}
		this.dom.launchButton.text(`Create variable using ${lst.length} groups`)
		this.dom.newTermNameInput.property('value', lst.map(i => this.state.groups[i].name).join(' vs '))
	}

	displayCustomTerms() {
		this.dom.customTermDiv.selectAll('*').remove()
		if (this.state.customTerms.length == 0) {
			this.dom.customTermDiv
				.append('div')
				.text('No custom variables. Use above controls to create new ones. Custom variables are added to dictionary.')
				.style('font-size', '.8em')
			return
		}
		this.dom.customTermDiv
			.append('div')
			.style('margin-bottom', '10px')
			.style('font-size', '.8em')
			.text('Following custom variables are available in all charts where variables are used. Click one to delete.')
		for (const { name, tw } of this.state.customTerms) {
			const div = this.dom.customTermDiv.append('div')
			div
				.text(name)
				.attr('class', 'sja_filter_tag_btn')
				.style('padding', '3px 6px')
				.style('border-radius', '6px')
				.style('margin-right', '5px')
				.on('click', event => {
					const deleteCallback = () => this.app.vocabApi.deleteCustomTerm(name)
					this.showGroupsMenu(event, tw, deleteCallback)
				})
		}
	}

	newId() {
		this.lastId = get$id()
		return this.lastId
	}

	showGroupsMenu(event, tw, deleteCallback) {
		const samplelstTW = JSON.parse(JSON.stringify(tw))
		this.tip.clear()
		const menuDiv = this.tip.d.append('div')
		const id = this?.lastId
		let row = menuDiv.append('div')

		addMatrixMenuItems(this.tip, menuDiv, samplelstTW, this.app, id, this.state, () => this.newId)
		if (this.state.supportedChartTypes.includes('DEanalysis') && samplelstTW.q.groups.length == 2)
			addDEPlotMenuItem(menuDiv, this, this.state, samplelstTW)

		if (this.state.supportedChartTypes.includes('survival'))
			addPlotMenuItem('survival', menuDiv, 'Compare survival', this.tip, samplelstTW, id, this, true)

		if (this.state.supportedChartTypes.includes('cuminc'))
			addPlotMenuItem('cuminc', menuDiv, 'Compare cumulative incidence', this.tip, samplelstTW, id, this, true)

		const summarizeDiv = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border').html('Summarize')
		summarizeDiv.insert('div').html('›').style('float', 'right')

		summarizeDiv.on('click', async e => {
			showTermsTree(
				summarizeDiv,
				term => {
					openSummaryPlot(term, samplelstTW, this.app, id, () => this.newId)
				},
				this.app,
				this.tip
			)
		})
		row = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete variable')
			.on('click', event => {
				deleteCallback()
				this.tip.hide()
			})

		this.tip.showunder(event.target)
	}
}

export const groupsInit = getCompInit(MassGroups)

function addDEPlotMenuItem(div, self, state, samplelstTW, tip) {
	div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Differential expression')
		.on('click', e => {
			const groups = []
			for (const group of samplelstTW.q.groups) {
				if (group.values && group.values.length > 0) {
					groups.push(group)
				} else {
					throw 'group does not contain samples for DE analysis'
				}
			}
			const config = {
				chartType: 'DEanalysis',
				state,
				samplelst: { groups }
			}
			self.tip.hide()
			self.app.dispatch({
				type: 'plot_create',
				config
			})
		})
}

function initUI(self) {
	self.dom.filterTableDiv = self.dom.holder.append('div').style('margin-bottom', '10px')

	// row of buttons
	const btnRow = self.dom.holder.append('div')

	// btn 1: prompt to add new group
	self.dom.addNewGroupBtnHolder = btnRow.append('span').style('margin-right', '20px')

	// btn 2: patch of controls to create new term
	self.dom.newTermSpan = btnRow.append('span') // contains "create button" and <input>, so they can toggle on/off together
	self.dom.newTermSpan.append('span').style('padding-left', '15px').text('Add variable:')
	self.dom.newTermNameInput = self.dom.newTermSpan.append('input').attr('type', 'text')

	self.dom.launchButton = self.dom.newTermSpan
		.append('span')
		.attr('class', 'sja_menuoption')
		.on('click', () => clickLaunchBtn(self))

	// msg: none selected
	self.dom.noGroupSelected = btnRow.append('span').text('No groups selected').style('opacity', 0.5)

	// bottom box to list custom terms
	self.dom.customTermDiv = self.dom.holder
		.append('div')
		.style('margin', '20px')
		.style('border-left', 'solid 1px black')
		.style('padding', '10px')

	self.dom.holder.on('click', event => {
		if (tip2) tip2.hide()
	})
}

async function updateUI(self) {
	// prompt button is an instance to a blank filter, can only make the button after state is filled
	// but not in instance.init()

	// create "Add new group" button as needed
	if (!self.filterPrompt)
		self.filterPrompt = await filterPromptInit({
			holder: self.dom.addNewGroupBtnHolder,
			vocab: self.app.opts.state.vocab,
			emptyLabel: 'Add group',
			termdbConfig: self.state.termdbConfig,
			callback: f => {
				addNewGroup(self.app, f, groups)
			},
			debug: self.opts.debug
		})
	// filterPrompt.main() always empties the filterUiRoot data
	self.filterPrompt.main(self.getMassFilter()) // provide mass filter to limit the term tree

	// duplicate groups[] array to mutate and add to action.state for dispatching
	const groups = structuredClone(self.state.groups)

	if (!groups.length) {
		// no groups, do not show launch button, hide table
		self.updateLaunchButton()
		self.dom.filterTableDiv.style('display', 'none')
		self.displayCustomTerms()
		return
	}

	// clear table and populate rows
	self.dom.filterTableDiv.style('display', '').selectAll('*').remove()

	const tableArg = {
		div: self.dom.filterTableDiv,
		columns: [
			{
				label: 'NAME',
				editCallback: async (i, cell) => {
					const newName = cell.value
					const index = self.state.groups.findIndex(group => group.name == newName)
					if (index != -1) {
						alert(`Group named ${newName} already exists`)
						updateUI(self)
					} else
						await self.app.dispatch({
							type: 'rename_group',
							index: i,
							newName: cell.value
						})
				}
			},
			{
				label: 'COLOR',
				editCallback: async (i, cell) => {
					await self.app.dispatch({
						type: 'change_color_group',
						index: i,
						newColor: cell.color
					})
				}
			},
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
		],
		columnButtons: [
			{
				text: 'Delete',
				callback: (e, i) => {
					const group = groups[i]
					self.app.vocabApi.deleteGroup(group.name)
				}
			}
		],
		rows: []
	}
	for (const g of groups) {
		tableArg.rows.push([
			{ value: g.name }, // to allow click to show <input>
			{ color: g.color },
			{ value: 'n=' + (await self.app.vocabApi.getFilteredSampleCount(g.filter)) },
			{} // blank cell to show filter ui
		])
	}

	// clear existing selected groups
	self.selectedGroupsIdx.clear()

	if (groups.length == 1) {
		// only one group, add index 0
		self.selectedGroupsIdx.add(0)
	} else {
		// more than 1 group, show checkboxes for each row
		tableArg.noButtonCallback = (i, node) => {
			if (node.checked) self.selectedGroupsIdx.add(i)
			else self.selectedGroupsIdx.delete(i)
			self.updateLaunchButton() // update button text, based on how many groups are selected
		}
		//
		tableArg.selectedRows = []
		for (let i = 0; i < groups.length; i++) {
			tableArg.selectedRows.push(i) // check all rows by default
			self.selectedGroupsIdx.add(i)
		}
	}

	renderTable(tableArg)
	for (const [i, row] of tableArg.rows.entries()) {
		const group = groups[i]
		filterInit({
			holder: row[3].__td,
			vocabApi: self.app.vocabApi,
			termdbConfig: self.state.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = groups.findIndex(g => g.name == group.name)
					groups.splice(i, 1)
				} else {
					// update filter
					group.filter = f
				}
				self.app.dispatch({
					type: 'app_refresh',
					state: { groups }
				})
			}
		}).main(group.filter)
	}

	self.updateLaunchButton()

	self.displayCustomTerms()
}

async function clickLaunchBtn(self) {
	// click button to create samplelst tw
	// collect groups in use
	const groups = []
	for (const i of self.selectedGroupsIdx) {
		const g = self.state.groups[i]
		if (g) groups.push(g)
	}

	if (groups.length == 0) throw 'No groups, should not happen'

	const name = self.dom.newTermNameInput.property('value')

	// 1 or more groups are in use, generate samplelst tw and save it to state
	const tw = await self.groups2samplelst(groups)
	if (!tw) return
	tw.term.name = name
	self.app.vocabApi.addCustomTerm({ name, tw })

	self.dom.newTermSpan.style('display', 'none')
}

/*
s = {groups[ {filter} ], termfilter{filter} }
termfilter is mass global filter
if provided, need to "rebase" group's visible filter to it
a group filter contains the shadowy global filter from previous state. when new state is provided, need to replace it
*/
export function rebaseGroupFilter(s) {
	if (!s.termfilter?.filter || s.termfilter.filter.lst.length == 0) {
		// blank filter
		return s.groups
	}
	const groups = [] // new groups
	for (const g of s.groups) {
		const f = getNormalRoot(structuredClone(s.termfilter.filter))
		const f2 = getFilterItemByTag(g.filter, 'filterUiRoot')
		if (!f2) {
			//console.log('filterUiRoot not found')
			groups.push(g)
			continue
		}
		f.lst.push(f2)
		f.join = f.lst.length > 1 ? 'and' : ''
		const g2 = {
			name: g.name,
			filter: f,
			color: g.color
		}
		groups.push(g2)
	}
	return groups
}

export async function openPlot(chartType, term, term2, app, id, newId) {
	let config = {
		chartType,
		term,
		term2
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

export async function openSummaryPlot(term, samplelstTW, app, id, newId) {
	// barchart config.term{} name is confusing, as it is actually a termsetting object, not term
	// thus convert the given term into a termwrapper
	// tw.q can be missing and will be filled in with default setting
	const tw = term.term ? term : { id: term.id, term }

	let config = {
		chartType: 'summary',
		childType: 'barchart',
		term: tw,
		term2: samplelstTW
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}
let tip2 // tip 2 is used for showing the terms tree, which is a submenu of the main tip, created here for reuse
export async function showTermsTree(
	div,
	callback,
	app,
	tip,
	state = { tree: { usecase: { target: 'default', detail: 'term' } } },
	closeParent = true,
	shift = true,
	disable_terms = []
) {
	if (!tip2) tip2 = new Menu({ padding: 0, offsetX: 162, offsetY: -34, parent_menu: tip.d.node() })
	tip2.clear()
	if (shift) tip2.showunderoffset(div.node())
	else tip2.showunder(div.node())
	appInit({
		holder: tip2.d,
		vocabApi: app.vocabApi,
		state,
		tree: {
			disable_terms,
			click_term: term => {
				callback(term)
				tip2.hide()
				if (closeParent) tip.hide()
			}
		}
	})
}
export function addPlotMenuItem(chartType, div, text, tip, samplelstTW, id, parent, openOnTop = false) {
	const itemDiv = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		//.html('Compare survival&nbsp;&nbsp;›')
		.html(`${text}&nbsp;&nbsp;›`)
		.on('click', e => {
			const state = { tree: { usecase: { target: chartType, detail: 'term' } } }
			if (chartType == 'survival') state.nav = { header_mode: 'hide_search' }
			showTermsTree(
				itemDiv,
				term => {
					openPlot(chartType, term, samplelstTW, parent.app, id, openOnTop ? () => parent.newId : null)
				},
				parent.app,
				tip,
				state
			)
		})
}

export function addMatrixMenuItems(menu, menuDiv, tw, app, id, state, newId) {
	if (state.matrixplots) {
		for (const plot of state.matrixplots) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', async () => {
					const config = await app.vocabApi.getMatrixByName(plot.name)
					config.divideBy = tw
					config.insertBefore = id
					config.settings.matrix.colw = 0
					if (newId) config.id = newId()

					app.dispatch({
						type: 'plot_create',
						config
					})
					menu.hide()
				})
		}
	}
}

export function addNewGroup(app, filter, groups) {
	groups = JSON.parse(JSON.stringify(groups))
	let name = 'New group'
	let i = 0
	while (1) {
		const name2 = name + (i == 0 ? '' : ' ' + i)
		if (!groups.find(g => g.name == name2)) break
		i++
	}
	name = name + (i == 0 ? '' : ' ' + i)
	const newGroup = {
		name,
		filter,
		color: rgb(colorScale(groups.length)).formatHex()
	}
	groups.push(newGroup)
	app.dispatch({
		type: 'app_refresh',
		state: { groups }
	})
}
