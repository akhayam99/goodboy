import type { RunRoute, RunRouteCloseness, Workflow } from '@goodboy/types';
import { runKindLineOf } from '../startKind/runKindLineOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type PresetRouteParams = {
  readonly preset: Workflow;
  readonly closeness: RunRouteCloseness;
  readonly row: number;
  readonly why: string;
};

export const presetRouteOf = ({ preset, closeness, row, why }: PresetRouteParams): RunRoute => ({
  shape: 'lead',
  row,
  presetName: preset.name,
  workflowId: preset.id,
  closeness,
  role: null,
  choice: `${RUN_ROUTE_COPY.leadPlan({ name: preset.name })} · ${RUN_ROUTE_COPY.closeness[closeness]}`,
  why,
});

type OlderPlanRouteParams = {
  readonly preset: Workflow | null;
  readonly closeness: RunRouteCloseness;
  readonly row: number;
  readonly why: string;
};

export const olderPlanRouteOf = ({
  preset,
  closeness,
  row,
  why,
}: OlderPlanRouteParams): RunRoute =>
  preset === null
    ? {
        shape: 'plan',
        row,
        presetName: null,
        closeness: null,
        role: null,
        choice: RUN_ROUTE_COPY.shapes.plan,
        why,
      }
    : {
        shape: 'plan',
        row,
        presetName: preset.name,
        closeness,
        role: null,
        choice: `${runKindLineOf({ line: { kind: 'preset', presetName: preset.name } })} · ${RUN_ROUTE_COPY.closeness[closeness]}`,
        why,
      };

type ShapeRouteParams = {
  readonly row: number;
  readonly why: string;
};

export const leadRouteOf = ({ row, why }: ShapeRouteParams): RunRoute => ({
  shape: 'lead',
  row,
  presetName: null,
  closeness: null,
  role: null,
  choice: RUN_ROUTE_COPY.shapes.lead,
  why,
});

type RoleRouteParams = {
  readonly role: string;
  readonly label: string;
  readonly row: number;
  readonly why: string;
};

export const roleRouteOf = ({ role, label, row, why }: RoleRouteParams): RunRoute => ({
  shape: 'lead',
  row,
  presetName: null,
  closeness: null,
  role,
  choice: runKindLineOf({ line: { kind: 'agent', role: label } }),
  why,
});
