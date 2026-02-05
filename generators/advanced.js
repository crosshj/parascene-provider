import { generateFluxImage } from './flux.js';
import { makeFluxPrompt } from './openai.js';

/** Response for advanced_query (no credits). */
export function getAdvancedQueryResponse(body) {
	console.log('getAdvancedQueryResponse', body);
	// TODO: will want to be honest about the cost and support based on the query
	return { supported: true, cost: 3 };
}

const ADVANCED_GENERATE_CREDITS = 3;

/** Generate image for advanced_generate: use OpenAI to build a Flux prompt from args (items + optional prompt), then render via Flux 2 Pro. */
export async function generateAdvancedImage(body) {
	const args = body?.args ?? {};
	const items = args.items ?? [];
	const userPrompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';

	const input = { items };
	if (userPrompt) input.prompt = userPrompt;

	const fluxPrompt = await makeFluxPrompt(input);
	if (!fluxPrompt) {
		throw new Error('Failed to generate');
	}

	const result = await generateFluxImage({
		model: 'flux2Pro',
		prompt: fluxPrompt,
	});
	return { ...result, credits: ADVANCED_GENERATE_CREDITS };
}
