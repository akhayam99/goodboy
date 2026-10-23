import type { RunRoute, RunRouteCloseness, RunRouteShape, Workflow } from '@goodboy/types';
import { runKindLineOf } from '../startKind/runKindLineOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type PresetRouteParams = {
  readonly preset: Workflow;
  readonly closeness: RunRouteCloseness;
  readonly row: number;
  readonly why: string;
};

export const presetRouteOf = ({ preset, closeness, row, why }: PresetRouteParams): RunRoute => ({
  shape: 'plan',
  row,
  presetName: preset.name,
  closeness,
  role: null,
  choice: `${runKindLineOf({ line: { kind: 'preset', presetName: preset.name } })} · ${RUN_ROUTE_COPY.closeness[closeness]}`,
  why,
});

type ShapeRouteParams = {
  readonly shape: RunRouteShape;
  readonly row: number;
  readonly why: string;
};

export const shapeRouteOf = ({ shape, row, why }: ShapeRouteParams): RunRoute => ({
  shape,
  row,
  presetName: null,
  closeness: null,
  role: null,
  choice: RUN_ROUTE_COPY.shapes[shape],
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
