import type { ResolvedAction } from '../../../features/actions/types';

export type ArmedAction = {
  readonly action: ResolvedAction;
  readonly run: () => Promise<void>;
};

export type OnArm = (armed: ArmedAction) => void;
