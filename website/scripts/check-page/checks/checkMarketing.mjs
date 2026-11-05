import { MAX_SENTENCE_WORDS } from '../constants.mjs';

export const checkMarketing = ({ fail, probe, rules }) => {
  if (probe.middot !== null) {
    fail(`a middot triplet in visible text: "${probe.middot}"`);
  }
  if (!probe.hasMockStage) {
    fail('no .mockStage on the page, so the shadow rule has nothing to check');
  }
  rules.rasters.forEach((image) => fail(`a raster image in main: ${image}`));
  rules.longSentences.forEach((message) =>
    fail(`a sentence over ${MAX_SENTENCE_WORDS} words, ${message}`),
  );
  rules.copyRepeats.forEach((message) => fail(message));
};
