import { useState, type KeyboardEvent } from 'react';
import { Button, FormActions, formatError, useEscapeLayer, KeyHint } from '@goodboy/ui';
import type { ResolveCommitStyle, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PromptField } from '../../../../../shared/components/PromptField';
import { RunsOn } from '../../../../../shared/components/RunsOn';
import { eventMatches } from '../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { sessionResolveStyle } from '../../../../../store/sessionReplySettings';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { launchChoiceOf } from '../../../launchChoice';
import {
  LAUNCH_ORDER_LINE,
  REVIEW_LAUNCH_LABEL,
  launchStartLabel,
  launchTitle,
} from '../../../reviewLaunchCopy';
import { startBatch } from '../../../startBatch';
import type { ReviewEntry } from '../useReviewEntries';
import { useDraftRouting } from '../useDraftRouting';
import { LaunchPanelRow } from './LaunchPanelRow';

type LaunchPanelRowState = {
  readonly entry: ReviewEntry;
  readonly isIncluded: boolean;
};

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<LaunchPanelRowState>;
  readonly onToggle: (threadId: string) => void;
  readonly onClose: () => void;
  readonly onStarted: () => void;
};

const storedCommitStyle = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ResolveCommitStyle => {
  const state = useAppStore.getState();
  const last = state.sessionResolveBatches[sessionId]?.at(-1)?.launchChoice.commitStyle ?? null;
  return last ?? sessionResolveStyle({ state, sessionId }).commitStyle;
};

export const LaunchPanel = ({ sessionId, rows, onToggle, onClose, onStarted }: Props) => {
  const draft = useDraftRouting({ sessionId });
  const [hint, setHint] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadIds = rows.filter((row) => row.isIncluded).map((row) => row.entry.threadId);
  const count = threadIds.length;

  useEscapeLayer(onClose);

  const start = async (): Promise<void> => {
    if (isStarting || count === 0) {
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      await startBatch({
        getState: useAppStore.getState,
        sessionId,
        threadIds,
        launchChoice: launchChoiceOf({
          routing: draft.routing,
          commitStyle: storedCommitStyle({ sessionId }),
          hint,
        }),
      });
      onStarted();
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setIsStarting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['composer.submit'] })) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void start();
  };

  return (
    <section
      aria-label={REVIEW_LAUNCH_LABEL.panel}
      onKeyDown={onKeyDown}
      className="flex min-w-0 max-w-[var(--measure)] flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-title text-foreground">{launchTitle({ count })}</h2>
        <p className="text-meta text-muted-foreground">{LAUNCH_ORDER_LINE}</p>
      </div>
      <ul className="flex flex-col gap-0.5 rounded-lg bg-subtle p-1">
        {rows.map((row) => (
          <li key={row.entry.threadId} className="min-w-0 list-none">
            <LaunchPanelRow
              entry={row.entry}
              isIncluded={row.isIncluded}
              onToggle={() => onToggle(row.entry.threadId)}
            />
          </li>
        ))}
      </ul>
      <RunsOn
        suggested={draft.suggested}
        override={draft.isOverridden ? draft.routing : null}
        onChange={draft.save}
        disabled={isStarting}
      />
      <p className="text-meta text-faint-foreground">
        {draft.source === 'session-pick'
          ? REVIEW_LAUNCH_LABEL.remembered
          : REVIEW_LAUNCH_LABEL.roleDefault}
      </p>
      <PromptField
        kind="document"
        minRows={2}
        maxRows={6}
        value={hint}
        onChange={setHint}
        placeholder={REVIEW_LAUNCH_LABEL.hintPlaceholder}
        label={REVIEW_LAUNCH_LABEL.hintLabel}
        disabled={isStarting}
        className="bg-background"
      />
      <FormActions error={error}>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {REVIEW_LAUNCH_LABEL.cancel}
          <KeyHint keys="Esc" />
        </Button>
        <Button
          size="sm"
          variant="primary"
          isBusy={isStarting}
          disabled={count === 0}
          onClick={() => void start()}
        >
          {launchStartLabel({ count })}
          <KeyHint keys={shortcutGlyphs('composer.submit')} onTone />
        </Button>
      </FormActions>
    </section>
  );
};
