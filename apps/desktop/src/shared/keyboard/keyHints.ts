import type { FacetKeyHint } from '@goodboy/ui';
import { shortcutGlyphs, type ShortcutId } from './registry';

type HintSpec = {
  readonly ids: ReadonlyArray<ShortcutId>;
  readonly label: string;
};

export const keyHintsOf = (specs: ReadonlyArray<HintSpec>): ReadonlyArray<FacetKeyHint> =>
  specs.map((spec) => ({ keys: spec.ids.map(shortcutGlyphs), label: spec.label }));
