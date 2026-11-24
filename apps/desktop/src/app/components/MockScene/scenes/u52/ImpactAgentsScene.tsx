import { useEffect, useState } from 'react';
import type { InvokeArgs } from '@tauri-apps/api/core';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ImpactStudio } from '../../../../../features/impact/components/ImpactStudio';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { payloadString } from '../audit/ipcPayload';
import { useSceneClicks } from '../audit/useSceneClicks';
import { seedImpactScene } from '../ImpactScene';
import { mockSceneIpc } from '../mockSceneIpc';
import { StudioFrame } from '../StudioFrame';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isRowOpen: boolean;
};

type GroupRow = readonly [string, string, string, string | null, number, number, number];

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-impact-workspace-harborline' });

const GROUPS: ReadonlyArray<GroupRow> = [
  ['implementer', 'anthropic', 'claude-sonnet-5-5', 'medium', 200, 32.4, 6],
  ['implementer', 'anthropic', 'claude-sonnet-5-5', 'high', 50, 12.4, 3],
  ['implementer', 'codex', 'gpt-6-astra', 'medium', 84, 16.8, 3],
  ['implementer', 'anthropic', 'claude-opus-5-5', 'high', 36, 19.8, 1],
  ['scout', 'anthropic', 'claude-haiku-5-5', 'low', 120, 3.0, 2],
  ['scout', 'cursor', 'composer-2.5-fast', null, 54, 2.16, 1],
  ['reviewer', 'anthropic', 'claude-opus-5-5', 'high', 80, 32.4, 2],
  ['reviewer', 'codex', 'gpt-6-astra', 'medium', 52, 10.4, 1],
  ['tester', 'anthropic', 'claude-haiku-5-5', 'low', 110, 3.3, 3],
  ['planner', 'anthropic', 'claude-opus-5-5', 'high', 66, 22.3, 1],
  ['docs', 'anthropic', 'claude-haiku-5-5', 'low', 50, 1.5, 0],
];

const PICKS: ReadonlyMap<string, readonly [number, number, number]> = new Map([
  ['implementer', [330, 46, 250]],
  ['scout', [160, 12, 140]],
  ['reviewer', [120, 34, 70]],
  ['tester', [90, 6, 80]],
  ['planner', [60, 30, 20]],
]);

const NO_PICKS = [0, 0, 0] as const;

const GROUP_ROWS = GROUPS.map(
  ([role, provider, model, effort, turns, costUsd, failedTurns], index) => {
    const isFirstOfRole = GROUPS.findIndex((group) => group[0] === role) === index;
    const [known, pinned, lead] = isFirstOfRole ? (PICKS.get(role) ?? NO_PICKS) : NO_PICKS;
    return {
      step_role: role,
      provider,
      model,
      effort,
      turns,
      priced_turns: turns,
      cost_usd: costUsd,
      failed_turns: failedTurns,
      known_turns: known,
      pinned_turns: pinned,
      lead_turns: lead,
    };
  },
);

type AnswerParams = {
  readonly command: string;
  readonly payload: InvokeArgs | undefined;
};

const answerOf = ({ command, payload }: AnswerParams): unknown => {
  if (command !== 'db_select') {
    return null;
  }
  const sql = payloadString({ payload, key: 'sql' }) ?? '';
  if (sql.includes('GROUP BY step_role, provider, model, effort')) {
    return GROUP_ROWS;
  }
  return null;
};

const OPEN_ROW_CLICKS: ReadonlyArray<string> = ['Implementer models'];

const NO_CLICKS: ReadonlyArray<string> = [];

export const ImpactAgentsScene = ({ theme, isRowOpen }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedImpactScene();
    mockSceneIpc((command, payload) => answerOf({ command, payload }));
    setIsReady(true);
  }, [theme]);

  useSceneClicks({
    isReady,
    labels: isRowOpen ? OPEN_ROW_CLICKS : NO_CLICKS,
    selector: 'button[aria-expanded]',
    match: 'prefix',
    intervalMs: 200,
  });

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target={{ place: 'impact', tool: null }}
      main={
        <ImpactStudio
          workspaceId={WORKSPACE_ID}
          initialScope={{ kind: 'agents' }}
          onClose={() => undefined}
        />
      }
    />
  );
};
