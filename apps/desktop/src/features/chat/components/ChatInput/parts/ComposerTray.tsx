import type { ReactNode } from 'react';
import type { AgentQueuedTurn } from '../../../../../store/slices/agentQueue/types';
import { QueuedMessages } from './QueuedMessages';
import { SuggestionStack } from './SuggestionStack';

type Props = {
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly suggestions: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
  readonly canEdit: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onSendNow: (id: string) => void;
};

export const ComposerTray = ({
  queue,
  suggestions,
  canEdit,
  onEdit,
  onRemove,
  onSendNow,
}: Props) => (
  <div className="flex flex-col gap-2 rounded-t-lg bg-muted px-2 pb-2 pt-2">
    <QueuedMessages
      items={queue}
      canEdit={canEdit}
      onEdit={onEdit}
      onRemove={onRemove}
      onSendNow={onSendNow}
    />
    <SuggestionStack items={suggestions} />
  </div>
);
