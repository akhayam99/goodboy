import { Play } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly queuedCount: number;
  readonly isStopped: boolean;
  readonly onRead: () => void;
};

type LabelParams = {
  readonly queuedCount: number;
};

const queuedLabel = ({ queuedCount }: LabelParams): string =>
  queuedCount === 1 ? 'queued message' : `${queuedCount} queued`;

export const OrchestratorQueuedRead = ({ queuedCount, isStopped, onRead }: Props) => (
  <div
    role="status"
    className="flex items-center justify-between gap-2 text-meta text-muted-foreground"
  >
    <span>
      {isStopped ? 'Run stopped · ' : ''}
      {queuedCount} queued {queuedCount === 1 ? 'message' : 'messages'} waiting
    </span>
    <Button type="button" size="sm" variant="primary" onClick={onRead}>
      <Play size={ICON_SIZE.row} aria-hidden />
      {isStopped ? 'Resume and read ' : 'Read '}
      {queuedLabel({ queuedCount })}
    </Button>
  </div>
);
