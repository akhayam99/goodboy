import type { ReactNode } from 'react';
import { ComposerTray as ComposerTrayFrame } from '../../../../../shared/components/ComposerTray';
import { NAMES } from '../../../../../shared/utils/names';
import { QueuedMessages } from '../../../queuedMessages';
import type { QueuedRows } from '../hooks/useQueuedRows';
import { SuggestionStack } from './SuggestionStack';

type Props = {
  readonly queued: QueuedRows;
  readonly suggestions: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
  readonly canEdit: boolean;
  readonly isDenying: boolean;
};

export const ComposerTray = ({ queued, suggestions, canEdit, isDenying }: Props) => (
  <ComposerTrayFrame>
    <QueuedMessages
      items={queued.rows}
      canEdit={canEdit}
      failure={queued.failure}
      onEdit={queued.onEdit}
      onRemove={queued.onRemove}
      onSendNow={queued.onSendNow}
      onRetry={queued.onRetry}
      retryLabel={isDenying ? NAMES.sendAndDeny : NAMES.retry}
      onRaiseLimit={queued.onRaiseLimit}
    />
    <SuggestionStack items={suggestions} />
  </ComposerTrayFrame>
);
