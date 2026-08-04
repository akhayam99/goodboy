import { Plus } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { Button, Popover, cn } from '@goodboy/ui';
import { useDropdown } from '../../../../../../shared/hooks/useDropdown';
import { DropdownPortal } from '../../../../../../shared/hooks/useDropdown/DropdownPortal';
import { LinkIssueForm } from './LinkIssueForm';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly providerLabel: string;
};

export const LinkTicketPopover = ({ sessionId, workspaceId, provider, providerLabel }: Props) => {
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    align: 'end',
    expectedHeight: 280,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
  });

  return (
    <div ref={containerRef} className="relative min-w-0">
      <Button variant="secondary" size="sm" onClick={toggle}>
        <Plus size={13} aria-hidden />
        Link issue
      </Button>
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel={`Link ${providerLabel} issue`}
            className={cn(popupClassName, 'p-3')}
            style={popupStyle}
          >
            <LinkIssueForm
              sessionId={sessionId}
              workspaceId={workspaceId}
              provider={provider}
              providerLabel={providerLabel}
              onLinked={close}
            />
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
