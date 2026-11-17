const AGE_OWNER = 'apps/desktop/src/shared/utils/time/formatAge.ts';

const MOCK_SCENE_PATH = /[/]MockScene[/]/;

const HAND_WRITTEN_AGE = /\}\s+ago\b|\b(?:seconds?|minutes?|hours?|days?|weeks?) ago\b/;

export const HAND_WRITTEN_AGE_RULE = {
  id: 'hand-written-age',
  kinds: ['ts'],
  matches: (line) => HAND_WRITTEN_AGE.test(line),
  count: (file) =>
    file.path === AGE_OWNER || MOCK_SCENE_PATH.test(file.path)
      ? 0
      : file.lines.filter((line) => HAND_WRITTEN_AGE.test(line)).length,
  hint: 'an age in words comes from formatAge or formatAdaptiveAge in shared/utils/time, never a hand-written "ago"',
};
