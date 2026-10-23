import type { RunRoute, Workflow } from '@goodboy/types';
import type { RunRouteChoice } from '../../startRun/changeRunRoute';
import { runKindLineOf } from '../../startKind/runKindLineOf';

type Params = {
  readonly route: RunRoute;
  readonly presets: ReadonlyArray<Workflow>;
};

export type RunKindChoice = Readonly<{
  key: string;
  label: string;
  choice: RunRouteChoice;
}>;

export const runKindChoicesOf = ({ route, presets }: Params): ReadonlyArray<RunKindChoice> => {
  const closeness = route.closeness ?? 'adapt';
  const isOrchestrated = route.shape === 'plan' && route.presetName === null;
  const isAutoAgent = route.shape === 'lead';
  const orchestrated: ReadonlyArray<RunKindChoice> = isOrchestrated
    ? []
    : [
        {
          key: 'orchestrated',
          label: runKindLineOf({ line: { kind: 'orchestrated' } }),
          choice: { shape: 'plan', presetId: null, closeness },
        },
      ];
  const fromPresets = presets
    .filter((preset) => route.shape !== 'plan' || preset.name !== route.presetName)
    .map((preset): RunKindChoice => ({
      key: `preset:${preset.id}`,
      label: runKindLineOf({ line: { kind: 'preset', presetName: preset.name } }),
      choice: { shape: 'plan', presetId: preset.id, closeness },
    }));
  const autoAgent: ReadonlyArray<RunKindChoice> = isAutoAgent
    ? []
    : [
        {
          key: 'auto-agent',
          label: runKindLineOf({ line: { kind: 'autoAgent' } }),
          choice: { shape: 'lead', presetId: null, closeness },
        },
      ];
  return [...orchestrated, ...fromPresets, ...autoAgent];
};
