const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/cuminc -***-')
	test.end()
})

tape('basic cuminc', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiac dysrhythmia',
						term: termjson['Cardiac dysrhythmia'],
						q: { bar_by_grade: true, value_by_max_grade: true }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let cumincDiv
	async function runTests(cuminc) {
		cumincDiv = cuminc.Inner.dom.chartsDiv
		test.equal(cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series').size(), 1, 'should render 1 cuminc series g')
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series path').size(),
			2,
			'should render 2 cuminc series paths for estimate line and 95% CI area'
		)
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series circle').size(),
			21,
			'should render 21 cuminc series circles'
		)
		test.end()
	}
})

tape('hidden uncomputable', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiac dysrhythmia'
					},
					term2: {
						id: 'hrtavg'
					},
					settings: {
						cuminc: {
							minSampleSize: 1
						}
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		const legendDiv = cuminc.Inner.dom.legendDiv
		test.equal(
			legendDiv &&
				legendDiv
					.selectAll('.legend-row')
					.filter(function() {
						return Number(this.style.opacity) < 1
					})
					.size(),
			2,
			'should hide 1 series'
		)
		test.end()
	}
})

tape('skipped series', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System',
						//term: termjson['Cardiac dysrhythmia'],
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
					term2: {
						id: 'genetic_race'
						//term: termjson['Cardiac dysrhythmia'],
						//q: { bar_by_grade: true, value_by_max_grade: true }
					},
					settings: {
						cuminc: {
							minSampleSize: 1
						}
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		const skippedDivs = cuminc.Inner.dom.chartsDiv
			.select('.pp-cuminc-chartLegends')
			.selectAll('.pp-cuminc-chartLegends-skipped')
		test.equal(skippedDivs && skippedDivs.size(), 1, 'should render 1 skipped series')
		test.end()
	}
})
