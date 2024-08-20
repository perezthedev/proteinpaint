import { TermWrapper, RawTW, HandlerOpts } from '#types'
import { mayHydrateDictTwLst, get$id } from '../termsetting/termsetting.ts'
import { CategoricalInstance, CategoricalBase } from './CategoricalTW'

// type FakeInstance = {
// 	base: any
// 	id: string
// 	term: any
// 	q: any
// }

type TwInstance = CategoricalInstance //| FakeInstance

export type UseCase = {
	target: string
	detail: string
}

export type TwInitOpts = {
	useCase?: UseCase
}

export class RootTW {
	static async init(tw /*: RawTW*/, opts: HandlerOpts = {}): Promise<TwInstance> {
		const fullTW = await RootTW.fill(tw, opts)
		if (fullTW.term.type == 'categorical') return await CategoricalBase.init(fullTW, { ...opts, root: RootTW })
		throw `unable to init(tw)`
	}

	static async fill(tw /*: RawTW*/, opts: HandlerOpts = {}): Promise<TermWrapper> {
		await RootTW.preprocess(tw, opts?.vocabApi)

		switch (tw.term.type) {
			case 'categorical': {
				//const { CategoricalBase } = await import('./CategoricalTW.ts')
				if (!tw.term.id) throw 'missing tw.term.id'
				return await CategoricalBase.fill(tw, { ...opts, root: RootTW })
			}
			// case 'integer':
			// case 'float':
			// 	return

			// case 'condition':
			// 	return

			// case 'survival':
			// 	return

			// case 'geneVariant':
			// 	return

			// case 'geneExpression':
			// 	return

			default:
				throw `unrecognized tw.term?.type='${tw.term?.type}'`
		}
	}

	// can reuse this function to generate valid preprocessed tw
	// for term-type specific unit tests
	static async preprocess(tw /*: RawTW*/, vocabApi?: any) {
		const keys = Object.keys(tw)
		if (!keys.length) throw `empty tw object`
		if (tw.id && !tw.term) {
			// for dev work, testing, and URLs, it's convenient to only specify tw.id for a dictionary tw,
			// must support creating a hydrated tw.term from a minimal dict tw
			await mayHydrateDictTwLst([tw], vocabApi)
		}

		if (!tw.q) tw.q = {}
		tw.q.isAtomic = true
		reshapeLegacyTw(tw)
	}
}

// check for legacy tw structure that could be
// present in old saved sessions
function reshapeLegacyTw(tw) {
	// check for legacy q.groupsetting{}
	if (Object.keys(tw.q).includes('groupsetting')) {
		if (!tw.q.groupsetting.inuse) {
			tw.q.type = 'values'
		} else if (tw.q.type == 'predefined-groupset') {
			tw.q.predefined_groupset_idx = tw.q.groupsetting.predefined_groupset_idx
		} else if (tw.q.type == 'custom-groupset') {
			tw.q.customset = tw.q.groupsetting.customset
		} else {
			throw 'invalid q.type'
		}
		delete tw.q['groupsetting']
	}
}
