import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Chip, useDropdown } from '@goodboy/ui';
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
};

const CHIP_CLASS = 'min-w-0 max-w-full shrink';

export const BranchSwitcher = ({ sessionId, currentPath, repoName, branch }: Props) => {
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

  useEffect(() => {
    if (!isOpen) {
      setIsNaming(false);
    }
  }, [isOpen]);

  const label = (
    <span className="flex min-w-0 items-center gap-1">
      {repoName === null ? null : (
        <>
          <span className="truncate">{repoName}</span>
          <span aria-hidden className="text-faint-foreground">
            ·
          </span>
        </>
      )}
      <BranchName branch={branch} />
    </span>
  );
  const icon = <CONCEPT_ICONS.projectRepo size={ICON_SIZE.row} aria-hidden className="shrink-0" />;

  if (!isInteractive) {
    return (
      <Chip
        tone="neutral"
        shape="badge"
        size="control"
        className={CHIP_CLASS}
        icon={icon}
        label={label}
      />
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role={isNaming ? 'dialog' : 'menu'}
      ariaLabel={isNaming ? 'New branch' : 'Branches'}
      anchorClassName="flex min-w-0 max-w-full"
      trigger={
        <Chip
          as="button"
          tone="neutral"
          shape="badge"
          size="control"
          className={CHIP_CLASS}
          icon={icon}
          label={label}
          trailing={
            hasChoices ? (
              <ChevronDown
                size={ICON_SIZE.row}
                aria-hidden
                data-slot="switcher-chevron"
                className="shrink-0"
              />
            ) : null
          }
          ariaLabel={`Branch ${branch}`}
          testId="branch-switcher"
          hasPopup="menu"
          expanded={isOpen}
          onClick={dropdown.toggle}
        />
      }
    >
      {isNaming ? (
        <NewBranchForm
          repoName={repoName}
          onCreate={async (params) => {
            const isCreated = await switcher.create(params);
            if (isCreated) {
              dropdown.close();
            }
            return isCreated;
          }}
          onCancel={() => setIsNaming(false)}
        />
      ) : (
        <BranchSwitcherMenu
          groups={switcher.groups}
          count={switcher.count}
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
