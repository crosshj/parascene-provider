/**
 * Synthetic aspect ratios: advertised to clients but produced by generating at
 * `generateAs` (a native provider ratio) then post-processing with `postProcess`.
 *
 * Not model-specific — models opt in via synthetic_aspect_ratios on their config entry.
 */
const SYNTHETIC_ASPECT_RATIOS = {
	'4:5': {
		generateAs: '3:4',
		postProcess: 'crop',
	},
};

function getSyntheticAspectRatioDef(key) {
	const k = String(key ?? '').trim();
	if (!k) return null;
	const def = SYNTHETIC_ASPECT_RATIOS[k];
	if (!def || typeof def !== 'object') return null;
	const generateAs = String(def.generateAs ?? '').trim();
	if (!generateAs) return null;
	const postProcess = def.postProcess === 'letterbox' ? 'letterbox' : 'crop';
	return { key: k, generateAs, postProcess };
}

export { SYNTHETIC_ASPECT_RATIOS, getSyntheticAspectRatioDef };
