import sharp from 'sharp';

const RATIO_KEY_RE = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;

/**
 * Parse "W:H" aspect ratio key to numeric parts and width/height quotient.
 * @param {string} ratioKey
 * @returns {{ key: string, width: number, height: number, value: number }}
 */
export function parseAspectRatioKey(ratioKey) {
	const key = String(ratioKey ?? '').trim();
	const m = key.match(RATIO_KEY_RE);
	if (!m) {
		throw new Error(`Invalid aspect ratio key: ${ratioKey}`);
	}
	const width = Number.parseFloat(m[1]);
	const height = Number.parseFloat(m[2]);
	if (!(width > 0 && height > 0)) {
		throw new Error(`Invalid aspect ratio key: ${ratioKey}`);
	}
	return { key, width, height, value: width / height };
}

/**
 * Pick the native ratio key whose value is closest to the target (for auto synthetic source).
 * @param {string} targetKey
 * @param {string[]} nativeKeys
 * @returns {string|null}
 */
export function pickNearestNativeAspectRatio(targetKey, nativeKeys) {
	const target = parseAspectRatioKey(targetKey);
	let best = null;
	let bestDelta = Infinity;
	for (const key of nativeKeys) {
		if (key === 'auto') continue;
		let native;
		try {
			native = parseAspectRatioKey(key);
		} catch {
			continue;
		}
		const delta = Math.abs(native.value - target.value);
		if (delta < bestDelta) {
			bestDelta = delta;
			best = key;
		}
	}
	return best;
}

/**
 * Center-crop or letterbox an image buffer to a target aspect ratio.
 * @param {Buffer} buffer
 * @param {string} targetKey - e.g. "4:5"
 * @param {{ mode?: 'crop' | 'letterbox', background?: { r: number, g: number, b: number, alpha?: number } }} [options]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
export async function fitImageToAspectRatio(buffer, targetKey, options = {}) {
	const mode = options.mode === 'letterbox' ? 'letterbox' : 'crop';
	const target = parseAspectRatioKey(targetKey);

	const meta = await sharp(buffer, { failOn: 'none' }).metadata();
	const iw = meta.width;
	const ih = meta.height;
	if (!(iw > 0 && ih > 0)) {
		throw new Error('Cannot fit aspect ratio: image has no dimensions');
	}

	const current = iw / ih;
	const targetVal = target.value;
	if (Math.abs(current - targetVal) < 0.002) {
		const out = await sharp(buffer).png().toBuffer();
		return { buffer: out, width: iw, height: ih };
	}

	if (mode === 'crop') {
		let cropW;
		let cropH;
		let left;
		let top;
		if (current > targetVal) {
			cropH = ih;
			cropW = Math.round(ih * targetVal);
			left = Math.max(0, Math.round((iw - cropW) / 2));
			top = 0;
		} else {
			cropW = iw;
			cropH = Math.round(iw / targetVal);
			left = 0;
			top = Math.max(0, Math.round((ih - cropH) / 2));
		}
		cropW = Math.min(cropW, iw - left);
		cropH = Math.min(cropH, ih - top);
		const out = await sharp(buffer)
			.extract({ left, top, width: cropW, height: cropH })
			.png()
			.toBuffer();
		const outMeta = await sharp(out).metadata();
		return {
			buffer: out,
			width: outMeta.width ?? cropW,
			height: outMeta.height ?? cropH,
		};
	}

	const bg = options.background ?? { r: 24, g: 24, b: 32, alpha: 1 };
	let pipeline = sharp(buffer);

	if (current > targetVal) {
		const newH = Math.round(iw / targetVal);
		const padTotal = Math.max(0, newH - ih);
		const top = Math.floor(padTotal / 2);
		const bottom = padTotal - top;
		pipeline = pipeline.extend({ top, bottom, background: bg });
	} else {
		const newW = Math.round(ih * targetVal);
		const padTotal = Math.max(0, newW - iw);
		const left = Math.floor(padTotal / 2);
		const right = padTotal - left;
		pipeline = pipeline.extend({ left, right, background: bg });
	}

	const out = await pipeline.png().toBuffer();
	const finalMeta = await sharp(out).metadata();
	return {
		buffer: out,
		width: finalMeta.width ?? iw,
		height: finalMeta.height ?? ih,
	};
}
