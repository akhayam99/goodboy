import type { RunRoute } from '@goodboy/types';
import type { StartShape } from '../../../store/slices/sessionDraft/state';
import { START_KIND_COPY } from '../startKind/startKindCopy';
import { runKindLineOf } from '../startKind/runKindLineOf';

type Params = {
  readonly route: RunRoute;
};

export type RunKindOfRoute = Readonly<{
  shape: StartShape;
  name: string;
  what: string;
}>;

export const runKindOfRoute = ({ route }: Params): RunKindOfRoute => {
  if (route.shape === 'plan' && route.presetName !== null) {
    return {
      shape: 'preset',
      name: runKindLineOf({ line: { kind: 'preset', presetName: route.presetName } }),
      what: START_KIND_COPY.shapes.preset.what,
    };
  }
  if (route.shape === 'plan') {
    return {
      shape: 'orchestrated',
      name: runKindLineOf({ line: { kind: 'orchestrated' } }),
      what: START_KIND_COPY.shapes.orchestrated.what,
    };
  }
  if (route.role !== null) {
    return { shape: 'agent', name: route.choice, what: START_KIND_COPY.shapes.agent.what };
  }
  return {
    shape: 'autoAgent',
    name: runKindLineOf({ line: { kind: 'autoAgent' } }),
    what: START_KIND_COPY.shapes.autoAgent.what,
  };
};
