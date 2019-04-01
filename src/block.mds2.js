import {select as d3select,event as d3event} from 'd3-selection'
import {axisTop, axisLeft, axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import * as common from './common'
import * as client from './client'
import * as mds2legend from './block.mds2.legend'





export async function loadTk( tk, block ) {
/*
*/

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish( tk, block ) // function used at multiple places

	try {

		if(tk.uninitialized) {
			makeTk(tk,block)
			delete tk.uninitialized
		}

		tk.tklabel.each(function(){ tk.leftLabelMaxwidth = this.getBBox().width }) // do this when querying each time

		const data = await loadTk_do( tk, block )

		const rowheight_vcf = may_render_vcf( data, tk, block )

		// set height_main
		tk.height_main = rowheight_vcf

		_finish()

	} catch( e ) {

		tk.height_main = 50

		if(e.nodata) {
			/*
			central place to handle "no data", no mutation data in any sample
			for both single/multi-sample
			*/
			trackclear( tk )
			// remove old data so the legend can update properly
			//delete tk.data_vcf

			_finish({message:tk.name+': no data in view range'})
			return
		}

		if(e.stack) console.log( e.stack )
		_finish( e )
		return
	}
}



function makeTk ( tk, block ) {

	/* step 1
	validate tk
	upon error, throw
	*/
	if( !tk.dslabel ) throw '.dslabel missing'
	tk.mds = block.genome.datasets[ tk.dslabel ]
	if(!tk.mds) throw 'dataset not found for '+tk.dslabel
	if(!tk.mds.track) throw 'mds.track{} missing: dataset not configured for mds2 track'

	tk.tklabel.text( tk.mds.track.name )

	// vcf row
	tk.g_vcfrow = tk.glider.append('g')

	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})

	mds2legend.init( tk, block )
}



async function loadTk_do ( tk, block ) {

	const par = addparameter_rangequery( tk, block )

	return client.dofetch('mds2', par)
	.then(data=>{
		if(data.error) throw data.error
		return data
	})
}






function loadTk_finish ( tk, block ) {
	return (error)=>{
		mds2legend.update(tk, block)
		block.tkcloakoff( tk, {error: (error ? error.message||error : null)})
		block.block_setheight()
		block.setllabel()
	}
}



function addparameter_rangequery ( tk, block ) {
// to get data for current view range

	/*
	for vcf track, server may render image when too many variants
	need to supply all options regarding rendering:
	*/
	const par={
		genome:block.genome.name,
		dslabel: tk.dslabel,
		rglst: block.tkarg_maygm(tk),
	}

	if( block.usegm ) {
		/* for vcf, when rendering image on server, variants from the block region will have mclass decided by whether the block is in gmmode or not
		this does not apply to subpanels

		in p4, should apply to all panels
		*/
		for(const r of par.rglst) r.usegm_isoform = block.usegm.isoform
	}

	// append xoff to each r from block
	let xoff = 0
	for(const r of par.rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const r of block.subpanels) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				xoff: xoff
			})
			xoff += r.width + r.leftpad
		}
	}

	if( tk.mds.track.vcf ) {
		par.trigger_vcfbyrange = 1
	}
	// add trigger for other data types

	/* TODO
	for vcf, when rendering image on server, need to know 
	if any categorical attr is used to class variants instead of mclass
	*/

	return par
}




function may_render_vcf ( data, tk, block ) {
/* for now, assume always in variant-only mode for vcf
*/
	if( !tk.mds.track.vcf ) return
	if( !data.vcf ) return
	if( !data.vcf.rglst ) return

	tk.g_vcfrow.selectAll('*').remove()

	/* current implementation ignore subpanels
	to be fixed in p4
	*/

	apply_scale_to_region( data.vcf.rglst )

	let rowheight = 0

	for(const r of data.vcf.rglst) {
		
		const g = tk.g_vcfrow.append('g')
			.attr('transform','translate('+r.xoff+',0)')

		if( r.rangetoobig ) {
			r.text_rangetoobig = g.append('text')
				.text( r.rangetoobig )
				.attr('text-anchor','middle')
				.attr('dominant-baseline','central')
				.attr('x', r.width/2 )
				// set y after row height is decided
			rowheight = Math.max( rowheight, 50 )
			continue
		}

		if( r.imgsrc ) {
			g.append('image')
				.attr('width', r.width)
				.attr('height', r.imgheight)
				.attr('xlink:href', r.imgsrc)
			rowheight = Math.max( rowheight, r.imgheight )
			continue
		}

		if( r.variants ) {
			const height = render_variants( r, g, tk )
			rowheight = Math.max( rowheight, height )
			continue
		}
	}

	// row height set
	for(const r of data.vcf.rglst) {
		if(r.rangetoobig) {
			r.text_rangetoobig.attr('y', rowheight/2 )
		}
	}

	return rowheight
}




function render_variants ( r, g, tk ) {
/*
r: region
	.scale
g:
tk:
*/
	return tk.mds.track.vcf.axisheight
}



/*
function getheight_vcf_row ( tk, vcfdata ) {
// for range query, based on returned data, get height for the vcf row across all regions
	let h = 0
	for(const r of vcfdata.rglst) {
		if(r.rangetoobig) {
			h = Math.max( h, 50 )
		} else {
			h = Math.max( h,  )
		}
	}
}
*/



function apply_scale_to_region ( rglst ) {
	// such as data.vcf.rglst
	for(const r of rglst) {
		r.scale = scaleLinear()
		if(r.reverse) {
			r.scale.domain([r.stop, r.start]).range([0,r.width])
		} else {
			r.scale.domain([r.start, r.stop]).range([0,r.width])
		}
	}
}
