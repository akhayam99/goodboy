import { runListGridFit } from './validateScenesListGridFit.mjs';
import { runReleaseImageShape } from './validateScenesReleaseImageShape.mjs';
import { runQuestionCard } from './validateScenesQuestionCard.mjs';
import { runRowAlign } from './validateScenesRowAlign.mjs';
import { runRunTailFit } from './validateScenesRunTailFit.mjs';

export const runFitProbes = async (context) => {
  await runListGridFit(context);
  await runQuestionCard(context);
  await runReleaseImageShape(context);
  await runRowAlign(context);
  await runRunTailFit(context);
};
