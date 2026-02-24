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
		description:
			'Black Forest Labs Flux 2 Flex. More control, highest cost.',
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
		description:
			'Edit and image with Flux 2 Pro',
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
		description:
			'Generate pixel art with PixelLab\'s Pixflux and Bitforge',
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
		name: 'Upload Image From URL',
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
		name: 'Replicate',
		description:
			'Run a Replicate image generation model.',
		intent: 'image_generate',
		credits: 3,
		fields: {
			model: {
				label: 'Model',
				type: 'select',
				required: true,
				options: [
					{ label: 'Luma Photon', value: 'luma/photon' },
					// { label: 'DreamShaper 8', value: 'dreamshaper/dreamshaper_8_pruned:fp16' },
					{ label: 'PrunaAI p-image', value: 'prunaai/p-image' },
				]
			},
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
			input: {
				label: 'Input (JSON)',
				type: 'text',
				required: true,
				default: JSON.stringify({
					aspect_ratio: '1:1',
					disable_safety_checker: true,
				}, null, 2),
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
