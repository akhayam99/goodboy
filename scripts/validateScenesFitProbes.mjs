import { runListGridFit } from './validateScenesListGridFit.mjs';
import { runReleaseImageShape } from './validateScenesReleaseImageShape.mjs';
import { runRowAlign } from './validateScenesRowAlign.mjs';
import { runRunTailFit } from './validateScenesRunTailFit.mjs';

export const runFitProbes = async (context) => {
  await runListGridFit(context);
  await runReleaseImageShape(context);
  await runRowAlign(context);
  await runRunTailFit(context);
};
