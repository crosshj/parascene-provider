import { createRequire } from 'node:module';
import Replicate from 'replicate';
import {
	MINIMAX_CUSTOM_VOICE,
	normalizeMinimaxEmotion,
	MUSIC_MODEL_LYRIA,
	MUSIC_MODEL_MINIMAX,
	REPLICATE_VOICE_CLONE_MODEL,
	REPLICATE_VOICE_CLONE_SLUG,
	SPEECH_MODEL_GEMINI,
	SPEECH_MODEL_MINIMAX,
	SPEECH_PROMPT_MAX_CHARS,
	VOICE_TRAIN_PREVIEW_TEXT,
} from '../config/audioVoices.js';
import {
	getFirstImageUrl,
	replicatePredictionBody,
	resolveSelectModel,
} from './replicate.js';
import { fetchImageBuffer, log } from './utils.js';

const require = createRequire(import.meta.url);
globalThis.MPEGMode = require('lamejs/src/js/MPEGMode.js');
globalThis.Lame = require('lamejs/src/js/Lame.js');
globalThis.BitStream = require('lamejs/src/js/BitStream.js');
const lamejs = require('lamejs');

function requireToken() {
	const token = process.env.REPLICATE_API_TOKEN;
	if (!token || typeof token !== 'string') {
		throw new Error('REPLICATE_API_TOKEN is not set');
	}
	return token;
}

export function buildSpeechInput(args = {}) {
	const model = String(args.model ?? '').trim();
	const prompt = String(args.prompt ?? '').trim();
	if (!prompt) throw new Error('Replicate speech prompt is required');
	if (prompt.length > SPEECH_PROMPT_MAX_CHARS) {
		throw new Error(`Speech prompt must be at most ${SPEECH_PROMPT_MAX_CHARS} characters`);
	}

	if (model === SPEECH_MODEL_MINIMAX) {
		const voice = String(args.voice ?? '').trim();
		const voiceId = String(args.voice_id ?? '').trim();
		const input = { text: prompt };
		if (voice === MINIMAX_CUSTOM_VOICE) {
			if (!voiceId) {
				throw new Error('voice_id is required when voice is custom');
			}
			input.voice_id = voiceId;
		} else if (voice) {
			input.voice_id = voice;
		}
		const emotion = normalizeMinimaxEmotion(args.emotion);
		if (emotion) input.emotion = emotion;
		return input;
	}

	if (model === SPEECH_MODEL_GEMINI) {
		const input = { text: prompt };
		const voice = String(args.voice ?? '').trim();
		if (voice) input.voice = voice;
		const style = String(args.style ?? '').trim();
		if (style) input.prompt = style;
		return input;
	}

	throw new Error(`Unsupported speech model: ${model || '(none)'}`);
}

export function buildMusicInput(args = {}) {
	const model = String(args.model ?? '').trim();
	const prompt = String(args.prompt ?? '').trim();
	if (!prompt) throw new Error('Replicate music prompt is required');

	if (model === MUSIC_MODEL_LYRIA) {
		return { prompt };
	}

	if (model === MUSIC_MODEL_MINIMAX) {
		const input = { prompt };
		const lyrics = String(args.lyrics ?? '').trim();
		if (lyrics) input.lyrics = lyrics;
		if (args.is_instrumental === true || args.is_instrumental === 'true') {
			input.is_instrumental = true;
		}
		if (args.lyrics_optimizer === true || args.lyrics_optimizer === 'true') {
			input.lyrics_optimizer = true;
		}
		return input;
	}

	throw new Error(`Unsupported music model: ${model || '(none)'}`);
}

const VOICE_FILE_EXT_RE = /\.(wav|mp3|m4a)(\?|#|$)/i;

function decodeAudioDataUrl(value) {
	const raw = String(value ?? '').trim();
	const match = raw.match(/^data:([^;,]+)?((?:;[^,]+)*)?,(.*)$/s);
	if (!match) return null;
	const mime = (match[1] || 'application/octet-stream').trim().toLowerCase();
	const meta = match[2] || '';
	const payload = match[3] || '';
	const isBase64 = /;base64/i.test(`${mime}${meta}`);
	const buffer = Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
	if (!buffer.length) return null;
	let ext = 'wav';
	if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';
	else if (mime.includes('mp4') || mime.includes('m4a')) ext = 'm4a';
	else if (mime.includes('wav')) ext = 'wav';
	return { buffer, ext, mime };
}

function pcm16FromWav(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 44) return null;
	if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
		return null;
	}
	let offset = 12;
	let sampleRate = 16000;
	while (offset + 8 <= buffer.length) {
		const id = buffer.toString('ascii', offset, offset + 4);
		const size = buffer.readUInt32LE(offset + 4);
		const start = offset + 8;
		if (id === 'fmt ' && size >= 16) {
			sampleRate = buffer.readUInt32LE(start + 4);
		}
		if (id === 'data') {
			const count = Math.floor(size / 2);
			const samples = new Int16Array(count);
			for (let i = 0; i < count; i += 1) {
				samples[i] = buffer.readInt16LE(start + i * 2);
			}
			return { samples, sampleRate };
		}
		offset = start + size + (size % 2);
	}
	return null;
}

function resampleInt16(samples, fromRate, toRate) {
	if (fromRate === toRate) return samples;
	const ratio = fromRate / toRate;
	const length = Math.max(1, Math.round(samples.length / ratio));
	const out = new Int16Array(length);
	for (let i = 0; i < length; i += 1) {
		const src = i * ratio;
		const i0 = Math.floor(src);
		const i1 = Math.min(i0 + 1, samples.length - 1);
		const t = src - i0;
		out[i] = Math.round(samples[i0] * (1 - t) + samples[i1] * t);
	}
	return out;
}

export function encodePcmToMp3(samples, sampleRate = 16000) {
	const rate = sampleRate === 44100 || sampleRate === 48000 || sampleRate === 22050
		? sampleRate
		: 44100;
	const pcm = resampleInt16(samples, sampleRate, rate);
	const encoder = new lamejs.Mp3Encoder(1, rate, 128);
	const block = 1152;
	const parts = [];
	for (let i = 0; i < pcm.length; i += block) {
		const chunk = pcm.subarray(i, i + block);
		const encoded = encoder.encodeBuffer(chunk);
		if (encoded?.length) parts.push(Buffer.from(encoded));
	}
	const tail = encoder.flush();
	if (tail?.length) parts.push(Buffer.from(tail));
	const mp3 = Buffer.concat(parts);
	if (mp3.length < 32) throw new Error('MP3 encode produced no audio');
	return mp3;
}

function voiceBufferToMp3(buffer) {
	if (buffer.length >= 3 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
		return buffer;
	}
	const wav = pcm16FromWav(buffer);
	if (!wav) throw new Error('Could not decode voice sample as WAV for MP3 encode');
	return encodePcmToMp3(wav.samples, wav.sampleRate);
}

/** MiniMax accepts MP3 data URIs. A File becomes files.create → JSON metadata URL, which they reject. */
export function mp3DataUriFromBuffer(buffer) {
	const mp3 =
		buffer.length >= 3 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0
			? buffer
			: voiceBufferToMp3(buffer);
	return `data:audio/mpeg;base64,${mp3.toString('base64')}`;
}

export async function resolveVoiceTrainFile(voiceFile) {
	if (voiceFile instanceof Blob) {
		const buffer = Buffer.from(await voiceFile.arrayBuffer());
		return mp3DataUriFromBuffer(buffer);
	}
	const raw = String(voiceFile ?? '').trim();
	if (!raw) throw new Error('voice_file is required');
	if (/^https?:\/\//i.test(raw)) {
		if (/^https:\/\/api\.replicate\.com\/v1\/files\//i.test(raw)) {
			throw new Error(
				'Do not pass a Replicate files URL as voice_file. That URL is JSON metadata, not audio. Use a public https audio URL or a recorded data URL.'
			);
		}
		if (VOICE_FILE_EXT_RE.test(raw)) return raw;
		const { buffer } = await fetchImageBuffer(raw);
		return mp3DataUriFromBuffer(buffer);
	}
	const decoded = decodeAudioDataUrl(raw);
	if (!decoded) {
		throw new Error('voice_file must be an https URL or audio data URL');
	}
	if (decoded.ext === 'mp3' || decoded.mime.includes('mpeg')) {
		return `data:audio/mpeg;base64,${decoded.buffer.toString('base64')}`;
	}
	return mp3DataUriFromBuffer(decoded.buffer);
}

export function buildVoiceTrainInput(args = {}) {
	const voiceFile = args.voice_file;
	if (voiceFile instanceof Blob) {
		return {
			model: REPLICATE_VOICE_CLONE_MODEL,
			voice_file: voiceFile,
		};
	}
	const raw = String(voiceFile ?? '').trim();
	if (!raw) throw new Error('voice_file is required');
	return {
		model: REPLICATE_VOICE_CLONE_MODEL,
		voice_file: raw,
	};
}

function asObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value;
}

function mediaUrlFromUnknown(value) {
	if (value == null) return null;
	if (typeof value === 'string') {
		const s = value.trim();
		if (!s) return null;
		if (s.startsWith('http') || s.startsWith('data:')) return s;
		return null;
	}
	return tryMediaUrl(value);
}

export function parseVoiceTrainOutput(output) {
	if (output == null) return { voiceId: '', previewUrl: null };
	if (typeof output === 'string') {
		try {
			return parseVoiceTrainOutput(JSON.parse(output));
		} catch {
			return { voiceId: '', previewUrl: isAudioUrl(output) ? output : null };
		}
	}
	const obj = asObject(Array.isArray(output) ? output[0] : output);
	if (!obj) {
		return { voiceId: '', previewUrl: mediaUrlFromUnknown(output) };
	}
	const voiceRaw = obj.voice_id ?? obj.voiceId;
	const voiceId = typeof voiceRaw === 'string' ? voiceRaw.trim() : '';
	const previewRaw = obj.preview ?? obj.preview_url ?? obj.previewUrl;
	const previewUrl = mediaUrlFromUnknown(previewRaw);
	return { voiceId, previewUrl };
}

function isAudioUrl(value) {
	const s = String(value ?? '').trim();
	if (!s) return false;
	return (
		/^https?:\/\//i.test(s) &&
		/\.(mp3|m4a|wav|aac|ogg|flac|webm)(\?|#|$)/i.test(s)
	);
}

function tryMediaUrl(value) {
	try {
		return getFirstImageUrl(value);
	} catch {
		return null;
	}
}

function contentTypeFromUrl(url, fallback = 'audio/mpeg') {
	const path = String(url ?? '').split('?')[0].toLowerCase();
	if (path.endsWith('.wav')) return 'audio/wav';
	if (path.endsWith('.m4a')) return 'audio/mp4';
	if (path.endsWith('.ogg')) return 'audio/ogg';
	if (path.endsWith('.flac')) return 'audio/flac';
	if (path.endsWith('.webm')) return 'audio/webm';
	if (path.endsWith('.aac')) return 'audio/aac';
	return fallback;
}

async function downloadAudio(url) {
	const { buffer, contentType } = await fetchImageBuffer(url);
	return {
		audioBuffer: buffer,
		contentType: contentType || contentTypeFromUrl(url),
	};
}

async function runAsyncOrSync({ args, scope, refFallback, buildInput }) {
	const { _async, job_id, prediction_id, ...rest } = args || {};
	const token = requireToken();
	const replicate = new Replicate({ auth: token });
	const model = String(rest.model ?? refFallback).trim() || refFallback;
	const ref = resolveSelectModel(scope, model);

	if (_async) {
		const existingId = job_id || prediction_id;
		if (existingId) {
			const id = existingId.toString().trim();
			const prediction = await replicate.predictions.get(id);
			if (prediction && prediction.status === 'succeeded' && prediction.output != null) {
				const audioUrl = getFirstImageUrl(prediction.output);
				const downloaded = await downloadAudio(audioUrl);
				return { ...downloaded, job_id: id };
			}
			return {
				async: true,
				status: prediction?.status ?? 'unknown',
				job_id: id,
			};
		}

		const input = buildInput({ ...rest, model });
		log(`Replicate ${scope} prediction.create (async)`, {
			model,
			inputKeys: Object.keys(input || {}),
		});
		const prediction = await replicate.predictions.create(
			replicatePredictionBody(ref, input)
		);
		return {
			async: true,
			status: prediction?.status ?? 'starting',
			job_id: prediction.id,
		};
	}

	const input = buildInput({ ...rest, model });
	log(`Replicate ${scope} run (sync)`, {
		model,
		inputKeys: Object.keys(input || {}),
	});
	const output = await replicate.run(ref, { input });
	const audioUrl = getFirstImageUrl(output);
	return downloadAudio(audioUrl);
}

export async function generateReplicateSpeech(args = {}) {
	return runAsyncOrSync({
		args,
		scope: 'replicateSpeech',
		refFallback: SPEECH_MODEL_GEMINI,
		buildInput: buildSpeechInput,
	});
}

export async function generateReplicateMusic(args = {}) {
	return runAsyncOrSync({
		args,
		scope: 'replicateMusic',
		refFallback: MUSIC_MODEL_LYRIA,
		buildInput: buildMusicInput,
	});
}

async function synthesizeClonePreview(replicate, voiceId) {
	const input = {
		text: VOICE_TRAIN_PREVIEW_TEXT,
		voice_id: voiceId,
	};
	log('Replicate voice train preview speech', {
		model: SPEECH_MODEL_MINIMAX,
		voiceId,
	});
	const output = await replicate.run(SPEECH_MODEL_MINIMAX, { input });
	const audioUrl = getFirstImageUrl(output);
	return downloadAudio(audioUrl);
}

async function attachVoiceTrainPreview(replicate, result, previewUrl) {
	if (previewUrl) {
		try {
			const downloaded = await downloadAudio(previewUrl);
			result.audioBuffer = downloaded.audioBuffer;
			result.contentType = downloaded.contentType;
			return result;
		} catch {
			result.preview_url = previewUrl;
		}
	}
	try {
		const synthesized = await synthesizeClonePreview(replicate, result.voice_id);
		result.audioBuffer = synthesized.audioBuffer;
		result.contentType = synthesized.contentType;
		delete result.preview_url;
	} catch (error) {
		log('Replicate voice train preview speech failed', {
			voiceId: result.voice_id,
			error: error?.message || String(error),
		});
	}
	return result;
}

export async function generateReplicateVoiceTrain(args = {}) {
	const { _async, job_id, prediction_id, ...rest } = args || {};
	const token = requireToken();
	const replicate = new Replicate({ auth: token });
	const ref = REPLICATE_VOICE_CLONE_SLUG;

	const finish = async (output, id) => {
		const parsed = parseVoiceTrainOutput(output);
		if (!parsed.voiceId) {
			throw new Error('Voice train finished without a voice_id');
		}
		const result = {
			voice_id: parsed.voiceId,
			status: 'succeeded',
		};
		if (id) result.job_id = id;
		return attachVoiceTrainPreview(replicate, result, parsed.previewUrl);
	};

	if (_async) {
		const existingId = job_id || prediction_id;
		if (existingId) {
			const id = existingId.toString().trim();
			const prediction = await replicate.predictions.get(id);
			if (prediction && prediction.status === 'succeeded' && prediction.output != null) {
				return finish(prediction.output, id);
			}
			return {
				async: true,
				status: prediction?.status ?? 'unknown',
				job_id: id,
			};
		}
		const input = buildVoiceTrainInput({
			...rest,
			voice_file: await resolveVoiceTrainFile(rest.voice_file),
		});
		log('Replicate voice train prediction.create (async)', {
			model: ref,
			inputKeys: Object.keys(input || {}),
			voiceFile:
				input.voice_file instanceof Blob
					? input.voice_file.name
					: String(input.voice_file).slice(0, 80),
		});
		const prediction = await replicate.predictions.create(
			replicatePredictionBody(ref, input)
		);
		return {
			async: true,
			status: prediction?.status ?? 'starting',
			job_id: prediction.id,
		};
	}

	const input = buildVoiceTrainInput({
		...rest,
		voice_file: await resolveVoiceTrainFile(rest.voice_file),
	});
	log('Replicate voice train run (sync)', {
		model: ref,
		voiceFile:
			input.voice_file instanceof Blob
				? input.voice_file.name
				: String(input.voice_file).slice(0, 80),
	});
	const output = await replicate.run(ref, { input });
	return finish(output);
}
