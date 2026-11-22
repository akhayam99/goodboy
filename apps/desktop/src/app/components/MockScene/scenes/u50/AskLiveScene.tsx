import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { SessionAskLine } from '../../../../../features/session/ask/components/SessionAskLine';
import { NAMES } from '../../../../../shared/utils/names';
import { mockSceneIpc } from '../mockSceneIpc';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

export type AskLiveQuestion = 'none' | 'doing' | 'left';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly question: AskLiveQuestion;
};

type LiveRowParams = {
  readonly agentId: string | null;
};

const WIDTH = 720;
const HEIGHT = 420;
const CLICK_DELAY_MS = 300;

const QUESTION_LABEL: Readonly<Record<Exclude<AskLiveQuestion, 'none'>, string>> = {
  doing: NAMES.whatAreYouDoing,
  left: NAMES.whatIsLeft,
};

const liveRowsOf = ({
  agentId,
}: LiveRowParams): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  agentId === null
    ? []
    : [
        {
          runId: 'run-ask-live',
          sessionId: COLUMN_SESSION_ID,
          agentId,
          mountId: null,
          tool: { name: 'Bash', command: 'pnpm test retry', path: null },
          hasToolCall: true,
          canSeeTools: true,
        },
      ];

export const AskLiveScene = ({ theme, question }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedCentralColumn({ kind: 'mid' });
    const running =
      (useAppStore.getState().sessionPhaseRuns[COLUMN_SESSION_ID] ?? []).find(
        (agent) => agent.status === 'running',
      ) ?? null;
    const rows = liveRowsOf({ agentId: running?.id ?? null });
    mockSceneIpc((command) => (command === 'live_work' ? rows : null));
    useAppStore.setState((state) => ({
      sessionPlans: { ...state.sessionPlans, [COLUMN_SESSION_ID]: [] },
    }));
    setIsReady(true);
  }, [theme]);
  useEffect(() => {
    if (!isReady || question === 'none') {
      return;
    }
    const timer = window.setTimeout(() => {
      const label = QUESTION_LABEL[question];
      const starter = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent === label,
      );
      starter?.click();
    }, CLICK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, question]);
  if (!isReady) {
    return null;
  }
  return (
    <div
      data-shot
      style={{ width: WIDTH, height: HEIGHT }}
      className="flex flex-col justify-end bg-background p-6"
    >
      <SessionAskLine sessionId={COLUMN_SESSION_ID} />
    </div>
  );
};
