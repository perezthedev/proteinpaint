import { select as d3select } from 'd3'
import { dofetch2, tab2box, tkt } from './client'
import { make_radios } from './dom'

/*
doms{}
.isdense_radios DOM
.assaytrack_radios DOM
.assaytrack_inuse BOOL
.sampleset_inuse BOOL

validate_input()
 */

export async function init_mdsjsonform(par) {
	const { holder, genomes } = par
	{
		// check if the form is enabled to work on this server
		const re = await dofetch2('mdsjsonform', { method: 'POST', body: '{}' })
		if (re.error) {
			holder.append('div').text(re.error)
			return
		}
	}
	const [form_div, wrapper_div] = make_header(holder)
	const doms = {}
	doms.genome = make_genome(wrapper_div, genomes)
	doms.position = make_position(wrapper_div)
	doms.name = make_name(wrapper_div)
	set_dense(wrapper_div, doms)
	doms.svcnvfileurl = make_svcnv(wrapper_div)
	doms.vcffileurl = make_vcf(wrapper_div)
	doms.expressionfile = make_expression_filepath(wrapper_div)
	make_sampleset(wrapper_div, doms)
	make_assaytracks(wrapper_div, doms)
	//window.doms = doms
	make_buttons(form_div, doms)
}

function make_header(holder) {
	const form_div = holder.append('div')
	form_div
		.append('div')
		.style('font-size', '20px')
		.style('margin', '10px')
		.text('Create a Custom GenomePaint Track')
	const wrapper_div = form_div
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr 4fr')
		.style('align-items', 'start')
		.style('grid-template-rows', '1fr')
		.style('row-gap', '15px')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')
	return [form_div, wrapper_div]
}

function make_buttons(form_div, doms) {
	const submit_row = form_div

	submit_row
		.append('button')
		.style('margin-left', '10px')
		.style('margin-top', '5px')
		.text('Submit')
		.on('click', async () => {
			link_holder.html('Loading...')
			try {
				const deposit = validate_input(doms)
				const genome = deposit.genome
				delete deposit.genome
				const re = await dofetch2('mdsjsonform', { method: 'POST', body: JSON.stringify({ deposit }) })
				if (re.error) throw re.error
				const lst = [window.location.origin + '?block=1', 'genome=' + genome, 'mdsjsoncache=' + re.id]
				if (deposit.position) {
					lst.push('position=' + deposit.position)
					delete deposit.position
				}
				link_holder.html('<a href=' + lst.join('&') + ' target=_blank>View track</a>')
			} catch (e) {
				window.alert('Error: ' + e)
				if (e.stack) console.log(e.stack)
				reset_link(link_holder)
				return
			}
		})

	const link_holder = submit_row
		.append('span')
		.style('margin-left', '10px')
		.style('border', 'solid 1px #eee')
		.style('padding', '2px 9px')
	reset_link(link_holder)

	submit_row
		.append('button')
		.text('Example')
		.style('margin-top', '5px')
		.style('margin-left', '20px')
		.on('click', () => {
			doms.position.property('value', 'chr7:54990404-55375627')
			doms.name.property('value', 'TCGA GBM somatic alterations')
			doms.svcnvfileurl.property('value', 'proteinpaint_demo/hg19/tcga-gbm/gbm.svcnv.hg19.gz')
			doms.vcffileurl.property('value', 'proteinpaint_demo/hg19/tcga-gbm/gbm.snvindel.vep.vcf.gz')
			doms.expressionfile.property('value', 'proteinpaint_demo/hg19/tcga-gbm/gbm.fpkm.hg19.gz')
			doms.isdense_radios.nodes()[1].click()
			doms.assaytrack_radios.nodes()[0].click()
			doms.assaytrack_bigwig_textarea.property(
				'value',
				`TCGA-06-0152-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010643_R1.bw	TCGA-06-0152-02A RNA coverage
TCGA-06-0152-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010643_R1.bw	TCGA-06-0152-02A WGS coverage
TCGA-41-5651-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010602_D1.bw	TCGA-41-5651-01A RNA coverage
TCGA-41-5651-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010602_D1.bw	TCGA-41-5651-01A WGS coverage
TCGA-02-2483-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010586_D1.bw	TCGA-02-2483-01A RNA coverage
TCGA-02-2483-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010586_D1.bw	TCGA-02-2483-01A WGS coverage
TCGA-06-0171-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010485_R1.bw	TCGA-06-0171-02A RNA coverage
TCGA-06-0171-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010485_R1.bw	TCGA-06-0171-02A WGS coverage
TCGA-06-0211-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010540_R1.bw	TCGA-06-0211-02A RNA coverage
TCGA-06-0211-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010540_R1.bw	TCGA-06-0211-02A WGS coverage
TCGA-26-5135-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010548_D1.bw	TCGA-26-5135-01A RNA coverage
TCGA-26-5135-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010548_D1.bw	TCGA-26-5135-01A WGS coverage
TCGA-32-1970-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010550_D1.bw	TCGA-32-1970-01A RNA coverage
TCGA-32-1970-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010550_D1.bw	TCGA-32-1970-01A WGS coverage
TCGA-06-0125-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010572_D1.bw	TCGA-06-0125-01A RNA coverage
TCGA-06-0125-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010572_D1.bw	TCGA-06-0125-01A WGS coverage
TCGA-26-5132-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010504_D1.bw	TCGA-26-5132-01A RNA coverage
TCGA-26-5132-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010504_D1.bw	TCGA-26-5132-01A WGS coverage
TCGA-06-0210-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010624_D1.bw	TCGA-06-0210-01A RNA coverage
TCGA-06-0210-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010624_D1.bw	TCGA-06-0210-01A WGS coverage
TCGA-06-0686-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010607_D1.bw	TCGA-06-0686-01A RNA coverage
TCGA-06-0686-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010607_D1.bw	TCGA-06-0686-01A WGS coverage
TCGA-14-1402-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010600_R1.bw	TCGA-14-1402-02A RNA coverage
TCGA-14-1402-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010600_R1.bw	TCGA-14-1402-02A WGS coverage
TCGA-06-0125-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010572_R1.bw	TCGA-06-0125-02A RNA coverage
TCGA-06-0125-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010572_R1.bw	TCGA-06-0125-02A WGS coverage
TCGA-06-0157-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010633_D1.bw	TCGA-06-0157-01A RNA coverage
TCGA-06-0157-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010633_D1.bw	TCGA-06-0157-01A WGS coverage
TCGA-06-0190-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010560_D1.bw	TCGA-06-0190-01A RNA coverage
TCGA-06-0190-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010560_D1.bw	TCGA-06-0190-01A WGS coverage
TCGA-14-2554-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010592_D1.bw	TCGA-14-2554-01A RNA coverage
TCGA-14-2554-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010592_D1.bw	TCGA-14-2554-01A WGS coverage
TCGA-06-5411-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010518_D1.bw	TCGA-06-5411-01A RNA coverage
TCGA-06-5411-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010518_D1.bw	TCGA-06-5411-01A WGS coverage
TCGA-19-1389-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010509_R1.bw	TCGA-19-1389-02A RNA coverage
TCGA-19-1389-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010509_R1.bw	TCGA-19-1389-02A WGS coverage
TCGA-19-2620-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010513_D1.bw	TCGA-19-2620-01A RNA coverage
TCGA-19-2620-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010513_D1.bw	TCGA-19-2620-01A WGS coverage
TCGA-19-2629-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010627_D1.bw	TCGA-19-2629-01A RNA coverage
TCGA-19-2629-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010627_D1.bw	TCGA-19-2629-01A WGS coverage
TCGA-02-2485-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010530_D1.bw	TCGA-02-2485-01A RNA coverage
TCGA-02-2485-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010530_D1.bw	TCGA-02-2485-01A WGS coverage
TCGA-27-2528-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010599_D1.bw	TCGA-27-2528-01A RNA coverage
TCGA-27-2528-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010599_D1.bw	TCGA-27-2528-01A WGS coverage
TCGA-27-1831-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010641_D1.bw	TCGA-27-1831-01A RNA coverage
TCGA-27-1831-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010641_D1.bw	TCGA-27-1831-01A WGS coverage
TCGA-06-5415-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010554_D1.bw	TCGA-06-5415-01A RNA coverage
TCGA-06-5415-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010554_D1.bw	TCGA-06-5415-01A WGS coverage
TCGA-19-5960-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010577_D1.bw	TCGA-19-5960-01A RNA coverage
TCGA-19-5960-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010577_D1.bw	TCGA-19-5960-01A WGS coverage
TCGA-06-0210-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010624_R1.bw	TCGA-06-0210-02A RNA coverage
TCGA-06-0210-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010624_R1.bw	TCGA-06-0210-02A WGS coverage
TCGA-15-1444-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010527_D1.bw	TCGA-15-1444-01A RNA coverage
TCGA-15-1444-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010527_D1.bw	TCGA-15-1444-01A WGS coverage
TCGA-14-1034-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010484_D1.bw	TCGA-14-1034-01A RNA coverage
TCGA-14-1034-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010484_D1.bw	TCGA-14-1034-01A WGS coverage
TCGA-27-2523-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010559_D1.bw	TCGA-27-2523-01A RNA coverage
TCGA-27-2523-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010559_D1.bw	TCGA-27-2523-01A WGS coverage
TCGA-06-2557-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010549_D1.bw	TCGA-06-2557-01A RNA coverage
TCGA-06-2557-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010549_D1.bw	TCGA-06-2557-01A WGS coverage
TCGA-06-2570-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010593_D1.bw	TCGA-06-2570-01A RNA coverage
TCGA-06-2570-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010593_D1.bw	TCGA-06-2570-01A WGS coverage
TCGA-06-0745-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010515_D1.bw	TCGA-06-0745-01A RNA coverage
TCGA-06-0745-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010515_D1.bw	TCGA-06-0745-01A WGS coverage
TCGA-14-1034-02B	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010484_R1.bw	TCGA-14-1034-02B RNA coverage
TCGA-14-1034-02B	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010484_R1.bw	TCGA-14-1034-02B WGS coverage
TCGA-14-1823-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010587_D1.bw	TCGA-14-1823-01A RNA coverage
TCGA-14-1823-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010587_D1.bw	TCGA-14-1823-01A WGS coverage
TCGA-06-0190-02A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010560_R1.bw	TCGA-06-0190-02A RNA coverage
TCGA-06-0190-02A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010560_R1.bw	TCGA-06-0190-02A WGS coverage
TCGA-06-0211-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010540_D2.bw	TCGA-06-0211-01A RNA coverage
TCGA-06-0211-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010540_D2.bw	TCGA-06-0211-01A WGS coverage
TCGA-19-2624-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010505_D1.bw	TCGA-19-2624-01A RNA coverage
TCGA-19-2624-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010505_D1.bw	TCGA-19-2624-01A WGS coverage
TCGA-06-0744-01A	proteinpaint_demo/hg19/tcga-gbm/rna-bw/SJHGG010537_D1.bw	TCGA-06-0744-01A RNA coverage
TCGA-06-0744-01A	proteinpaint_demo/hg19/tcga-gbm/DNA/cov-wgs/SJHGG010537_D1.bw	TCGA-06-0744-01A WGS coverage`
			)
			doms.assaytrack_junction_textarea.property(
				'value',
				`TCGA-19-5960-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010577_D1.bam.junction.gz	TCGA-19-5960-01A RNA junction
TCGA-06-0190-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010560_D1.bam.junction.gz	TCGA-06-0190-01A RNA junction
TCGA-14-1402-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010600_R1.bam.junction.gz	TCGA-14-1402-02A RNA junction
TCGA-19-2620-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010513_D1.bam.junction.gz	TCGA-19-2620-01A RNA junction
TCGA-06-5411-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010518_D1.bam.junction.gz	TCGA-06-5411-01A RNA junction
TCGA-14-1034-02B	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010484_R1.bam.junction.gz	TCGA-14-1034-02B RNA junction
TCGA-26-5132-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010504_D1.bam.junction.gz	TCGA-26-5132-01A RNA junction
TCGA-14-1034-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010484_D1.bam.junction.gz	TCGA-14-1034-01A RNA junction
TCGA-19-2624-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010505_D1.bam.junction.gz	TCGA-19-2624-01A RNA junction
TCGA-06-2570-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010593_D1.bam.junction.gz	TCGA-06-2570-01A RNA junction
TCGA-06-0210-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010624_D1.bam.junction.gz	TCGA-06-0210-01A RNA junction
TCGA-06-0190-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010560_R1.bam.junction.gz	TCGA-06-0190-02A RNA junction
TCGA-14-2554-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010592_D1.bam.junction.gz	TCGA-14-2554-01A RNA junction
TCGA-27-2523-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010559_D1.bam.junction.gz	TCGA-27-2523-01A RNA junction
TCGA-41-5651-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010602_D1.bam.junction.gz	TCGA-41-5651-01A RNA junction
TCGA-06-5415-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010554_D1.bam.junction.gz	TCGA-06-5415-01A RNA junction
TCGA-14-1823-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010587_D1.bam.junction.gz	TCGA-14-1823-01A RNA junction
TCGA-06-0211-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010540_D2.bam.junction.gz	TCGA-06-0211-01A RNA junction
TCGA-06-0686-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010607_D1.bam.junction.gz	TCGA-06-0686-01A RNA junction
TCGA-27-2528-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010599_D1.bam.junction.gz	TCGA-27-2528-01A RNA junction
TCGA-02-2483-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010586_D1.bam.junction.gz	TCGA-02-2483-01A RNA junction
TCGA-06-2557-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010549_D1.bam.junction.gz	TCGA-06-2557-01A RNA junction
TCGA-06-0745-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010515_D1.bam.junction.gz	TCGA-06-0745-01A RNA junction
TCGA-06-0171-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010485_R1.bam.junction.gz	TCGA-06-0171-02A RNA junction
TCGA-19-1389-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010509_R1.bam.junction.gz	TCGA-19-1389-02A RNA junction
TCGA-32-1970-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010550_D1.bam.junction.gz	TCGA-32-1970-01A RNA junction
TCGA-06-0157-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010633_D1.bam.junction.gz	TCGA-06-0157-01A RNA junction
TCGA-26-5135-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010548_D1.bam.junction.gz	TCGA-26-5135-01A RNA junction
TCGA-15-1444-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010527_D1.bam.junction.gz	TCGA-15-1444-01A RNA junction
TCGA-06-0210-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010624_R1.bam.junction.gz	TCGA-06-0210-02A RNA junction
TCGA-06-0125-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010572_D1.bam.junction.gz	TCGA-06-0125-01A RNA junction
TCGA-19-2629-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010627_D1.bam.junction.gz	TCGA-19-2629-01A RNA junction
TCGA-06-0211-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010540_R1.bam.junction.gz	TCGA-06-0211-02A RNA junction
TCGA-06-0125-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010572_R1.bam.junction.gz	TCGA-06-0125-02A RNA junction
TCGA-06-0744-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010537_D1.bam.junction.gz	TCGA-06-0744-01A RNA junction
TCGA-02-2485-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010530_D1.bam.junction.gz	TCGA-02-2485-01A RNA junction
TCGA-06-0152-02A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010643_R1.bam.junction.gz	TCGA-06-0152-02A RNA junction
TCGA-27-1831-01A	proteinpaint_demo/hg19/tcga-gbm/junction/SJHGG010641_D1.bam.junction.gz	TCGA-27-1831-01A RNA junction`
			)
		})
	submit_row
		.append('span')
		.style('margin-left', '8px')
		.append('span')
		.style('opacity', '.5')
		.style('color', 'red')
		.text('Will overwrite existing contents.')
}
function reset_link(d) {
	d.html('')
		.append('span')
		.style('opacity', '.5')
		.text('Link will appear here.')
}

function validate_input(doms) {
	const obj = {
		type: tkt.mdssvcnv,
		isdense: doms.isdense,
		isfull: doms.isfull
	}
	{
		const n = doms.genome.node()
		obj.genome = n.options[n.selectedIndex].text
	}

	{
		const tmp = doms.position.property('value').trim()
		if (tmp) obj.position = tmp
	}

	obj.name = doms.name.property('value') || 'My dataset'

	// .isdense/isfull is already defined

	{
		const cnv = doms.svcnvfileurl.property('value').trim()
		const vcf = doms.vcffileurl.property('value').trim()
		if (!cnv && !vcf) throw 'Either SVCNV or VCF file/URL (or both) needs to be provided.'
		if (cnv) {
			if (isurl(cnv)) {
				obj.svcnvurl = cnv
			} else {
				obj.svcnvfile = cnv
			}
		}
		if (vcf) {
			if (isurl(vcf)) {
				obj.vcfurl = vcf
			} else {
				obj.vcffile = vcf
			}
		}
	}
	{
		const tmp = doms.expressionfile.property('value').trim()
		if (tmp) {
			if (isurl(tmp)) {
				obj.expressionurl = tmp
			} else {
				obj.expressionfile = tmp
			}
		}
	}

	if (doms.sampleset_inuse) {
		const tmp = doms.sampleset_textarea.property('value').trim()
		if (!tmp) throw 'Missing input for sample subset'
		const group2lst = new Map()
		const nogrplst = []
		for (const line of tmp.split('\n')) {
			if (!line) continue
			const [sample, group] = line.split('\t')
			if (group) {
				if (!group2lst.has(group)) group2lst.set(group, [])
				group2lst.get(group).add(sample)
			} else {
				nogrplst.push(sample)
			}
		}
		obj.sampleset = []
		if (nogrplst.length) {
			obj.sampleset.push({ samples: nogrplst })
		}
		for (const [group, lst] of group2lst) {
			obj.sampleset.push({ name: group, samples: lst })
		}
	}

	if (doms.assaytrack_inuse) {
		const lst = [...parse_bigwig(doms), ...parse_bigwigstranded(doms), ...parse_bedj(doms), ...parse_junction(doms)]
		obj.sample2assaytrack = {}
		for (const { sample, tk } of lst) {
			if (!obj.sample2assaytrack[sample]) obj.sample2assaytrack[sample] = []
			obj.sample2assaytrack[sample].push(tk)
		}
	}
	console.log(obj)
	return obj
}

function isurl(t) {
	const a = t.toUpperCase()
	return a.startsWith('HTTP://') || a.startsWith('HTTPS://')
}
//.genome
function make_genome(div, genomes) {
	const genome_prompt = div.append('div')

	genome_prompt.append('span').text('Genome')

	const g_row = div.append('div')

	const select = g_row.append('select')
	for (const n in genomes) {
		select.append('option').text(n)
	}
	return select
}
//.position
function make_position(div) {
	div
		.append('div')
		.append('span')
		.text('Default position')
	return div
		.append('div')
		.append('input')
		.attr('size', 30)
		.property('placeholder', 'chr:start-stop')
}

//.name
function make_name(div) {
	const tk_name_prompt = div.append('div')

	tk_name_prompt.append('span').text('Track name')

	const tk_name_div = div.append('div')

	return tk_name_div
		.append('div')
		.append('input')
		.attr('size', 30)
}
// .isdense, isfull
function set_dense(div, doms) {
	// this helper function will not return radio buttons,
	// the radio buttons will trigger callback that will modify doms{} attribute

	doms.isdense = true // default settings are needed in case the form is submitted without triggering radio callback
	doms.isfull = false
	const is_dense_prompt = div.append('div')

	is_dense_prompt.append('span').text('Display')

	const row = div.append('div')
	const { divs, labels, inputs } = make_radios({
		holder: row,
		options: [{ label: 'Dense', value: 1, checked: true }, { label: 'Expanded', value: 2 }],
		callback: value => {
			if (value == 1) {
				doms.isdense = true
				doms.isfull = false
			} else {
				doms.isdense = false
				doms.isfull = true
			}
		},
		styles: {
			display: 'inline'
		}
	})
	doms.isdense_radios = inputs
}
//.svcnvfile or .svcnvurl
function make_svcnv(div) {
	const svcnv_path_prompt = div.append('div')

	svcnv_path_prompt
		.append('span')
		.html(
			'<a href=https://docs.google.com/document/d/1owXUQuqw5hBHFERm0Ria7anKtpyoPBaZY_MCiXXf5wE/edit#heading=h.57qr5fp90wn9 target=_blank>CNV+SV+fusion</a> file path or URL'
		)

	const svcnv_path_div = div.append('div')

	return svcnv_path_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
//.vcffile
function make_vcf(div) {
	const vcf_file_prompt = div.append('div')

	vcf_file_prompt
		.append('span')
		.html(
			'<a href=https://docs.google.com/document/d/1owXUQuqw5hBHFERm0Ria7anKtpyoPBaZY_MCiXXf5wE/edit#heading=h.hce6nejglfdx target=_blank>VCF</a> file path or URL <span style="font-size:.7em">Either CNV or VCF file is required.</span>'
		)

	const vcf_file_div = div.append('div')

	return vcf_file_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
//.expressionfile
function make_expression_filepath(div) {
	const expression_file_prompt = div.append('div')

	expression_file_prompt
		.append('span')
		.html(
			'<a href=https://docs.google.com/document/d/1owXUQuqw5hBHFERm0Ria7anKtpyoPBaZY_MCiXXf5wE/edit#heading=h.v8yrfg1dqvdy target=_blank>Gene expression</a> file path or URL'
		)

	const expression_file_div = div.append('div')

	return expression_file_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
// .sampleset
function make_sampleset(div, doms) {
	const sampleset_prompt = div.append('div')

	sampleset_prompt.append('span').text('Subset samples')

	const column2 = div.append('div')
	const radiodiv = column2.append('div')
	const uidiv = column2.append('div').style('display', 'none')
	make_radios({
		holder: radiodiv,
		options: [{ label: 'Show all', value: 1, checked: true }, { label: 'Show subset', value: 2 }],
		callback: value => {
			doms.sampleset_inuse = value == 2
			uidiv.style('display', value == 2 ? 'block' : 'none')
		},
		styles: {
			display: 'inline'
		}
	})
	// contents of uidiv
	doms.sampleset_textarea = uidiv
		.append('textarea')
		.style('width', '200px')
		.style('height', '250px')
}

// Assay track
function make_assaytracks(div, doms) {
	const assay_prompt = div.append('div')

	assay_prompt.append('span').text('Assay tracks')

	const column2 = div.append('div')
	const radiodiv = column2.append('div')
	const uidiv = column2.append('div').style('display', 'none')
	const { divs, labels, inputs } = make_radios({
		holder: radiodiv,
		options: [{ label: 'Yes', value: 1 }, { label: 'No', value: 2, checked: true }],
		callback: value => {
			doms.assaytrack_inuse = value == 1
			uidiv.style('display', value == 1 ? 'block' : 'none')
		},
		styles: {
			display: 'inline'
		}
	})
	doms.assaytrack_radios = inputs
	// contents of uidiv
	const tabs = [
		{
			label: 'bigWig',
			callback: div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by tabs')
				doms.assaytrack_bigwig_textarea = div
					.append('textarea')
					.style('width', '500px')
					.style('height', '160px')
			}
		},
		{
			label: 'Stranded bigWig',
			callback: div => {
				div
					.append('div')
					.text(
						'Copy and paste the sample name, strand 1 file path, strand 2 file path, and track name in a four column format separated by tabs'
					)
				doms.assaytrack_bigwigstranded_textarea = div
					.append('textarea')
					.style('width', '500px')
					.style('height', '160px')
			}
		},
		{
			label: 'JSON-BED (bedj)',
			callback: div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by tabs')
				doms.assaytrack_bedj_textarea = div
					.append('textarea')
					.style('width', '500px')
					.style('height', '160px')
			}
		},
		{
			label: 'Splice junction',
			callback: div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by tabs')
				doms.assaytrack_junction_textarea = div
					.append('textarea')
					.style('width', '500px')
					.style('height', '160px')
			}
		}
	]
	tab2box(uidiv, tabs, true)
}

function parse_bigwig(doms) {
	const tmp = doms.assaytrack_bigwig_textarea.property('value').trim()
	const tks = []
	for (const line of tmp.split('\n')) {
		if (!line || line[0] == '#') continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' bigwig',
			type: tkt.bigwig
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		tks.push({ sample, tk })
	}
	return tks
}

function parse_bigwigstranded(doms) {
	const tmp = doms.assaytrack_bigwigstranded_textarea.property('value').trim()
	const tks = []
	for (const line of tmp.split('\n')) {
		if (!line || line[0] == '#') continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[3] || sample + ' stranded bigWig',
			type: tkt.bigwigstranded
		}
		if (isurl(lst[1])) {
			tk.url1 = {
				strand1: {
					url: lst[1]
				}
			}
		} else {
			tk.file1 = {
				strand1: {
					file: lst[1]
				}
			}
		}
		if (isurl(lst[2])) {
			tk.url2 = {
				strand2: {
					url: lst[2]
				}
			}
		} else {
			tk.file2 = {
				strand2: {
					file: lst[2]
				}
			}
		}
		tks.push({ sample, tk })
	}
	return tks
}

function parse_bedj(doms) {
	const tmp = doms.assaytrack_bedj_textarea.property('value').trim()
	const tks = []
	for (const line of tmp.split('\n')) {
		if (!line || line[0] == '#') continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' JSON bed',
			type: tkt.bedj
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		tks.push({ sample, tk })
	}
	return tks
}

function parse_junction(doms) {
	const tmp = doms.assaytrack_junction_textarea.property('value').trim()
	const tks = []
	for (const line of tmp.split('\n')) {
		if (!line || line[0] == '#') continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' splice junction',
			type: tkt.junction
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		tks.push({ sample, tk })
	}
	return tks
}
