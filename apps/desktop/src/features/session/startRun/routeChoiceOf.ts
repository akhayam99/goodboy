import type { RunRoute, RunRouteCloseness, RunRouteShape, Workflow } from '@goodboy/types';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type CountParams = {
  readonly count: number;
};

const stepsWord = ({ count }: CountParams): string => `${count} ${count === 1 ? 'step' : 'steps'}`;

type PresetRouteParams = {
  readonly preset: Workflow;
  readonly closeness: RunRouteCloseness;
  readonly row: number;
  readonly why: string;
};

export const presetRouteOf = ({ preset, closeness, row, why }: PresetRouteParams): RunRoute => {
  const steps = preset.steps.filter((step) => step.deletedAt == null).length;
  return {
    shape: 'plan',
    row,
    presetName: preset.name,
    closeness,
    role: null,
    choice: `Plan from ${preset.name}, ${stepsWord({ count: steps })} · ${RUN_ROUTE_COPY.closeness[closeness]}`,
    why,
  };
};

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
