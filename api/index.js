import { generationMethods } from '../config/generationMethods.js';
import { methodHandlers } from '../lib/methodHandlers.js';
import {
	getAdvancedQueryResponse,
	generateAdvancedImage,
} from '../generators/advanced.js';
import { exampleItems } from '../test/fixtures/advanced.items.js';

function validateAuth(req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return false;
	}
	const token = authHeader.slice(7);
	return token === process.env.PARASCENE_API_KEY;
}

function sendImageResponse(res, result, credits) {
	res.setHeader('Content-Type', 'image/png');
	res.setHeader('Content-Length', result.buffer.length);
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('X-Image-Color', result?.color ?? '#000000');
	res.setHeader('X-Image-Width', result.width.toString());
	res.setHeader('X-Image-Height', result.height.toString());
	res.setHeader('X-Credits', String(credits));
	return res.send(result.buffer);
}

export default async function handler(req, res) {
	if (req.method === 'GET') {
		if (!validateAuth(req)) {
			return res.status(401).json({
				error: 'Unauthorized',
				message: 'Valid API key required. Use Authorization: Bearer <key>',
			});
		}

		// Return mock items for advanced_generate UI (test fixture in place)
		const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
		if (url.searchParams.get('mockItems') === '1') {
			return res.status(200).json({ items: exampleItems });
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

			// Special methods not listed in config
			if (body.method === 'advanced_query') {
				return res.status(200).json(getAdvancedQueryResponse(body));
			}
			if (body.method === 'advanced_generate') {
				const result = await generateAdvancedImage(body);
				return sendImageResponse(res, result, result.credits ?? 0);
			}

			if (!generationMethods[body.method]) {
				return res.status(400).json({
					error: `Unknown generation method: ${body.method}`,
					available_methods: Object.keys(generationMethods),
				});
			}

			const methodDef = generationMethods[body.method];
			let args = body.args || {};

			const fields = methodDef.fields || {};
			for (const [fieldName, fieldDef] of Object.entries(fields)) {
				if (!(fieldName in args) && fieldDef.default !== undefined) {
					args[fieldName] = fieldDef.default;
				}
			}

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

			// Replicate: pull model and prompt from fields; merge optional args (JSON) into payload
			if (body.method === 'replicate') {
				const model = (args.model ?? '').toString().trim();
				const prompt = (args.prompt ?? '').toString().trim();
				if (!model) {
					return res.status(400).json({ error: 'Replicate model is required' });
				}
				if (!prompt) {
					return res.status(400).json({ error: 'Replicate prompt is required' });
				}
				let extra = {};
				const inputRaw = args.input;
				if (typeof inputRaw === 'string' && inputRaw.trim()) {
					try {
						const parsed = JSON.parse(inputRaw);
						if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
							extra = parsed;
						}
					} catch (parseError) {
						return res.status(400).json({
							error: 'Invalid JSON in Replicate input',
							message: parseError.message,
						});
					}
				} else if (inputRaw != null && typeof inputRaw === 'object' && !Array.isArray(inputRaw)) {
					extra = inputRaw;
				}
				args = { model, prompt, ...extra };
			}

			const generator = methodHandlers[body.method];
			if (!generator) {
				return res.status(500).json({
					error: `No handler registered for method: ${body.method}`,
				});
			}

			const result = await generator(args);
			const credits =
				typeof methodDef.credits === 'number' ? methodDef.credits : 0;
			return sendImageResponse(res, result, credits);
		} catch (error) {
			console.error('Error generating image:', error);
			const message = error?.message || String(error);
			return res.status(500).json({
				error: message || 'Failed to generate image',
				message,
			});
		}
	}

	return res.status(405).json({
		error:
			'Method not allowed. Use GET for capabilities or POST for generation.',
	});
}
