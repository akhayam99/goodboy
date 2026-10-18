import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type {
  SessionDraftMount,
  SessionDraftStart,
  SessionDraftThen,
} from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { KickoffProjects } from './KickoffProjects';
import { useLaunchMount } from '../../../inbox/useLaunchMount';
import { resolveSpawnRouting } from '../../spawn-routing';
import { visibleAgentKinds, type AgentKind } from '../../agent-kind';
import { AgentStartFields, type AgentStartRouting } from '../AgentStartFields';
import {
  WorkflowBuilderView,
  type BuilderKickoff,
} from '../../../workflows/components/WorkflowBuilderView';
import { KICKOFF_GOAL_PLACEHOLDER } from './WorkflowStart';
import { CrossProjectNote } from './CrossProjectNote';
import { StartFooter } from './StartFooter';
import { useDraftStart } from './useDraftStart';
import { useDraftDiscard } from './useDraftDiscard';
import { useStartFromDraft } from './useStartFromDraft';
import { NAMES } from '../../../../shared/names';
import { startFromIssuesLabel, willCloseLine } from '../../../../shared/lib/startCopy';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';
import { PromptField } from '../../../../shared/components/PromptField';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import { RunsAsChip } from './RunsAsChip';
import type { RunsAs } from './runsAs';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidates: ReadonlyArray<IssueCandidate>;
  readonly title: string;
  readonly goal: string;
  readonly onGoalChange: (goal: string) => void;
};

export const HowToWorkOnIt = ({ workspaceId, candidates, title, goal, onGoalChange }: Props) => {
  const first = candidates[0];
  const identifiers = candidates.map((candidate) => candidate.identifier);
  const [how, setHow] = useState<RunsAs>('orchestrate');
  const text = goal;
  const setText = onGoalChange;
  const [agentKind, setAgentKind] = useState<AgentKind>('implementer');
  const [agentRouting, setAgentRouting] = useState<AgentStartRouting>(null);
  const pickedProjectIds = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).projectIds,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const hasPrefilledRef = useRef(false);
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const startSessionFromDraft = useStartFromDraft();
  const startLabel = startFromIssuesLabel({ identifiers });
  const closeLine = willCloseLine({ identifiers });
  const { start: startAgent, isStarting, error } = useDraftStart({ workspaceId });
  const { canDiscard, discard } = useDraftDiscard({ workspaceId });
  const mount = useLaunchMount({
    workspaceId,
    source:
      first === undefined
        ? null
        : { provider: first.provider, url: first.url, sentryProject: first.sentryProject ?? null },
  });

  useEffect(() => {
    void loadPhaseTemplates(workspaceId).catch(() => undefined);
  }, [loadPhaseTemplates, workspaceId]);

  const kinds = visibleAgentKinds();
  const kind = kinds.includes(agentKind) ? agentKind : (kinds[0] ?? 'implementer');
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map((p) => p.id),
    ),
  );
  const roleDefault = useWorkspaceKindRouting({ workspaceId, kind });
  const suggestion = resolveSpawnRouting({ kind, roleDefault, session: null });

  const suggestedId = mount?.selectedId ?? null;
  const projectId = pickedProjectIds[0] ?? null;
  const draftMount: SessionDraftMount | null =
    mount === null || projectId === null || projectId !== suggestedId
      ? null
      : { projectId, reason: mount.reason };

  useEffect(() => {
    if (hasPrefilledRef.current || suggestedId === null) {
      return;
    }
    hasPrefilledRef.current = true;
    if (pickedProjectIds.length === 0) {
      patchSessionDraft({ workspaceId, patch: { projectIds: [suggestedId] } });
    }
  }, [suggestedId, pickedProjectIds.length, patchSessionDraft, workspaceId]);
  const trimmed = text.trim();
  const hasProject = projectId !== null;
  const promptFiles = usePromptFiles({
    note: 'Files go to the agent you start',
    isEnabled: hasProject && how === 'agent',
    notices: {
      ambiguous: 'Drop the file on the instructions box to attach it.',
      disabled: 'Pick a folder to attach files.',
      unavailable: 'File drop is unavailable. Use Attach files instead.',
    },
  });

  const taskStart = (then: SessionDraftThen): SessionDraftStart => ({
    kind: 'task',
    candidates,
    title: title.trim() === '' ? (first?.title ?? '') : title,
    goal: trimmed,
    then,
    ...(draftMount !== null && { mount: draftMount }),
  });

  const projectsBlock = (
    <div className="flex flex-col gap-2">
      <KickoffProjects
        workspaceId={workspaceId}
        suggestedIds={suggestedId === null ? [] : [suggestedId]}
        launch={draftMount}
        isDisabled={isStarting}
      />
      {candidates.slice(1).map((candidate) => (
        <CrossProjectNote
          key={draftIssueKey({ candidate })}
          workspaceId={workspaceId}
          candidate={candidate}
          projectId={projectId}
        />
      ))}
    </div>
  );

  const runsAs = <RunsAsChip value={how} isDisabled={isStarting} onChange={setHow} />;

  const kickoff: BuilderKickoff = {
    workspaceId,
    lane: 'task',
    leading: runsAs,
    projects: projectsBlock,
    goal: text,
    goalPlaceholder: KICKOFF_GOAL_PLACEHOLDER,
    primaryLabel: startLabel,
    canDiscard,
    onDiscard: discard,
    onGoalChange: setText,
    start: async (run: (session: Session) => Promise<void>) => {
      await startSessionFromDraft({
        workspaceId,
        start: taskStart({ kind: 'workflow-run', run }),
      });
    },
  };

  const startAgentRun = async () => {
    if (trimmed === '') {
      return;
    }
    const staged = hasProject ? promptFiles.attachments : [];
    const attachmentInputs = staged.length === 0 ? [] : await toAttachmentInputs(staged);
    const isStarted = await startAgent({
      ...taskStart({ kind: 'agent', agentKind: kind, prompt: trimmed, routing: agentRouting }),
      ...(attachmentInputs.length > 0 && { attachmentInputs }),
    });
    if (isStarted) {
      promptFiles.clear();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {how === 'workflow' ? (
        <WorkflowBuilderView
          mode="preset"
          kickoff={kickoff}
          onOrchestrateInstead={() => setHow('orchestrate')}
        />
      ) : null}
      {how === 'orchestrate' ? <WorkflowBuilderView mode="dynamic" kickoff={kickoff} /> : null}
      {how !== 'agent' ? null : (
        <div className="flex flex-col gap-6">
          <PromptField
            kind="document"
            value={text}
            onChange={setText}
            onSubmit={() => void startAgentRun()}
            isSubmitBlocked={trimmed === '' || isStarting}
            hasChangedKeys
            label="Agent instructions"
            isKickoffField
            minRows={2}
            maxRows={8}
            keyLabels={{ send: 'start' }}
            notice={promptFiles.notice}
            {...(hasProject && { files: promptFiles.files })}
          />
          {projectsBlock}
          <StartFooter
            workspaceId={workspaceId}
            leading={
              <>
                {runsAs}
                <AgentStartFields
                  kinds={kinds}
                  kind={kind}
                  onKindChange={setAgentKind}
                  routing={agentRouting}
                  suggestion={suggestion}
                  connectedProviders={connectedProviders}
                  isDisabled={isStarting}
                  onRoutingChange={setAgentRouting}
                />
              </>
            }
            note={trimmed === '' ? 'Write the goal first.' : null}
            error={error}
            isStarting={isStarting}
          >
            <Button
              size="md"
              disabled={trimmed === '' || isStarting}
              isBusy={isStarting}
              busyLabel={NAMES.starting}
              onClick={() => void startAgentRun()}
            >
              {error === null ? startLabel : NAMES.retry}
            </Button>
          </StartFooter>
        </div>
      )}
      {closeLine === null ? null : (
        <p className="text-right text-meta text-faint-foreground">{closeLine}</p>
      )}
    </div>
  );
};
