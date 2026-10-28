import type { Workflow } from '@goodboy/types';
import { agentKindPalette, type AgentKind } from '../agent-kind';
import { runKindLineOf } from '../startKind/runKindLineOf';
import { presetRouteOf, roleRouteOf, shapeRouteOf } from './routeChoiceOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import { runRouteOf, type RunRouteFacts, type RunRouteResult } from './runRouteOf';

export type RunAs =
  | Readonly<{ kind: 'auto' }>
  | Readonly<{ kind: 'autoAgent' }>
  | Readonly<{ kind: 'orchestrated' }>
  | Readonly<{ kind: 'preset'; presetId: string }>
  | Readonly<{ kind: 'role'; role: AgentKind }>;

export const AUTO_RUN_AS: RunAs = { kind: 'auto' };

export type RunAsChoice = Readonly<{
  key: string;
  label: string;
  runAs: RunAs;
}>;

type ChoicesParams = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly roles: RunRouteFacts['roles'];
};

export const runAsChoicesOf = ({ presets, roles }: ChoicesParams): ReadonlyArray<RunAsChoice> => [
  { key: 'auto', label: RUN_ROUTE_COPY.runAs.auto, runAs: AUTO_RUN_AS },
  {
    key: 'auto-agent',
    label: runKindLineOf({ line: { kind: 'autoAgent' } }),
    runAs: { kind: 'autoAgent' },
  },
  {
    key: 'orchestrated',
    label: runKindLineOf({ line: { kind: 'orchestrated' } }),
    runAs: { kind: 'orchestrated' },
  },
  ...presets.map((preset): RunAsChoice => ({
    key: `preset:${preset.id}`,
    label: runKindLineOf({ line: { kind: 'preset', presetName: preset.name } }),
    runAs: { kind: 'preset', presetId: preset.id },
  })),
  ...roles.map((entry): RunAsChoice => ({
    key: `role:${entry.kind}`,
    label: runKindLineOf({ line: { kind: 'agent', role: entry.label } }),
    runAs: { kind: 'role', role: entry.kind },
  })),
];

type LabelParams = {
  readonly runAs: RunAs;
  readonly choices: ReadonlyArray<RunAsChoice>;
};

type SameParams = {
  readonly first: RunAs;
  readonly second: RunAs;
};

const isSameRunAs = ({ first, second }: SameParams): boolean => {
  if (first.kind !== second.kind) {
    return false;
  }
  if (first.kind === 'preset' && second.kind === 'preset') {
    return first.presetId === second.presetId;
  }
  if (first.kind === 'role' && second.kind === 'role') {
    return first.role === second.role;
  }
  return true;
};

export const runAsLabelOf = ({ runAs, choices }: LabelParams): string =>
  choices.find((choice) => isSameRunAs({ first: choice.runAs, second: runAs }))?.label ??
  RUN_ROUTE_COPY.runAs.auto;

type Params = {
  readonly runAs: RunAs;
  readonly facts: RunRouteFacts;
};

export const runAsRouteOf = ({ runAs, facts }: Params): RunRouteResult => {
  const typed = runRouteOf({ facts });
  if (runAs.kind === 'auto' || typed.route.why === RUN_ROUTE_COPY.why.picked) {
    return typed;
  }
  const ask = facts.text.trim();
  const why = RUN_ROUTE_COPY.why.picked;
  if (runAs.kind === 'autoAgent' || runAs.kind === 'orchestrated') {
    return {
      route: shapeRouteOf({
        shape: runAs.kind === 'autoAgent' ? 'lead' : 'plan',
        row: 1,
        why,
      }),
      ask,
      preset: null,
      role: null,
    };
  }
  if (runAs.kind === 'preset') {
    const preset = facts.presets.find((entry) => entry.id === runAs.presetId);
    if (preset === undefined) {
      return typed;
    }
    return {
      route: presetRouteOf({ preset, closeness: 'follow', row: 1, why }),
      ask,
      preset,
      role: null,
    };
  }
  return {
    route: roleRouteOf({
      role: runAs.role,
      label: agentKindPalette({ kind: runAs.role }).label,
      row: 1,
      why,
    }),
    ask,
    preset: null,
    role: runAs.role,
  };
};
