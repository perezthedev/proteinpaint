import express from 'express'
import { initialize } from 'express-openapi'
import helpers from './services/helpers.js'
import apiDoc from './api.doc.js'

const app = express()
initialize({
	app,
	// NOTE: If using yaml you can provide a path relative to process.cwd() e.g.
	// apiDoc: './api-v1/api-doc.yml',
	apiDoc,
	dependencies: {
		helpers,
		genomes: {}
	},
	paths: './paths'
})

const port = 3002
console.log(`listening to port=${port}`)
app.listen(port)
