import { runListGridFit } from './validateScenesListGridFit.mjs';
import { runReleaseImageShape } from './validateScenesReleaseImageShape.mjs';
import { runRowAlign } from './validateScenesRowAlign.mjs';

export const runFitProbes = async (context) => {
  await runListGridFit(context);
  await runReleaseImageShape(context);
  await runRowAlign(context);
};
