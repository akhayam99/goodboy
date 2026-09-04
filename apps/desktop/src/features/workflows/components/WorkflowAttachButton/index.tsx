import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly placement: 'header' | 'inline';
};

const LABEL = 'Attach another workflow';

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
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
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
