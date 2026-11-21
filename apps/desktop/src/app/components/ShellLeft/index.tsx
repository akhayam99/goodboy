import { ShellRail, ShellRailItem, type ShellRailMark } from '@goodboy/ui';
import { Plus } from '@goodboy/ui/icons';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectSessionDraft } from '../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../store/slices/sessionDraft/hasSessionDraftContent';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { navEntryToneOf } from '../../../shared/components/navEntryToneOf';
import { requestNewSession } from '../../../features/session/requestNewSession';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import { useColumnPlace } from '../../hooks/useColumnPlace';
import type { ShellArrangement } from '../../shellArrangement';
import { UpdateArrivalCard } from '../../../features/updater/components/UpdateArrivalCard';
import { useUpdateCardState } from '../../../features/updater/hooks/useUpdateCardState';
import { UpdateRailMark } from '../../../features/updater/components/UpdateRailMark';
import { RailSignature } from './RailSignature';
import { ReportBugButton } from './ReportBugButton';
import { COLUMN_DOORS, openColumnDoor, type ColumnActions } from './columnDoors';
import { railMarkOf } from './railMarkOf';
import { useDoorSignals } from './useDoorSignals';
import { useRailFootEffects } from './useRailFootEffects';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';
import { railPlaceOf } from '../../../shared/navigation/railPlaceOf';

type Props = {
  readonly arrangement: ShellArrangement;
  readonly workspaceId: WorkspaceId | null;
  readonly actions: ColumnActions;
  readonly placeOverride?: ColumnPlace;
};

const DRAFT_MARK: ShellRailMark = { kind: 'dot', name: 'draft in progress' };

export const ShellLeft = ({ arrangement, workspaceId, actions, placeOverride }: Props) => {
  const storePlace = useColumnPlace();
  const columnPlace = placeOverride === undefined ? storePlace : placeOverride;
  const place = railPlaceOf({ place: columnPlace });
  const isInSession = columnPlace === null;
  const hasDraft = useAppStore((state) =>
    workspaceId === null
      ? false
      : hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && place !== 'new';
  const signals = useDoorSignals({});
  const { anchorRef } = useRailFootEffects({});
  const hasUpdate = useUpdateCardState().state !== null;
  return (
    <ShellRail label="Places">
      {arrangement.columnScope === 'workspace' ? (
        <>
          <WorkspaceIdentityRow />
          <ShellRailItem
            id="new"
            icon={Plus}
            label="New session"
            word="New"
            shortcut="session.new"
            mark={isDraftWaiting ? DRAFT_MARK : null}
            isOutlined
            isCurrent={place === 'new'}
            onSelect={requestNewSession}
          />
          {COLUMN_DOORS.map((door) => (
            <ShellRailItem
              key={door.id}
              id={door.id}
              icon={door.icon}
              label={door.label}
              {...(door.word !== undefined && { word: door.word })}
              {...(door.shortcutId !== undefined && { shortcut: door.shortcutId })}
              tone={navEntryToneOf({ icon: door.icon })}
              mark={railMarkOf({ id: door.id, signal: signals[door.id] })}
              isQuiet={door.isReference === true}
              isCurrent={place === door.id}
              canReselect={isInSession && door.id === 'board'}
              onSelect={() => openColumnDoor({ id: door.id, actions })}
            />
          ))}
        </>
      ) : null}
      <span aria-hidden className="min-h-0 flex-1" />
      <ShellRailItem
        id="settings"
        icon={CONCEPT_ICONS.settings}
        label="Settings"
        shortcut="settings.open"
        isCurrent={place === 'settings'}
        onSelect={actions.openSettings}
      />
      <ReportBugButton />
      <UpdateArrivalCard
        anchorRef={anchorRef}
        onOpenChangelog={actions.openChangelog}
        isBesideAnchor
      />
      {hasUpdate ? (
        <div ref={anchorRef} className="flex w-full">
          <UpdateRailMark />
        </div>
      ) : null}
      <RailSignature />
    </ShellRail>
  );
};
