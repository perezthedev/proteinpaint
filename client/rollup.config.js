import pkg from './package.json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'
import { terser } from 'rollup-plugin-terser'
import json from '@rollup/plugin-json'
import path from 'path'

const production = !process.env.ROLLUP_WATCH && process.env.NODE_ENV !== 'dev'

function onwarn(message, warn) {
	if (message.code === 'CIRCULAR_DEPENDENCY') return
	warn(message)
}

export default [
	{
		input: path.join(__dirname, './src/app.js'),
		output: { dir: path.join(__dirname, 'dist'), format: 'es' },
		external: [...Object.keys(pkg.peerDependencies ? pkg.peerDependencies : {})],
		plugins: [
			resolve({
				main: true
			}),
			json(),
			commonjs({
				extensions: ['.js']
			}),
			postcss(),
			// for GDC webpack 3 use case: do not use terser by running
			// `cd client && rm -rf dist && NODE_ENV=dev npx rollup -c ./rollup.config.js`
			production && terser()
		],
		onwarn
	}
]
