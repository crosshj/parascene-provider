import { generateFluxImage } from './flux.js';

/** Response for advanced_query (no credits). */
export function getAdvancedQueryResponse(body) {
	console.log('getAdvancedQueryResponse', body);
	// TODO: will want to be honest about the cost and support based on the query
	return { supported: true, cost: 3 };
}

const ADVANCED_GENERATE_CREDITS = 3;

/** Generate image for advanced_generate: "advanced generate" in gold letters via Flux 2 Pro. Returns result with credits. */
export async function generateAdvancedImage(body) {
	console.log('generateAdvancedImage', body);
	const result = await generateFluxImage({
		model: 'flux2Pro',
		prompt:
			'the text "advanced generate" in large gold letters, clean typography on a simple black background',
	});
	return { ...result, credits: ADVANCED_GENERATE_CREDITS };
}
