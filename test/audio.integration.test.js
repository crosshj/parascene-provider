import { generateReplicateSpeech } from '../generators/replicateAudio.js';
import { SPEECH_MODEL_GEMINI } from '../config/audioVoices.js';

const maybeIt = process.env.REPLICATE_API_TOKEN ? it : it.skip;

describe('Replicate speech integration', () => {
	maybeIt(
		'generates Gemini speech bytes',
		async () => {
			const result = await generateReplicateSpeech({
				model: SPEECH_MODEL_GEMINI,
				prompt: 'Hello from Parascene.',
				voice: 'Kore',
			});
			expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
			expect(result.audioBuffer.length).toBeGreaterThan(100);
			expect(String(result.contentType || '')).toMatch(/^audio\//);
		},
		6 * 60_000
	);
});
