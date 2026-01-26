import { generateGradientCircle } from '../generators/gradientCircle.js';
import { generateTextImage } from '../generators/textImage.js';
import { generatePoeticImage } from '../generators/zydeco.js';
import {
	generateFluxImage,
	generatePoeticImageFlux,
} from '../generators/flux.js';

const generationMethods = {
	fluxImage: {
		name: 'Flux 2',
		description:
			'Calls the Black Forest Labs Flux endpoint to generate a 1024x1024 image from a prompt.',
		credits: 5,
		fields: {
			prompt: {
				label: 'Prompt',
				type: 'text',
				required: true,
			},
		},
	},
	fluxPoeticImage: {
		name: 'Poetic Image (Zydeco + Flux)',
		description:
			'Generates a zydeco poem, builds an image prompt, renders with Flux, then overlays the poem at the bottom.',
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
		credits: 0.5,
		fields: {},
	},
	centeredTextOnWhite: {
		name: 'Centered Text on White',
		description:
			'Generates a 1024x1024 image with centered text rendered on a white background',
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
	fluxImage: generateFluxImage,
	fluxPoeticImage: generatePoeticImageFlux,
};

export default async function handler(req, res) {
	if (req.method === 'GET') {
		const capabilities = {
			status: 'operational',
			last_check_at: new Date().toISOString(),
			methods: generationMethods,
		};
		return res.status(200).json(capabilities);
	}

	if (req.method === 'POST') {
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

			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Content-Length', result.buffer.length);
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('X-Image-Color', result.color);
			res.setHeader('X-Image-Width', result.width.toString());
			res.setHeader('X-Image-Height', result.height.toString());

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
