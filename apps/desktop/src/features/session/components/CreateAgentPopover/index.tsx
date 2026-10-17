import type { ReactNode } from 'react';
import { AnchoredPopover, PopoverBody, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { AgentStartBlock } from '../AgentStartBlock';
import { CreateAgentTrigger } from './CreateAgentTrigger';
import { NAMES } from '../../../../shared/names';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
  readonly onSpawned?: () => void;
  readonly openEvent?: string;
  readonly anchor?: ReactNode;
};

export const CreateAgentPopover = ({
  sessionId,
  className,
  onSpawned,
  openEvent,
  anchor,
}: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    expectedHeight: 460,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    ...(openEvent !== undefined && { openEvent }),
  });
  const { open, close, toggle } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={NAMES.startAgent}
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName="min-w-0"
      trigger={
        anchor ?? <CreateAgentTrigger isOpen={open} className={className} onClick={toggle} />
      }
    >
      <PopoverBody>
        <div className="p-3">
          <AgentStartBlock
            sessionId={sessionId}
            isShown={open}
            onDone={close}
            {...(onSpawned !== undefined && { onSpawned })}
          />
        </div>
      </PopoverBody>
    </AnchoredPopover>
  );
};
