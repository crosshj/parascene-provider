const fluxResolutionOptions = [
	{ label: 'NES 8-bit', value: 'nes_8bit' },
	{ label: 'SNES 16-bit', value: 'snes_16bit' },
	{ label: 'AI Legacy', value: 'ai_legacy' },
	{ label: 'AI Classic', value: 'ai_classic' },
	{ label: 'AI Latest', value: 'ai_latest' },
];

const generationMethods = {
	fluxImage: {
		name: 'Flux 2 Pro',
		description:
			'Black Forest Labs Flux 2 Pro. Higher quality, higher credits.',
		intent: 'image_generate',
		credits: 3,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	fluxImageFlex: {
		name: 'Flux 2 Flex',
		description: 'Black Forest Labs Flux 2 Flex. More control, highest cost.',
		intent: 'image_generate',
		credits: 6,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	fluxImageKlein: {
		name: 'Flux Klein',
		description:
			'Black Forest Labs Flux Klein + resolution options. Lower quality, lower credits.',
		intent: 'image_generate',
		credits: 1.5,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			resolution: {
				label: 'Resolution',
				type: 'select',
				required: false,
				default: 'ai_latest',
				options: fluxResolutionOptions,
			},
		},
	},
	fluxImageEdit: {
		name: 'Flux 2 Pro - Image Edit',
		description: 'Edit and image with Flux 2 Pro',
		intent: 'image_mutate',
		credits: 5,
		fields: {
			image_url: {
				label: 'Image URL',
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
			'Resizes an image from a URL to 1024x1024 (cover + entropy crop).',
		intent: 'image_generate',
		credits: 0,
		fields: {
			image_url: {
				label: 'Image URL',
				type: 'image_url',
				required: true,
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
				options: [
					// { label: 'OpenAI GPT-Image 1.5', value: 'openai/gpt-image-1.5' }, // 0.14 credits
					// { label: 'Google Nano Banana Pro', value: 'google/nano-banana-pro' }, // 0.15 credits
					{ label: 'Google Nano Banana', value: 'google/nano-banana' }, //image_input - file[]
					{ label: 'BFL Flux 2 Pro', value: 'black-forest-labs/flux-2-pro' },  //input_images - file[]
					{ label: 'ByteDance Seedream 4', value: 'bytedance/seedream-4' }, //image_input - file[]
					{ label: 'PrunaAI P-Image', value: 'prunaai/p-image' }, //no image input
					{ label: 'PrunaAI Z-Image Turbo', value: 'prunaai/z-image-turbo' }, //no image input
					{ label: 'Qwen Image', value: 'qwen/qwen-image' }, //image - file 
					{ label: 'X.ai Grok Imagine Image', value: 'xai/grok-imagine-image' },  //image - file
					{
						label: 'Leonardo AI Lucid Origin',
						value: 'leonardoai/lucid-origin',
					}, //no image input
					{ label: 'Luma Photon', value: 'luma/photon' }, //image_reference, style_reference, character_reference - file
					{ label: 'MiniMax Image 01', value: 'minimax/image-01' }, //subject_reference - file
					{ label: 'Recraft V4', value: 'recraft-ai/recraft-v4' }, //no image input

					// { label: 'Stability AI Stable Diffusion 3', value: 'stability-ai/stable-diffusion-3' },
					{
						label: 'ByteDance SDXL Lightning 4-step',
						value:
							'bytedance/sdxl-lightning-4step:6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe',
					}, //no image input
					{
						label: 'Stability AI Stable Diffusion XL',
						value:
							'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
					}, //image, mask - file
					// { label: 'PrunaAI HiDream L1 Fast', value: 'prunaai/hidream-l1-fast' },
					// { label: 'DreamShaper', value: 'cjwbw/dreamshaper:ed6d8bee9a278b0d7125872bddfb9dd3fc4c401426ad634d8246a660e387475b' },
					// { label: 'PrunaAI Flux 2 Turbo', value: 'prunaai/flux-2-turbo:e5380ce042365016bb21eed79b6900e8b36d09976df40143a39fbeb569298ae5' },
				],
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			input_images: {
				label: 'Input Images []',
				type: 'image_url_array',
				required: false,
				hidden: true,
			},
			image_input: {
				label: 'Image Input []',
				type: 'image_url_array',
				required: false,
				hidden: true,
			},
			image: {
				label: 'Image',
				type: 'image_url',
				required: false,
				hidden: true,
			},
			input: {
				label: 'Input (JSON)',
				type: 'text',
				required: true,
				hidden: true,
				default: JSON.stringify(
					{
						seed: Math.floor(Math.random() * 1000000),
						aspect_ratio: '1:1',
						size: '1K',
						negative_prompt:
							'worst quality, low quality, frame, border, signature, watermark',
						resolution: '1 MP', // flux 2 pro
						// resolution: "1K", // nano banana pro
						// resolution: "1024 × 1024 (Square)", // HiDream L1 Fast
						// width: 1024,
						// height: 1024,
						safety_filter_level: 'block_only_high',
						safety_tolerance: 5,
						disable_safety_checker: true,
						moderation: 'low',
					},
					null,
					2
				),
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

export { fluxResolutionOptions, generationMethods };
