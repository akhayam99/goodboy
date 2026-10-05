import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

export const KEY_HELP_ROWS: ReadonlyArray<readonly [string, string]> = [
  [`${shortcutGlyphs('diff.fileDown')} ${shortcutGlyphs('diff.fileUp')}`, 'move'],
  [`${shortcutGlyphs('diff.previousFile')} ${shortcutGlyphs('diff.nextFile')}`, 'same'],
  [`${shortcutGlyphs('diff.closeFolder')} ${shortcutGlyphs('diff.openFolder')}`, 'fold'],
  [shortcutGlyphs('diff.markViewed'), 'viewed'],
  [shortcutGlyphs('diff.nextUnviewed'), 'next unviewed'],
  [shortcutGlyphs('diff.focusTree'), 'tree'],
  [`${shortcutGlyphs('diff.focusFilter')} ${shortcutGlyphs('diff.focusFilterAlias')}`, 'filter'],
  [shortcutGlyphs('diff.toggleTree'), 'hide'],
];

export const KEY_HELP = [
  `${shortcutGlyphs('diff.fileDown')} ${shortcutGlyphs('diff.fileUp')} move`,
  `${shortcutGlyphs('diff.markViewed')} viewed`,
  `${shortcutGlyphs('diff.focusFilter')} filter`,
].join(' · ');
