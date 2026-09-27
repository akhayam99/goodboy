import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, SegmentedTabs, Textarea, type SegmentedTabOption } from '@goodboy/ui';
import type { ProjectId, Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type {
  SessionDraftMount,
  SessionDraftStart,
  SessionDraftThen,
} from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { LaunchMountRow } from '../../../integrations/components/LaunchSessionPanel/LaunchMountRow';
import { useLaunchMount } from '../../../inbox/useLaunchMount';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AGENT_KIND_META, visibleAgentKinds, type AgentKind } from '../../agent-kind';
import { AgentStartFields, type AgentStartRouting } from '../AgentStartFields';
import { WorkflowBuilderView, type BuilderKickoff } from '../WorkflowBuilderView';
import { KICKOFF_GOAL_PLACEHOLDER } from './WorkflowStart';
import { StartFooter } from './StartFooter';
import { useDraftStart } from './useDraftStart';

type How = 'workflow' | 'agent';

const HOW_OPTIONS: ReadonlyArray<SegmentedTabOption<How>> = [
  { value: 'workflow', label: 'Run a workflow', icon: CONCEPT_ICONS.workflows },
  { value: 'agent', label: 'Ask an agent', icon: CONCEPT_ICONS.explore },
];

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
  readonly title: string;
  readonly goal: string;
};

export const HowToWorkOnIt = ({ workspaceId, candidate, title, goal }: Props) => {
  const [how, setHow] = useState<How>('workflow');
  const [text, setText] = useState(goal);
  const [agentKind, setAgentKind] = useState<AgentKind>('implementer');
  const [agentRouting, setAgentRouting] = useState<AgentStartRouting>(null);
  const [pickedProjectId, setPickedProjectId] = useState<ProjectId | null | undefined>(undefined);
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const startSessionFromDraft = useAppStore((state) => state.startSessionFromDraft);
  const { start: startAgent, isStarting, error } = useDraftStart({ workspaceId });
  const mount = useLaunchMount({
    workspaceId,
    source: {
      provider: candidate.provider,
      url: candidate.url,
      sentryProject: candidate.sentryProject ?? null,
    },
  });

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
  }, [loadPhaseTemplates, workspaceId]);

  const kinds = visibleAgentKinds();
  const kind = kinds.includes(agentKind) ? agentKind : (kinds[0] ?? 'implementer');
  const kindLabel = AGENT_KIND_META[kind].noun;
  const defaultProvider = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultProviderId,
  );
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map((p) => p.id),
    ),
  );
  const suggestion = resolveSpawnRouting({
    kind,
    roleModels: null,
    session: null,
    defaultProvider,
  });

  const projectId = pickedProjectId === undefined ? (mount?.selectedId ?? null) : pickedProjectId;
  const draftMount: SessionDraftMount | null =
    mount === null ? null : { projectId, reason: mount.reason };
  const trimmed = text.trim();

  const taskStart = (then: SessionDraftThen): SessionDraftStart => ({
    kind: 'task',
    candidate,
    title,
    goal: trimmed,
    then,
    ...(draftMount !== null && { mount: draftMount }),
  });

  const kickoff: BuilderKickoff = {
    workspaceId,
    lane: 'task',
    goal: text,
    goalPlaceholder: KICKOFF_GOAL_PLACEHOLDER,
    onGoalChange: setText,
    start: async (run: (session: Session) => Promise<void>) => {
      await startSessionFromDraft({
        workspaceId,
        start: taskStart({ kind: 'workflow-run', run }),
      });
    },
  };

  const startAgentRun = () => {
    if (trimmed === '') {
      return;
    }
    void startAgent(
      taskStart({ kind: 'agent', agentKind: kind, prompt: trimmed, routing: agentRouting }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {mount === null ? null : (
          <LaunchMountRow
            mount={mount}
            selectedId={projectId}
            disabled={isStarting}
            onChange={setPickedProjectId}
          />
        )}
        <SegmentedTabs
          size="sm"
          ariaLabel="How to work on it"
          options={HOW_OPTIONS}
          value={how}
          onChange={setHow}
        />
      </div>
      {how === 'workflow' ? (
        <WorkflowBuilderView kickoff={kickoff} />
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Agent instructions"
            data-kickoff-field
            minRows={2}
            maxRows={8}
            autoGrow
            className="text-body"
          />
          <AgentStartFields
            kinds={kinds}
            kind={kind}
            onKindChange={setAgentKind}
            routing={agentRouting}
            suggestion={suggestion}
            connectedProviders={connectedProviders}
            onRoutingChange={setAgentRouting}
            projects={[]}
            projectId={null}
            onProjectChange={() => undefined}
          />
          <StartFooter note={trimmed === '' ? 'Write the goal first.' : null} error={error}>
            <Button
              size="sm"
              disabled={trimmed === '' || isStarting}
              isBusy={isStarting}
              busyLabel={`Starting ${kindLabel}`}
              onClick={startAgentRun}
            >
              {`Start ${kindLabel}`}
            </Button>
          </StartFooter>
        </div>
      )}
    </div>
  );
};
