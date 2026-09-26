import { Button, Input } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { StartFooter } from './StartFooter';
import { useDraftStart } from './useDraftStart';

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

export const ScoutStart = ({ workspaceId }: Props) => {
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const focus = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentPrompt);
  const { start, isStarting, error } = useDraftStart({ workspaceId });

  const startScout = async () => {
    const isStarted = await start({
      kind: 'scout',
      focus,
      prompt: scoutKickoffPrompt({ focus }),
    });
    if (!isStarted) {
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={focus}
        onChange={(event) =>
          patchSessionDraft({ workspaceId, patch: { agentPrompt: event.target.value } })
        }
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void startScout();
        }}
        aria-label="Scout focus"
        placeholder="Optional: an area, a file or a question"
        data-kickoff-field
        className="h-8 text-body"
      />
      <StartFooter note="Scout only reads. It changes nothing." error={error}>
        <Button
          size="sm"
          disabled={isStarting}
          isBusy={isStarting}
          busyLabel="Starting Scout"
          onClick={() => void startScout()}
        >
          Start Scout
        </Button>
      </StartFooter>
    </div>
  );
};
