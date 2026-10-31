import { runListGridFit } from './validateScenesListGridFit.mjs';
import { runReleaseImageShape } from './validateScenesReleaseImageShape.mjs';

export const runFitProbes = async (context) => {
  await runListGridFit(context);
  await runReleaseImageShape(context);
};
