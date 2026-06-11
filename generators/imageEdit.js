import sharp from 'sharp';
import {
	dimensionsForAspectRatioLongEdge,
	parseAspectRatioKey,
} from '../lib/aspectRatio.js';
import { log, fetchImageBuffer } from './utils.js';

const maxBytes = 20 * 1024 * 1024;
const LONG_EDGE = 1024;
const DEFAULT_ASPECT = '1:1';
/** Letterbox padding — matches fitImageToAspectRatio letterbox default. */
const LETTERBOX_BACKGROUND = { r: 24, g: 24, b: 32, alpha: 1 };

/**
 * @param {unknown} raw
 * @returns {string}
 */
function resolveAspectRatio(raw) {
	const key = String(raw ?? '').trim() || DEFAULT_ASPECT;
	try {
		parseAspectRatioKey(key);
		return key;
	} catch {
		return DEFAULT_ASPECT;
	}
}

/**
 * Fit an image from a URL into the requested aspect ratio (long edge 1024).
 * Letterboxes only — no pixel loss (mutates can fill padding later). Defaults to 1:1.
 */
export async function uploadImage(args = {}) {
	if (!args || typeof args !== 'object')
		throw new Error('Arguments object is required');

	const image_url = (args.image_url || '').trim();
	if (!image_url) throw new Error('An image_url is required');

	try {
		new URL(image_url);
	} catch {
		throw new Error('image_url must be a valid URL');
	}

	const aspectKey = resolveAspectRatio(args.aspect_ratio);
	const { width: targetW, height: targetH } = dimensionsForAspectRatioLongEdge(
		aspectKey,
		LONG_EDGE
	);

	const { buffer: fetchedBuffer } = await fetchImageBuffer(image_url);
	let imgBuf = fetchedBuffer;

	if (imgBuf.length > maxBytes)
		throw new Error(
			`Input image too large: ${imgBuf.length} bytes (max ${maxBytes})`
		);

	const meta = await sharp(imgBuf).metadata();
	const width = Number(meta.width);
	const height = Number(meta.height);

	if (
		Number.isFinite(width) &&
		width > 0 &&
		Number.isFinite(height) &&
		height > 0 &&
		(width !== targetW || height !== targetH)
	) {
		log('Letterboxing image to target aspect', {
			aspect_ratio: aspectKey,
			from: { width, height },
			to: { width: targetW, height: targetH },
			mode: 'contain',
		});

		imgBuf = await sharp(imgBuf)
			.resize(targetW, targetH, {
				fit: 'contain',
				background: LETTERBOX_BACKGROUND,
			})
			.png()
			.toBuffer();
	} else {
		imgBuf = await sharp(imgBuf).png().toBuffer();
	}

	if (imgBuf.length > maxBytes)
		throw new Error(
			`Image too large after resize: ${imgBuf.length} bytes (max ${maxBytes})`
		);

	return {
		buffer: imgBuf,
		width: targetW,
		height: targetH,
		color: '#000000',
	};
}
