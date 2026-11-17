import {
  AnchoredPopover,
  Button,
  MENU_MAX_WIDTH,
  Tooltip,
  cn,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { FactButton } from '../../../../shared/components/SettingChip/FactButton';
import { FactDot } from '../../../../shared/components/SettingChip/FactDot';
import { useIsSettingFact } from '../../../../shared/components/SettingChip/settingLookContext';
import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AppMenuList } from '../../../actions/AppMenuList';
import { openRunDefaults } from '../../../settings/openRunDefaults';
import { RUN_AUTONOMY_OPTIONS } from '../../../workflows/runAutonomy';
import { useLeadPermissions } from '../../hooks/useLeadPermissions';
import { leadDetailsDifferOf } from '../leadDetailsDifferOf';
import { levelSelectOf } from '../levelSelectOf';
import { LEAD_LEVEL_COPY } from '../leadLevelCopy';

export type LeadPermissionsTarget = Readonly<{
  workspaceId: WorkspaceId;
  sessionId: SessionId | null;
  treeId: AutoTreeId | null;
}>;

type Props = {
  readonly target: LeadPermissionsTarget;
};

export const LeadPermissionsChip = ({ target }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-50',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 320,
  });
  const openDrawer = useAppStore((state) => state.openDrawer);
  const model = useLeadPermissions({
    workspaceId: target.workspaceId,
    sessionId: target.sessionId,
    treeId: target.treeId,
    scope: target.treeId === null ? 'default' : 'lead',
  });
  const { permissions } = model;
  const level = permissions?.level ?? null;
  const differ = permissions === null ? 0 : leadDetailsDifferOf({ permissions });
  const word = level === null ? 'Loading' : LEAD_LEVEL_COPY.word({ level, differ });
  const { sessionId, treeId, workspaceId } = target;
  const isOnRun = sessionId !== null && treeId !== null;
  const fineTune: MenuEntry = {
    kind: 'item',
    key: 'fine-tune',
    label: isOnRun ? LEAD_LEVEL_COPY.fineTuneRun : LEAD_LEVEL_COPY.fineTuneSettings,
    description: isOnRun ? LEAD_LEVEL_COPY.fineTuneRunLine : LEAD_LEVEL_COPY.fineTuneSettingsLine,
    onSelect: () => {
      if (sessionId === null || treeId === null) {
        openRunDefaults();
        return;
      }
      openDrawer({ kind: 'lead-details', sessionId, payload: { workspaceId, treeId } });
    },
  };
  const entries: ReadonlyArray<MenuEntry> =
    level === null
      ? []
      : [
          {
            kind: 'radio',
            key: 'level',
            label: LEAD_LEVEL_COPY.menu,
            isDisabled: model.isBusy,
            choices: RUN_AUTONOMY_OPTIONS.map((option) => ({
              id: option.key,
              label: option.label,
              description: LEAD_LEVEL_COPY.line({ level: option.key }),
              isCurrent: differ === 0 && option.key === level,
            })),
            onSelect: levelSelectOf({
              onPick: ({ level: next }) => void model.pickLevel({ level: next }),
            }),
          },
          ...(differ === 0
            ? []
            : [
                {
                  kind: 'item',
                  key: 'reset',
                  label: LEAD_LEVEL_COPY.reset({ level }),
                  isDisabled: model.isBusy,
                  onSelect: () => void model.pickLevel({ level }),
                } satisfies MenuEntry,
              ]),
          { kind: 'separator', key: 'details' },
          fineTune,
        ];
  const error = model.levelError ?? model.readError;
  const ariaLabel = `${LEAD_LEVEL_COPY.menu}: ${word}`;
  const isFact = useIsSettingFact();
  const fact = (
    <Tooltip
      content={level === null ? LEAD_LEVEL_COPY.menu : LEAD_LEVEL_COPY.help({ level, differ })}
      isSuppressed={dropdown.open}
    >
      <FactButton
        aria-haspopup="menu"
        aria-expanded={dropdown.open}
        aria-label={ariaLabel}
        data-setting-chip={LEAD_LEVEL_COPY.menu}
        disabled={level === null}
        onClick={dropdown.toggle}
      >
        {level === null ? word : LEAD_LEVEL_COPY.fact({ level, differ })}
      </FactButton>
    </Tooltip>
  );
  const chip = (
    <Button
      size="xs"
      variant="setting"
      aria-haspopup="menu"
      aria-expanded={dropdown.open}
      aria-label={ariaLabel}
      data-setting-chip={LEAD_LEVEL_COPY.menu}
      disabled={level === null}
      onClick={dropdown.toggle}
      className={cn('max-w-full', dropdown.open && 'border-border bg-selected')}
    >
      <span className="shrink-0 text-faint-foreground">{LEAD_LEVEL_COPY.chip}:</span>
      <span className="min-w-0 max-w-56 truncate text-eyebrow text-foreground">{word}</span>
    </Button>
  );
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {isFact ? <FactDot /> : null}
      <AnchoredPopover
        dropdown={dropdown}
        anchorClassName="inline-flex min-w-0"
        trigger={isFact ? fact : chip}
      >
        <AppMenuList label={LEAD_LEVEL_COPY.menu} entries={entries} onClose={dropdown.close} />
      </AnchoredPopover>
      {error === null ? null : (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      )}
    </span>
  );
};
