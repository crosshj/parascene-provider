import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import sharp from 'sharp';

const LETTERBOX = { r: 24, g: 24, b: 32 };

describe('uploadImage', () => {
	let uploadImage;
	let fetchImageBuffer;

	beforeEach(async () => {
		jest.resetModules();
		fetchImageBuffer = jest.fn();
		jest.unstable_mockModule('../generators/utils.js', () => ({
			log: jest.fn(),
			fetchImageBuffer: (...args) => fetchImageBuffer(...args),
		}));
		({ uploadImage } = await import('../generators/imageEdit.js'));
	});

	test('letterboxes square input to 9:16 without cropping content', async () => {
		const square = await sharp({
			create: { width: 800, height: 800, channels: 3, background: '#336699' },
		})
			.png()
			.toBuffer();

		fetchImageBuffer.mockResolvedValue({ buffer: square });

		const result = await uploadImage({
			image_url: 'https://example.com/square.png',
			aspect_ratio: '9:16',
		});

		expect(result.width).toBe(576);
		expect(result.height).toBe(1024);

		const { data, info } = await sharp(result.buffer)
			.raw()
			.toBuffer({ resolveWithObject: true });

		const px = (x, y) => {
			const i = (y * info.width + x) * info.channels;
			return { r: data[i], g: data[i + 1], b: data[i + 2] };
		};

		// Top letterbox band
		expect(px(288, 8)).toEqual(LETTERBOX);
		// Scaled square content (center)
		expect(px(288, 512)).toEqual({ r: 51, g: 102, b: 153 });
		// Bottom letterbox band
		expect(px(288, 1016)).toEqual(LETTERBOX);
	});

	test('defaults to 1:1 when aspect_ratio is omitted', async () => {
		const portrait = await sharp({
			create: { width: 600, height: 900, channels: 3, background: '#cc6633' },
		})
			.png()
			.toBuffer();

		fetchImageBuffer.mockResolvedValue({ buffer: portrait });

		const result = await uploadImage({
			image_url: 'https://example.com/portrait.png',
		});

		expect(result.width).toBe(1024);
		expect(result.height).toBe(1024);

		const { data, info } = await sharp(result.buffer)
			.raw()
			.toBuffer({ resolveWithObject: true });

		const px = (x, y) => {
			const i = (y * info.width + x) * info.channels;
			return { r: data[i], g: data[i + 1], b: data[i + 2] };
		};

		// Side letterbox on 1:1 canvas
		expect(px(8, 512)).toEqual(LETTERBOX);
		expect(px(512, 512)).toEqual({ r: 204, g: 102, b: 51 });
	});
});
