import { PLACE_ROWS } from '../navigation/placeRows';

export const CONTEXT_ROWS = {
  section: PLACE_ROWS.contextSection,
  view: 'context.view',
  highlight: 'context.highlight',
} as const satisfies Readonly<Record<string, string>>;
