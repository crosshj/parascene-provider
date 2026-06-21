import { resolveAspectRatioPlan } from '../config/generationMethods.js';

describe('resolveAspectRatioPlan', () => {
	it('passes native ratios through for grok', () => {
		expect(
			resolveAspectRatioPlan('xai/grok-imagine-image', 'replicate', '9:16')
		).toMatchObject({
			requested: '9:16',
			apiAspectRatio: '9:16',
			postProcess: null,
		});
	});

	it('uses 3:4 + crop for synthetic 4:5 on grok', () => {
		expect(
			resolveAspectRatioPlan('xai/grok-imagine-image', 'replicate', '4:5')
		).toMatchObject({
			requested: '4:5',
			apiAspectRatio: '3:4',
			postProcess: { target: '4:5', mode: 'crop' },
		});
	});

	it('supports non-grok replicate models (not 1:1 only)', () => {
		expect(
			resolveAspectRatioPlan('prunaai/p-image', 'replicate', '16:9')
		).toMatchObject({
			requested: '16:9',
			apiAspectRatio: '16:9',
			postProcess: null,
		});
	});

	it('supports replicatePro models', () => {
		expect(
			resolveAspectRatioPlan('black-forest-labs/flux-2-max', 'replicatePro', '4:5')
		).toMatchObject({
			requested: '4:5',
			apiAspectRatio: '3:4',
			postProcess: { target: '4:5', mode: 'crop' },
		});
	});

	it('marks width/height models', () => {
		expect(
			resolveAspectRatioPlan(
				'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
				'replicate',
				'9:16'
			)
		).toMatchObject({
			requested: '9:16',
			apiAspectRatio: '9:16',
			usesDimensions: true,
		});
	});

	it('rejects unsupported client ratios', () => {
		expect(() =>
			resolveAspectRatioPlan('xai/grok-imagine-image', 'replicate', '3:2')
		).toThrow(/Unsupported aspect_ratio/);
	});

	it('defaults to 1:1 when omitted', () => {
		expect(
			resolveAspectRatioPlan('qwen/qwen-image', 'replicate', undefined)
		).toMatchObject({
			requested: '1:1',
			apiAspectRatio: '1:1',
			postProcess: null,
		});
	});
});
