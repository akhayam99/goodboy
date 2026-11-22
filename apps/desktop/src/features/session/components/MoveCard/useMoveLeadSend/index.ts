import { useMemo } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { checkLeadItemOf } from '../../../../work/sendToLead/checkLeadItemOf';
import { failedCheckOf } from '../../../../work/sendToLead/failedCheckOf';
import type { LeadSend } from '../../../../work/sendToLead/LeadSend';
import type { ActionCardModel } from '../../../central/next/actionCardsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly card: ActionCardModel;
};

type MountParams = {
  readonly card: ActionCardModel;
};

const checkMountOf = ({ card }: MountParams): MountId | null => {
  if (card.source.kind !== 'suggestion') {
    return null;
  }
  const { suggestion } = card.source;
  return suggestion.kind === 'fix-checks' || suggestion.kind === 'rerun-check'
    ? suggestion.payload.mountId
    : null;
};

export const useMoveLeadSend = ({ sessionId, card }: Params): LeadSend | null => {
  const mountId = checkMountOf({ card });
  const github = useAppStore((state) =>
    mountId === null ? undefined : state.mountGithub[mountId],
  );
  const logUrl = failedCheckOf({ github })?.detailsUrl ?? null;
  const reading = useAppStore((state) => (logUrl === null ? undefined : state.checkLogs[logUrl]));
  return useMemo(
    () => (mountId === null ? null : checkLeadItemOf({ github, reading, sessionId, mountId })),
    [mountId, github, reading, sessionId],
  );
};
