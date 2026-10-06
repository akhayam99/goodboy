import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionCost, useSessionStageInfo } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { stateDescription } from '../../../../../shared/utils/statePresentation';
import { describeSessionStage } from '../../../session-stage';
import {
  askRightNow,
  askRightNowText,
  askSuggestions,
  type AskRightNowInput,
  type AskRightNowLine,
} from '../../askRightNow';
import { askDigestOf } from '../../collectAskPackInput';

type Params = {
  readonly session: Session;
};

export type AskRightNowView = {
  readonly lines: ReadonlyArray<AskRightNowLine>;
  readonly text: ReadonlyArray<string>;
  readonly suggestions: ReadonlyArray<string>;
};

type Digest = Omit<AskRightNowInput, 'description' | 'cost'>;

export const useAskRightNow = ({ session }: Params): AskRightNowView => {
  const stageInfo = useSessionStageInfo(session);
  const description = stateDescription({ presentation: describeSessionStage(stageInfo) });
  const cost = useSessionCost(session.id);
  const now = useNow(30_000);
  const digestKey = useAppStore((state) =>
    JSON.stringify(askDigestOf({ state, sessionId: session.id, now })),
  );
  return useMemo(() => {
    const digest: Digest = JSON.parse(digestKey);
    const input: AskRightNowInput = { ...digest, description, cost };
    const lines = askRightNow(input);
    return { lines, text: askRightNowText(lines), suggestions: askSuggestions(input) };
  }, [cost, description, digestKey]);
};
