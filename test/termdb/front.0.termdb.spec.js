const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require("../../serverconfig")
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
  test.pass("-***- mds.termdb -***-")
  test.end()
})

tape("standalone layout", function (test) {
  const div0 = d3s.select('body').append('div')
  
  runproteinpaint({
    host,
    holder: div0.node(),
    noheader:1,
    nobox:true,
    display_termdb:{
      dslabel:'SJLife',
      genome:'hg38',
      default_rootterm:{},
      termfilter:{show_top_ui:true},
      callbacks: {
        tree: {
          postRender: [testAvailElems]
        }
      },
    },
  })
  
  function testAvailElems(obj) {
    test.equal(div0.selectAll('.tree_search').size(), 1, "should have a search input")
    test.equal(div0.selectAll('div').filter(function(){return this.innerHTML=="FILTER"}).size(), 1, "should have a FILTER input")
    test.equal(div0.selectAll('.sja_menuoption').size(), 4, "should have the correct number of buttons")
    test.end()
  }
})


