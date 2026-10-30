import type { Workflow } from '@goodboy/types';
import { AUTO_RUN_AS, type RunAs } from '../../startRun/runAsOf';
import type { StartFormKind } from './startFormKinds';

type KindParams = {
  readonly runAs: RunAs;
};

export const startFormKindOfRunAs = ({ runAs }: KindParams): StartFormKind | null => {
  switch (runAs.kind) {
    case 'auto':
      return null;
    case 'autoAgent':
      return 'auto';
    case 'role':
      return 'agent';
    case 'orchestrated':
    case 'preset':
      return runAs.kind;
    default: {
      const unreachable: never = runAs;
      return unreachable;
    }
  }
};

type RunAsParams = {
  readonly kind: StartFormKind;
  readonly presets: ReadonlyArray<Workflow>;
};

export const runAsOfStartFormKind = ({ kind, presets }: RunAsParams): RunAs => {
  if (kind === 'auto') {
    return { kind: 'autoAgent' };
  }
  if (kind === 'orchestrated') {
    return { kind: 'orchestrated' };
  }
  if (kind === 'agent') {
    return { kind: 'role', role: 'scout' };
  }
  const [first] = presets;
  return first === undefined
    ? AUTO_RUN_AS
    : { kind: 'preset', presetId: first.id, closeness: 'adapt' };
};
