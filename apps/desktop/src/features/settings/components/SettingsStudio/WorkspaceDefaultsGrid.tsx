import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Input, Switch } from '@goodboy/ui';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { isAttributionEnabled } from '../../../../shared/utils/attribution';
import { WorkspaceDefaultRow } from './WorkspaceDefaultRow';
import { WorkspaceEyebrow } from './WorkspaceEyebrow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type PersistParams = {
  readonly patch: WorkspaceOverridesPatch;
  readonly failureTitle: string;
};

const sanitized = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);

export const WorkspaceDefaultsGrid = ({ workspaceId }: Props) => {
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const verbosity = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultVerbosity,
  );
  const parallelAgents = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).parallelAgents,
  );
  const resolvedBranchPrefix = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultBranchPrefix,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const attributionFooter = isAttributionEnabled({ overrides: wsOverrides });

  useEffect(() => {
    setBranchPrefix(resolvedBranchPrefix);
    setSavedBranchPrefix(resolvedBranchPrefix);
  }, [workspaceId, resolvedBranchPrefix]);

  const persistOverrides = async ({ patch, failureTitle }: PersistParams) => {
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (err) {
      void reportError({ title: failureTitle, error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  const commitBranchPrefix = async () => {
    const next = branchPrefix.trim() || DEFAULT_BRANCH_PREFIX;
    if (next === savedBranchPrefix) {
      setBranchPrefix(next);
      return;
    }
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch: { defaultBranchPrefix: next } });
      setBranchPrefix(next);
      setSavedBranchPrefix(next);
    } catch (err) {
      void reportError({ title: "Couldn't save the branch prefix", error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="workspace-new-sessions" className="flex flex-col gap-2">
      <WorkspaceEyebrow id="workspace-new-sessions" label="New sessions" />
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 @xl:grid-cols-2">
        <WorkspaceDefaultRow label="Branch prefix" help="Prefixes every new session branch.">
          <span className="flex items-center gap-1">
            <Input
              type="text"
              value={branchPrefix}
              onChange={(e) => setBranchPrefix(sanitized(e.target.value))}
              onBlur={() => void commitBranchPrefix()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void commitBranchPrefix();
                }
              }}
              placeholder={DEFAULT_BRANCH_PREFIX}
              disabled={busy}
              maxLength={16}
              size={10}
              aria-label="Branch prefix"
              className="w-auto font-mono"
            />
            <span className="text-code text-faint-foreground">/&lt;slug&gt;</span>
          </span>
        </WorkspaceDefaultRow>

        <WorkspaceDefaultRow
          label="Parallel agents"
          help="Lets eligible agents split independent work and reconcile it in one output."
        >
          <Switch
            label={parallelAgents ? 'On' : 'Off'}
            checked={parallelAgents}
            disabled={busy}
            onChange={(next) =>
              void persistOverrides({
                patch: { parallelAgents: next },
                failureTitle: "Couldn't save the parallel agents setting",
              })
            }
          />
        </WorkspaceDefaultRow>

        <WorkspaceDefaultRow label="Output verbosity" help="Response style for agents.">
          <div className="w-36">
            <VerbositySelect
              value={verbosity}
              onChange={(v) =>
                void persistOverrides({
                  patch: { defaultVerbosity: v },
                  failureTitle: "Couldn't save the output verbosity",
                })
              }
              disabled={busy}
            />
          </div>
        </WorkspaceDefaultRow>

        <WorkspaceDefaultRow
          label="Attribution line"
          help="Signs every comment Goodboy posts to GitHub, GitLab, Bitbucket, Jira, Linear and Slack."
        >
          <Switch
            label={attributionFooter ? 'On' : 'Off'}
            checked={attributionFooter}
            disabled={busy}
            onChange={(next) =>
              void persistOverrides({
                patch: { attributionFooter: next },
                failureTitle: "Couldn't save the attribution line setting",
              })
            }
          />
        </WorkspaceDefaultRow>
      </div>
    </section>
  );
};
