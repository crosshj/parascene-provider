import 'dotenv/config';
import { generateGradientCircle } from '../generators/gradientCircle.js';
import { generateTextImage } from '../generators/textImage.js';
import { generatePoeticImage } from '../generators/zydeco.js';
import {
	generateFluxImage,
	generatePoeticImageFlux,
	fluxImageEdit,
} from '../generators/flux.js';
import { uploadImage } from '../generators/imageEdit.js';

function validateAuth(req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return false;
	}
	const token = authHeader.slice(7);
	return token === process.env.PARASCENE_API_KEY;
}

const fluxResolutionOptions = [
	{ label: 'NES 8-bit', value: 'nes_8bit' },
	{ label: 'SNES 16-bit', value: 'snes_16bit' },
	{ label: 'AI Legacy', value: 'ai_legacy' },
	{ label: 'AI Classic', value: 'ai_classic' },
	{ label: 'AI Latest', value: 'ai_latest' },
];

const generationMethods = {
	fluxImage: {
		name: 'Flux 2 (Pro)',
		description:
			'Black Forest Labs Flux 2 Pro. Higher quality, higher credits.',
		intent: 'image_generate',
		credits: 5,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			}
		},
	},
	fluxImageKlein: {
		name: 'Flux 2 (Klein)',
		description:
			'Black Forest Labs Flux Klein with resolution options. Lower quality, lower credits.',
		intent: 'image_generate',
		credits: 3.5,
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
		name: 'Flux 2 Image Edit',
		description:
			'Downloads an input image from Image URL and sends it to Flux along with your prompt to perform an edit.',
		intent: 'image_mutate',
		credits: 8,
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
	fluxPoeticImage: {
		name: 'Poetic Image (Zydeco + Flux)',
		description:
			'Generates a zydeco poem, builds an image prompt, renders with Flux, then overlays the poem at the bottom.',
		intent: 'image_generate',
		credits: 5,
		fields: {
			style: {
				label: 'Style',
				type: 'text',
				required: false,
			},
		},
	},
	poeticImage: {
		name: 'Poetic Image (Zydeco)',
		description:
			'Zydeco makes a random poem. Open AI cleans it up. Then OpenAI (Dall-E 3) generates an image from poem.',
		intent: 'image_generate',
		credits: 2,
		fields: {
			style: {
				label: 'Style',
				type: 'text',
				required: false,
			},
		},
	},
	gradientCircle: {
		name: 'Gradient Circle',
		description:
			'Generates a 1024x1024 image with a gradient background using random colors at each corner and a random colored circle',
		intent: 'image_generate',
		credits: 0.25,
		fields: {},
	},
	centeredTextOnWhite: {
		name: 'Centered Text on White',
		description:
			'Generates a 1024x1024 image with centered text rendered on a white background',
		intent: 'image_generate',
		credits: 0.25,
		fields: {
			text: {
				label: 'Text',
				type: 'text',
				required: true,
			},
			color: {
				label: 'Text Color',
				type: 'color',
				required: false,
			},
		},
	},
};

const methodHandlers = {
	gradientCircle: generateGradientCircle,
	centeredTextOnWhite: generateTextImage,
	poeticImage: generatePoeticImage,
	fluxImage: (args) => generateFluxImage({ ...args, model: 'flux2Pro' }),
	fluxImageKlein: (args) => generateFluxImage({ ...args, model: 'fluxKlein' }),
	fluxPoeticImage: generatePoeticImageFlux,
	fluxImageEdit: fluxImageEdit,
	uploadImage,
};

export default async function handler(req, res) {
	if (req.method === 'GET') {
		if (!validateAuth(req)) {
			return res.status(401).json({
				error: 'Unauthorized',
				message: 'Valid API key required. Use Authorization: Bearer <key>',
			});
		}

		const capabilities = {
			status: 'operational',
			last_check_at: new Date().toISOString(),
			methods: generationMethods,
		};
		return res.status(200).json(capabilities);
	}

	if (req.method === 'POST') {
		if (!validateAuth(req)) {
			return res.status(401).json({
				error: 'Unauthorized',
				message: 'Valid API key required. Use Authorization: Bearer <key>',
			});
		}

		try {
			let body;
			try {
				body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
			} catch (parseError) {
				return res.status(400).json({
					error: 'Invalid JSON in request body',
					message: parseError.message,
				});
			}

			if (!body.method) {
				return res.status(400).json({
					error: 'Missing required field: method',
					available_methods: Object.keys(generationMethods),
				});
			}

			if (!generationMethods[body.method]) {
				return res.status(400).json({
					error: `Unknown generation method: ${body.method}`,
					available_methods: Object.keys(generationMethods),
				});
			}

			const methodDef = generationMethods[body.method];
			const args = body.args || {};

			const fields = methodDef.fields || {};
			const missingFields = [];
			for (const [fieldName, fieldDef] of Object.entries(fields)) {
				if (fieldDef.required && !(fieldName in args)) {
					missingFields.push(fieldName);
				}
			}

			if (missingFields.length > 0) {
				return res.status(400).json({
					error: `Missing required arguments: ${missingFields.join(', ')}`,
					method: body.method,
					missing_fields: missingFields,
				});
			}

			const generator = methodHandlers[body.method];
			if (!generator) {
				return res.status(500).json({
					error: `No handler registered for method: ${body.method}`,
				});
			}

			const result = await generator(args);

			const credits = typeof methodDef.credits === 'number' ? methodDef.credits : 0;

			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Content-Length', result.buffer.length);
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('X-Image-Color', result?.color ?? '#000000');
			res.setHeader('X-Image-Width', result.width.toString());
			res.setHeader('X-Image-Height', result.height.toString());
			res.setHeader('X-Credits', String(credits));

			return res.send(result.buffer);
		} catch (error) {
			console.error('Error generating image:', error);
			return res.status(500).json({
				error: 'Failed to generate image',
				message: error.message,
			});
		}
	}

	return res.status(405).json({
		error:
			'Method not allowed. Use GET for capabilities or POST for generation.',
	});
}
