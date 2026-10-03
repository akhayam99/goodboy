import { SHORTCUTS } from './registry';

type ChordEvent = {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
};

const SUBMIT_KEY = SHORTCUTS['composer.submit'].combo.split('+').at(-1);

export const isSubmitChord = (event: ChordEvent): boolean =>
  event.key === SUBMIT_KEY && (event.metaKey || event.ctrlKey);
