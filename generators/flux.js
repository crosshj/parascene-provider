import { getPoem, annotatePoemWithJimp } from './zydeco.js';
import { rewritePoemWithOpenAI } from './zydeco.llm.js';
import sharp from 'sharp';
import { log } from './utils.js';

const { FLUX_API_KEY } = process.env;
const url = 'https://api.bfl.ai/v1/flux-2-pro';

async function fluxRequest(payload = {}) {
	if (!FLUX_API_KEY) throw new Error('FLUX_API_KEY missing');

	const prompt = payload?.prompt;
	if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
		throw new Error('A prompt string is required');
	}

	const startTime = Date.now();
	let rest = null;

	try {
		const post = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-key': FLUX_API_KEY,
			},
			body: JSON.stringify({
				...payload,
				prompt: prompt.trim(),
			}),
		});
		if (!post.ok) throw new Error(await post.text());
		const { polling_url, ...r } = await post.json();
		rest = r;

		log('Flux request created', {
			id: rest.id,
			cost: rest.cost,
			input_mp: rest.input_mp,
			output_mp: rest.output_mp,
		});

		let pollCount = 0;

		for (; ;) {
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
				let meta = null;
				try {
					meta = await sharp(buffer).metadata();
				} catch {
					// ignore metadata failures
				}
				const duration = Date.now() - startTime;

				log('Flux request ready', {
					id: rest.id,
					cost: rest.cost,
					input_mp: rest.input_mp,
					output_mp: rest.output_mp,
					duration_ms: duration,
					pollCount,
				});

				return {
					buffer,
					width: typeof meta?.width === 'number' ? meta.width : undefined,
					height: typeof meta?.height === 'number' ? meta.height : undefined,
					format: meta?.format,
					mime: img.headers.get('content-type') || undefined,
					duration,
					pollCount,
					final: jRest,
					...rest,
				};
			}
			// Per BFL get_result docs: only poll while Pending.
			if (status !== 'Pending') {
				log('Flux non-pending status', { id: rest?.id, status, response: j });
				throw new Error(
					`Flux request did not complete: status=${status} id=${rest?.id || 'unknown'}`
				);
			}

			log('Polling...');
			await new Promise((r) => setTimeout(r, 1000));
		}
	} catch (err) {
		log('Flux request error', {
			id: rest?.id,
			message: err?.message || String(err),
		});
		throw err;
	}
}

export async function flux(prompt) {
	return fluxRequest({
		prompt,
		prompt_upsampling: false,
		seed: 0,
		width: 1024,
		height: 1024,
	});
}

export async function generateFluxImage(args = {}) {
	const result = await flux(args.prompt || args.text);
	return {
		...result,
		width: 1024,
		height: 1024,
		prompt: (args.prompt || args.text || '').trim(),
		color: '#000000',
		width: 1024,
		height: 1024,
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
		color: '#000000',
		width: 1024,
		height: 1024,
	};
}

export async function fluxImageEdit(args = {}) {
	if (!args || typeof args !== 'object')
		throw new Error('Arguments object is required');

	const prompt = (args.prompt || args.text || '').trim();
	if (!prompt) throw new Error('A prompt string is required');

	const image_url = (args.image_url || '').trim();
	if (!image_url) throw new Error('An image_url is required');

	// Validate URL shape early for clearer errors.
	try {
		new URL(image_url);
	} catch {
		throw new Error('image_url must be a valid URL');
	}

	const img = await fetch(image_url);
	if (!img.ok) throw new Error(`Failed to download image: ${await img.text()}`);
	const imgBuf = Buffer.from(await img.arrayBuffer());

	// Per BFL docs: input_image supports up to 20MB.
	const maxBytes = 20 * 1024 * 1024;
	if (imgBuf.length > maxBytes)
		throw new Error(
			`Input image too large: ${imgBuf.length} bytes (max ${maxBytes})`
		);

	const input_image = imgBuf.toString('base64');
	const result = await fluxRequest({
		prompt,
		input_image,
		prompt_upsampling: false,
		seed: 0,
		output_format: 'png',
	});

	if (typeof result.width !== 'number' || typeof result.height !== 'number') {
		// API layer expects numeric dimensions for headers.
		throw new Error('Unable to determine output image dimensions');
	}

	return {
		...result,
		prompt,
		image_url,
		color: '#000000',
	};
}
