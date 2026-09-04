import { Plus } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import { LinkIssueForm } from './LinkIssueForm';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly providerLabel: string;
  readonly noun: string;
  readonly nounPhrase: string;
  readonly nounPlural: string;
};

export const LinkTicketPopover = ({
  sessionId,
  workspaceId,
  provider,
  providerLabel,
  noun,
  nounPhrase,
  nounPlural,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 280,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { close, toggle } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`Link ${providerLabel} ${noun}`}
      className="p-3"
      anchorClassName="min-w-0"
      trigger={
        <Button variant="secondary" size="sm" onClick={toggle}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          {`Link ${noun}`}
        </Button>
      }
    >
      <LinkIssueForm
        sessionId={sessionId}
        workspaceId={workspaceId}
        provider={provider}
        providerLabel={providerLabel}
        nounPhrase={nounPhrase}
        nounPlural={nounPlural}
        onLinked={close}
      />
    </AnchoredPopover>
  );
};
