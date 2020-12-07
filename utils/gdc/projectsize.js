const got = require('got')
const token = process.argv[2]

const query = `
query CancerDistributionSsmTable_relayQuery(
  $ssmTested: FiltersArgument
) {
  viewer {
    explore {
      cases {
        total: aggregations(filters: $ssmTested) {
          project__project_id {
            buckets {
              doc_count
              key
            }
          }
          project__disease_type {
            buckets {
              doc_count
              key
            }
          }
          project__primary_site{
            buckets {
              doc_count
              key
            }
          }
        }
      }
    }
  }
}
`

const variables = {
	ssmTested: {
		op: 'and',
		content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
	}
}
const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
if (token) headers['X-Auth-Token'] = token
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers,
			body: JSON.stringify({ query, variables })
		})
		const re = JSON.parse(response.body)
		{
			const lst = re.data.viewer.explore.cases.total.project__project_id.buckets
			for (const v of lst) {
				console.log(v.key, v.doc_count)
			}
			console.log(lst.length, 'projects')
		}
		{
			const lst = re.data.viewer.explore.cases.total.project__disease_type.buckets
			for (const v of lst) {
				console.log(v.key, v.doc_count)
			}
			console.log(lst.length, 'disease types')
		}
		{
			const lst = re.data.viewer.explore.cases.total.project__primary_site.buckets
			for (const v of lst) {
				console.log(v.key, v.doc_count)
			}
			console.log(lst.length, 'primary sites')
		}
	} catch (error) {
		console.log(error)
	}
})()
