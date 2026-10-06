import { useEffect } from 'react';
import { AnchoredPopover, Divider, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { Session, SessionGroupKey, SessionSortKey, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSelectedProjectIds, useSessionViewPrefs } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useProjectFilterOptions } from '../../../hooks/useProjectFilterOptions';
import { useSidebarPeekHold } from '../../SidebarPeekOverlay/hold';
import { MenuChoice } from './MenuChoice';
import { MenuSection } from './MenuSection';

type SortOption = {
  readonly key: SessionSortKey;
  readonly label: string;
};

type GroupOption = {
  readonly key: SessionGroupKey;
  readonly label: string;
};

const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { key: 'needsYou', label: 'Needs you first' },
  { key: 'goal', label: 'Alphabetical' },
  { key: 'updatedAt', label: 'Last activity' },
  { key: 'createdAt', label: 'Created' },
];

const GROUP_OPTIONS: ReadonlyArray<GroupOption> = [
  { key: 'none', label: 'None' },
  { key: 'pr', label: 'PR state' },
  { key: 'stage', label: 'Stage' },
  { key: 'project', label: 'Project' },
];

const MENU_WIDTH = 224;
const MoreIcon = CONCEPT_ICONS.more;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedCount: number;
  readonly onArchivedShownChange: (isShown: boolean) => void;
};

export const SessionViewMenu = ({
  workspaceId,
  sessions,
  archivedCount,
  onArchivedShownChange,
}: Props) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((state) => state.setSessionViewPrefs);
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const projectOptions = useProjectFilterOptions({ workspaceId, sessions });

  const { hold, release } = useSidebarPeekHold();
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-56',
    expectedWidth: MENU_WIDTH,
    expectedHeight: 360,
  });
  const { open, toggle } = dropdown;

  useEffect(() => {
    if (!open) {
      return;
    }
    hold();
    return () => release();
  }, [hold, open, release]);

  const toggleProject = (projectId: string) => {
    const next = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds({ workspaceId, selectedProjectIds: next });
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Options for sessions"
      className="max-h-96 py-1"
      hasBackdrop
      trigger={
        <Tooltip content="Options for sessions" side="bottom">
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Options for sessions"
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded-sm motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              open
                ? 'bg-selected text-foreground'
                : 'text-faint-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            <MoreIcon size={ICON_SIZE.control} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <MenuSection title="Sort">
        {SORT_OPTIONS.map((option) => (
          <MenuChoice
            key={option.key}
            role="menuitemradio"
            label={option.label}
            isChecked={prefs.sort === option.key}
            onSelect={() => setSessionViewPrefs({ workspaceId, patch: { sort: option.key } })}
          />
        ))}
      </MenuSection>
      <Divider />
      <MenuSection title="Group">
        {GROUP_OPTIONS.map((option) => (
          <MenuChoice
            key={option.key}
            role="menuitemradio"
            label={option.label}
            isChecked={prefs.group === option.key}
            onSelect={() => setSessionViewPrefs({ workspaceId, patch: { group: option.key } })}
          />
        ))}
      </MenuSection>
      {projectOptions.length > 0 ? (
        <>
          <Divider />
          <MenuSection title="Filter by project">
            {projectOptions.map((option) => (
              <MenuChoice
                key={option.id}
                role="menuitemcheckbox"
                label={option.label}
                isChecked={selectedProjectIds.includes(option.id)}
                onSelect={() => toggleProject(option.id)}
                trailing={
                  <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
                    {option.count}
                  </span>
                }
              />
            ))}
          </MenuSection>
        </>
      ) : null}
      <Divider />
      <MenuSection title="View">
        <MenuChoice
          role="menuitemcheckbox"
          label={`Show archived (${archivedCount})`}
          isChecked={prefs.isArchivedShown}
          onSelect={() => onArchivedShownChange(!prefs.isArchivedShown)}
        />
      </MenuSection>
    </AnchoredPopover>
  );
};
