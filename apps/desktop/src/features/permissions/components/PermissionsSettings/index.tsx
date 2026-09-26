import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { ErrorStrip, Eyebrow, PanelLoading, STRIPED_LIST, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { usePermissionRules } from '../../hooks/usePermissionRules';
import { DEFAULT_PERMISSION_MODE, pickerModeOf, type PickerMode } from '../../modeCopy';
import { PERMISSIONS_SECTION_ID } from '../../openPermissionSettings';
import { hasIgnoredDeny } from '../../utils/providerSupport';
import { DefaultModeCards } from './DefaultModeCards';
import { IgnoredDenyNotice } from './IgnoredDenyNotice';
import { ProviderSupportTable } from './ProviderSupportTable';
import { RuleRow } from './RuleRow';
import { AddRuleForm } from './AddRuleForm';
import { RecentDecisions } from './RecentDecisions';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const PermissionsSettings = ({ workspaceId }: Props) => {
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null,
  );
  const defaultMode = useAppStore(
    (s) =>
      s.workspaces.find((workspace) => workspace.id === workspaceId)?.defaultPermissionMode ??
      DEFAULT_PERMISSION_MODE,
  );
  const activeProviders = useAppStore(
    useShallow((s): ReadonlyArray<ProviderId> => {
      const providers = s.sessions
        .filter((session) => session.workspaceId === workspaceId)
        .flatMap((session) => [
          session.providerPreference.defaultProvider,
          ...(session.providerPreference.enabledProviders ?? []),
        ]);
      return [...new Set(providers)].sort();
    }),
  );
  const setWorkspacePermissionDefault = useAppStore((s) => s.setWorkspacePermissionDefault);
  const reportError = useAppStore((s) => s.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const rules = usePermissionRules({ workspaceId });

  const saveDefault = async (mode: PickerMode) => {
    setIsSaving(true);
    try {
      await setWorkspacePermissionDefault({ workspaceId, mode });
    } catch (error) {
      void reportError({ title: "Couldn't change the default mode", error, workspaceId });
    } finally {
      setIsSaving(false);
    }
  };

  const addRule = async (rule: Parameters<typeof rules.add>[0]): Promise<boolean> => {
    try {
      await rules.add(rule);
      return true;
    } catch (error) {
      void reportError({ title: "Couldn't add the rule", error, workspaceId });
      return false;
    }
  };

  const removeRule = async (rule: Parameters<typeof rules.remove>[0]) => {
    try {
      await rules.remove(rule);
    } catch (error) {
      void reportError({ title: "Couldn't remove the rule", error, workspaceId });
    }
  };

  return (
    <section aria-labelledby={PERMISSIONS_SECTION_ID} className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={PERMISSIONS_SECTION_ID}>
          <Eyebrow label="Permissions" />
        </h2>
        <p className="text-label text-muted-foreground">
          What agents may do in this workspace without asking you.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label text-foreground">Default for new sessions</h3>
        <DefaultModeCards
          value={pickerModeOf({ mode: defaultMode })}
          isBusy={isSaving}
          onChange={(mode) => void saveDefault(mode)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label text-foreground">What each provider does with these settings</h3>
        <ProviderSupportTable />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label text-foreground">Rules</h3>
        <AddRuleForm onAdd={addRule} />
        <ErrorStrip label="permission rules" error={rules.error} onRetry={rules.retry} />
        {rules.isLoading && rules.rules.length === 0 ? (
          <PanelLoading label="Loading rules" />
        ) : null}
        {!rules.isLoading && rules.error === null && rules.rules.length === 0 ? (
          <p className="text-secondary text-muted-foreground">
            No rules yet. Add one here, or pick Always allow on an approval.
          </p>
        ) : null}
        {rules.rules.length > 0 ? (
          <div className={cn('flex flex-col rounded-lg bg-subtle p-1', STRIPED_LIST)}>
            {rules.rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                activeProviders={activeProviders}
                onRemove={removeRule}
              />
            ))}
          </div>
        ) : null}
        {workspaceName !== null && hasIgnoredDeny({ rules: rules.rules, activeProviders }) ? (
          <IgnoredDenyNotice workspaceName={workspaceName} activeProviders={activeProviders} />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label text-foreground">Recent decisions</h3>
        <RecentDecisions workspaceId={workspaceId} />
      </div>
    </section>
  );
};
