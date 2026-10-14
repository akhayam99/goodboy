import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Chip, FormActions, formatError } from '@goodboy/ui';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { Docked } from '../../../shared/components/Docked';
import { PromptField } from '../../../shared/components/PromptField';
import { RoutingPicker } from '../../../shared/components/RoutingPicker';
import { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import { useAgentRouting } from '../hooks/useAgentRouting';
import { useAutoStart } from '../hooks/useAutoStart';

type Props = {
  readonly sessionId: SessionId;
  readonly actionsHost?: HTMLElement | null;
  readonly action?: HTMLElement | null;
  readonly footerClassName?: string;
  readonly onDone: () => void;
};

const AUTO_PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic'];

const EMPTY_REASON = 'Set a goal to start';

export const AutoComposer = ({
  sessionId,
  actionsHost,
  action,
  footerClassName,
  onDone,
}: Props) => {
  const goal = useAppStore((state) => state.newDrawerDrafts[sessionId]?.autoGoal ?? '');
  const setGoal = useAppStore((state) => state.setNewDrawerAutoGoal);
  const connected = useAppStore(
    useShallow((state) =>
      AUTO_PROVIDERS.filter((provider) =>
        state.providers.some((entry) => entry.id === provider && entry.connection === 'connected'),
      ),
    ),
  );
  const choice = useAgentRouting({ sessionId, kind: 'generic' });
  const start = useAutoStart({ sessionId });
  const files = usePromptFiles({ note: 'Files go to Auto' });
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const hasGoal = goal.trim() !== '';

  const submit = async (): Promise<void> => {
    if (!hasGoal || isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      await start({ goal, routing: choice.effective });
      setGoal({ sessionId, goal: '' });
      files.clear();
      choice.reset();
      onDone();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  return (
    <>
      <section aria-label="Auto" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-label text-foreground">Auto</span>
          <Chip tone="warning" kind="state" shape="badge" label="Experimental" />
          <span className="text-meta text-muted-foreground">It may not work well yet.</span>
        </div>
        <PromptField
          kind="message"
          label="Describe the work"
          value={goal}
          onChange={(next) => setGoal({ sessionId, goal: next })}
          onSubmit={() => void submit()}
          isSubmitBlocked={!hasGoal || isStarting}
          placeholder="Describe the work."
          minRows={4}
          maxRows={12}
          disabled={isStarting}
          notice={files.notice}
          files={files.files}
          keyLabels={{ send: 'start' }}
          hasChangedKeys
        />
        <div className="flex min-w-0 items-center justify-between gap-2">
          <RoutingPicker
            variant="pill"
            align="start"
            ariaLabel="Auto model"
            connectedProviders={connected}
            provider={choice.effective.provider}
            model={choice.effective.model}
            effort={{ editable: true, value: choice.effective.effort }}
            recommendation={{
              provider: choice.suggestion.provider,
              model: choice.suggestion.model,
              label: 'Suggested',
              reason: choice.suggestionReason,
            }}
            recommendationKind="auto"
            disabled={isStarting}
            overridden={choice.routing !== null}
            onReset={choice.reset}
            onChange={choice.pick}
          />
        </div>
      </section>
      {hasGoal ? (
        <Docked node={action}>
          <Button
            variant="ghost"
            size="sm"
            disabled={isStarting}
            onClick={() => {
              setGoal({ sessionId, goal: '' });
              files.clear();
            }}
          >
            Discard draft
          </Button>
        </Docked>
      ) : null}
      <Docked node={actionsHost}>
        <FormActions
          className={footerClassName}
          error={error}
          reason={hasGoal ? null : EMPTY_REASON}
        >
          <Button
            size="md"
            onClick={() => void submit()}
            disabled={!hasGoal || isStarting}
            isBusy={isStarting}
            busyLabel="Starting Auto"
          >
            Start Auto
          </Button>
        </FormActions>
      </Docked>
    </>
  );
};
