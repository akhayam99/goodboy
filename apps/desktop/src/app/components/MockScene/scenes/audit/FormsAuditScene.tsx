import { useEffect, useState, type ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';
import type { ProjectId, SessionBudget, Skill, Workspace, WorkflowRun } from '@goodboy/types';
import { CreatePrPanel } from '../../../../../features/integrations/github/components/PullRequest/CreatePrPanel';
import { CreateMrForm } from '../../../../../features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm';
import { WorkspaceLinkForm } from '../../../../../features/workspace/components/WorkspaceLinkForm';
import { ConvertWorkspaceFlow } from '../../../../../features/workspace/components/ConvertWorkspaceFlow';
import { SkillsPanel } from '../../../../../features/skills/components/SkillsPanel';
import { CreateAgentPopover } from '../../../../../features/session/components/CreateAgentPopover';
import { RunSpendLimitPopover } from '../../../../../features/workflows/components/RunSpendLimitPopover';
import { SpendLimitEditor } from '../../../../../features/budget/components/SessionSpendPopover/SpendLimitEditor';
import { ScriptEditor } from '../../../../../features/scripts/components/ScriptEditor';
import { SavedStepEditor } from '../../../../../features/workflows/components/WorkflowStudio/SavedStepsList/SavedStepEditor';
import { ImportPopover } from '../../../../../features/workflows/components/WorkflowStudio/ImportPopover';
import { LocateMovedProjects } from '../../../../../features/workspace/components/LocateMovedProjects';
import { blankStepDraft } from '../../../../../features/workflows/engine';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, WORKSPACE_ID, seedResolveScene } from '../resolveSeed';
import { sceneParam, sceneParamList } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-27T10:00:00.000Z' });
const NOW = clock.iso({ at: '2026-09-27T10:00:00.000Z' });

const FORM_KEYS = [
  'pr',
  'mr',
  'link',
  'convert',
  'skills',
  'agent',
  'spend-run',
  'spend-session',
  'script',
  'saved-step',
  'import',
  'locate',
] as const;

type FormKey = (typeof FORM_KEYS)[number];

const isFormKey = (params: { value: string }): params is { value: FormKey } =>
  FORM_KEYS.some((key) => key === params.value);

const requestedForm = { value: sceneParam({ key: 'form' }) ?? 'pr' };
const FORM: FormKey = isFormKey(requestedForm) ? requestedForm.value : 'pr';
const OPEN_LABELS = sceneParamList({ key: 'open', separator: ',' });

const noop = () => undefined;

const LEDGER_ID = 'mock-forms-project-ledger-core' as ProjectId;
const RELAY_ID = 'mock-forms-project-notify-relay' as ProjectId;

const SKILL = {
  id: 'mock-forms-skill-replay',
  workspaceId: WORKSPACE_ID,
  name: 'replay-dead-letters',
  description: 'Replays the dead letter queue of notify-relay',
  filePath: '~/code/harborline/.claude/skills/replay-dead-letters.md',
  body: 'Read the dead letter queue, replay each message once, report what failed.',
  frontmatter: {
    name: 'replay-dead-letters',
    description: 'Replays the dead letter queue of notify-relay',
  },
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Skill;

const RUN = {
  id: 'mock-forms-run-settlement',
  sessionId: SESSION_ID,
  spendLimitUsd: 12.5,
  spendLimitMode: 'pause',
} as unknown as WorkflowRun;

const LIMIT = { softCapUsd: 20, onExceed: 'pause' } as unknown as SessionBudget;

const PROJECTS = [
  {
    id: LEDGER_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    kind: 'repo',
    rootPath: '~/code/harborline/ledger-core',
  },
  {
    id: RELAY_ID,
    workspaceId: WORKSPACE_ID,
    name: 'notify-relay',
    kind: 'repo',
    rootPath: '~/code/harborline/notify-relay',
  },
] as unknown as ReadonlyArray<ReturnType<typeof useAppStore.getState>['projects'][number]>;

const workspaceOf = (): Workspace | null =>
  useAppStore.getState().workspaces.find((workspace) => workspace.id === WORKSPACE_ID) ?? null;

const renderForm = ({ form }: { form: FormKey }): ReactNode => {
  switch (form) {
    case 'pr':
      return (
        <div className="flex h-full min-h-0 flex-col">
          <CreatePrPanel
            sessionId={SESSION_ID}
            defaultTitle={SESSION.goal}
            onCreated={noop}
            onCancel={noop}
          />
        </div>
      );
    case 'mr':
      return (
        <div className="flex h-full min-h-0 flex-col">
          <CreateMrForm
            sessionId={SESSION_ID}
            branch="hl/fix-duplicate-credit"
            error={null}
            onClose={noop}
          />
        </div>
      );
    case 'link':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <WorkspaceLinkForm onComplete={noop} />
        </PageColumn>
      );
    case 'convert': {
      const workspace = workspaceOf();
      const project = PROJECTS[0];
      return workspace === null || project === undefined ? null : (
        <PageColumn className="flex flex-col gap-6 py-8">
          <ConvertWorkspaceFlow workspaceId={workspace.id} project={project} onClose={noop} />
        </PageColumn>
      );
    }
    case 'skills':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <SkillsPanel workspaceId={WORKSPACE_ID} />
        </PageColumn>
      );
    case 'agent':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="flex justify-center">
            <CreateAgentPopover sessionId={SESSION_ID} />
          </div>
        </PageColumn>
      );
    case 'spend-run':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="flex justify-center">
            <RunSpendLimitPopover sessionId={SESSION_ID} run={RUN} variant="meta" />
          </div>
        </PageColumn>
      );
    case 'spend-session':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="w-80 rounded-lg border border-border bg-floating p-3">
            <SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={noop} />
          </div>
        </PageColumn>
      );
    case 'script':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <ScriptEditor
            label="New script"
            name="Replay dead letters"
            body={
              '#!/usr/bin/env bash\nset -euo pipefail\npnpm --filter notify-relay exec node ./tools/replay.mjs'
            }
            projects={PROJECTS}
            projectId={RELAY_ID}
            error={null}
            isSaving={false}
            onNameChange={noop}
            onBodyChange={noop}
            onProjectChange={noop}
            onSave={noop}
            onCancel={noop}
          />
        </PageColumn>
      );
    case 'saved-step':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="rounded-lg bg-subtle">
            <SavedStepEditor
              mode="new"
              draft={{ ...blankStepDraft(), name: 'Replay dead letters' }}
              recommendedProvider="anthropic"
              recommendedModel="sonnet-5"
              connectedProviders={['anthropic', 'codex']}
              isBusy={false}
              error={null}
              onChange={noop}
              onSaveCopy={noop}
              onRemove={noop}
              onDone={noop}
            />
          </div>
        </PageColumn>
      );
    case 'import':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="flex justify-end">
            <ImportPopover workspaceId={WORKSPACE_ID} takenNames={new Set<string>()} />
          </div>
        </PageColumn>
      );
    case 'locate':
      return (
        <PageColumn className="flex flex-col gap-6 py-8">
          <LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={noop} />
        </PageColumn>
      );
    default: {
      const exhaustive: never = form;
      return exhaustive;
    }
  }
};

export const FormsAuditScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens: null,
    });
    useAppStore.setState({
      projects: PROJECTS,
      skills: { [WORKSPACE_ID]: [SKILL] },
      loadSkills: async () => undefined,
      projectRelocationWorkspaceId: WORKSPACE_ID,
      projectRelocationPhase: 'preview',
      projectRelocationError: null,
      projectRelocationCompleted: [],
      projectRelocationCandidates: [
        {
          projectId: LEDGER_ID,
          name: 'ledger-core',
          fromRoot: '~/code/ledger-core',
          toRoot: '~/code/harborline/ledger-core',
          verdict: 'same_repository',
          identity: null,
          isSelected: true,
          status: 'ready',
        },
      ],
    });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: OPEN_LABELS,
    selector: 'button, [role="radio"]',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={renderForm({ form: FORM })} />;
};
