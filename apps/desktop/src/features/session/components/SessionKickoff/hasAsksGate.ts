import type { StartShape } from '../../../../store/slices/sessionDraft/state';

type Params = {
  readonly shape: StartShape;
};

export const hasAsksGate = ({ shape }: Params): boolean =>
  shape === 'orchestrated' || shape === 'preset';
