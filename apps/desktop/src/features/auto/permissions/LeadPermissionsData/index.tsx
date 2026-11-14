import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { LeadPermissionsPanel } from '../LeadPermissionsPanel';
import { useLeadPermissions, type LeadPermissionScope } from '../../hooks/useLeadPermissions';

type ScopeParams = {
  readonly scope: LeadPermissionScope;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly treeId: AutoTreeId | null;
  readonly scope: LeadPermissionScope;
  readonly onScope?: (params: ScopeParams) => void;
};

export const LeadPermissionsData = ({ workspaceId, sessionId, treeId, scope, onScope }: Props) => {
  const model = useLeadPermissions({ workspaceId, sessionId, treeId, scope });
  if (model.permissions === null) {
    return model.readError === null ? null : (
      <p role="alert" className="text-meta text-danger">
        {model.readError}
      </p>
    );
  }
  return (
    <LeadPermissionsPanel
      permissions={model.permissions}
      scope={scope}
      rowErrors={model.rowErrors}
      presetError={model.presetError}
      isDisabled={model.isBusy}
      onChange={({ key, value }) => void model.change({ key, value })}
      onReset={({ key }) => void model.reset({ key })}
      onPreset={({ level }) => void model.pickPreset({ level })}
      {...(onScope === undefined ? {} : { onScope })}
    />
  );
};
