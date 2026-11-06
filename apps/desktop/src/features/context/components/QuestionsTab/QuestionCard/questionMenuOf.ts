import { Bot, Send, X } from 'lucide-react';
import type { MenuEntry } from '@goodboy/ui';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';
import { SEND_AS_MESSAGE_HINT } from '../AnswerSubmitButton';

type Params = {
  readonly delegateState: DelegateRowState;
  readonly onChooseDelegate: () => void;
  readonly onSendAsMessage: (() => void) | null;
  readonly isSendReady: boolean;
  readonly onDismiss: (() => void) | null;
};

const OFFERING_STATES: ReadonlySet<DelegateRowState> = new Set<DelegateRowState>([
  'available',
  'retry',
  'blocked',
]);

export const questionMenuOf = ({
  delegateState,
  onChooseDelegate,
  onSendAsMessage,
  isSendReady,
  onDismiss,
}: Params): ReadonlyArray<MenuEntry> => [
  ...(OFFERING_STATES.has(delegateState)
    ? [
        {
          kind: 'item' as const,
          key: 'delegate',
          label:
            delegateState === 'retry' ? QUESTION_DELEGATE_COPY.retry : QUESTION_DELEGATE_COPY.offer,
          icon: Bot,
          isDisabled: delegateState === 'blocked',
          blockedReason: delegateState === 'blocked' ? QUESTION_DELEGATE_COPY.blocked : null,
          onSelect: onChooseDelegate,
        },
      ]
    : []),
  ...(onSendAsMessage === null
    ? []
    : [
        {
          kind: 'item' as const,
          key: 'send-as-message',
          label: 'Send as message',
          icon: Send,
          isDisabled: !isSendReady,
          tooltip: SEND_AS_MESSAGE_HINT,
          onSelect: onSendAsMessage,
        },
      ]),
  ...(onDismiss === null
    ? []
    : [
        {
          kind: 'item' as const,
          key: 'dismiss',
          label: 'Dismiss question',
          icon: X,
          onSelect: onDismiss,
        },
      ]),
];
