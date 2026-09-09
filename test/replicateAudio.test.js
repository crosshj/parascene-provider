import { generationMethods, replicateSpeechModels } from '../config/generationMethods.js';
import {
	GEMINI_SYSTEM_VOICES,
	MINIMAX_CUSTOM_VOICE,
	MINIMAX_SPEECH_EMOTIONS,
	MINIMAX_SPEECH_VOICE_OPTIONS,
	SPEECH_MODEL_GEMINI,
	SPEECH_MODEL_MINIMAX,
	SPEECH_PROMPT_MAX_CHARS,
} from '../config/audioVoices.js';
import {
	buildMusicInput,
	buildSpeechInput,
	buildVoiceTrainInput,
	encodePcmToMp3,
	parseVoiceTrainOutput,
	resolveVoiceTrainFile,
} from '../generators/replicateAudio.js';

describe('replicate audio capabilities', () => {
	it('advertises full Gemini and MiniMax voice lists including custom', () => {
		const minimax = replicateSpeechModels.find((m) => m.value === SPEECH_MODEL_MINIMAX);
		const gemini = replicateSpeechModels.find((m) => m.value === SPEECH_MODEL_GEMINI);
		expect(minimax.fields.voice.options).toHaveLength(MINIMAX_SPEECH_VOICE_OPTIONS.length);
		expect(minimax.fields.voice.options.at(-1)).toEqual({
			value: MINIMAX_CUSTOM_VOICE,
			label: 'Custom',
		});
		expect(minimax.fields.voice_id.show_when).toEqual({
			field: 'voice',
			equals: 'custom',
		});
		expect(minimax.fields.voice_id.hidden).toBe(true);
		expect(minimax.fields.emotion.type).toBe('select');
		expect(minimax.fields.emotion.options).toEqual(MINIMAX_SPEECH_EMOTIONS);
		expect(gemini.fields.voice.options).toHaveLength(GEMINI_SYSTEM_VOICES.length);
		expect(gemini.fields.voice.options.map((o) => o.value)).toContain('Kore');
		expect(gemini.fields.voice.options.map((o) => o.value)).toContain('Puck');
	});

	it('registers speech, music, and voice train methods', () => {
		expect(generationMethods.replicateSpeech.intent).toBe('audio_generate');
		expect(generationMethods.replicateSpeech.credits).toBe(2);
		expect(generationMethods.replicateSpeech.fields.prompt.max_length).toBe(
			SPEECH_PROMPT_MAX_CHARS
		);
		expect(generationMethods.replicateMusic.intent).toBe('audio_generate');
		expect(generationMethods.replicateVoiceTrain.intent).toBe('voice_train');
		expect(generationMethods.replicateVoiceTrain.credits).toBe(175);
		expect(generationMethods.replicateVoiceTrain.fields.voice_file.type).toBe('audio_url');
	});
});

describe('buildSpeechInput', () => {
	it('maps MiniMax system voice to voice_id', () => {
		expect(
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'Hello there',
				voice: 'English_expressive_narrator',
				emotion: 'happy',
			})
		).toEqual({
			text: 'Hello there',
			voice_id: 'English_expressive_narrator',
			emotion: 'happy',
		});
	});

	it('requires voice_id when MiniMax voice is custom', () => {
		expect(() =>
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'Hello',
				voice: 'custom',
			})
		).toThrow(/voice_id is required/);
		expect(
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'Hello',
				voice: 'custom',
				voice_id: 'R8_FDU1SV5S',
			})
		).toEqual({
			text: 'Hello',
			voice_id: 'R8_FDU1SV5S',
		});
	});

	it('keeps official MiniMax emotions and drops invalid ones', () => {
		expect(
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'Hello',
				voice: 'English_expressive_narrator',
				emotion: 'Happy',
			})
		).toEqual({
			text: 'Hello',
			voice_id: 'English_expressive_narrator',
			emotion: 'happy',
		});
		expect(
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'Hello',
				voice: 'English_expressive_narrator',
				emotion: 'excited',
			})
		).toEqual({
			text: 'Hello',
			voice_id: 'English_expressive_narrator',
		});
	});

	it('rejects a speech prompt over the character cap', () => {
		expect(() =>
			buildSpeechInput({
				model: SPEECH_MODEL_MINIMAX,
				prompt: 'x'.repeat(SPEECH_PROMPT_MAX_CHARS + 1),
			})
		).toThrow(/at most 400 characters/);
	});

	it('maps Gemini text, voice, and style', () => {
		expect(
			buildSpeechInput({
				model: SPEECH_MODEL_GEMINI,
				prompt: 'Replacement line',
				voice: 'Kore',
				style: 'warm studio',
			})
		).toEqual({
			text: 'Replacement line',
			voice: 'Kore',
			prompt: 'warm studio',
		});
	});
});

describe('buildMusicInput', () => {
	it('maps Lyria prompt', () => {
		expect(buildMusicInput({ model: 'google/lyria-3', prompt: 'tense strings' })).toEqual({
			prompt: 'tense strings',
		});
	});

	it('maps MiniMax music extras', () => {
		expect(
			buildMusicInput({
				model: 'minimax/music-2.6',
				prompt: 'night drive',
				lyrics: 'city lights',
				is_instrumental: true,
				lyrics_optimizer: 'true',
			})
		).toEqual({
			prompt: 'night drive',
			lyrics: 'city lights',
			is_instrumental: true,
			lyrics_optimizer: true,
		});
	});
});

describe('voice train', () => {
	it('builds clone input', () => {
		expect(buildVoiceTrainInput({ voice_file: 'https://cdn.example/voice.wav' })).toEqual({
			model: 'speech-02-hd',
			voice_file: 'https://cdn.example/voice.wav',
		});
	});

	it('leaves https wav URLs alone', async () => {
		expect(await resolveVoiceTrainFile('https://cdn.example/voice.wav')).toBe(
			'https://cdn.example/voice.wav'
		);
	});

	it('encodes PCM to an MP3 frame', () => {
		const samples = new Int16Array(44100);
		for (let i = 0; i < samples.length; i += 1) {
			samples[i] = Math.round(Math.sin((i / 44100) * 440 * Math.PI * 2) * 8000);
		}
		const mp3 = encodePcmToMp3(samples, 44100);
		expect(mp3[0]).toBe(0xff);
		expect(mp3[1] & 0xe0).toBe(0xe0);
	});

	it('turns a recorded wav data URL into an mp3 data URI', async () => {
		const samples = new Int16Array(16000);
		const dataSize = samples.length * 2;
		const wav = Buffer.alloc(44 + dataSize);
		wav.write('RIFF', 0);
		wav.writeUInt32LE(36 + dataSize, 4);
		wav.write('WAVE', 8);
		wav.write('fmt ', 12);
		wav.writeUInt32LE(16, 16);
		wav.writeUInt16LE(1, 20);
		wav.writeUInt16LE(1, 22);
		wav.writeUInt32LE(16000, 24);
		wav.writeUInt32LE(32000, 28);
		wav.writeUInt16LE(2, 32);
		wav.writeUInt16LE(16, 34);
		wav.write('data', 36);
		wav.writeUInt32LE(dataSize, 40);
		const uri = await resolveVoiceTrainFile(
			`data:audio/wav;base64,${wav.toString('base64')}`
		);
		expect(uri.startsWith('data:audio/mpeg;base64,')).toBe(true);
	});

	it('rejects a Replicate files URL', async () => {
		await expect(
			resolveVoiceTrainFile(
				'https://api.replicate.com/v1/files/abc123.mp3'
			)
		).rejects.toThrow(/Do not pass a Replicate files URL/);
	});

	it('parses voice_id from clone JSON', () => {
		expect(
			parseVoiceTrainOutput({
				voice_id: 'R8_FDU1SV5S',
				preview: 'https://example.com/preview.mp3',
			})
		).toEqual({
			voiceId: 'R8_FDU1SV5S',
			previewUrl: 'https://example.com/preview.mp3',
		});
	});

	it('reads preview from FileOutput.url()', () => {
		expect(
			parseVoiceTrainOutput({
				voice_id: 'R8_X',
				preview: { url: () => 'https://example.com/p.mp3' },
			})
		).toEqual({
			voiceId: 'R8_X',
			previewUrl: 'https://example.com/p.mp3',
		});
	});

	it('treats empty preview object as missing', () => {
		expect(
			parseVoiceTrainOutput({
				voice_id: 'R8_X',
				preview: {},
			})
		).toEqual({
			voiceId: 'R8_X',
			previewUrl: null,
		});
	});
});
