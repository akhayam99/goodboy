import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, FOCUS_RING, ROW_INTERACTIVE, cn, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useBranchSwitcher } from '../../hooks/useBranchSwitcher';
import { BranchName } from './BranchName';
import { BranchSwitcherMenu } from './BranchSwitcherMenu';
import { NewBranchForm } from './NewBranchForm';

type Props = {
  readonly sessionId: SessionId;
  readonly currentPath: string | null;
  readonly repoName: string | null;
  readonly branch: string;
  readonly leading?: ReactNode;
};

const FACE_CLASS = 'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-label';

export const BranchSwitcher = ({ sessionId, currentPath, repoName, branch, leading }: Props) => {
  const switcher = useBranchSwitcher({ sessionId, currentPath });
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedHeight: 260,
    expectedWidth: 320,
  });
  const [isNaming, setIsNaming] = useState(false);
  const { open: isOpen } = dropdown;
  const hasChoices = switcher.count > 1;
  const isInteractive = hasChoices || switcher.canCreate;
  const isFormShown = isNaming || !hasChoices;

  useEffect(() => {
    if (!isOpen) {
      setIsNaming(false);
    }
  }, [isOpen]);

  const icon = leading ?? (
    <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
  );

  if (!isInteractive) {
    return (
      <span className={cn(FACE_CLASS, 'text-foreground')}>
        {icon}
        <BranchName branch={branch} />
      </span>
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role={isFormShown ? 'dialog' : 'menu'}
      ariaLabel={isFormShown ? 'New branch' : 'Branches'}
      anchorClassName="flex min-w-0 flex-1"
      trigger={
        <button
          type="button"
          aria-label={`Branch ${branch}`}
          aria-haspopup={hasChoices ? 'menu' : 'dialog'}
          aria-expanded={isOpen}
          data-testid="branch-switcher"
          onClick={dropdown.toggle}
          className={cn(FACE_CLASS, 'text-foreground', ROW_INTERACTIVE, FOCUS_RING)}
        >
          {icon}
          <BranchName branch={branch} />
          {hasChoices ? (
            <ChevronDown
              size={ICON_SIZE.row}
              aria-hidden
              data-slot="switcher-chevron"
              className="shrink-0 text-muted-foreground"
            />
          ) : null}
        </button>
      }
    >
      {isFormShown ? (
        <NewBranchForm
          repoName={repoName}
          onCreate={async (params) => {
            const isCreated = await switcher.create(params);
            if (isCreated) {
              dropdown.close();
            }
            return isCreated;
          }}
          onCancel={() => {
            setIsNaming(false);
            if (!hasChoices) {
              dropdown.close();
            }
          }}
        />
      ) : (
        <BranchSwitcherMenu
          groups={switcher.groups}
          canCreate={switcher.canCreate}
          onChoose={(row) => {
            dropdown.close();
            row.onSelect();
          }}
          onNewBranch={() => setIsNaming(true)}
        />
      )}
    </AnchoredPopover>
  );
};
