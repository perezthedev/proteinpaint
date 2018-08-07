import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
import {transition} from 'd3-transition'
import {format as d3format} from 'd3-format'
import {axisTop, axisLeft} from 'd3-axis'
import * as coord from './coord'
import * as common from './common'
import * as client from './client'
import {TKruler} from './block.tk.ruler'
import {validate_parameter_init} from './block.init'







export class Block {

constructor ( arg ) {

	try {
		validate_parameter_init( arg, this )
	} catch(e) {
		if(e.stack) console.log(e.stack)
		if(this.holder) {
			this.holder.append('div').style('margin','20px').text('Error: '+e)
		} else {
			alert('Error: '+e)
		}
		return
	}

	/* now has:
	.genome
	.views[]
	.tklst[]
	*/


	this.settle_width()

	{
		// init ruler
		const tk = new TKruler( this )
		this.tklst.push( tk )
	}

	// init other tracks

	this.settle_height()

// END of constructor
}



//////////// methods


settle_width () {
	/*
	call after changing width of any column
	update:
		view width and clip box
		block width
		x position for each column accordingly
	*/

	let x = 0
	for(const v of this.views) {

		v.x = x
		v.g.attr('transform','translate('+x+',0)')

		if(v.regions) {
			// set view width by portions of regions in view range
			v.width = ( v.stopidx - v.startidx ) * v.regionspace
			for(let i=v.startidx; i<=v.stopidx; i++) {
				const r = v.regions[ i ]
				v.width += ( r.stop - r.start ) / v.bpperpx
			}
			v.cliprect.attr('width', v.width+1 )
		} else {
			// something else
			v.width=100
		}
		x += v.width + v.rightpad
	}

	this.width = this.leftcolumnwidth + this.leftpad
		+ x
		- this.views[this.views.length-1].rightpad
		+ this.rightpad + this.rightcolumnwidth

	this.svg.svg
		.transition()
		.attr('width', this.width)
	this.svg.gleft
		.transition()
		.attr('transform','translate('+this.leftcolumnwidth+',0)')
	this.svg.gmiddle
		.transition()
		.attr('transform','translate('+(this.leftcolumnwidth+this.leftpad)+')')
	this.svg.gright
		.transition()
		.attr('transform','translate('+(this.width-this.rightcolumnwidth)+',0)')
}



settle_height () {
	this.height = 0
	for(const t of this.tklst) {
		this.height += t.toppad + t.height + t.bottompad
	}
	// update cliprect height
	for(const v of this.views) {
		v.cliprect.attr('height', this.height)
	}
	this.svg.svg
		.transition()
		.attr('height', this.height)
}


init_dom_tk ( tk ) {
	/*
	call for a newly created tk
	initialize common things
	*/

	tk.block = this
	tk.left_width = tk.right_width = 100
	tk.y = 0 // shift by
	tk.toppad = 3
	tk.bottompad = 3

	tk.tip = new client.Menu({padding:'5px'})

	tk.gleft = this.svg.gleft.append('g') // y shift
	tk.tklabel = tk.gleft
		.append('text')
		.attr('fill','black')
		.attr('font-family',client.font)
		.attr('font-size', this.tklabelfontsize)
		.attr('font-weight','bold')
		.attr('text-anchor','end')
		.attr('y', this.tklabelfontsize)
		.on('mousedown',()=>{
			// TODO
		})

	tk.gright = this.svg.gright.append('g') // y shift
	tk.configlabel = tk.gright
		.append('text')
		.text('CONFIG')
		.attr('fill','#ccc')
		.attr('font-family',client.font)
		.attr('font-size', this.tklabelfontsize)
		.attr('y', this.tklabelfontsize)
		.on('click',()=>{
			// TODO
		})

	tk.views = {}
	for( const view of this.views ) {
		this.add_view_2tk( tk, view )
	}
}



add_view_2tk ( tk, view ) {
	/* addings things about a view to a tk
	do not update
	*/
	const tv = {
		g: view.gscroll.append('g'), // y shift
	}
	tk.views[ view.id ] = tv
}





view_updaterulerscale ( view ) {
	/* update ruler scale 
	call after updating range
	*/
	if(!view.regions) return

	const domains = []
	const ranges = []

	let x = 0

	for(let i=view.startidx; i<=view.stopidx; i++) {
		const r = view.regions[ i ]
		domains.push( view.reverse ? r.stop : r.start )
		domains.push( view.reverse ? r.start : r.stop )

		ranges.push( x )
		x += (r.stop - r.start)/ view.bpperpx
		ranges.push( x )
		x += view.regionspace
	}

	view.rulerscale.domain( domains ).range( ranges )
}




pannedby ( view, xoff ) {
	/*
	call after panning by a distance
	*/
	if( xoff == 0 ) return

	let nope = false
	if(xoff < 0) {
		// test right
		if( view.stopidx == view.regions.length-1 ) {
			const r = view.regions[ view.stopidx ]
			if( view.reverse ) {
				if( r.start <= r.bstart ) nope =true
			} else {
				if( r.stop >= r.bstop ) nope=true
			}
		}
	} else {
		// test left
		if( view.startidx == 0 ) {
			const r = view.regions[ 0 ]
			if( view.reverse ) {
				if( r.stop >= r.bstop ) nope=true
			} else {
				if( r.start <= r.bstart ) nope=true
			}
		}
	}
	if(nope) {
		view.gscroll.transition().attr('transform','translate(0,0)')
		return
	}

	this.busy = true

	// before track actually udpates, keep shifted
	for(const tk of this.tklst) {
		const tv = tk.views[ view.id ]
		if(!tv) continue
		tv.g.attr( 'transform', 'translate(' + xoff + ',' + tk.y + ')' )
	}

	this.zoom2px( view, -xoff, view.width-xoff )
}



async zoom2px ( view, px1, px2 ) {
	/*
	for pan and zoom
	*/
	if(!view.regions) return
	const pxstart = Math.min( px1, px2 )
	const pxstop  = Math.max( px1, px2 )
	// update viewport
	const [ ridx1, float1 ] = this.pxoff2region( view, pxstart )
	const [ ridx2, float2 ] = this.pxoff2region( view, pxstop  )

	let pos1, pos2 // integer
	if( view.reverse ) {
		pos1 = Math.ceil(float1)
		pos2 = Math.floor(float2)
	} else {
		pos1 = Math.floor(float1)
		pos2 = Math.ceil(float2)
	}

	view.startidx = ridx1
	view.stopidx  = ridx2

	let totalbpinviewport = 0

	if( ridx1 == ridx2 ) {

		const r = view.regions[ ridx1 ]
		r.start = pos1
		r.stop  = pos2
		totalbpinviewport = pos2 - pos1

	} else {

		const r1 = view.regions[ ridx1 ]
		const r2 = view.regions[ ridx2 ]
		/*
		     -----------
		>>>>>|>>>  >>>>|>>>>>
		<<<<<|<<<  <<<<|<<<<<
		     -----------
		*/
		if( view.reverse ) {
			r1.start = r1.bstart
			r1.stop = pos1
			r2.start = pos2
			r2.stop = r2.bstop
		} else {
			r1.start = pos1
			r1.stop = r1.bstop
			r2.start = r2.bstart
			r2.stop = pos2
		}

		totalbpinviewport = r1.stop-r1.start + r2.stop-r2.start
		for(let i=ridx1+1; i<ridx2; i++) {
			const r = view.regions[ i ]
			totalbpinviewport += r.bstop - r.bstart
		}
	}

	// view px width stays same despite coord change
	view.bpperpx = totalbpinviewport / ( view.width - (ridx2-ridx1) * view.regionspace )

	this.view_updaterulerscale( view )

	for(const tk of this.tklst) {
		tk.update()
	}
	this.busy = false
}




pxoff2region ( view, px ) {
	if(!view.regions) return
	const coord = view.rulerscale.invert( px )
	let regionidx
	if(px > 0) {
		// to right
		for(regionidx = view.startidx; regionidx<view.regions.length; regionidx++) {
			const r = view.regions[ regionidx ]
			let remainbp // remaining bp from this region
			if( regionidx == view.startidx ) {
				if( view.reverse ) {
					remainbp = r.stop - r.bstart
				} else {
					remainbp = r.bstop - r.start
				}
			} else {
				remainbp = r.bstop - r.bstart
			}
			const remainpx = remainbp / view.bpperpx
			if( remainpx >= px ) {
				break
			}
			px -= remainpx + view.regionspace
		}
	} else {
		// to left
		px *= -1
		for(regionidx = view.startidx; regionidx >=0; regionidx--) {
			const r = view.regions[ regionidx ]
			let remainbp
			if( regionidx == view.startidx ) {
				if( view.reverse ) {
					remainbp = r.bstop - r.stop
				} else {
					remainbp = r.start - r.bstart
				}
			} else {
				remainbp = r.bstop - r.bstart
			}
			const remainpx = remainbp / view.bpperpx
			if( remainpx >= px ) {
				break
			}
			px -= remainpx + view.regionspace
		}
	}
	return [ regionidx, coord ]
}





// END of block
}
