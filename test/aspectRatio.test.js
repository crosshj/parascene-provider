import sharp from 'sharp';
import {
	parseAspectRatioKey,
	fitImageToAspectRatio,
	pickNearestNativeAspectRatio,
} from '../lib/aspectRatio.js';

describe('aspectRatio', () => {
	it('parses ratio keys', () => {
		expect(parseAspectRatioKey('4:5').value).toBeCloseTo(0.8, 5);
		expect(parseAspectRatioKey('3:4').value).toBeCloseTo(0.75, 5);
	});

	it('picks 3:4 as nearest native for 4:5', () => {
		const native = ['1:1', '16:9', '9:16', '4:3', '3:4'];
		expect(pickNearestNativeAspectRatio('4:5', native)).toBe('3:4');
	});

	it('center-crops 3:4 buffer to 4:5', async () => {
		const buffer = await sharp({
			create: { width: 1536, height: 2048, channels: 3, background: '#336699' },
		})
			.png()
			.toBuffer();

		const { width, height } = await fitImageToAspectRatio(buffer, '4:5', {
			mode: 'crop',
		});

		expect(width).toBe(1536);
		expect(height).toBe(1920);
		expect(width / height).toBeCloseTo(4 / 5, 4);
	});
});
