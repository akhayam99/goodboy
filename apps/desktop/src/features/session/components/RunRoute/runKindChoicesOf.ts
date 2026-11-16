import type { RunRoute, Workflow } from '@goodboy/types';
import type { RunRouteChoice } from '../../startRun/changeRunRoute';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';

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
  const isLeadPlan = route.shape === 'lead' && route.role === null;
  const isPlainLead = isLeadPlan && route.presetName === null;
  const lead: ReadonlyArray<RunKindChoice> = isPlainLead
    ? []
    : [
        {
          key: 'lead',
          label: RUN_ROUTE_COPY.shapes.lead,
          choice: { shape: 'lead', presetId: null, closeness },
        },
      ];
  const fromPresets = presets
    .filter((preset) => !isLeadPlan || preset.name !== route.presetName)
    .map((preset): RunKindChoice => ({
      key: `preset:${preset.id}`,
      label: RUN_ROUTE_COPY.leadPlan({ name: preset.name }),
      choice: { shape: 'lead', presetId: preset.id, closeness },
    }));
  return [...lead, ...fromPresets];
};
