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
	/** Map input_images to custom-named fields by position (one or more). */
	imgNamed: (fieldNames) => (args) => {
		if (!args.input_images?.length) return args;
		const modded = { ...args };
		fieldNames.forEach((name, i) => {
			const value = args.input_images[i];
			if (value != null) modded[name] = value;
		});
		return modded;
	},
};

const SDXL_NEG = 'worst quality, low quality, frame, border, signature, watermark';
const randomSeed = () => Math.floor(Math.random() * 1000000);

const modelArgsAdapters = {
	// multiple image input
	'google/nano-banana': (args) => xfrm.arrNamed('image_input')({
		...args,
		"aspect_ratio": "1:1",
		"output_format": "png"
		// no support for disable_safety_checker
	}),
	// 'black-forest-labs/flux-2-pro': (args) => xfrm.arrNamed('input_images')({
	// 	...args,
	// 	"resolution": "1 MP",
	// 	"aspect_ratio": "1:1",
	// 	"output_format": "png",
	// 	// "output_quality": 100,
	// 	"safety_tolerance": 5
	// }),
	'black-forest-labs/flux-2-pro': (args) => xfrm.noImg({
		...args,
		"resolution": "1 MP",
		"aspect_ratio": "1:1",
		"output_format": "png",
		// "output_quality": 100,
		"safety_tolerance": 5
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
		...args,
		"aspect_ratio": "1:1",
		"prompt_upsampling": false,
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
	const model = (args.model ?? '').toString().trim();
	const prompt = (args.prompt ?? '').toString().trim();
	if (!model) throw new Error('Replicate model is required');
	if (!prompt) throw new Error('Replicate prompt is required');

	const token = process.env.REPLICATE_API_TOKEN;
	if (!token || typeof token !== 'string') {
		throw new Error('REPLICATE_API_TOKEN is not set');
	}

	const { model: _model, prompt: _prompt, ...rest } = args;
	let input = { prompt, ...rest };

	const baseModel = model.split(':')[0];
	const adapter = modelArgsAdapters[baseModel];
	if (adapter) {
		input = adapter(input);
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
