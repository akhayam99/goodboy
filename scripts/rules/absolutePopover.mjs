const ABSOLUTE = /(?<![\w-])absolute(?![\w-])/;

const OUTSIDE_OR_POPOVER = /(?<![\w-])(?:(?:top|bottom|left|right)-full|z-popover)(?![\w-])/;

const BADGE_CORNER_OWNER = 'packages/ui/src/countBadgeCorner.ts';

export const ABSOLUTE_POPOVER_RULE = {
  id: 'absolute-popover',
  kinds: ['ts'],
  count: (file) =>
    file.path === BADGE_CORNER_OWNER
      ? 0
      : file.lines.filter((line) => ABSOLUTE.test(line) && OUTSIDE_OR_POPOVER.test(line)).length,
  hint: 'a surface that floats outside its box goes through the portal: AnchoredLayer or AnchoredPopover (docs/styling.md, Popovers)',
};
