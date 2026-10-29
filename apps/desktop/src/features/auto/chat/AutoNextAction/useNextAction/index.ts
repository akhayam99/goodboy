import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import {
  currentDelegationDecisionPort,
  type DelegationDecisionResult,
} from '../../../delegationDecisionPort';
import { nextStepMessageOf, type NextAction } from '../../nextActionOf';

const NOT_READY = "Auto can't take this answer in this window yet.";
const LOST_NOTE = 'No longer open. Auto proposes again if it still wants this.';

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly action: NextAction;
  readonly untold: string | null;
  readonly onUntold: (content: string | null) => void;
};

export type NextActionModel = Readonly<{
  pickedKey: string;
  hint: string;
  isBusy: boolean;
  error: string | null;
  lostNote: string | null;
  pick: (key: string) => void;
  setHint: (hint: string) => void;
  submit: () => Promise<void>;
  notNow: () => Promise<void>;
  tell: () => Promise<void>;
}>;

type DecideParams = {
  readonly decision: 'confirm' | 'decline';
  readonly note?: string;
};

type RunParams = {
  readonly work: () => Promise<void>;
};

type SendParams = {
  readonly content: string;
};

export const useNextAction = ({
  sessionId,
  rootAgentId,
  action,
  untold,
  onUntold,
}: Params): NextActionModel => {
  const sendTurn = useAppStore((state) => state.sendTurn);
  const [pickedKey, setPickedKey] = useState('primary');
  const [hint, setHint] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lostNote, setLostNote] = useState<string | null>(null);

  const decide = useCallback(
    async ({ decision, note }: DecideParams): Promise<DelegationDecisionResult> => {
      const port = currentDelegationDecisionPort();
      if (port === null) {
        throw new Error(NOT_READY);
      }
      const trimmed = note?.trim() ?? '';
      return port({
        delegationId: action.delegationId,
        decision,
        ...(trimmed === '' ? {} : { hint: trimmed }),
      });
    },
    [action.delegationId],
  );

  const run = useCallback(
    async ({ work }: RunParams): Promise<void> => {
      if (isBusy) {
        return;
      }
      setIsBusy(true);
      setError(null);
      try {
        await work();
      } catch (cause) {
        if (!isReportedError(cause)) {
          setError(formatError(cause));
        }
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy],
  );

  const send = useCallback(
    async ({ content }: SendParams): Promise<void> => {
      try {
        await sendTurn({ sessionId, agentId: rootAgentId, content });
      } catch (cause) {
        onUntold(content);
        throw cause;
      }
      onUntold(null);
    },
    [sendTurn, sessionId, rootAgentId, onUntold],
  );

  const submit = useCallback(
    () =>
      run({
        work: async () => {
          const choice = action.choices.find((one) => one.key === pickedKey) ?? action.choices[0];
          if (choice === undefined) {
            return;
          }
          if (choice.key === 'primary') {
            const result = await decide({ decision: 'confirm', note: hint });
            setLostNote(result === 'lost' ? LOST_NOTE : null);
            return;
          }
          const result = await decide({ decision: 'decline' });
          if (result === 'lost') {
            setLostNote(LOST_NOTE);
            return;
          }
          await send({ content: nextStepMessageOf({ choice, hint }) });
        },
      }),
    [run, action.choices, pickedKey, decide, hint, send],
  );

  const notNow = useCallback(
    () =>
      run({
        work: async () => {
          const result = await decide({ decision: 'decline' });
          setLostNote(result === 'lost' ? LOST_NOTE : null);
        },
      }),
    [run, decide],
  );

  const tell = useCallback(
    () =>
      run({
        work: async () => {
          if (untold !== null) {
            await send({ content: untold });
          }
        },
      }),
    [run, untold, send],
  );

  return {
    pickedKey,
    hint,
    isBusy,
    error,
    lostNote,
    pick: setPickedKey,
    setHint,
    submit,
    notNow,
    tell,
  };
};
