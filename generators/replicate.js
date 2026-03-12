import Replicate from 'replicate';
import sharp from 'sharp';
import { log, fetchImageBuffer } from './utils.js';

// --- Image-input adapter patterns (args.input_images → model-specific fields) ---

const xfrm = {
	/** No image input support; input_images ignored. */
	noImg: (args) => args,
	/** Map input_images array to a single non-standard field name (e.g. image_input). */
	arrNamed: (outputKey) => (args) => {
		if (!args.input_images?.length) return args;
		return { ...args, [outputKey]: args.input_images };
	},
	/** Map input_images to custom-named fields by position (one or more). Do not send input_images to the API. */
	imgNamed: (fieldNames) => (args) => {
		if (!args.input_images?.length) return args;
		const modded = { ...args };
		fieldNames.forEach((name, i) => {
			const value = args.input_images[i];
			if (value != null) modded[name] = value;
		});
		delete modded.input_images;
		return modded;
	},
};

/** Extract URL string from input_images element (string or { url } object). */
function toImageUrl(val) {
	if (val == null) return null;
	if (typeof val === 'string') return val.trim() || null;
	if (val && typeof val === 'object' && typeof val.url === 'string')
		return val.url.trim() || null;
	return null;
}

/** Normalize image to data URI with explicit format. Replicate/xai models require format; URLs without extension fail. */
async function normalizeImageToDataUri(imageInput) {
	const url = toImageUrl(imageInput);
	if (!url) return null;
	const { buffer } = await fetchImageBuffer(url);
	const png = await sharp(buffer).png().toBuffer();
	return `data:image/png;base64,${png.toString('base64')}`;
}

const SDXL_NEG = 'worst quality, low quality, frame, border, signature, watermark';
const randomSeed = () => Math.floor(Math.random() * 1000000);

const modelArgsAdapters = {
	// multiple image input
	'black-forest-labs/flux-2-max': (args) => (xfrm.arrNamed('input_images')({
		...args,
		"resolution": "1 MP",
		"aspect_ratio": "1:1",
		"output_format": "png",
		"safety_tolerance": 5
	})),
	'black-forest-labs/flux-2-pro': (args, ctx) => (ctx?.method === 'replicatePro'
		// multiple image input mode (expensive)
		? xfrm.arrNamed('input_images')({
			...args,
			"resolution": "1 MP",
			"aspect_ratio": "1:1",
			"output_format": "png",
			"safety_tolerance": 5
		})
		// generate & single image input mode (cheaper) — omit input_images when none provided
		: (() => {
			const { input_images, ...rest } = args;
			const first = input_images?.[0];
			const result = {
				...rest,
				"resolution": "1 MP",
				"aspect_ratio": "1:1",
				"output_format": "png",
				"safety_tolerance": 5
			};
			if (first != null) result.input_images = [first];
			return result;
		})()),
	'google/nano-banana-2': (args) => xfrm.arrNamed('image_input')({
		...args,
		"aspect_ratio": "1:1",
		"resolution": "1K",
		"output_format": "png",
		"image_search": true,
		"google_search": true,
		"output_format": "png",
		// no support for disable_safety_checker
	}),
	'google/nano-banana-pro': (args) => xfrm.arrNamed('image_input')({
		...args,
		"aspect_ratio": "1:1",
		"resolution": "1K",
		"output_format": "png",
		"allow_fallback_model": false,
		"safety_filter_level": "block_only_high",
	}),
	'openai/gpt-image-1.5': (args) => xfrm.arrNamed('input_images')({
		...args,
		"quality": "high",
		"background": "opaque",
		"aspect_ratio": "1:1",
		"output_format": "png",
		"input_fidelity": "high",
		"number_of_images": 1,
		"output_compression": 90,
		"moderation": "low",
	}),
	// END PRO MODELS

	'google/nano-banana': (args) => xfrm.arrNamed('image_input')({
		...args,
		"aspect_ratio": "1:1",
		"output_format": "png"
		// no support for disable_safety_checker
	}),

	'bytedance/seedream-4': (args) => xfrm.arrNamed('image_input')({
		...args,
		"size": "1K",
		"aspect_ratio": "1:1",
		"width": 1024,
		"height": 1024,
		"max_images": 1,
		"enhance_prompt": false,
		"sequential_image_generation": "disabled",
		// no support for disable_safety_checker
	}),
	'prunaai/p-image-edit': (args) => xfrm.arrNamed('images')({
		...args,
		"aspect_ratio": "1:1",
		turbo: true,
		seed: randomSeed(),
		disable_safety_checker: true,
	}),

	// named multiple
	'luma/photon': (args) => xfrm.imgNamed([
		'image_reference',
		'style_reference',
		'character_reference'
	])({
		...args,
		aspect_ratio: "1:1",
		"image_reference_weight": 0.85,
		"style_reference_weight": 0.85,
		seed: randomSeed(),
		// no support for disable_safety_checker
	}),
	'stability-ai/sdxl': (args) => xfrm.imgNamed([
		'image',
		'mask'
	])({
		...args,
		width: 1024,
		height: 1024,
		"scheduler": "K_EULER",
		"num_outputs": 1,
		"guidance_scale": 7.5,
		"apply_watermark": false,
		"prompt_strength": 0.9,
		"num_inference_steps": 25,
		negative_prompt: SDXL_NEG,
		seed: randomSeed(),
		// "refine": "expert_ensemble_refiner",
		// "high_noise_frac": 0.8,
		// "lora_scale": 0.6,
		disable_safety_checker: true,
	}),

	// single image input
	'qwen/qwen-image-edit': (args) => xfrm.imgNamed(['image'])({
		...args,
		"go_fast": true,
		"aspect_ratio": "1:1",
		seed: randomSeed(),
		"output_format": "png",
		// "output_quality": 100,
		disable_safety_checker: true,
	}),
	// xai/grok-imagine-image requires format in URL; URLs without extension fail with "Invalid image format ''"
	'xai/grok-imagine-image': (args) => xfrm.imgNamed(['image'])({
		...args,
		"aspect_ratio": "1:1",
		seed: randomSeed(),
		// no support for disable_safety_checker
	}),
	'minimax/image-01': (args) => xfrm.imgNamed(['subject_reference'])({
		...args,
		"aspect_ratio": "1:1",
		"number_of_images": 1,
		"prompt_optimizer": false,
		// no support for disable_safety_checker
	}),
	// 'stability-ai/stable-diffusion-3': (args) => xfrm.imgNamed(['image'])({
	// 	...args,
	// 	"cfg": 3.5,
	// 	"seed": 1,
	// 	"steps": 28,
	// 	"aspect_ratio": "1:1",
	// 	"negative_prompt": SDXL_NEG,
	// 	"prompt_strength": 0.85,
	// 	seed: randomSeed(),
	// 	"output_format": "png",
	// 	// "output_quality": 100,
	// 	disable_safety_checker: true,
	// }),

	// no image input
	'qwen/qwen-image': (args) => xfrm.noImg({
		...args,
		"aspect_ratio": "1:1",
		"go_fast": true,
		"guidance": 4,
		"strength": 0.9,
		"image_size": "optimize_for_quality",
		"lora_scale": 1,
		"output_format": "png",
		"enhance_prompt": false,
		"output_quality": 80,
		"negative_prompt": SDXL_NEG,
		"num_inference_steps": 50,
		seed: randomSeed(),
		disable_safety_checker: true,
	}),
	'prunaai/p-image': (args) => xfrm.noImg({
		"prompt_upsampling": false,
		...args,
		"aspect_ratio": "1:1",
		seed: randomSeed(),
		// "lora_scale": 0.5,
		disable_safety_checker: true,
	}),
	'prunaai/z-image-turbo': (args) => xfrm.noImg({
		...args,
		"width": 1024,
		"height": 1024,
		"go_fast": false,
		"output_format": "png",
		"guidance_scale": 0,
		"num_inference_steps": 8,
		seed: randomSeed(),
		// "output_quality": 100,
		// no support for disable_safety_checker
	}),
	'leonardoai/lucid-origin': (args) => xfrm.noImg({
		...args,
		"style": "none",
		"contrast": "medium",
		"num_images": 1,
		"aspect_ratio": "1:1",
		"prompt_enhance": false,
		"generation_mode": "standard",
		// no support for disable_safety_checker
	}),
	'recraft-ai/recraft-v4': (args) => xfrm.noImg({
		...args,
		aspect_ratio: '1:1',
		size: '1024x1024',
		// no support for disable_safety_checker
	}),
	'bytedance/sdxl-lightning-4step': (args) => xfrm.noImg({
		...args,
		width: 1024,
		height: 1024,
		negative_prompt: SDXL_NEG,
		seed: randomSeed(),
		disable_safety_checker: true,
	}),
};


/**
 * Get the first image URL from Replicate run output.
 * Output may be a single FileOutput/URL, an array, or nested structure.
 * @param {unknown} output
 * @returns {string}
 */
function getFirstImageUrl(output) {
	if (output == null) {
		throw new Error('Replicate run returned no output');
	}
	const first = Array.isArray(output) ? output[0] : output;
	if (first == null) {
		throw new Error('Replicate run returned empty output');
	}
	// FileOutput has .url() (returns URL) and .toString() (returns url string)
	if (typeof first.url === 'function') {
		const u = first.url();
		return typeof u === 'string' ? u : String(u?.href ?? u);
	}
	if (
		typeof first.toString === 'function' &&
		(first.toString() || '').startsWith('http')
	) {
		return first.toString();
	}
	if (
		typeof first === 'string' &&
		(first.startsWith('http') || first.startsWith('data:'))
	) {
		return first;
	}
	if (first && typeof first === 'object' && typeof first.url === 'string') {
		return first.url;
	}
	throw new Error('Replicate output did not contain an image URL');
}

/**
 * Run a Replicate model and return the first image as a buffer with dimensions.
 * Args: model (required), prompt (required), input_images? (optional), and any model-specific input fields.
 *
 * @param {object} args - model, prompt, input_images?, and other input fields
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
export async function generateReplicateImage(args = {}) {
	const { _method, ...restArgs } = args;
	const method = _method === 'replicatePro' ? 'replicatePro' : 'replicate';
	const ctx = { method };

	const model = (restArgs.model ?? '').toString().trim();
	const prompt = (restArgs.prompt ?? '').toString().trim();
	if (!model) throw new Error('Replicate model is required');
	if (!prompt) throw new Error('Replicate prompt is required');

	const token = process.env.REPLICATE_API_TOKEN;
	if (!token || typeof token !== 'string') {
		throw new Error('REPLICATE_API_TOKEN is not set');
	}

	const baseModel = model.split(':')[0];
	if (
		baseModel === 'black-forest-labs/flux-2-pro' &&
		method === 'replicatePro' &&
		!restArgs.input_images?.length
	) {
		throw new Error(
			'Include at least one input image. Add input images or use the standard Replicate Flux 2 Pro model.'
		);
	}

	const { model: _model, prompt: _prompt, ...rest } = restArgs;
	let input = { prompt, ...rest };
	const adapter = modelArgsAdapters[baseModel];
	if (adapter) {
		input = adapter(input, ctx);
	}
	if (Object.prototype.hasOwnProperty.call(input, '_method')) {
		delete input._method;
	}

	// Models that require explicit image format (Replicate infers from URL; URLs without extension fail)
	const imageFormatStrictModels = new Set(['xai/grok-imagine-image']);
	if (imageFormatStrictModels.has(baseModel) && input.image) {
		const normalized = await normalizeImageToDataUri(input.image);
		if (normalized) input = { ...input, image: normalized };
	}

	const replicate = new Replicate({ auth: token });

	log('Replicate run', { model, inputKeys: Object.keys(input || {}) });

	const output = await replicate.run(model, { input });

	const imageUrl = getFirstImageUrl(output);
	const { buffer } = await fetchImageBuffer(imageUrl);

	const meta = await sharp(buffer).metadata();
	const width = typeof meta.width === 'number' ? meta.width : 1024;
	const height = typeof meta.height === 'number' ? meta.height : 1024;

	return {
		buffer: await sharp(buffer).png().toBuffer(),
		width,
		height,
	};
}

/**
 * Run a Replicate video model and return the video as a buffer.
 * Args: model (optional, defaults to wan-video/wan-2.2-i2v-fast), prompt (required), image (required).
 *
 * @param {object} args - model?, prompt, image
 * @returns {Promise<{ videoBuffer: Buffer }>}
 */
export async function generateReplicateVideo(args = {}) {
	const { _async, job_id, prediction_id, ...rest } = args || {};

	const rawModel = rest.model ?? 'wan-video/wan-2.2-i2v-fast';
	const model = rawModel.toString().trim() || 'wan-video/wan-2.2-i2v-fast';
	const prompt = (rest.prompt ?? '').toString().trim();
	const image = (rest.image ?? '').toString().trim();

	const token = process.env.REPLICATE_API_TOKEN;
	if (!token || typeof token !== 'string') {
		throw new Error('REPLICATE_API_TOKEN is not set');
	}

	const replicate = new Replicate({ auth: token });

	// Async mode: act as a thin proxy around Replicate predictions API.
	if (_async) {
		// Poll existing job (client-facing job_id, internally a Replicate prediction id)
		const existingId = job_id || prediction_id;
		if (existingId) {
			const id = existingId.toString().trim();
			const prediction = await replicate.predictions.get(id);

			// If the async job has completed successfully, download and return the video buffer.
			// Replicate video predictions may return a single URL string or an array; getFirstImageUrl
			// normalizes either shape.
			if (prediction && prediction.status === 'succeeded' && prediction.output != null) {
				const videoUrl = getFirstImageUrl(prediction.output);
				const { buffer } = await fetchImageBuffer(videoUrl);
				return {
					videoBuffer: buffer,
					job_id: id,
				};
			}

			return {
				async: true,
				status: prediction?.status ?? 'unknown',
				job_id: id,
			};
		}

		// Start a new prediction (no blocking)
		if (!prompt) throw new Error('Replicate video prompt is required');
		if (!image) throw new Error('Replicate video image is required');

		const input = {
			image,
			last_image: image,
			prompt,
			go_fast: true,
			num_frames: 97,
			resolution: '480p',
			sample_shift: 12,
			frames_per_second: 16,
			interpolate_output: false,
			lora_scale_transformer: 1,
			lora_scale_transformer_2: 1,
			disable_safety_checker: true,
		};

		log('Replicate video prediction.create (async)', {
			model,
			inputKeys: Object.keys(input || {}),
		});

		const prediction = await replicate.predictions.create({
			model,
			input,
		});

		return {
			async: true,
			status: prediction?.status ?? 'starting',
			job_id: prediction.id,
		};
	}

	// Synchronous mode: block until video is ready and return buffer.
	if (!prompt) throw new Error('Replicate video prompt is required');
	if (!image) throw new Error('Replicate video image is required');

	const input = {
		image,
		last_image: image,
		prompt,
		go_fast: true,
		num_frames: 97,
		resolution: '480p',
		sample_shift: 12,
		frames_per_second: 16,
		interpolate_output: false,
		lora_scale_transformer: 1,
		lora_scale_transformer_2: 1,
		disable_safety_checker: true,
	};

	log('Replicate video run (sync)', { model, inputKeys: Object.keys(input || {}) });

	const output = await replicate.run(model, { input });

	const videoUrl = getFirstImageUrl(output);
	const { buffer } = await fetchImageBuffer(videoUrl);

	return {
		videoBuffer: buffer,
	};
}
