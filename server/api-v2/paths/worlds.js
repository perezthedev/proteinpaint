export default function (helpers) {
	let operations = {
		GET
	}

	function GET(req, res, next) {
		//console.log(6, req.query.name)
		const data = { hello: helpers.capitalize(req.query.name) } //console.log(7, data)
		res.status(200).json(data)
	}

	// NOTE: We could also use a YAML string here.
	GET.apiDoc = {
		summary: 'Returns worlds by name.',
		operationId: 'getWorlds',
		parameters: [
			{
				in: 'query',
				name: 'name',
				required: true,
				type: 'string'
			}
		],
		responses: {
			200: {
				description: 'A list of worlds that match the requested name.',
				schema: {
					type: 'array',
					items: {
						$ref: '#/definitions/World'
					}
				}
			},
			default: {
				description: 'An error occurred',
				schema: {
					additionalProperties: true
				}
			}
		}
	}

	return operations
}
