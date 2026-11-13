const FONT_SANS = /\bfont-sans\b/;

const DIFF_FEATURE_PATH = 'apps/desktop/src/features/diff/';

export const DIFF_FONT_SANS_RULE = {
  id: 'diff-font-sans',
  kinds: ['ts'],
  count: (file) =>
    file.path.startsWith(DIFF_FEATURE_PATH)
      ? file.lines.filter((line) => FONT_SANS.test(line)).length
      : 0,
  hint: 'the diff sets font-sans once on the container that holds its comment threads and its children stop undoing mono; do not write it again under features/diff (docs/navigation/branch-page.md)',
};
