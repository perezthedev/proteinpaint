const app = require('../app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const termdbsql = require('./termdb.sql')

/*
********************** EXPORTED
handle_request_closure
**********************
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    const q = req.query
    for(const i of [0,1,2]) {
      const termnum_q = 'term' + i + '_q'
      const term_q = q[termnum_q]
      if (term_q) {
        q[termnum_q] = JSON.parse(decodeURIComponent(term_q))
        q[termnum_q].term_id = q['term' + i + '_id']
      }
    }
    app.log(req)
    if (!q.term0) q.term0 = ''
    if (!q.term2) q.term2 = ''
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'

      // process triggers
      await barchart_data( q, ds, res, tdb )
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

async function barchart_data ( q, ds, res, tdb ) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
*/
  if(!ds.cohort) throw 'cohort missing from ds'
  q.ds = ds

  if (q.ssid) {
    const [genotypeBySample, genotype2sample] = await load_genotype_by_sample(q.ssid)
    q.genotypeBySample = genotypeBySample
    q.genotype2sample = genotype2sample
  }
  for(const i of [0,1,2]) {
    preProcessTermQ(q['term' + i + '_q'], ds)
  }

  const startTime = +(new Date())
  q.results = termdbsql.get_rows(q, true) // withCTEs = true
  const sqlDone = +(new Date())
  const pj = getPj(q, q.results.lst, tdb, ds)
  if (pj.tree.results) {
    pj.tree.results.times = {
      sql: sqlDone - startTime,
      pj: pj.times,
    }
  }
  res.send(pj.tree.results)
}

function preProcessTermQ(q, ds) {
  if (q && q.custom_bins) setCustomBins(q, ds)
}

// template for partjson, already stringified so that it does not 
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
  "@errmode": ["","","",""],
  "@before()": "=prep()",
  results: {
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      chartId: "@key",
      "~samples": ["$sample", "set"],
      "__:total": "=sampleCount()",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        seriesId: "@key",
        data: [{
          dataId: "@key",
          "~samples": ["$sample", "set"],
          "__:total": "=sampleCount()",
        }, "$key2"],
        "_:_max": "$val2", // needed by client-side boxplot renderer 
        "~values": ["$nval2",0],
        "~sum": "+$nval2",
        "~samples": ["$sample", "set"],
        "__:total": "=sampleCount()",
        "__:boxplot": "=boxplot()",
        "__:AF": "=getAF()",
      }, "$key1"],
      //"@done()": "=filterEmptySeries()"
    }, "$key0"],
    "~sum": "+$nval1",
    "~values": ["$nval1",0],
    "__:boxplot": "=boxplot()",
    /*"_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    },*/
    "_:_refs": {
      cols: ["$key1"],
      colgrps: ["-"], 
      rows: ["$key2"],
      rowgrps: ["-"],
      col2name: {
        "$key1": {
          name: "@branch",
          grp: "-"
        }
      },
      row2name: {
        "$key2": {
          name: "@branch",
          grp: "-"
        }
      },
      "__:unannotatedLabels": "=unannotatedLabels()", 
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:bins": "=bins()",
      "__:grade_labels": "=grade_labels()",
      "@done()": "=sortColsRows()"
    },
    "@done()": "=sortCharts()"
  }
})

function getPj(q, data, tdb, ds) { 
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
  const joinAliases = ["chart", "series", "data"]
  const terms = [0,1,2].map(i=>{
    const d = getTermDetails(q, tdb, i)
    const bins = q.results['CTE' + i].bins ? q.results['CTE' + i].bins : []
    return Object.assign(d, {
      key: 'key' + i, 
      val: 'val' + i,
      nval: 'nval' + i,
      isGenotype: q['term' + i + '_is_genotype'],
      bins,
      orderedLabels: d.term.iscondition && d.term.grades
        ? d.term.grades
        : d.term.iscondition
        ? [0,1,2,3,4,5,9] // hardcoded default order
        : bins.map(bin => bin.name ? bin.name : bin.label)
    })
  })

  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        // mutates the data row, ok since
        // rows from db query are unique to request;
        // do not do this with ds.cohort.annorows in termdb.barchart
        // since that is shared across requests - 
        // use partjson @join() instead 
        for(const d of terms) {
          if (d.isGenotype) {
            if (!(row.sample in q.genotypeBySample)) return
            row[d.key] = q.genotypeBySample[row.sample]
            row[d.val] = q.genotypeBySample[row.sample]
          } else if (d.isAnnoVal(row[d.val])) {
            row[d.nval] = row[d.val]
          }
        }
        return true
      },
      sampleCount(row, context) {
        return context.self.samples ? context.self.samples.size : undefined
      },
      maxSeriesTotal(row, context) {
        let maxSeriesTotal = 0
        for(const grp of context.self.serieses) {
          if (grp && grp.total > maxSeriesTotal) {
            maxSeriesTotal = grp.total
          }
        }
        return maxSeriesTotal
      },
      maxAcrossCharts(row, context) {
        let maxAcrossCharts = 0
        for(const chart of context.self.charts) {
          if (chart.maxSeriesTotal > maxAcrossCharts) {
            maxAcrossCharts = chart.maxSeriesTotal
          }
        }
        return maxAcrossCharts
      },
      boxplot(row, context) {
        const values = context.self.values
        if (!values || !values.length) return
        values.sort((i,j)=> i - j ); //console.log(context.self.seriesId, values.slice(0,5), values.slice(-5), context.self.values.sort((i,j)=> i - j ).slice(0,5))
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.self.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      getAF(row, context) {
        // only get AF when termdb_bygenotype.getAF is true
        if ( !ds.track
          || !ds.track.vcf
          || !ds.track.vcf.termdb_bygenotype
          || !ds.track.vcf.termdb_bygenotype.getAF
        ) return
        if (!q.term2_is_genotype) return
        if (!q.chr) throw 'chr missing for getting AF'
        if (!q.pos) throw 'pos missing for getting AF'
        
        return get_AF(
          context.self.samples ? [...context.self.samples] : [],
          q.chr,
          Number(q.pos),
          q.genotype2sample,
          ds
        )
      },
      unannotatedLabels() {
        const unannotated = {}
        terms.forEach((kv,i)=>{
          unannotated['term' + i] = kv.unannotatedLabels
            ? kv.unannotatedLabels
            : []
        })
        return unannotated
      },
      filterEmptySeries(result) {
        const nonempty = result.serieses.filter(series=>series.total)
        result.serieses.splice(0, result.serieses.length, ...nonempty)
      },
      grade_labels() {
        return terms[0].term.iscondition || terms[1].term.iscondition || terms[2].term.iscondition
          ? tdb.patient_condition.grade_labels
          : undefined
      },
      bins() {
        return {
          "0": terms[0].bins,
          "1": terms[1].bins,
          "2": terms[2].bins,
        }
      },
      useColOrder() {
        return terms[1].orderedLabels.length > 0
      },
      useRowOrder() {
        return terms[2].orderedLabels.length > 0
      },
      sortColsRows(result) {
        if (terms[1].orderedLabels.length) {
          const labels = terms[1].orderedLabels
          result.cols.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
        if (terms[2].orderedLabels.length) {
          const labels = terms[2].orderedLabels
          result.rows.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
      },
      sortCharts(result) {
        if (terms[0].orderedLabels.length) {
          const labels = terms[0].orderedLabels
          result.charts.sort((a,b) => labels.indexOf(a.chartId) - labels.indexOf(b.chartId))
        }
      }
    }
  })
}

function getTermDetails(q, tdb, index) {
  const termnum_id = 'term'+ index + '_id'
  const termid = q[termnum_id]
  const term = termid && !q['term' + index + '_is_genotype'] ? tdb.termjson.map.get(termid) : {}
  const termIsNumeric = term.isinteger || term.isfloat
  const nb = term.graph && term.graph.barchart && term.graph.barchart.numeric_bin 
    ? term.graph.barchart.numeric_bin
    : {}
  const unannotatedValues = nb.unannotated
    ? Object.keys(nb.unannotated).filter(key=>key.startsWith('value')).map(key=>nb.unannotated[key]) 
    : []
  const isAnnoVal = val => termIsNumeric && !unannotatedValues.includes(val)
  const unannotatedLabels = nb.unannotated
    ? Object.keys(nb.unannotated).filter(key=>key.startsWith('label') && key != 'label_annotated').map(key=>nb.unannotated[key])
    : []
  return {term, isAnnoVal, nb, unannotatedValues, unannotatedLabels}
}


async function load_genotype_by_sample ( id ) {
/* id is the file name under cache/samples-by-genotype/
*/
  const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
  const bySample = Object.create(null)
  const genotype2sample = new Map()
  for(const line of text.split('\n')) {
    if (!line) continue
    const [type, samplesStr] = line.split('\t')
    if (!samplesStr) continue
    const samples = samplesStr.split(",")
    for(const sample of samples) {
      bySample[sample] = type
    }

    if(!genotype_type_set.has(type)) throw 'unknown hardcoded genotype label: '+type
    genotype2sample.set(type, new Set(samples))
  }
  return [bySample, genotype2sample]
}

const genotype_type_set = new Set(["Homozygous reference","Homozygous alternative","Heterozygous"])
const genotype_types = {
  href: "Homozygous reference",
  halt: "Homozygous alternative",
  het: "Heterozygous"
}

function get_AF ( samples, chr, pos, genotype2sample, ds ) {
/*
as configured by ds.track.vcf.termdb_bygenotype,
at genotype overlay of a barchart,
to show AF=? for each bar, based on the current variant

arguments:
- samples[]
  list of sample names from a bar
- chr
  chromosome of the variant
- genotype2sample Map
    returned by load_genotype_by_sample()
- ds{}
*/
  const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations
  const href = genotype2sample.has(genotype_types.href) ? genotype2sample.get(genotype_types.href) : new Set()
  const halt = genotype2sample.has(genotype_types.halt) ? genotype2sample.get(genotype_types.halt) : new Set()
  const het = genotype2sample.has(genotype_types.het) ? genotype2sample.get(genotype_types.het) : new Set()
  let AC=0, AN=0
  for(const sample of samples) {
    let isdiploid = false
    if( afconfig.sex_chrs.has( chr ) ) {
      if( afconfig.male_samples.has( sample ) ) {
        if( afconfig.chr2par && afconfig.chr2par[chr] ) {
          for(const par of afconfig.chr2par[chr]) {
            if(pos>=par.start && pos<=par.stop) {
              isdiploid=true
              break
            }
          }
        }
      } else {
        isdiploid=true
      }
    } else {
      isdiploid=true
    }
    if( isdiploid ) {
      AN+=2
      if(halt.has( sample ) ) {
        AC+=2
      } else if(het.has( sample )) {
        AC++
      }
    } else {
      AN++
      if(!href.has(sample)) AC++
    }
  }
  return (AN==0 || AC==0) ? 0 : (AC/AN).toFixed(3)
}

function setCustomBins(q, ds) {
  if (!q.custom_bins) return
  if (!('size' in q.custom_bins)) throw 'missing custom_bin.size'
  if (!q.term_id) throw 'missing q.term[ ]_id to set custom_bins'

  const custom_bins = q.custom_bins
  delete q.custom_bins // must not use custom_bin config as understood by get_numeric_summary below
  
  // set defaults here, only in case it is not set by the client app 
  if (!('lowerbound' in custom_bins)) custom_bins.lowerbound = 'auto'
  if (!('lowerbound_inclusive' in custom_bins)) custom_bins.lowerbound_inclusive = 0
  if (!('first_bin_uppervalue' in custom_bins)) custom_bins.first_bin_uppervalue = 'auto'
  if (!('first_bin_unit' in custom_bins)) custom_bins.first_bin_unit = 'value'
  
  if (!('upperbound' in custom_bins)) custom_bins.upperbound = 'auto'
  if (!('upperbound_inclusive' in custom_bins)) custom_bins.upperbound_inclusive = 0
  if (!('last_bin_uppervalue' in custom_bins)) custom_bins.last_bin_uppervalue = 'auto'
  if (!('last_bin_unit' in custom_bins)) custom_bins.last_bin_unit = 'value'
  
  if (!('startinclusive' in custom_bins)) custom_bins.startinclusive = 1
  if (!('stopinclusive' in custom_bins)) custom_bins.startinclusive = 0

  const bins = []
  const orderedLabels = []
  const term = ds.cohort.termdb.q.termjsonByOneid( q.term_id )
  const summary = termdbsql.get_numericsummary(q, term, ds, [], true)  
  
  const min = custom_bins.lowerbound == 'auto' 
    ? summary.min 
    : custom_bins.first_bin_unit == 'percentile' 
    ? summary.values[ Math.floor((custom_bins.lowerbound / 100) * summaries.values.length) ]
    : custom_bins.lowerbound
  const max = custom_bins.upperbound == 'auto' 
    ? summary.max
    : custom_bins.last_bin_unit == 'percentile'
    ? summary.values[ Math.floor((custom_bins.upperbound / 100) * summary.values.length) ]
    : custom_bins.upperbound
  
  let start = custom_bins.lowerbound == 'auto' ? null : min
  
  while( start <= summary.max ) {
    const upper = !bins.length && custom_bins.first_bin_uppervalue != 'auto'
      ? custom_bins.first_bin_uppervalue
      : start == null 
      ? min + custom_bins.size 
      : start + custom_bins.size

    const stop = !isNaN(custom_bins.last_bin_lowervalue) && upper > custom_bins.last_bin_lowervalue
      ? custom_bins.last_bin_lowervalue
      : upper < max 
      ? upper
      : custom_bins.upperbound == 'auto'
      ? null
      : max

    const bin = {
      start, // >= max ? max : start,
      stop, //startunbound ? min : stop,
      startunbound: start === null,
      stopunbound: stop === null,
      startinclusive: custom_bins.startinclusive,
      stopinclusive: custom_bins.stopinclusive,
    }

    if (bin.startunbound) { 
      const oper = bin.stopinclusive ? "\u2264" : "<"
      const v1 = Number.isInteger(stop) ? stop : binLabelFormatter(stop)
      bin.label = oper + binLabelFormatter(stop);
    } else if (bin.stopunbound) {
      const oper = bin.startinclusive ? "\u2265" : ">"
      const v0 = Number.isInteger(start) ? start : binLabelFormatter(start)
      bin.label = oper + v0
    } else if( Number.isInteger( custom_bins.size )) {
      // bin size is integer, make nicer label
      if( custom_bins.size == 1 ) {
        // bin size is 1; use just start value as label, not a range
        bin.label = start //binLabelFormatter(start)
      } else {
        const oper0 = custom_bins.startinclusive ? "" : ">"
        const oper1 = custom_bins.stopinclusive ? "" : "<"
        const v0 = Number.isInteger(start) ? start : binLabelFormatter(start)
        const v1 = Number.isInteger(stop) ? stop : binLabelFormatter(stop)
        bin.label = oper0 + v0 +' to '+ oper1 + v1
      }
    } else {
      const oper0 = custom_bins.startinclusive ? "" : ">"
      const oper1 = custom_bins.stopinclusive ? "" : "<"
      bin.label = oper0 + binLabelFormatter(start) +' to '+ oper1 + binLabelFormatter(stop)
    }

    bins.push( bin )
    orderedLabels.push(bin.label)
    if (stop === null 
      || (!isNaN(custom_bins.last_bin_lowervalue) && custom_bins.last_bin_lowervalue <= stop)
    ) break
    start = stop
  }

  q.custom_bins = bins
}
