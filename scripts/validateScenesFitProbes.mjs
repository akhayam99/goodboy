import { runFrost } from './validateScenesFrost.mjs';
import { runListGridFit } from './validateScenesListGridFit.mjs';
import { runModelsGrid } from './validateScenesModelsGrid.mjs';
import { runReadingHold } from './validateScenesReadingHold.mjs';
import { runReleaseImageShape } from './validateScenesReleaseImageShape.mjs';
import { runQuestionCard } from './validateScenesQuestionCard.mjs';
import { runRowAlign } from './validateScenesRowAlign.mjs';
import { runRunTailFit } from './validateScenesRunTailFit.mjs';
import { runPageColumn } from './validateScenesPageColumn.mjs';
import { runRowStart } from './validateScenesRowStart.mjs';
import { runTitleBand } from './validateScenesTitleBand.mjs';
import { runToolSignal } from './validateScenesToolSignal.mjs';

export const runFitProbes = async (context) => {
  await runFrost(context);
  await runListGridFit(context);
  await runModelsGrid(context);
  await runQuestionCard(context);
  await runReadingHold(context);
  await runReleaseImageShape(context);
  await runRowAlign(context);
  await runRunTailFit(context);
  await runPageColumn(context);
  await runTitleBand(context);
  await runRowStart(context);
  await runToolSignal(context);
};
