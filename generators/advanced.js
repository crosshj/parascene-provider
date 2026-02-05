import { generateFluxImage } from './flux.js';

/** Response for advanced_query (no credits). */
export function getAdvancedQueryResponse(body) {
	console.log('getAdvancedQueryResponse', body);
	// TODO: will want to be honest about the cost and support based on the query
	return { supported: true, cost: 3 };
}

const ADVANCED_GENERATE_CREDITS = 3;

/** Count items by source for prompt. */
function countBySource(items) {
	if (!Array.isArray(items) || items.length === 0) return null;
	const bySource = {};
	for (const item of items) {
		const s = item?.source != null ? String(item.source) : 'unknown';
		bySource[s] = (bySource[s] ?? 0) + 1;
	}
	return bySource;
}

/** Generate image for advanced_generate: "advanced generate" in gold letters via Flux 2 Pro. Returns result with credits. */
export async function generateAdvancedImage(body) {
	const items = body?.args?.items ?? [];
	const bySource = countBySource(items);
	const total = items.length;

	let itemsLine = '';
	if (total > 0 && bySource) {
		const parts = Object.entries(bySource)
			.sort((a, b) => b[1] - a[1])
			.map(([source, count]) => `${source}: ${count}`);
		itemsLine = `\nUnder this show the text "items: ${total}" and below that "${parts.join(', ')}"`;
	}

	const result = await generateFluxImage({
		model: 'flux2Pro',
		prompt:
			'the text "advanced generate" in large gold letters, clean typography on a simple black background' +
			itemsLine,
	});
	return { ...result, credits: ADVANCED_GENERATE_CREDITS };
}
