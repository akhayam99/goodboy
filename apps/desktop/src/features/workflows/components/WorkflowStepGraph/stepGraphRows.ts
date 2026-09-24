import type { Agent, Step } from '@goodboy/types';
import { isAgentSettled } from '@goodboy/core';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import {
  TIMELINE_RHYTHM,
  markerCenterY,
  type TimelineRowGrade,
} from '../../../workTreeModel/timelineRhythm';

const MAX_DEPTH = 4;

export const STEP_ROW_GRADE = 'entry' satisfies TimelineRowGrade;

export const STEP_ROW_HEIGHT = TIMELINE_RHYTHM.grade[STEP_ROW_GRADE].height;

export const STEP_ROW_MARKER_Y = markerCenterY({ grade: STEP_ROW_GRADE, gap: 'none' });

export type StepGraphRow = {
  readonly run: Agent;
  readonly marker: string;
  readonly depth: number;
  readonly step: Step | null;
  readonly childCount: number;
  readonly doneChildCount: number;
  readonly answersForStepName: string | null;
};

type Params = {
  readonly runs: ReadonlyArray<Agent>;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
  readonly stepById: ReadonlyMap<string, Step>;
};

type WalkParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly depth: number;
  readonly prefix: string;
  readonly parentStepName: string | null;
};

export const buildStepGraphRows = ({
  runs,
  childrenByParentId,
  stepById,
}: Params): ReadonlyArray<StepGraphRow> => {
  const rows: StepGraphRow[] = [];

  const walk = ({ agents, depth, prefix, parentStepName }: WalkParams): void => {
    const ordered = [...agents].sort((first, second) => first.ordinal - second.ordinal);
    ordered.forEach((run, index) => {
      const marker = `${prefix}${index + 1}`;
      const children = childrenByParentId.get(run.id) ?? [];
      const hasBranch = children.length > 0 && depth < MAX_DEPTH;
      const ownStep = run.stepId == null ? null : (stepById.get(run.stepId) ?? null);
      const step = depth > 0 ? null : ownStep;
      rows.push({
        run,
        marker,
        depth,
        step,
        childCount: hasBranch ? children.length : 0,
        doneChildCount: children.filter((child) => isAgentSettled({ agent: child })).length,
        answersForStepName: isQuestionDelegate({ agent: run }) ? parentStepName : null,
      });
      if (hasBranch) {
        walk({
          agents: children,
          depth: depth + 1,
          prefix: `${marker}.`,
          parentStepName: ownStep?.name ?? run.name,
        });
      }
    });
  };

  walk({ agents: runs, depth: 0, prefix: '', parentStepName: null });
  return rows;
};
