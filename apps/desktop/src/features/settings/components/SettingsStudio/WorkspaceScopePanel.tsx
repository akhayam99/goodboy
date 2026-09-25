import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import {
  Button,
  cn,
  FieldRow,
  InlineConfirm,
  Input,
  Notice,
  SectionSurface,
  Switch,
  tintClasses,
} from '@goodboy/ui';
import { GitBranch, Unplug } from 'lucide-react';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { WorkspaceProfileSection } from './WorkspaceProfileSection';
import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';
import { WorkspaceStorageNotice } from '../../../../features/storage/components/WorkspaceStorageNotice';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { useSectionAnchors } from '../../hooks/useSectionAnchors';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isAttributionEnabled } from '../../../../shared/utils/attribution';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';
import { PaneShell } from '../../../../shared/components/PaneShell';

type DisconnectTitleParams = {
  readonly name: string;
  readonly runningCount: number;
};

const disconnectTitle = ({ name, runningCount }: DisconnectTitleParams): string => {
  if (runningCount === 0) {
    return `Disconnect ${name}?`;
  }
  return `Disconnect ${name} and stop ${runningCount} running ${runningCount === 1 ? 'session' : 'sessions'}?`;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialSection?: string;
  readonly requestClose: () => void;
};

export const WorkspaceScopePanel = ({ workspaceId, initialSection, requestClose }: Props) => {
  const disconnect = useAppStore((s) => s.disconnectWorkspace);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId) ?? null);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
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
  const runningCount = useAppStore((s) =>
    s.currentWorkspaceId === workspaceId
      ? s.sessions.filter((session) => session.state.kind === 'running').length
      : 0,
  );
  const reportError = useAppStore((s) => s.reportError);

  const [displayName, setDisplayName] = useState(workspace?.name ?? '');
  const [renaming, setRenaming] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { anchor } = useSectionAnchors({ section: initialSection });

  const attributionFooter = isAttributionEnabled({ overrides: wsOverrides });

  useEffect(() => {
    setBranchPrefix(resolvedBranchPrefix);
    setSavedBranchPrefix(resolvedBranchPrefix);
  }, [workspaceId, resolvedBranchPrefix]);

  useEffect(() => {
    setDisplayName(workspace?.name ?? '');
  }, [workspace?.name]);

  const persistOverrides = async ({
    patch,
    failureTitle,
  }: {
    readonly patch: WorkspaceOverridesPatch;
    readonly failureTitle: string;
  }) => {
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (err) {
      void reportError({ title: failureTitle, error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  const commitDisplayName = async () => {
    const next = displayName.trim();
    if (workspace == null || next === '' || next === workspace.name) {
      setDisplayName(workspace?.name ?? '');
      return;
    }
    setRenaming(true);
    try {
      await renameWorkspace({ workspaceId, name: next });
    } catch (err) {
      void reportError({ title: "Couldn't rename the workspace", error: err, workspaceId });
      setDisplayName(workspace.name);
    } finally {
      setRenaming(false);
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

  const onDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect(workspaceId);
      requestClose();
    } catch (err) {
      void reportError({ title: "Couldn't disconnect the workspace", error: err, workspaceId });
      setDisconnecting(false);
    }
  };

  const sanitized = (input: string): string =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '')
      .replace(/^-+/, '')
      .slice(0, 16);

  return (
    <PaneShell animationClassName={SETTINGS_PANE_ENTRY} title="Workspace" meta={workspace?.name}>
      <div className="flex flex-col gap-4">
        {workspace == null ? null : (
          <>
            <div id="identity" ref={anchor({ id: 'identity' })}>
              <SectionSurface
                label="Workspace"
                hint="How this workspace is labelled across the app."
                icon={<CONCEPT_ICONS.workspace size={ICON_SIZE.row} aria-hidden />}
                headingLevel={2}
              >
                <div className="flex flex-col">
                  <FieldRow
                    label="Display name"
                    help="Only the label changes. Project folders stay where they are."
                  >
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onBlur={() => void commitDisplayName()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void commitDisplayName();
                        }
                        if (e.key === 'Escape') {
                          setDisplayName(workspace.name);
                        }
                      }}
                      placeholder={workspace.slug}
                      disabled={renaming}
                      maxLength={60}
                      aria-label="Display name"
                      className="w-56"
                    />
                  </FieldRow>
                </div>
              </SectionSurface>
            </div>

            <div ref={anchor({ id: 'projects' })}>
              <WorkspaceProjectsSection workspaceId={workspaceId} />
            </div>

            <div ref={anchor({ id: 'profile' })}>
              <WorkspaceProfileSection workspaceId={workspaceId} />
            </div>
          </>
        )}

        <div id="general" ref={anchor({ id: 'general' })}>
          <SectionSurface
            label="Session defaults"
            hint="Applied to new sessions and agents in this workspace."
            icon={<CONCEPT_ICONS.sessions size={ICON_SIZE.row} aria-hidden />}
            headingLevel={2}
          >
            <div className="flex flex-col">
              <FieldRow label="Branch prefix" help="Prefixes every new session branch.">
                <div className="flex items-center gap-1.5">
                  <GitBranch
                    size={ICON_SIZE.row}
                    aria-hidden
                    className="shrink-0 text-muted-foreground"
                  />
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
                    size={12}
                    aria-label="Branch prefix"
                    className="w-auto font-mono"
                  />
                  <span className="font-mono text-sm text-muted-foreground">/&lt;slug&gt;</span>
                </div>
              </FieldRow>

              <FieldRow label="Output verbosity" help="Response style for agents.">
                <div className="w-40">
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
              </FieldRow>

              <FieldRow
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
              </FieldRow>

              <FieldRow
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
              </FieldRow>
            </div>
          </SectionSurface>
        </div>

        {WORKSPACE_FEATURES.skills ? (
          <div ref={anchor({ id: 'skills' })}>
            <SkillsPanel workspaceId={workspaceId} />
          </div>
        ) : null}

        <WorkspaceStorageNotice workspaceId={workspaceId} />

        <section
          id="danger"
          ref={anchor({ id: 'danger' })}
          aria-label="Danger zone"
          className="flex flex-col"
        >
          <Notice
            tone="danger"
            placement="inline"
            title="Disconnect workspace"
            body="Hides it from the sidebar. Nothing on disk is deleted."
            actions={
              confirmDisconnect ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDisconnect(true)}
                  className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
                >
                  <Unplug size={ICON_SIZE.row} aria-hidden />
                  Disconnect
                </Button>
              )
            }
          >
            {confirmDisconnect && (
              <InlineConfirm
                role="danger"
                icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
                title={disconnectTitle({
                  name: workspace?.name ?? 'this workspace',
                  runningCount,
                })}
                description="Projects, branches and worktrees stay on disk. Choose Add workspace with the same folder to bring it back with its sessions."
                confirmLabel="Disconnect"
                isBusy={disconnecting}
                onConfirm={onDisconnect}
                onCancel={() => setConfirmDisconnect(false)}
                className="text-left"
              />
            )}
          </Notice>
        </section>
      </div>
    </PaneShell>
  );
};
