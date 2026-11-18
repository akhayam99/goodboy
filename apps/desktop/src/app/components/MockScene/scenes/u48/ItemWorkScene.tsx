import { useEffect } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { MeasuredTurnSpan } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  WorkTimeContext,
  type WorkTimeSource,
} from '../../../../../features/workTreeModel/workTimeSource';
import { ITEM_WORK_SCENE_ROWS } from './itemWorkSceneRows';
import { ItemWorkSceneRowView } from './ItemWorkSceneRowView';

type Props = {
  readonly theme?: 'dark' | 'light';
};

const NOW_MS = Date.parse('2026-11-17T10:00:00.000Z');
const WAITED_MS = 51_000;

const waitingSpans: ReadonlyArray<MeasuredTurnSpan> = ITEM_WORK_SCENE_ROWS.flatMap((row) =>
  row.isAgentWaiting && row.agentId !== null
    ? [
        {
          agentId: row.agentId,
          parentAgentId: null,
          agentStatus: 'running',
          workflowRunId: null,
          isOrchestratedRunDone: false,
          stepRole: 'implementer',
          provider: 'anthropic',
          model: 'claude-sonnet-5-5',
          effort: null,
          startedAtMs: NOW_MS - 2 * WAITED_MS,
          endedAtMs: NOW_MS - WAITED_MS,
          endReason: 'succeeded',
          costUsd: null,
          touchedMountIds: null,
        },
      ]
    : [],
);

const SOURCE: WorkTimeSource = {
  nowMs: NOW_MS,
  spans: waitingSpans,
  history: null,
  liveStartMs: new Map(
    ITEM_WORK_SCENE_ROWS.flatMap((row) =>
      row.agentId === null || row.liveForMs === null
        ? []
        : [[row.agentId, NOW_MS - row.liveForMs] as const],
    ),
  ),
  childrenOf: new Map(),
};

const WORKING = ITEM_WORK_SCENE_ROWS.slice(0, 6);
const RESULTS = ITEM_WORK_SCENE_ROWS.slice(6);

export const ItemWorkScene = ({ theme }: Props) => {
  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
  }, [theme]);
  return (
    <WorkTimeContext.Provider value={SOURCE}>
      <div data-shot className="flex w-[760px] flex-col gap-6 bg-background p-6">
        <section aria-label="Work in progress" className="flex flex-col gap-2">
          <Eyebrow label="Work in progress" />
          <ul className="flex flex-col gap-1">
            {WORKING.map((row) => (
              <ItemWorkSceneRowView key={row.id} row={row} />
            ))}
          </ul>
        </section>
        <section aria-label="Results" className="flex flex-col gap-2">
          <Eyebrow label="Results" />
          <ul className="flex flex-col gap-1">
            {RESULTS.map((row) => (
              <ItemWorkSceneRowView key={row.id} row={row} />
            ))}
          </ul>
        </section>
      </div>
    </WorkTimeContext.Provider>
  );
};
