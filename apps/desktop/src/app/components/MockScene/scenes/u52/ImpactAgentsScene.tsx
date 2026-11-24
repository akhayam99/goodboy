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

const PICKS = [
  { step_role: 'implementer', known_turns: 330, pinned_turns: 46, lead_turns: 250 },
  { step_role: 'scout', known_turns: 160, pinned_turns: 12, lead_turns: 140 },
  { step_role: 'reviewer', known_turns: 120, pinned_turns: 34, lead_turns: 70 },
  { step_role: 'tester', known_turns: 90, pinned_turns: 6, lead_turns: 80 },
  { step_role: 'planner', known_turns: 60, pinned_turns: 30, lead_turns: 20 },
  { step_role: 'docs', known_turns: 0, pinned_turns: 0, lead_turns: 0 },
];

const GROUP_ROWS = GROUPS.map(([role, provider, model, effort, turns, costUsd, failedTurns]) => ({
  step_role: role,
  provider,
  model,
  effort,
  turns,
  cost_usd: costUsd,
  failed_turns: failedTurns,
}));

type AnswerParams = {
  readonly command: string;
  readonly payload: InvokeArgs | undefined;
};

const answerOf = ({ command, payload }: AnswerParams): unknown => {
  if (command !== 'db_select') {
    return null;
  }
  const sql = payloadString({ payload, key: 'sql' }) ?? '';
  if (sql.includes('WITH turn_picks')) {
    return PICKS;
  }
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
