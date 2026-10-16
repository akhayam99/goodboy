import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AUTO_OWN_PROVIDERS } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';
import type { PickedRoute } from '../../../../shared/components/RoutingPicker/PickedRoute';
import { openAgentRevealEvent } from '../../../../shared/utils/openAgentReveal';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AutoComposerView, type AutoRoutingChoice } from '../AutoComposerView';
import { useDraftStart } from './useDraftStart';
import { useDraftDiscard } from './useDraftDiscard';
import { KickoffProjects } from './KickoffProjects';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const SUGGESTION_REASON = 'The default model for Auto.';

export const AutoStart = ({ workspaceId }: Props) => {
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const draft = useAppStore((state) => selectSessionDraft({ state, workspaceId }));
  const connected = useAppStore(
    useShallow((state) =>
      AUTO_OWN_PROVIDERS.filter((provider) =>
        state.providers.some((entry) => entry.id === provider && entry.connection === 'connected'),
      ),
    ),
  );
  useEffect(() => {
    if (draft.agentPrompt.trim() !== '' && draft.autoGoal.trim() === '') {
      patchSessionDraft({ workspaceId, patch: { autoGoal: draft.agentPrompt, agentPrompt: '' } });
    }
  }, [draft.autoGoal, draft.agentPrompt, patchSessionDraft, workspaceId]);
  const roleDefault = useWorkspaceKindRouting({ workspaceId, kind: 'auto' });
  const spawnDefault = resolveSpawnRouting({ kind: 'auto', roleDefault, session: null });
  const suggestion = {
    provider: spawnDefault.provider,
    model: spawnDefault.model,
    effort: spawnDefault.effort,
  };
  const promptFiles = usePromptFiles({ note: 'Files go to Auto' });
  const { start, isStarting, error } = useDraftStart({ workspaceId });
  const { discard } = useDraftDiscard({ workspaceId });
  const limit = useAutoTreeLimit({ workspaceId });
  const goal = draft.autoGoal;

  const choice: AutoRoutingChoice = {
    routing: draft.autoRouting,
    effective: draft.autoRouting ?? suggestion,
    suggestion,
    suggestionReason: SUGGESTION_REASON,
    pick: ({ provider, model, effort }: PickedRoute) => {
      if (provider === '') {
        patchSessionDraft({ workspaceId, patch: { autoRouting: null } });
        return;
      }
      patchSessionDraft({
        workspaceId,
        patch: { autoRouting: { ...(draft.autoRouting ?? suggestion), provider, model, effort } },
      });
    },
    reset: () => patchSessionDraft({ workspaceId, patch: { autoRouting: null } }),
  };

  const submit = async (): Promise<void> => {
    if (goal.trim() === '') {
      return;
    }
    await limit.persist();
    const staged = promptFiles.attachments;
    const attachmentInputs = staged.length === 0 ? [] : await toAttachmentInputs(staged);
    const isStarted = await start({
      kind: 'scout',
      agentKind: 'auto',
      focus: goal,
      prompt: goal.trim(),
      routing: choice.effective,
      ...(attachmentInputs.length > 0 && { attachmentInputs }),
    });
    if (!isStarted) {
      return;
    }
    promptFiles.clear();
    window.dispatchEvent(openAgentRevealEvent());
  };

  return (
    <AutoComposerView
      goal={goal}
      promptFiles={promptFiles}
      connected={connected}
      choice={choice}
      limit={limit}
      isStarting={isStarting}
      error={error}
      onGoalChange={(next) => patchSessionDraft({ workspaceId, patch: { autoGoal: next } })}
      onSubmit={() => void submit()}
      onDiscard={discard}
      projects={<KickoffProjects workspaceId={workspaceId} isDisabled={isStarting} />}
    />
  );
};
