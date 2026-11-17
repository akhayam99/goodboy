import { DrawerFrame } from '@goodboy/ui';
import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useLeadPermissions } from '../../hooks/useLeadPermissions';
import { LeadLevelRow } from '../LeadLevelRow';
import { LeadPermissionsPanel } from '../LeadPermissionsPanel';
import { LEAD_LEVEL_COPY } from '../leadLevelCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly treeId: AutoTreeId;
  readonly onClose: () => void;
};

export const LeadDetailsDrawer = ({ sessionId, workspaceId, treeId, onClose }: Props) => {
  const model = useLeadPermissions({ workspaceId, sessionId, treeId, scope: 'lead' });
  const { permissions } = model;
  return (
    <DrawerFrame
      title={LEAD_LEVEL_COPY.drawerTitle}
      icon={CONCEPT_ICONS.approval}
      iconClassName="text-muted-foreground"
      meta={LEAD_LEVEL_COPY.drawerLine}
      onClose={onClose}
    >
      {permissions === null ? (
        <p
          role={model.readError === null ? 'status' : 'alert'}
          className="text-meta text-muted-foreground"
        >
          {model.readError ?? 'Reading the details.'}
        </p>
      ) : (
        <div data-lead-details="" className="flex min-w-0 flex-col gap-6">
          <LeadLevelRow
            permissions={permissions}
            error={model.levelError}
            isDisabled={model.isBusy}
            onPick={({ level }) => void model.pickLevel({ level })}
          />
          <LeadPermissionsPanel
            permissions={permissions}
            rowErrors={model.rowErrors}
            isDisabled={model.isBusy}
            onChange={({ key, value }) => void model.change({ key, value })}
          />
        </div>
      )}
    </DrawerFrame>
  );
};
