import { describe, expect, it } from 'vitest';
import { startSentence } from '../artifacts/startSentence';
import { WIREFRAME_FIDELITIES, WIREFRAME_FIDELITY_HINT } from './wireframeFidelity';

describe('WIREFRAME_FIDELITY_HINT', () => {
  it.each(WIREFRAME_FIDELITIES)(
    'shows every sentence of the %s hint in sentence case',
    (fidelity) => {
      const shown = startSentence({ text: WIREFRAME_FIDELITY_HINT[fidelity] });
      const sentences = shown.split(/\.\s+/);
      for (const sentence of sentences) {
        expect(sentence.charAt(0)).toBe(sentence.charAt(0).toUpperCase());
      }
    },
  );
});
