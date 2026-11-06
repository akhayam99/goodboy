import { Check, X } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { TranscriptItem } from '../../chat/utils/transcript-items';
import { decisionSentenceOf } from './PermissionDecisionCard/decisionSentenceOf';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
};

export const PermissionRecordLine = ({ item }: Props) => {
  const Icon = item.decision === 'allow' ? Check : X;
  const sentence =
    item.scope === 'once'
      ? `${item.decision === 'allow' ? 'Allowed' : 'Denied'} ${item.subject ?? item.toolName}`
      : decisionSentenceOf({
          decision: item.decision,
          scope: item.scope,
          toolName: item.toolName,
          subject: item.subject,
        });
  return (
    <p
      data-permission-record={item.decision}
      className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">
        {item.reason === undefined ? sentence : `${sentence}: ${item.reason}`}
      </span>
    </p>
  );
};
