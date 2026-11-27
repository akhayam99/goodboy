import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import {
  Band,
  cn,
  Collapsible,
  EmptyState,
  ErrorStrip,
  ICON_SIZE,
  SkeletonRows,
  STRIPED_LIST,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { undoable } from '../../../../shared/utils/undoable';
import { usePermissionRules } from '../../hooks/usePermissionRules';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { hasIgnoredDeny } from '../../utils/providerSupport';
import { IgnoredDenyNotice } from './IgnoredDenyNotice';
import { ProviderSupportTable } from './ProviderSupportTable';
import { RuleRow } from './RuleRow';
import { AddRuleForm } from './AddRuleForm';
import { RecentDecisions } from './RecentDecisions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly afterRules?: ReactNode;
};

export const PermissionsSettings = ({ workspaceId, afterRules = null }: Props) => {
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null,
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
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const rules = usePermissionRules({ workspaceId });

  const addRule = async (rule: Parameters<typeof rules.add>[0]): Promise<boolean> => {
    try {
      await rules.add(rule);
      return true;
    } catch (error) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't add the rule",
        error,
        workspaceId,
      });
      return false;
    }
  };

  const removeRule = async (rule: Parameters<typeof rules.remove>[0]) => {
    try {
      await rules.remove(rule);
      undoable({
        showToast,
        message: 'Rule removed',
        undo: () => rules.restore(rule),
      });
    } catch (error) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't remove the rule",
        error,
        workspaceId,
      });
    }
  };

  return (
    <>
      <Band
        inset="content"
        label="Rules"
        ariaLabel="Rules"
        hint="Allow, ask or deny a tool, whatever the default says."
        icon={<CONCEPT_ICONS.checks size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <AddRuleForm onAdd={addRule} />
        <ErrorStrip labels={['permission rules']} error={rules.error} onRetry={rules.retry} />
        {rules.isLoading && rules.rules.length === 0 ? (
          <SkeletonRows label="Loading rules" />
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

      {afterRules}

      <Band
        inset="content"
        label="Recent decisions"
        ariaLabel="Recent decisions"
        hint="Stays on this workspace."
        icon={<CONCEPT_ICONS.decisions size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <RecentDecisions workspaceId={workspaceId} />
      </Band>
    </>
  );
};
