import { StatusMark } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionStageInfo } from '../../../../store';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { attentionMarkOf } from '../../../session/attentionMarkOf';
import { attentionWordsOf } from '../../../session/session-stage';
import { useSessionPermissionAsk } from '../../../session/sessionPermissionAsk';
import { openAttention } from '../../openAttention';
import { WidgetRow } from '../../WidgetCard/WidgetRow';
import { AllowVerb } from './AllowVerb';
import { OpenVerb } from './OpenVerb';
import { needsYouVerbOf } from './needsYouVerbOf';

type Props = {
  readonly session: Session;
  readonly nowMs: number;
  readonly isFirst: boolean;
};

export const NeedsYouRow = ({ session, nowMs, isFirst }: Props) => {
  const info = useSessionStageInfo(session);
  const reason = info.attention;
  const ask = useSessionPermissionAsk({
    sessionId: session.id,
    isEnabled: reason === 'needs-approval',
  });
  const title = sessionTitle({ session });
  const words = reason === null ? info.reason : attentionWordsOf({ reason, counts: info });
  const age = formatSpan({ from: info.attentionSince ?? null, to: nowMs });
  const open = (): void => {
    if (reason !== null) {
      openAttention({ session, reason });
    }
  };
  return (
    <WidgetRow
      lead={
        <StatusMark
          mark={reason === null ? { kind: 'dot', tone: 'unread' } : attentionMarkOf({ reason })}
        />
      }
      title={title}
      meta={joinFacts({ facts: [words, age === '' ? null : `Waiting ${age}`] })}
      label={`Open ${title}, ${words}`}
      onOpen={open}
      trailing={
        ask === null ? (
          <OpenVerb verb={needsYouVerbOf({ reason })} isFirst={isFirst} onOpen={open} />
        ) : (
          <AllowVerb sessionId={session.id} ask={ask} isFirst={isFirst} />
        )
      }
    />
  );
};
