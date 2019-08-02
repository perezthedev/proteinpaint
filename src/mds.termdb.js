import * as client from './client'
import * as common from './common'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init as plot_init} from './mds.termdb.plot'
import {validate_termvaluesetting} from './mds.termdb.termvaluesetting'
import * as termvaluesettingui from './mds.termdb.termvaluesetting.ui'
import { debounce } from 'debounce'


/*

init() accepts following triggers:
- show term tree starting with default terms, at terms show graph buttons
- show term tree, for selecting a term (what are selectable?), no graph buttons

init accepts obj{}
.genome{}
.mds{}
.div


triggers
obj.default_rootterm{}


modifiers, for modifying the behavior/display of the term tree
attach to obj{}
** modifier_click_term
	when this is provided, will allow selecting terms, do not show graph buttons
** modifier_ssid_barchart
** modifier_barchart_selectbar






********************** EXPORTED
init()
menuoption_add_filter
menuoption_select_to_gp
menuoption_select_group_add_to_cart
********************** INTERNAL
show_default_rootterm
	display_searchbox
	may_display_termfilter
	print_one_term
		print_term_name
		may_make_term_foldbutton
		may_apply_modifier_click_term
		may_apply_modifier_barchart_selectbar
		may_make_term_graphbuttons
			term_addbutton_barchart
				make_barplot
*/





const tree_indent = '30px',
	label_padding = '5px 3px 5px 1px',
	graph_leftpad = '0px',
	button_radius = '5px'


export async function init ( obj ) {
/*
obj{}:
.genome {}
.mds{}
.div
.default_rootterm{}
... modifiers
*/
	if( obj.debugmode ) window.obj = obj

	obj.dom = {
		div: obj.div
	}
	delete obj.div
	obj.dom.errdiv = obj.dom.div.append('div')
	obj.dom.searchdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.termfilterdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.cartdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.treediv = obj.dom.div.append('div')
		.append('div')
		.style('display','inline-block')
		.append('div')
	obj.tip = new client.Menu({padding:'5px'})
	// simplified query
	obj.do_query = (args) => {
		const lst = [ 'genome='+obj.genome.name+'&dslabel='+obj.mds.label ]
		// maybe no need to provide term filter at this query
		return client.dofetch2( '/termdb?'+lst.join('&')+'&'+args.join('&') )
	}
	obj.showtree4selectterm = ( termidlst, button, callback ) => {
		// convenient function to be called in barchart config panel for selecting term2
		obj.tip.clear()
			.showunder( button )
		const obj2 = {
			genome: obj.genome,
			mds: obj.mds,
			div: obj.tip.d.append('div'),
			default_rootterm: {},
			modifier_click_term: {
				disable_terms: new Set( termidlst ),
				callback,
			}
		}
		init(obj2)
	}

	try {
		if(!obj.genome) throw '.genome{} missing'
		if(!obj.mds) throw '.mds{} missing'

		// handle triggers

		if( obj.default_rootterm ) {
			await show_default_rootterm( obj )
			restore_view(obj)
			return
		}

		// to allow other triggers
	} catch(e) {
		obj.dom.errdiv.text('Error: '+ (e.message||e) )
		if(e.stack) console.log(e.stack)
		return
	}
}



async function show_default_rootterm ( obj ) {
/* for showing default terms, as defined by ds config

also for showing term tree, allowing to select certain terms

*/

	display_searchbox( obj )

	may_display_termfilter( obj )

	update_cart_button(obj)

	const data = await obj.do_query(["default_rootterm=1"])
	if(data.error) throw 'error getting default root terms: '+data.error
	if(!data.lst) throw 'no default root term: .lst missing'

	// show root nodes

	for(const i of data.lst) {
		const arg = {
			row: obj.dom.treediv.append('div'),
			term: i,
		}
		print_one_term( arg, obj )
	}
}




function may_display_termfilter( obj ) {
/* when the ui is not displayed, will not allow altering filters and callback-updating
*/

	if(obj.termfilter && obj.termfilter.terms) {
		if(!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
		validate_termvaluesetting( obj.termfilter.terms )
	}

	if( !obj.termfilter || !obj.termfilter.show_top_ui ) {
		// do not display ui, and do not collect callbacks
		return
	}

	obj.termfilter.callbacks = []
	if(!obj.termfilter.terms) obj.termfilter.terms = []

	// make ui
	make_filter_ui(obj)
}


function update_cart_button(obj){
	
	if(!obj.selected_groups) return

	if(obj.selected_groups.length > 0){

		obj.groupCallbacks = []
		
		// selected group button
		obj.dom.cartdiv
			.style('display','inline-block')
			.attr('class','sja_filter_tag_btn')
			.style('padding','6px')
			.style('margin','0px 10px')
			.style('border-radius', button_radius)
			.style('background-color','#00AB66')
			.style('color','#fff')
			.text('Selected '+ obj.selected_groups.length +' Group' + (obj.selected_groups.length > 1 ?'s':''))
			.on('click',()=>{
				const tip = new client.Menu({padding:'0'})
				make_selected_group_tip(tip)
			})
	}else{
		obj.dom.cartdiv
			.style('display','none')
	}

	function make_selected_group_tip(tip){

		// const tip = obj.tip // not working, creating new tip
		tip.clear()
		tip.showunder( obj.dom.cartdiv.node() )

		const table = tip.d.append('table')
			.style('border-spacing','5px')
			.style('border-collapse','separate')

		// one row for each group
		for( const [i, group] of obj.selected_groups.entries() ) {
		
			const tr = table.append('tr')
			const td1 = tr.append('td')

			td1.append('div')
				.attr('class','sja_filter_tag_btn')
				.text('Group '+(i+1))
				.style('white-space','nowrap')
				.style('color','#000')
				.style('padding','6px')
				.style('margin','3px 5px')
				.style('font-size','.7em')
				.style('text-transform','uppercase')
				
			group.dom = {
				td2: tr.append('td'),
				td3: tr.append('td').style('opacity',.5).style('font-size','.8em'),
				td4: tr.append('td')
			}
			
			termvaluesettingui.display(
				group.dom.td2, 
				group, 
				obj.mds, 
				obj.genome, 
				false,
				// callback when updating the groups
				() => {
					for(const fxn of obj.groupCallbacks) {
							fxn()
					}
				}
			)
			
			// TODO : update 'n=' by group selection 
			// group.dom.td3.append('div')
			//  .text('n=?, view stats')

			// 'X' button to remove gorup
			group.dom.td4.append('div')
				.attr('class','sja_filter_tag_btn')
				.style('padding','2px 6px 2px 6px')
				.style('display','inline-block')
				.style('margin-left','7px')
				.style('border-radius','6px')
				.style('background-color','#fa5e5b')
				.html('&#215;') 
				.on('click',()=>{
					
					// remove group and update tip and button
					obj.selected_groups.splice(i,1)
					
					if(obj.selected_groups.length == 0){
						obj.dom.cartdiv.style('display','none')
						tip.hide()
					}
					else{
						make_selected_group_tip(tip)
						update_cart_button(obj)
					}
				})
		}

		if(obj.selected_groups.length > 1){
			
			const tr_gp = table.append('tr')
			const td_gp = tr_gp.append('td')
				.attr('colspan',4)
				.attr('align','center')
				.style('padding','0')

			td_gp.append('div')
				.attr('class','sja_filter_tag_btn')
				.style('display','inline-block')
				.style('height','100%')
				.style('width','96%')
				.style('padding','4px 10px')
				.style('margin-top','10px')
				.style('border-radius','3px')
				.style('background-color','#eee')
				.style('color','#000')
				.text('Perform Association Test in GenomePaint')
				.style('font-size','.8em')
				.on('click',()=>{
					tip.hide()
					const pane = client.newpane({x:100,y:100})
					import('./block').then(_=>{
						new _.Block({
							hostURL:localStorage.getItem('hostURL'),
							holder: pane.body,
							genome:obj.genome,
							nobox:true,
							chr: obj.genome.defaultcoord.chr,
							start: obj.genome.defaultcoord.start,
							stop: obj.genome.defaultcoord.stop,
							nativetracks:[ obj.genome.tracks.find(i=>i.__isgene).name.toLowerCase() ],
							tklst:[ {
								type:client.tkt.mds2,
								dslabel:obj.dslabel,
								vcf:{ numerical_axis:{ AFtest:{ groups: obj.selected_groups} } }
							} ]
						})
					})
				})
		}
	}
}


function print_one_term ( arg, obj ) {
/* print a term, in the term tree
for non-leaf term, show the expand/fold button
upon clicking button, to retrieve children and make recursive call to render children

arg{}
.row <DIV>
.term{}
.flicker

and deal with modifiers
try to keep the logic clear
*/

	const term = arg.term

	/* a row for:
	[+] [term name] [graph button]
	*/
	const row = arg.row.append('div')
		.attr('class','sja_tr2')
	// another under row, for adding graphs
	const row_graph = arg.row.append('div')

	// if [+] button is created, will add another row under row for showing children
	may_make_term_foldbutton( arg, row, obj )

	// if be able to apply these modifiers, can just exist and not doing anything else
	if( may_apply_modifier_click_term( obj, term, row ) ) return

	print_term_name( row, arg, term )

	if( may_apply_modifier_barchart_selectbar( obj, term, row, row_graph ) ) return


	// term function buttons, including barchart, and cross-tabulate

	may_make_term_graphbuttons( term, row, row_graph, obj )
}




function print_term_name ( row, arg, term ) {
	// term name
	const label = row
		.append('div')
		.style('display','inline-block')
		.style('padding', label_padding)
		.text( term.name )
	if(arg && arg.flicker) {
		label.style('background-color','yellow')
			.transition()
			.duration(4000)
			.style('background-color','transparent')
	}
	return label
}



function may_apply_modifier_barchart_selectbar ( obj, term, row, row_graph ) {
	if(!obj.modifier_barchart_selectbar) return false
	if(!term.graph || !term.graph.barchart) {
		// no chart, this term is not clickable
		return true
	}
	term_addbutton_barchart ( term, row, row_graph, obj )
	return true
}



function may_apply_modifier_click_term ( obj, term, row ) {
	if( !obj.modifier_click_term ) return false
	/*
	a modifier to be applied to namebox
	for clicking box and collect this term and done
	will not show any other buttons
	*/

	const namebox = print_term_name( row, null, term )

	if( obj.modifier_click_term.disable_terms && obj.modifier_click_term.disable_terms.has( term.id ) ) {

		// this term is disabled, no clicking
		namebox.style('opacity','.5')

	} else if(term.graph) {

		// enable clicking this term
		namebox
			.style('padding-left','8px')
			.style('padding-right','8px')
			.attr('class', 'sja_menuoption')
			.style('border-radius', button_radius)
			.on('click',()=>{
				obj.modifier_click_term.callback( term )
			})
	}
	return true
}



function may_make_term_graphbuttons ( term, row, row_graph, obj ) {
/*
if term.graph{} is there, make a button to trigger it
allow to make multiple buttons
*/
	if(!term.graph) {
		// no graph
		return
	}


	if(term.graph.barchart) {
		term_addbutton_barchart( term, row, row_graph, obj )
	}


	// to add other graph types
}






function term_addbutton_barchart ( term, row, row_graph, obj ) {
/*
click button to launch barchart for a term

there may be other conditions to apply, e.g. patients carrying alt alleles of a variant
such conditions may be carried by obj

*/
	const button_div = row.append('div')
		.style('display','inline-block')

	const button = button_div.append('div')
		.style('font-size','.8em')
		.style('margin-left','20px')
		.style('display','inline-block')
		.style('border-radius',button_radius)
		.attr('class','sja_menuoption')
		.text('VIEW')

	const view_btn_line = button_div.append('div')
		.style('height','10px')
		.style('margin-left','45px')
		.style('border-left','solid 1px #aaa')
		.style('display','none')

	const div = row_graph.append('div')
		.style('border','solid 1px #aaa')
		.style('margin-bottom','10px')
		.style('display','none')

	const plot_loading_div = div.append('div')
		.style('padding','10px')
		.text('Loading...')
		.style('text-align','center')

	let loaded =false,
		loading=false

	button.on('click', async ()=>{
		if(div.style('display') == 'none') {
			client.appear(div, 'inline-block')
			view_btn_line.style('display','block')
		} else {
			client.disappear(div)
			view_btn_line.style('display','none')
		}
		if( loaded || loading ) return
		button.style('border','solid 1px #aaa')
		loading=true
		make_barplot( obj, term, div, ()=> {
			plot_loading_div.remove()
			loaded=true
			loading=false
		})
	})
}





function make_barplot ( obj, term, div, callback ) {
	// make barchart
	const plot = {
		obj,
		holder: div,
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		term: term
	}

	if( obj.modifier_ssid_barchart ) {
		const g2c = {}
		for(const k in obj.modifier_ssid_barchart.groups) {
			g2c[ k ] = obj.modifier_ssid_barchart.groups[k].color
		}
		plot.mutation_lst = [
			{
				chr: obj.modifier_ssid_barchart.chr,
				mutation_name: obj.modifier_ssid_barchart.mutation_name,
				ssid: obj.modifier_ssid_barchart.ssid,
				genotype2color: g2c
			}
		]
		plot.overlay_with_genotype_idx = 0
	}
	plot_init( plot, callback )
}









function may_make_term_foldbutton ( arg, buttonholder, obj ) {
/*
may show expand/fold button for a term
modifiers available from arg also needs to be propagated to children

arg{}
	.term
	.row
		the parent of buttonholder for creating the div for children terms
	possible modifiers

buttonholder: div in which to show the button, term label is also in it
*/

	if(arg.term.isleaf) {
		// is leaf term, no button
		return
	}

	let children_loaded = false, // whether this term has children loaded already
		isloading = false

	// row to display children terms
	const childrenrow = arg.row.append('div')
		.style('display','none')
		.style('padding-left', tree_indent)

	const button = buttonholder.append('div')
		.style('display','inline-block')
		.style('font-family','courier')
		.attr('class','sja_menuoption')
		.text('+')

	button.on('click',()=>{

		if(childrenrow.style('display') === 'none') {
			client.appear(childrenrow)
			button.text('-')
		} else {
			client.disappear(childrenrow)
			button.text('+')
		}

		if( children_loaded ) return

		// to load children terms, should run only once
		const wait = childrenrow.append('div')
			.text('Loading...')
			.style('opacity',.5)
			.style('margin','3px 0px')

		const param = [ 'get_children=1&tid='+arg.term.id ] // not adding ssid here
		obj.do_query( param )
		.then(data=>{
			if(data.error) throw data.error
			if(!data.lst || data.lst.length===0) throw 'error getting children'
			wait.remove()
			// got children
			for(const cterm of data.lst) {
				print_one_term(
					{
						term: cterm,
						row: childrenrow,
					},
					obj
				)
			}
		})
		.catch(e=>{
			wait
				.text( e.message || e)
				.style('color','red')
			if(e.stack) console.log(e.stack)
		})
		.then( ()=>{
			children_loaded = true
			client.appear( childrenrow )
			button.text('-')
		})
	})
}







function display_searchbox ( obj ) {
/* show search box at top of tree
display list of matching terms in-place below <input>
term view shows barchart
barchart is shown in-place under term and in full capacity
*/
	const div = obj.dom.searchdiv
		.style('display','block')
		.append('div')
		.style('display','inline-block')
	const input = div
		.append('input')
		.attr('type','search')
		.attr('class','tree_search')
		.style('width','100px')
		.style('display','block')
		.attr('placeholder','Search')
	input.node().focus() // always focus

	const table = div
		.append('div')
		.style('border-left','solid 1px #85B6E1')
		.style('margin','2px 0px 10px 10px')
		.style('padding-left','10px')
		.append('table')
		.style('border-spacing','0px')
		.style('border-collapse','separate')

	input.on('input', debounce(tree_search, 300 ))

	// helpers
	function searchresult2clickterm ( lst ) {
		for(const term of lst) {
			const div = table.append('tr')
				.append('td')
				.append('div')
				.text(term.name)
			if( term.graph ) {
				// only allow selecting for graph-enabled ones
				div.attr('class','sja_menuoption')
					.style('margin','1px 0px 0px 0px')
					.style('border-radius',button_radius)
					.on('click',()=> {
						obj.modifier_click_term.callback( term )
					})
			} else {
				div.style('padding','5px 10px')
				.style('opacity',.5)
			}
		}
	}
	function makeviewbutton ( term, td ) {
		const tr_hidden = table.append('tr')
			.style('display','none')
		let loading=false,
			loaded =false
		const viewbutton = td.append('div') // view button
			.style('display','inline-block')
			.attr('class','sja_menuoption')
			.style('zoom','.8')
			.style('margin-right','10px')
			.text('VIEW')
		viewbutton.on('click',()=>{
			if( tr_hidden.style('display')=='none' ) {
				tr_hidden.style('display','table-row')
			} else {
				tr_hidden.style('display','none')
			}
			if(loaded || loading) return
			viewbutton.text('Loading...')
			loading=true
			const div = tr_hidden.append('td')
				.attr('colspan',3)
				.append('div')
				.style('border-left','solid 1px #aaa')
				.style('margin-left',graph_leftpad)
			make_barplot( obj, term, div, ()=>{
				loading=false
				loaded=true
				viewbutton.text('VIEW')
			})
		})
	}
	function maketreebutton ( term, td ) {
		const span = td.append('span')
			.style('font-size','.8em')
			.attr('class','sja_clbtext')
			.text('TREE')
		span.on('click', async ()=>{
			span.text('Loading...')
			const data = await obj.do_query(['treeto='+term.id])
			if(!data.levels) throw 'levels[] missing'
			table.selectAll('*').remove()
			obj.dom.treediv.selectAll('*').remove()
			let currdiv = obj.dom.treediv
			for(const [i,level] of data.levels.entries()) {
				let nextdiv
				for(const term of level.terms) {
					const row = currdiv.append('div')
					if(term.id == level.focusid) {
						// term under focus
						if(i==data.levels.length-1) {
							// last level
							print_one_term( {term,row,flicker:true}, obj )
						} else {
							// before last level, manually print it
							const row2 = row.append('div')
							const row_graph = row.append('div')
							row2.attr('class','sja_tr2')
							row2.append('div') // button
								.style('display','inline-block')
								.style('font-family','courier')
								.attr('class','sja_menuoption')
								.text('-')
								.on('click',()=>{
									const toshow = nextdiv.style('display')=='none'
									d3event.target.innerHTML = toshow ? '-' : '+'
									nextdiv.style('display', toshow ? 'block' : 'none')
								})
							print_term_name( row2, null, term )

							if( may_apply_modifier_barchart_selectbar( obj, term, row2, row_graph ) ) {
							} else {
								may_make_term_graphbuttons( term, row2, row_graph, obj )
							}

							nextdiv = currdiv.append('div')
								.style('padding-left',tree_indent)
						}
					} else {
						// a sibling
						print_one_term( {term,row}, obj )
					}
				}
				currdiv = nextdiv
			}
		})
	}

	async function tree_search(){

		table.selectAll('*').remove()

		const str = input.property('value')
		// do not trim space from input, so that 'age ' will be able to match with 'age at..' but not 'agedx'

		if( str==' ' || str=='' ) {
			// blank
			return
		}
		try {
			// query
			const data = await obj.do_query( ['findterm='+str] )
			if(data.error) throw data.error
			if(!data.lst || data.lst.length==0) throw 'No match'

			if( obj.modifier_click_term ) {
				searchresult2clickterm( data.lst )
				return
			}

			// show full terms with graph/tree buttons
			for(const term of data.lst) {
				const tr = table.append('tr')
					.attr('class','sja_tr2')
				tr.append('td')
					.style('opacity','.6')
					.text(term.name)
				const td = tr.append('td') // holder for buttons
					.style('text-align','right')
				if( term.graph && term.graph.barchart ) {
					makeviewbutton( term, td )
				}
				maketreebutton( term, td )
			}
		} catch(e) {
			table.append('tr').append('td')
				.style('opacity',.5)
				.text(e.message || e)
			if(e.stack) console.log(e.stack)
		}
	}
}




export function menuoption_add_filter ( obj, tvslst ) {
/*
obj: the tree object
tvslst: an array of 1 or 2 term-value setting objects
     this is to be added to the obj.termfilter.terms[]
	 if barchart is single-term, tvslst will have only one element
	 if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
*/

	if(!tvslst) return

	if( !obj.termfilter || !obj.termfilter.show_top_ui ) {
		// do not display ui, and do not collect callbacks
		return
	}

	for(const [i, term] of tvslst.entries()){
		obj.termfilter.terms.push(term)
	}

	make_filter_ui(obj)

	for (const fxn of obj.termfilter.callbacks) fxn()
}


export function menuoption_select_to_gp ( obj, tvslst ) {
	obj.tip.hide()
	const pane = client.newpane({x:100,y:100})
	import('./block').then(_=>{
		new _.Block({
			hostURL:localStorage.getItem('hostURL'),
			holder: pane.body,
			genome:obj.genome,
			nobox:true,
			chr: obj.genome.defaultcoord.chr,
			start: obj.genome.defaultcoord.start,
			stop: obj.genome.defaultcoord.stop,
			nativetracks:[ obj.genome.tracks.find(i=>i.__isgene).name.toLowerCase() ],
			tklst:[ {
				type:client.tkt.mds2,
				dslabel:obj.dslabel,
				vcf:{ numerical_axis:{ AFtest:{ groups:[
					{ is_termdb:true, terms: tvslst },
					obj.bar_click_menu.select_to_gp.group_compare_against
				] } } }
			} ]
		})
	})
}

export function menuoption_select_group_add_to_cart ( obj, tvslst ) {

	if(!tvslst) return
		
	const new_group = {}
	new_group.is_termdb = true
	new_group.terms = []

	for(const [i, term] of tvslst.entries()){
		new_group.terms.push(term)
	}

	if(!obj.selected_groups){
		obj.selected_groups = []
	}

	obj.selected_groups.push(new_group)
	update_cart_button(obj)

}

function make_filter_ui(obj){

	obj.dom.termfilterdiv.selectAll('*').remove()

	const div = obj.dom.termfilterdiv
		.style('display','inline-block')
		.append('div')
		.style('display','inline-block')
		.style('border','solid 1px #ddd')
		.style('padding','7px')
		.style('margin-bottom','10px')
	
	div.append('div')
		.style('display','inline-block')
		.style('margin','0px 5px')
		.text('FILTER')
		.style('opacity','.5')
		.style('font-size','.8em')

	termvaluesettingui.display(
		div,
		obj.termfilter,
		obj.mds,
		obj.genome,
		false,
		// callback when updating the filter
		() => {
			for(const fxn of obj.termfilter.callbacks) {
				fxn()
			}
		} 
	)
}

// allow view restore on initial page load only
let view_restored = false

function restore_view(obj) {
	if (view_restored) return
	view_restored = true
	const querystr = window.location.search.split('?')[1]
	if (!querystr) return
	const params = {}
	querystr.split('&').forEach(kv=>{
		const [key,val] = kv.split('=')
		params[key] = !val || isNaN(val) ? val : +val 
	})
	if (!params.restore_view) return
	if (params.restore_view=='by-url-params') {
		if (!params.term1) return
		if (params.view_type=='barchart') {
			restore_barchart(obj, params)
		}
	} else if (params.restore_view=='by-saved-settings' && params.view_id) {
		// fetch cached view settings from the server
		// will enable sharing of saved views among users, developers
		// useful for discussions, feedback, bug reports
	}
}

function save_view() {
	/* To-Do: 

	If a user clicks a 'Save View' button,
	it will submit and cache the view settings as a json file
	in the server, which will return and notify the user
	with the view_id for future reference and to be opened via
	restore_view()

	*/
}

async function restore_barchart(obj, params) {
	const data = await obj.do_query( ['findterm='+params.term1] );
	if (!data.lst.length) return
	
	const restored_div = obj.dom.div.append('div')
		.style('margin', '20px')
		.style('padding', '10px 20px')
		.style('border', '1px solid #aaa')
	restored_div.append('h3')
		.html('Restored View')

	let term2, term0
	if (params.term2) {
		const data = await obj.do_query( ['findterm='+params.term2] );
		if (data.lst.length) term2 = data.lst.filter(d=>d.iscategorical || d.isfloat || d.isinteger || d.iscondition)[0]
	}
	if (params.term0) {
		const data = await obj.do_query( ['findterm='+params.term0] );
		if (data.lst.length) term0 = data.lst.filter(d=>d.iscategorical || d.isfloat || d.isinteger || d.iscondition)[0]
	}

	make_barplot( obj, data.lst[0], restored_div, ({plot, main})=>{
		if (!term2 && !term0) return
		if (term2) plot.settings.bar.overlay = 'tree'
		if (term0) plot.settings.bar.divideBy = 'tree'
    plot.term2 = term2
    plot.term0 = term0
    if (plot.term2 && plot.term2.isfloat && plot.term2_boxplot) { 
      plot.term2_displaymode = 'boxplot'
    } else if (plot.term2) {
      if (plot.term2_displaymode == "boxplot") {
        plot.term2_displaymode = "stacked"
      }
      plot.term2_boxplot = 0
    }
	  setTimeout(()=>{
	    main( plot )
	  }, 1100)
	})
}

