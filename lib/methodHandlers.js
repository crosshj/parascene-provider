import { generateGradientCircle } from '../generators/gradientCircle.js';
import { generateTextImage } from '../generators/textImage.js';
import { generatePoeticImage } from '../generators/zydeco.js';
import {
	generateFluxImage,
	generatePoeticImageFlux,
	fluxImageEdit,
} from '../generators/flux.js';
import { uploadImage } from '../generators/imageEdit.js';
import { generateRetroDiffusionImage } from '../generators/retroDiffusion.js';
import { generatePixelLabImage } from '../generators/pixelLab.js';
import { generateReplicateImage } from '../generators/replicate.js';

export const methodHandlers = {
	gradientCircle: generateGradientCircle,
	centeredTextOnWhite: generateTextImage,
	poeticImage: generatePoeticImage,
	fluxImage: (args) => generateFluxImage({ ...args, model: 'flux2Pro' }),
	fluxImageFlex: (args) => generateFluxImage({ ...args, model: 'flux2Flex' }),
	fluxImageKlein: (args) => generateFluxImage({ ...args, model: 'fluxKlein' }),
	fluxPoeticImage: generatePoeticImageFlux,
	fluxImageEdit: fluxImageEdit,
	retroDiffusionImage: generateRetroDiffusionImage,
	pixelLabImage: generatePixelLabImage,
	uploadImage,
	replicate: generateReplicateImage,
};
