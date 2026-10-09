import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import {
  EmptyState,
  Band,
  Collapsible,
  ErrorStrip,
  PanelLoading,
  STRIPED_LIST,
  cn,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { usePermissionRules } from '../../hooks/usePermissionRules';
import { DEFAULT_PERMISSION_MODE, pickerModeOf, type PickerMode } from '../../modeCopy';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { hasIgnoredDeny } from '../../utils/providerSupport';
import { DefaultModeCards } from './DefaultModeCards';
import { IgnoredDenyNotice } from './IgnoredDenyNotice';
import { ProviderSupportTable } from './ProviderSupportTable';
import { RuleRow } from './RuleRow';
import { AddRuleForm } from './AddRuleForm';
import { RecentDecisions } from './RecentDecisions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly renderDefaultRow?: (control: ReactNode) => ReactNode;
};

const asIs = (control: ReactNode): ReactNode => control;

export const PermissionsSettings = ({ workspaceId, renderDefaultRow = asIs }: Props) => {
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
  const [isSupportOpen, setIsSupportOpen] = useState(false);
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
    <>
      <Band
        inset="content"
        label="Default"
        ariaLabel="Default"
        icon={<CONCEPT_ICONS.approval size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        {renderDefaultRow(
          <DefaultModeCards
            value={pickerModeOf({ mode: defaultMode })}
            isBusy={isSaving}
            onChange={(mode) => void saveDefault(mode)}
          />,
        )}
      </Band>

      <Band
        inset="content"
        label="Rules"
        ariaLabel="Rules"
        hint="Allow, ask or deny a tool, whatever the default says."
        icon={<CONCEPT_ICONS.checks size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <AddRuleForm onAdd={addRule} />
        <ErrorStrip label="permission rules" error={rules.error} onRetry={rules.retry} />
        {rules.isLoading && rules.rules.length === 0 ? (
          <PanelLoading label="Loading rules" />
        ) : null}
        {!rules.isLoading && rules.error === null && rules.rules.length === 0 ? (
          <EmptyState
            size="section"
            icon={CONCEPT_ICONS.checks}
            title="No rules yet"
            description="Save a rule when deciding how an agent can use a tool."
          />
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
      </Band>

      <Collapsible
        open={isSupportOpen}
        onOpenChange={setIsSupportOpen}
        trigger={
          <span className="text-meta text-muted-foreground">
            Some providers can't ask first or ignore rules. See each provider.
          </span>
        }
      >
        <ProviderSupportTable />
      </Collapsible>

      <Band
        inset="content"
        label="Recent decisions"
        ariaLabel="Recent decisions"
        hint="Stays on this workspace."
        icon={<CONCEPT_ICONS.history size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <RecentDecisions workspaceId={workspaceId} />
      </Band>
    </>
  );
};
