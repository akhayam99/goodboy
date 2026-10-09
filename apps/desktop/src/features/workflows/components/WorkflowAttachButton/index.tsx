import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { ROW_INTERACTIVE, cn, Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly placement: 'header' | 'inline';
};

const LABEL = 'Start another run';

export const WorkflowAttachButton = ({ sessionId, placement }: Props) => {
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  if (placement === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-dashed border-border-soft px-2 py-2 text-left text-label text-muted-foreground transition-colors hover:border-border hover:text-foreground',
          ROW_INTERACTIVE,
        )}
      >
        <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{LABEL}</span>
      </button>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      {LABEL}
    </Button>
  );
};
