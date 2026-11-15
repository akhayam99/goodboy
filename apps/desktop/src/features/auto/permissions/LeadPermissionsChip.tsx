import { useState } from 'react';
import {
  AnchoredPopover,
  Button,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  cn,
  useDropdown,
} from '@goodboy/ui';
import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';
import { LeadPermissionsPanel } from './LeadPermissionsPanel';
import { useLeadPermissions, type LeadPermissionScope } from '../hooks/useLeadPermissions';

export type LeadPermissionsTarget = Readonly<{
  workspaceId: WorkspaceId;
  sessionId: SessionId | null;
  treeId: AutoTreeId | null;
}>;

type Props = {
  readonly target: LeadPermissionsTarget;
};

const LABEL = NAMES.asksYou;

type WordParams = {
  readonly preset: string | null;
};

const presetWordOf = ({ preset }: WordParams): string => {
  if (preset === null) {
    return 'Loading';
  }
  return RUN_AUTONOMY_OPTIONS.find((option) => option.key === preset)?.label ?? 'Custom';
};

export const LeadPermissionsChip = ({ target }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 640,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    width: POPOVER_WIDTH_CLASS.studio,
  });
  const [scope, setScope] = useState<LeadPermissionScope>(
    target.treeId === null ? 'default' : 'lead',
  );
  const model = useLeadPermissions({
    workspaceId: target.workspaceId,
    sessionId: target.sessionId,
    treeId: target.treeId,
    scope,
  });
  const { permissions } = model;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={LABEL}
      anchorClassName="inline-flex min-w-0"
      className="flex flex-col gap-3 p-4"
      trigger={
        <Button
          size="xs"
          variant="setting"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`${LABEL}: ${presetWordOf({ preset: permissions?.preset ?? null })}`}
          data-setting-chip={LABEL}
          onClick={dropdown.toggle}
          className={cn('max-w-full', dropdown.open && 'border-border bg-selected')}
        >
          <span className="shrink-0 text-faint-foreground">{LABEL}:</span>
          <span className="min-w-0 max-w-56 truncate text-eyebrow text-foreground">
            {presetWordOf({ preset: permissions?.preset ?? null })}
          </span>
        </Button>
      }
    >
      {permissions === null ? (
        <p
          role={model.readError === null ? 'status' : 'alert'}
          className="text-meta text-muted-foreground"
        >
          {model.readError ?? 'Reading the permissions.'}
        </p>
      ) : (
        <LeadPermissionsPanel
          permissions={permissions}
          scope={scope}
          rowErrors={model.rowErrors}
          presetError={model.presetError}
          isDisabled={model.isBusy}
          onChange={({ key, value }) => void model.change({ key, value })}
          onReset={({ key }) => void model.reset({ key })}
          onPreset={({ level }) => void model.pickPreset({ level })}
          {...(target.treeId === null ? {} : { onScope: ({ scope: next }) => setScope(next) })}
        />
      )}
    </AnchoredPopover>
  );
};
