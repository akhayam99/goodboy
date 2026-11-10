import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { useAppStore } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { seedFlowSession } from '../flow-audit/seeds';
import { seedStudioChrome } from '../shellChrome';

export type P9SlotView = 'session' | 'inbox' | 'impact' | 'workflows';

type Props = {
  readonly view: P9SlotView;
};

const IMPACT_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['db_select', []],
  ['budget_rule_list', []],
  ['budget_alerts_list', []],
  ['session_budget_get', null],
]);

type AnswerParams = {
  readonly cmd: string;
};

const answerImpact = ({ cmd }: AnswerParams): unknown => {
  if (!IMPACT_ANSWERS.has(cmd)) {
    throw new Error(`${cmd} has no answer in this scene`);
  }
  return IMPACT_ANSWERS.get(cmd);
};

export const P9SlotScene = ({ view }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (view === 'impact') {
      mockIPC((cmd) => answerImpact({ cmd }));
    }
    seedFlowSession();
    seedStudioChrome();
    useAppStore.getState().openDrawer({
      kind: 'context',
      sessionId: FLOW_SESSION_ID,
      payload: { section: 'goal', view: 'current' },
    });
    setIsReady(true);
  }, [view]);

  if (!isReady) {
    return null;
  }

  return <AppFrame view={view} isRailCollapsed={false} hasPane />;
};
