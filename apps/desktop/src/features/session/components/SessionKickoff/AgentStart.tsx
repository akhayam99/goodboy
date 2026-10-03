import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { useWorkspaceRepoProjects } from '../../hooks/useWorkspaceRepoProjects';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AGENT_KIND_META, visibleAgentKinds } from '../../agent-kind';
import { AgentStartFields, type AgentStartRouting } from '../AgentStartFields';
import { StartFooter } from './StartFooter';
import { useDraftStart } from './useDraftStart';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';
import { PromptField } from '../../../../shared/components/PromptField';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const SCOUT_BRIEF =
  'Read this project and suggest where to start: what needs doing, and which piece to pick up first.';

type BriefParams = {
  readonly focus: string;
};

export const scoutKickoffPrompt = ({ focus }: BriefParams): string => {
  const trimmed = focus.trim();
  return trimmed === '' ? SCOUT_BRIEF : `${SCOUT_BRIEF}\n\nFocus on: ${trimmed}`;
};

export const AgentStart = ({ workspaceId }: Props) => {
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const draft = useAppStore((state) => selectSessionDraft({ state, workspaceId }));
  const kinds = visibleAgentKinds();
  const kind = kinds.includes(draft.agentKind) ? draft.agentKind : (kinds[0] ?? 'scout');
  const kindLabel = AGENT_KIND_META[kind].noun;
  const defaultProvider = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultProviderId,
  );
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map((p) => p.id),
    ),
  );
  const projects = useWorkspaceRepoProjects({ workspaceId });
  useEffect(() => {
    const firstProjectId = projects[0]?.id ?? null;
    if (draft.projectId === null && firstProjectId !== null) {
      patchSessionDraft({ workspaceId, patch: { projectId: firstProjectId } });
    }
  }, [draft.projectId, projects, patchSessionDraft, workspaceId]);
  const roleDefault = useWorkspaceKindRouting({ workspaceId, kind });
  const suggestion = resolveSpawnRouting({ kind, roleDefault, session: null });
  const { start, isStarting, error } = useDraftStart({ workspaceId });
  const hasProject = draft.projectId !== null;
  const promptFiles = usePromptFiles({
    note: 'Images go to the agent you start',
    isEnabled: hasProject,
    notices: {
      ambiguous: 'Drop the file on the instructions box to attach it.',
      disabled: 'Pick a project to attach files.',
      unavailable: 'File drop is unavailable. Use Attach files instead.',
    },
  });
  const isScout = kind === 'scout';
  const hasPrompt = draft.agentPrompt.trim() !== '';
  const canStart = isScout || hasPrompt;

  const startAgent = async () => {
    if (!canStart) {
      return;
    }
    const prompt = isScout
      ? scoutKickoffPrompt({ focus: draft.agentPrompt })
      : draft.agentPrompt.trim();
    const staged = hasProject ? promptFiles.attachments : [];
    const attachmentInputs = staged.length === 0 ? [] : await toAttachmentInputs(staged);
    const isStarted = await start({
      kind: 'scout',
      agentKind: kind,
      focus: draft.agentPrompt,
      prompt,
      routing: draft.agentRouting,
      ...(attachmentInputs.length > 0 && { attachmentInputs }),
    });
    if (!isStarted) {
      return;
    }
    promptFiles.clear();
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const placeholder = isScout
    ? 'Optional: an area, a file or a question'
    : `What should ${kindLabel} do?`;
  const startLabel =
    isScout && !hasPrompt ? 'Start Scout on the whole project' : `Start ${kindLabel}`;

  return (
    <div className="flex flex-col gap-2">
      <PromptField
        kind="message"
        value={draft.agentPrompt}
        onChange={(agentPrompt) => patchSessionDraft({ workspaceId, patch: { agentPrompt } })}
        onSubmit={() => void startAgent()}
        isSubmitBlocked={!canStart || isStarting}
        hasChangedKeys
        label={isScout ? 'Scout focus' : 'Agent instructions'}
        placeholder={placeholder}
        isKickoffField
        minRows={4}
        maxRows={14}
        keyLabels={{ send: 'start' }}
        notice={promptFiles.notice}
        {...(hasProject && { files: promptFiles.files })}
      />
      <div className="flex items-center justify-between gap-2">
        <AgentStartFields
          kinds={kinds}
          kind={kind}
          onKindChange={(next) => patchSessionDraft({ workspaceId, patch: { agentKind: next } })}
          routing={draft.agentRouting as AgentStartRouting}
          suggestion={suggestion}
          connectedProviders={connectedProviders}
          onRoutingChange={(next) =>
            patchSessionDraft({ workspaceId, patch: { agentRouting: next } })
          }
          projects={projects}
          projectId={draft.projectId}
          onProjectChange={(next) => patchSessionDraft({ workspaceId, patch: { projectId: next } })}
        />
      </div>
      <StartFooter note="Scout only reads. It changes nothing." error={error}>
        <Button
          size="sm"
          disabled={!canStart || isStarting}
          isBusy={isStarting}
          busyLabel={`Starting ${kindLabel}`}
          onClick={() => void startAgent()}
          title={!canStart ? `Write what ${kindLabel} should do` : undefined}
        >
          {startLabel}
        </Button>
      </StartFooter>
    </div>
  );
};
