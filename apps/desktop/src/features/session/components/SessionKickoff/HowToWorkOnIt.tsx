import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, SegmentedTabs, Textarea, type SegmentedTabOption } from '@goodboy/ui';
import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectPresetWorkflows } from '../../../../store/slices/workflows/selectPresetWorkflows';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type { SessionDraftThen } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AGENT_KIND_META, visibleAgentKinds, type AgentKind } from '../../agent-kind';
import { AgentStartFields, type AgentStartRouting } from '../AgentStartFields';
import { WorkflowPresetGroup } from './WorkflowPresetGroup';
import { StartFooter } from './StartFooter';

type How = 'workflow' | 'agent';

const HOW_OPTIONS: ReadonlyArray<SegmentedTabOption<How>> = [
  { value: 'workflow', label: 'Run a workflow', icon: CONCEPT_ICONS.workflows },
  { value: 'agent', label: 'Ask an agent', icon: CONCEPT_ICONS.explore },
];

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly goal: string;
  readonly onStart: (then: SessionDraftThen) => void;
  readonly isStarting: boolean;
  readonly error: string | null;
};

export const HowToWorkOnIt = ({ workspaceId, goal, onStart, isStarting, error }: Props) => {
  const [how, setHow] = useState<How>('workflow');
  const [text, setText] = useState(goal);
  const [workflowId, setWorkflowId] = useState<WorkflowId | null>(null);
  const [agentKind, setAgentKind] = useState<AgentKind>('implementer');
  const [agentRouting, setAgentRouting] = useState<AgentStartRouting>(null);
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
  }, [loadPhaseTemplates, workspaceId]);

  const workflows = useAppStore(
    useShallow((state) => selectPresetWorkflows({ state, workspaceId })),
  );
  const builtIn = workflows.filter((workflow) => workflow.origin === 'library');
  const saved = workflows.filter((workflow) => workflow.origin !== 'library');
  const recommended = builtIn[0] ?? saved[0] ?? null;
  const pickedWorkflow = workflows.find((workflow) => workflow.id === workflowId) ?? recommended;

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

  const trimmed = text.trim();
  const canRunWorkflow = pickedWorkflow != null && trimmed !== '' && !isStarting;
  const canStartAgent = trimmed !== '' && !isStarting;

  const start = () => {
    if (how === 'workflow') {
      if (pickedWorkflow == null || trimmed === '') {
        return;
      }
      onStart({ kind: 'workflow', workflowId: pickedWorkflow.id });
      return;
    }
    if (trimmed === '') {
      return;
    }
    onStart({ kind: 'agent', agentKind: kind, prompt: trimmed, routing: agentRouting });
  };

  return (
    <div className="flex flex-col gap-2">
      <SegmentedTabs
        size="sm"
        ariaLabel="How to work on it"
        options={HOW_OPTIONS}
        value={how}
        onChange={setHow}
      />
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label={how === 'workflow' ? 'Workflow goal' : 'Agent instructions'}
        data-kickoff-field
        minRows={2}
        maxRows={8}
        autoGrow
        className="text-body"
      />
      {how === 'workflow' ? (
        workflows.length === 0 ? (
          <p className="px-2.5 text-label text-muted-foreground">
            No workflows in this workspace yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <WorkflowPresetGroup
              label="Built in"
              workflows={builtIn}
              pickedId={pickedWorkflow?.id ?? null}
              onPick={setWorkflowId}
            />
            <WorkflowPresetGroup
              label="Saved"
              workflows={saved}
              pickedId={pickedWorkflow?.id ?? null}
              onPick={setWorkflowId}
            />
          </div>
        )
      ) : (
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
      )}
      <StartFooter note={trimmed === '' ? 'Write the goal first.' : null} error={error}>
        <Button
          size="sm"
          disabled={how === 'workflow' ? !canRunWorkflow : !canStartAgent}
          isBusy={isStarting}
          busyLabel={how === 'workflow' ? 'Starting workflow' : `Starting ${kindLabel}`}
          onClick={start}
        >
          {how === 'workflow' ? 'Run workflow' : `Start ${kindLabel}`}
        </Button>
      </StartFooter>
    </div>
  );
};
