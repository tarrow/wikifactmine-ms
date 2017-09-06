var fs = require('fs')
var _ = require('lodash')
var request = require('request-promise-native')
var stringify = require('csv-stringify')

// this will return tf-idf for different terms in the elasticsearch index by dictionary
var fileContents = fs.readFileSync('celllines-sample.json')
var totalCounts = {} // this should be populated with all the counts needed
var data = JSON.parse(fileContents)
var results = []
var qids = []
var pmcids = []

var resolveUrlBuilder = function (pmcid) {
  if (/^PMC/.test(pmcid)) {
    pmcid = pmcid.slice(3)
  }
  return `https://query.wikidata.org/bigdata/namespace/wdq/sparql?query=SELECT%20%3Fitem%20%3Ftitle%20%0AWHERE%20%0A%7B%0A%20%20%3Fitem%20wdt%3AP1476%20%3Ftitle%20.%0A%20%20%3Fitem%20wdt%3AP932%20%22${pmcid}%22%0A%7D&format=json`
}

// From https://stackoverflow.com/questions/24586110/resolve-promises-one-after-another-i-e-in-sequence
var serial = funcs =>
funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]))

var doExtraction = function (element) {
  var paperPMCID = element.key
  var mainTopicID = element.fact_count.buckets[0].key
  qids.push(mainTopicID)
  pmcids.push(paperPMCID)

  return request.get({
    url: resolveUrlBuilder(paperPMCID),
    json: true
  })
  .then(function (response) {
    var title = response.results.bindings[0].title.value
    var re = /Q[0-9]+$/
    var paperWikiId = re.exec(response.results.bindings[0].item.value)[0]
    results.push({
      paper: paperPMCID,
      paperWikiId: paperWikiId,
      paperTitle: title,
      mainTopics: [
        {id: mainTopicID, term: element.fact_count.buckets[0].documents.hits.hits[0]._source.term, score: element.fact_count.buckets[0].doc_count / element.doc_count}
      ]
    })
  })
  .catch(() => { return {} })
}

// build set of all paper IDs and get their title uysing SPARQL

// build set of all QIDs (terms) then resolve them

// How to turn qids back into documents?
// either: hit sparql
// look up from our static dictionaries
// test what is in elasticsearch

var resolveWID = function (qid) {

}

var funcs = data.aggregations.papers.buckets.map(element => () => doExtraction(element))
serial(funcs)
.then(() => {
  var uniqQids = _.uniq(qids)
  var funcs = uniqQids.map(qid => () => resolveWID(qid))
})
.then(() => {

  var sortedResults = _.orderBy(results, ['mainTopics[0].score'], ['desc'])
  stringify(sortedResults.map((x) => {
    return [
      x.paper,
      x.paperWikiId,
      x.paperTitle,
      x.mainTopics[0].id,
      x.mainTopics[0].term,
      x.mainTopics[0].score,
      x.paperWikiId + '\tP921\t' + x.mainTopics[0].id
    ]
  }), (err, out) => {
    if (err) throw err
    console.log(out)
  })
})

// written to CSV we would like: Paper Q1234, Paper Title, Suggested Q12345, Score, Term)
