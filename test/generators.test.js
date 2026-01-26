import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { generateGradientCircle } from '../generators/gradientCircle.js';
import { generateTextImage } from '../generators/textImage.js';
import {
	generateFluxImage,
	generatePoeticImageFlux,
} from '../generators/flux.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '..', '.output');

async function writeImage(name, buffer) {
	const filePath = path.join(outputDir, name);
	await fs.writeFile(filePath, buffer);
	return filePath;
}

function expectBufferResult(result) {
	expect(result).toBeTruthy();
	expect(Buffer.isBuffer(result.buffer)).toBe(true);
	expect(result.buffer.length).toBeGreaterThan(0);
	expect(typeof result.width).toBe('number');
	expect(typeof result.height).toBe('number');
}

describe('generators', () => {
	beforeAll(async () => {
		await fs.mkdir(outputDir, { recursive: true });
	});

	jest.setTimeout(60000);

	it('creates a gradient circle png', async () => {
		const result = await generateGradientCircle();
		expectBufferResult(result);
		const saved = await writeImage('gradient-circle.png', result.buffer);
		expect(saved).toContain('gradient-circle.png');
	});

	it('creates centered text png', async () => {
		const result = await generateTextImage({ text: 'Hello Test' });
		expectBufferResult(result);
		const saved = await writeImage('text-image.png', result.buffer);
		expect(saved).toContain('text-image.png');
	});

	it('supports custom text color', async () => {
		const result = await generateTextImage({
			text: 'Custom Color',
			color: '#ff00ff',
		});
		expectBufferResult(result);
		const saved = await writeImage(
			'text-image-custom-color.png',
			result.buffer
		);
		expect(saved).toContain('text-image-custom-color.png');
	});

	it.only('calls Flux generator to create an image', async () => {
		const result = await generateFluxImage({
			prompt: `haunted tropical reggae voodoo game level`.trim(),
		});
		expectBufferResult(result);

		console.log(result);

		const saved = await writeImage('flux-image.png', result.buffer);
		expect(saved).toContain('flux-image.png');
	});

	it('calls Flux Zydeco generator to create an image', async () => {
		const result = await generatePoeticImageFlux({
			style: 'dark fantasy',
		});
		expectBufferResult(result);

		// console.log(result);

		const saved = await writeImage('flux-image.png', result.buffer);
		expect(saved).toContain('flux-image.png');
	});
});
