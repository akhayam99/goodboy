import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { Button, cn } from '@goodboy/ui';

type Props = {
  readonly sessionId: SessionId;
  readonly placement: 'header' | 'rail';
};

export const WorkflowAttachButton = ({ sessionId, placement }: Props) => (
  <Button
    variant={placement === 'header' ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
      );
    }}
    className={cn(placement === 'rail' && 'w-full justify-start text-muted-foreground')}
  >
    <Plus size={13} aria-hidden className="shrink-0" />
    Attach another workflow
  </Button>
);
