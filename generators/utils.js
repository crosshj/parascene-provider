export function log(...args) {
	// Vercel sets these in serverless environments (prod/preview/dev).
	const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
	if (isVercel) return;
	console.log(...args);
}

