import type { WorkNodeState } from '@goodboy/ui';

export const RAIL_ROW_HEIGHT = 56;
export const RAIL_NODE_SIZE = 20;
export const RAIL_NODE_CENTER_X = 16;
export const RAIL_NODE_CENTER_Y = 18;

type SpineStroke = Readonly<{
  stroke: string;
  dash: string | undefined;
}>;

const SUCCESS: SpineStroke = { stroke: 'var(--color-success)', dash: undefined };
const ACTIVE: SpineStroke = { stroke: 'var(--color-info)', dash: undefined };
const FAILED: SpineStroke = { stroke: 'var(--color-danger)', dash: undefined };
const QUIET: SpineStroke = { stroke: 'var(--color-border)', dash: '3 3' };

const SPINE_BY_NODE: Readonly<Record<WorkNodeState, SpineStroke>> = {
  queued: QUIET,
  ready: QUIET,
  running: ACTIVE,
  question: ACTIVE,
  budget: ACTIVE,
  approval: ACTIVE,
  alert: ACTIVE,
  failed: FAILED,
  approved: SUCCESS,
  merging: ACTIVE,
  done: SUCCESS,
  finished: SUCCESS,
  closed: QUIET,
  stopped: QUIET,
  skipped: QUIET,
  marker: QUIET,
  mixed: QUIET,
};

type NodeParams = {
  readonly node: WorkNodeState;
};

export const spineStrokeOf = ({ node }: NodeParams): SpineStroke => SPINE_BY_NODE[node];
