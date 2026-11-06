import type { ReactNode } from 'react';
import { NAMES } from '../../../../../shared/utils/names';
import type { QueuedRows } from '../hooks/useQueuedRows';
import { QueuedMessages } from './QueuedMessages';
import { SuggestionStack } from './SuggestionStack';

type Props = {
  readonly queued: QueuedRows;
  readonly suggestions: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
  readonly canEdit: boolean;
  readonly isDenying: boolean;
};

export const ComposerTray = ({ queued, suggestions, canEdit, isDenying }: Props) => (
  <div className="flex flex-col gap-2 rounded-t-lg bg-muted px-2 pb-2 pt-2">
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
  </div>
);
