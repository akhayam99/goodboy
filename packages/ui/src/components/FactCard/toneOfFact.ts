import type { Tone } from '../../tint';
import type { FactTone } from './types';

type Params = {
  readonly tone: FactTone | 'neutral';
};

export const toneOfFact = ({ tone }: Params): Tone => (tone === 'ok' ? 'success' : tone);
