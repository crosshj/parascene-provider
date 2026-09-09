import { getSyntheticAspectRatioDef } from './syntheticAspectRatios.js';
import { pickNearestNativeAspectRatio } from '../lib/aspectRatio.js';
import {
	GEMINI_SYSTEM_VOICES,
	MINIMAX_SPEECH_EMOTIONS,
	MINIMAX_SPEECH_VOICE_OPTIONS,
	SPEECH_MODEL_GEMINI,
	SPEECH_MODEL_MINIMAX,
	MUSIC_MODEL_LYRIA,
	MUSIC_MODEL_MINIMAX,
} from './audioVoices.js';

const fluxResolutionOptions = [
	{ label: 'NES 8-bit', value: 'nes_8bit' },
	{ label: 'SNES 16-bit', value: 'snes_16bit' },
	{ label: 'AI Legacy', value: 'ai_legacy' },
	{ label: 'AI Classic', value: 'ai_classic' },
	{ label: 'AI Latest', value: 'ai_latest' },
];

/** replicate method: aspect ratios advertised to host. */
const ASPECT_RATIO_OPTIONS = ['1:1', '4:5', '9:16', '16:9'];

/** Native API ratios shared by most Replicate image models (4:5 is synthetic via 3:4). */
const DEFAULT_NATIVE_ASPECT_RATIOS = ['1:1', '9:16', '16:9', '3:4'];

function replicateModelBase(modelRef) {
	return String(modelRef ?? '').split(':')[0].trim();
}

function findReplicateModelEntry(method, modelRef) {
	const base = replicateModelBase(modelRef);
	const list = method === 'replicatePro' ? replicateProModels : replicateModels;
	return (
		list.find(
			(o) => typeof o.value === 'string' && o.value.split(':')[0].trim() === base
		) ?? null
	);
}

/**
 * Resolve client aspect_ratio to API input and optional post-processing (e.g. 4:5 via 3:4 crop).
 * @param {string} modelRef
 * @param {'replicate' | 'replicatePro'} method
 * @param {string} [raw]
 */
function resolveAspectRatioPlan(modelRef, method, raw) {
	const requested = String(raw ?? '').trim() || '1:1';
	const base = replicateModelBase(modelRef);
	const entry = findReplicateModelEntry(method, modelRef);

	if (!ASPECT_RATIO_OPTIONS.includes(requested)) {
		throw new Error(
			`Unsupported aspect_ratio "${requested}". Allowed: ${ASPECT_RATIO_OPTIONS.join(', ')}`
		);
	}

	const nativeRatios = entry?.native_aspect_ratios ?? DEFAULT_NATIVE_ASPECT_RATIOS;
	const nativeSet = new Set(nativeRatios);

	const syntheticDef = getSyntheticAspectRatioDef(requested);
	if (syntheticDef) {
		const optedIn =
			Array.isArray(entry?.synthetic_aspect_ratios) &&
			entry.synthetic_aspect_ratios.includes(requested);
		const defaultSynthetic =
			entry?.synthetic_aspect_ratios == null &&
			nativeSet.has(syntheticDef.generateAs);
		if ((optedIn || defaultSynthetic) && nativeSet.has(syntheticDef.generateAs)) {
			return {
				requested,
				apiAspectRatio: syntheticDef.generateAs,
				postProcess: {
					target: syntheticDef.key,
					mode: syntheticDef.postProcess,
				},
				usesDimensions: Boolean(entry?.uses_dimensions),
				usesRecraftSize: Boolean(entry?.uses_recraft_size),
			};
		}
	}

	if (nativeSet.has(requested)) {
		return {
			requested,
			apiAspectRatio: requested,
			postProcess: null,
			usesDimensions: Boolean(entry?.uses_dimensions),
			usesRecraftSize: Boolean(entry?.uses_recraft_size),
		};
	}

	const nearest = pickNearestNativeAspectRatio(requested, [...nativeSet]);
	if (!nearest) {
		throw new Error(`aspect_ratio "${requested}" is not supported for ${base}`);
	}

	return {
		requested,
		apiAspectRatio: nearest,
		postProcess: { target: requested, mode: 'crop' },
		usesDimensions: Boolean(entry?.uses_dimensions),
		usesRecraftSize: Boolean(entry?.uses_recraft_size),
	};
}

const replicateModels = [
	{
		label: 'X.ai Grok Imagine Image',
		value: 'xai/grok-imagine-image',
		hint: 'Supports single image input. Low censorship.',
	},
	{
		label: 'PrunaAI P-Image',
		value: 'prunaai/p-image',
		hint: 'No input image support. Low censorship.'
	},
	{
		label: 'PrunaAI P-Image Edit',
		value: 'prunaai/p-image-edit',
		hint: 'Supports multiple image inputs. Low censorship.'
	},
	{
		label: 'Qwen Image',
		value: 'qwen/qwen-image',
		hint: 'No input image support. Low censorship.'
	},
	{
		label: 'Qwen Image Edit',
		value: 'qwen/qwen-image-edit',
		hint: 'Supports single image input. Low censorship.'
	},
	// ---
	{
		label: 'Google Nano Banana (Gemini 2.5)',
		value: 'google/nano-banana',
		hint: 'Supports multiple image inputs.'
	},
	{
		label: 'BFL Flux 2 Pro',
		value: 'black-forest-labs/flux-2-pro',
		hint: 'Supports single image input.'
	},
	{
		label: 'ByteDance Seedream 4',
		value: 'bytedance/seedream-4',
		hint: 'Supports multiple image inputs.'
	},
	{
		label: 'PrunaAI Z-Image Turbo',
		value: 'prunaai/z-image-turbo',
		hint: 'No input image support.',
		uses_dimensions: true,
	},
	{
		label: 'Luma Photon',
		value: 'luma/photon',
		hint: 'Supports multiple image inputs [reference, style, character].'
	},
	{
		label: 'MiniMax Image 01',
		value: 'minimax/image-01',
		hint: 'Supports single image input [subject].'
	},
	{
		label: 'Leonardo AI Lucid Origin',
		value: 'leonardoai/lucid-origin',
		hint: 'No input image support.',
	},
	{
		label: 'Recraft V4',
		value: 'recraft-ai/recraft-v4',
		hint: 'No input image support. Low censorship.',
		uses_recraft_size: true,
	},

	{
		label: 'ByteDance SDXL Lightning 4-step',
		value: 'bytedance/sdxl-lightning-4step:6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe',
		hint: 'No input image support.  Low censorship.',
		uses_dimensions: true,
	},
	{
		label: 'Stability AI SDXL',
		value: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
		hint: 'Supports multiple image inputs [image, mask].  Low censorship.',
		uses_dimensions: true,
	},

	// { label: 'OpenAI GPT-Image 1.5', value: 'openai/gpt-image-1.5' }, // 0.14 credits
	// { label: 'Google Nano Banana Pro', value: 'google/nano-banana-pro' }, // 0.15 credits

	// 0.04 cents per gen, too expensive for what it is.
	// {
	// 	label: 'Stability AI SD3',
	// 	value: 'stability-ai/stable-diffusion-3',
	// 	hint: 'Supports single image input. Low censorship.',
	// },

	// {
	// 	label: 'PrunaAI HiDream L1 Fast',
	// 	value: 'prunaai/hidream-l1-fast'
	// },
	// { label: 'DreamShaper', value: 'cjwbw/dreamshaper:ed6d8bee9a278b0d7125872bddfb9dd3fc4c401426ad634d8246a660e387475b' },
	// { label: 'PrunaAI Flux 2 Turbo', value: 'prunaai/flux-2-turbo:e5380ce042365016bb21eed79b6900e8b36d09976df40143a39fbeb569298ae5' },
];

const replicateProModels = [
	{
		label: 'Google Nano Banana 2',
		value: 'google/nano-banana-2',
		hint: 'Supports multiple image inputs. Premium.'
	},
	{
		label: 'Google Nano Banana Pro',
		value: 'google/nano-banana-pro',
		hint: 'Supports multiple image inputs. Premium.'
	},
	{
		label: 'OpenAI GPT-Image 1.5',
		value: 'openai/gpt-image-1.5',
		hint: 'Supports multiple image inputs. Premium.'
	},
	{
		label: 'OpenAI GPT-Image 2',
		value: 'openai/gpt-image-2',
		hint: 'Supports multiple image inputs. Premium.'
	},
	{
		label: 'BFL Flux 2 Max',
		value: 'black-forest-labs/flux-2-max',
		hint: 'Supports multiple image inputs. Premium.'
	},
	{
		label: 'BFL Flux 2 Pro Multi-Image Edit',
		value: 'black-forest-labs/flux-2-pro',
		hint: 'Supports multiple image inputs.'
	},
];

const replicateVideoModels = [
	{
		label: 'Wan Video 2.2 i2v Fast',
		value: 'wan-video/wan-2.2-i2v-fast',
		hint: 'Image-to-video (i2v), fast.',
	},
];

const replicateSpeechModels = [
	{
		label: 'MiniMax Speech 2.8 Turbo',
		value: SPEECH_MODEL_MINIMAX,
		hint: 'Narration',
		fields: {
			voice: {
				label: 'Voice',
				type: 'select',
				required: false,
				options: MINIMAX_SPEECH_VOICE_OPTIONS,
			},
			voice_id: {
				label: 'Voice ID',
				type: 'text',
				hidden: true,
				required: false,
				show_when: { field: 'voice', equals: 'custom' },
			},
			emotion: {
				label: 'Emotion',
				type: 'select',
				required: false,
				options: MINIMAX_SPEECH_EMOTIONS,
			},
		},
	},
	{
		label: 'Gemini 3.1 Flash TTS',
		value: SPEECH_MODEL_GEMINI,
		hint: 'Narration / replacement line',
		fields: {
			voice: {
				label: 'Voice',
				type: 'select',
				required: false,
				options: GEMINI_SYSTEM_VOICES,
			},
			style: {
				label: 'Style',
				type: 'text',
				required: false,
			},
		},
	},
];

const replicateMusicModels = [
	{
		label: 'Lyria 3',
		value: MUSIC_MODEL_LYRIA,
		hint: 'Dramatic background score · 30s',
	},
	{
		label: 'MiniMax Music 2.6',
		value: MUSIC_MODEL_MINIMAX,
		hint: 'Song / MV track',
		fields: {
			lyrics: {
				label: 'Lyrics',
				type: 'text',
				required: false,
			},
			is_instrumental: {
				label: 'Instrumental',
				type: 'boolean',
				required: false,
				default: false,
			},
			lyrics_optimizer: {
				label: 'Lyrics optimizer',
				type: 'boolean',
				required: false,
				default: false,
			},
		},
	},
];

const generationMethods = {
	// fluxImage: {
	// 	name: 'Flux 2 Pro',
	// 	description:
	// 		'Black Forest Labs Flux 2 Pro. Higher quality, higher credits.',
	// 	intent: 'image_generate',
	// 	credits: 3,
	// 	fields: {
	// 		prompt: {
	// 			label: 'Prompt',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 	},
	// },
	// fluxImageFlex: {
	// 	name: 'Flux 2 Flex',
	// 	description: 'Black Forest Labs Flux 2 Flex. More control, highest cost.',
	// 	intent: 'image_generate',
	// 	credits: 6,
	// 	fields: {
	// 		prompt: {
	// 			label: 'Prompt',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 	},
	// },
	// fluxImageKlein: {
	// 	name: 'Flux Klein',
	// 	description:
	// 		'Black Forest Labs Flux Klein + resolution options. Lower quality, lower credits.',
	// 	intent: 'image_generate',
	// 	credits: 1.5,
	// 	fields: {
	// 		prompt: {
	// 			label: 'Prompt',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 		resolution: {
	// 			label: 'Resolution',
	// 			type: 'select',
	// 			required: false,
	// 			default: 'ai_latest',
	// 			options: fluxResolutionOptions,
	// 		},
	// 	},
	// },
	// fluxImageEdit: {
	// 	name: 'Flux 2 Pro - Image Edit',
	// 	description: 'Edit and image with Flux 2 Pro',
	// 	intent: 'image_mutate',
	// 	credits: 5,
	// 	fields: {
	// 		image_url: {
	// 			label: 'Image URL',
	// 			type: 'image_url',
	// 			required: true,
	// 		},
	// 		prompt: {
	// 			label: 'Prompt',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 	},
	// },

	// MEH... PixelLab is better for now.
	// retroDiffusionImage: {
	// 	name: 'Retro Diffusion',
	// 	description:
	// 		'Generate an image with Retro Diffusion; trained on pixel art.',
	// 	intent: 'image_generate',
	// 	credits: 1,
	// 	fields: {
	// 		prompt: {
	// 			label: 'Prompt',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 		width: {
	// 			label: 'Width',
	// 			type: 'number',
	// 			required: false,
	// 		},
	// 		height: {
	// 			label: 'Height',
	// 			type: 'number',
	// 			required: false,
	// 		},
	// 	},
	// },
	pixelLabImage: {
		name: 'PixelLab',
		description: "Generate pixel art with PixelLab's Pixflux and Bitforge",
		intent: 'image_generate',
		credits: 0.2,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			model: {
				label: 'Model',
				type: 'select',
				required: false,
				default: 'pixflux',
				options: [
					{ label: 'Pixflux', value: 'pixflux' },
					{ label: 'Bitforge', value: 'bitforge' },
				],
			},
			no_background: {
				label: 'No Background',
				type: 'boolean',
				required: false,
				default: false,
			},
			// width: {
			// 	label: 'Width',
			// 	type: 'number',
			// 	required: false,
			// },
			// height: {
			// 	label: 'Height',
			// 	type: 'number',
			// 	required: false,
			// },
		},
	},
	uploadImage: {
		name: 'Upload Image',
		description:
			'Letterboxes an image from a URL to the chosen aspect ratio (long edge 1024; no crop).',
		intent: 'image_generate',
		credits: 0,
		fields: {
			image_url: {
				label: 'Image URL',
				type: 'image_url',
				required: true,
			},
			aspect_ratio: {
				label: 'Aspect Ratio',
				type: 'select',
				hidden: true,
				required: false,
				default: '1:1',
				options: ASPECT_RATIO_OPTIONS.map((value) => ({
					label: value,
					value,
				})),
			},
		},
	},
	replicate: {
		default: true,
		name: 'Replicate',
		description: 'Run a Replicate image generation model.',
		intent: 'image_generate',
		credits: 3,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				options: replicateModels,
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			aspect_ratio: {
				label: 'Aspect Ratio',
				type: 'select',
				hidden: true,
				required: false,
				default: '1:1',
				options: ASPECT_RATIO_OPTIONS.map((value) => ({
					label: value,
					value,
				})),
			},
			input_images: {
				label: 'Input Images',
				type: 'image_url_array',
				required: false,
			},
		},
	},
	replicatePro: {
		name: 'Replicate Pro',
		description: 'Premium Replicate models. Higher quality, higher credits.',
		intent: 'image_generate',
		credits: 15,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				options: replicateProModels,
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			aspect_ratio: {
				label: 'Aspect Ratio',
				type: 'select',
				hidden: true,
				required: false,
				default: '1:1',
				options: ASPECT_RATIO_OPTIONS.map((value) => ({
					label: value,
					value,
				})),
			},
			input_images: {
				label: 'Input Images',
				type: 'image_url_array',
				required: false,
			},
		},
	},
	replicateVideo: {
		name: 'Replicate Video',
		description: 'Run a Replicate image-to-video model.',
		intent: 'video_generate',
		credits: 10,
		async: true,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				default: 'wan-video/wan-2.2-i2v-fast',
				options: replicateVideoModels,
			},
			image: {
				label: 'Image',
				type: 'image_url',
				required: true,
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	replicateSpeech: {
		name: 'Replicate Speech',
		description: 'Run a Replicate text-to-speech model.',
		intent: 'audio_generate',
		credits: 2,
		async: true,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				default: SPEECH_MODEL_GEMINI,
				options: replicateSpeechModels,
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	replicateMusic: {
		name: 'Replicate Music',
		description: 'Run a Replicate text-to-music model.',
		intent: 'audio_generate',
		credits: 8,
		async: true,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				default: MUSIC_MODEL_LYRIA,
				options: replicateMusicModels,
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	replicateVoiceTrain: {
		name: 'Replicate Voice Train',
		description:
			'Train a custom voice from an audio file via Replicate. Returns voice_id plus a short preview clip.',
		intent: 'voice_train',
		// Founder: $12 / 700 credits → $3.00 user cost at 175
		credits: 175,
		async: true,
		fields: {
			voice_file: {
				label: 'Voice file',
				type: 'audio_url',
				required: true,
			},
		},
	},
	// fluxPoeticImage: {
	// 	name: 'Poetic Image (Zydeco + Flux)',
	// 	description:
	// 		'Generates a zydeco poem, builds an image prompt, renders with Flux, then overlays the poem at the bottom.',
	// 	intent: 'image_generate',
	// 	credits: 5,
	// 	fields: {
	// 		style: {
	// 			label: 'Style',
	// 			type: 'text',
	// 			required: false,
	// 		},
	// 	},
	// },
	// poeticImage: {
	// 	name: 'Poetic Image (Zydeco)',
	// 	description:
	// 		'Zydeco makes a random poem. Open AI cleans it up. Then OpenAI (Dall-E 3) generates an image from poem.',
	// 	intent: 'image_generate',
	// 	credits: 2,
	// 	fields: {
	// 		style: {
	// 			label: 'Style',
	// 			type: 'text',
	// 			required: false,
	// 		},
	// 	},
	// },
	// gradientCircle: {
	// 	name: 'Gradient Circle',
	// 	description:
	// 		'Generates a 1024x1024 image with a gradient background using random colors at each corner and a random colored circle',
	// 	intent: 'image_generate',
	// 	credits: 0.25,
	// 	fields: {},
	// },
	// centeredTextOnWhite: {
	// 	name: 'Centered Text on White',
	// 	description:
	// 		'Generates a 1024x1024 image with centered text rendered on a white background',
	// 	intent: 'image_generate',
	// 	credits: 0.25,
	// 	fields: {
	// 		text: {
	// 			label: 'Text',
	// 			type: 'text',
	// 			required: true,
	// 		},
	// 		color: {
	// 			label: 'Text Color',
	// 			type: 'color',
	// 			required: false,
	// 		},
	// 	},
	// },
};

export {
	fluxResolutionOptions,
	generationMethods,
	replicateModels,
	replicateProModels,
	replicateVideoModels,
	replicateSpeechModels,
	replicateMusicModels,
	ASPECT_RATIO_OPTIONS,
	DEFAULT_NATIVE_ASPECT_RATIOS,
	findReplicateModelEntry,
	replicateModelBase,
	resolveAspectRatioPlan,
};
