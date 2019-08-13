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

tape("term button", function (test) {
  const div0 = d3s.select('body').append('div')
  let menuoption
  
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
          postRender: [triggerRootTermClick]
        }
      },
    },
  })

  function triggerRootTermClick(obj) {
    obj.callbacks.tree.postRender = []
    obj.callbacks.tree.postExpand = [testExpandedSubtree]
    menuoption = div0.select('.sja_menuoption').node()
    menuoption.click()
    //div0.select('.sja_menuoption').on('click')()
  }
  
  function testExpandedSubtree(obj) {
    setTimeout(()=>{
      test.true(menuoption.parentNode.parentNode.lastChild.querySelectorAll('.sja_menuoption').length > 1, "should expand to subterms when clicked")
      test.true(!menuoption.innerHTML.toLowerCase().includes('loading'), "should remove the loading text on expansion")
      obj.callbacks.tree.postExpand = []
      test.end()
    },100)
  }
})


