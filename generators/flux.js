import { getPoem, annotatePoemWithJimp } from './zydeco.js';
import { rewritePoemWithOpenAI } from './zydeco.llm';
import { imagePoemPrompt } from './zydeco.prompt.js';

const { FLUX_API_KEY } = process.env;
const url = 'https://api.bfl.ai/v1/flux-2-pro';

export async function flux(prompt) {
	if (!FLUX_API_KEY) throw new Error('FLUX_API_KEY missing');
	if (!prompt || typeof prompt !== 'string' || !prompt.trim())
		throw new Error('A prompt string is required');

	const startTime = Date.now();

	const post = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-key': FLUX_API_KEY,
		},
		body: JSON.stringify({
			prompt,
			prompt_upsampling: false,
			// input_image: 'string',
			// input_image_2: 'string',
			seed: 0,
			width: 1024,
			height: 1024,
		}),
	});
	if (!post.ok) throw new Error(await post.text());
	const { polling_url, ...rest } = await post.json();

	let pollCount = 0;

	for (;;) {
		pollCount++;
		const poll = await fetch(polling_url, {
			headers: {
				'x-key': FLUX_API_KEY,
			},
		});
		if (!poll.ok) throw new Error(await poll.text());
		const j = await poll.json();

		const { status, ...jRest } = j;

		if (status === 'Ready') {
			const img = await fetch(j.result.sample);
			if (!img.ok) throw new Error(await img.text());
			const buffer = Buffer.from(await img.arrayBuffer());
			const duration = Date.now() - startTime;

			return {
				buffer,
				duration,
				pollCount,
				final: jRest,
				...rest,
			};
		}
		if (status === 'Error' || status === 'Failed')
			throw new Error(JSON.stringify(j));

		await new Promise((r) => setTimeout(r, 400));
	}
}

export async function generateFluxImage(args = {}) {
	const result = await flux(args.prompt || args.text);
	return {
		...result,
		width: 1024,
		height: 1024,
		prompt: (args.prompt || args.text || '').trim(),
	};
}

const styledPrompt = ({ poem, style }) =>
	`
${poem}

style
-----
${style}

`.trim();

export async function generatePoeticImageFlux(args = {}) {
	const poem = getPoem();
	const poemPlusAI = await rewritePoemWithOpenAI({
		key: process.env.OPENAI_API_KEY,
		poem,
	});
	//TODO: handle !poemPlusAI?.ok case

	const prompt = args?.style
		? styledPrompt({ poem: poemPlusAI.text, style: args.style })
		: poemPlusAI.text;

	console.log(poemPlusAI);

	const result = await generateFluxImage({ prompt });
	const annotated = await annotatePoemWithJimp(result.buffer, poemPlusAI.text);
	if (!annotated.ok) {
		throw new Error(`Failed to annotate poem: ${annotated.message}`);
	}

	return {
		...result,
		buffer: annotated.buffer,
		description: poemPlusAI.text,
	};
}
