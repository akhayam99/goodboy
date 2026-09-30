import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  IconButton,
  KbdPill,
  SegmentedTabs,
  Textarea,
  formatError,
  type SegmentedTabOption,
} from '@goodboy/ui';
import {
  RESOLVE_PARALLEL_LIMIT_DEFAULT,
  type ResolveCommitStyle,
  type SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { sessionResolveStyle } from '../../../../store/sessionReplySettings';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { launchChoiceOf } from '../../launchChoice';
import {
  REVIEW_LAUNCH_LABEL,
  launchFactLine,
  launchStartLabel,
  launchTitle,
} from '../../reviewLaunchCopy';
import { startBatch } from '../../startBatch';
import { useDraftRouting } from './useDraftRouting';

type Props = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly onClose: () => void;
  readonly onStarted: (params: { readonly count: number; readonly model: string }) => void;
};

const COMMIT_OPTIONS: ReadonlyArray<SegmentedTabOption<ResolveCommitStyle>> = [
  { value: 'new', label: REVIEW_LAUNCH_LABEL.newCommit },
  { value: 'fixup', label: REVIEW_LAUNCH_LABEL.fixup },
];

const initialCommitStyle = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ResolveCommitStyle => {
  const state = useAppStore.getState();
  const last = state.sessionResolveBatches[sessionId]?.at(-1)?.launchChoice.commitStyle ?? null;
  return last ?? sessionResolveStyle({ state, sessionId }).commitStyle;
};

export const ReviewLaunchStrip = ({ sessionId, threadIds, onClose, onStarted }: Props) => {
  const draft = useDraftRouting({ sessionId });
  const limit = useAppStore(
    (s) => s.sessionResolveParallelLimit[sessionId] ?? RESOLVE_PARALLEL_LIMIT_DEFAULT,
  );
  const [commitStyle, setCommitStyle] = useState<ResolveCommitStyle>(() =>
    initialCommitStyle({ sessionId }),
  );
  const [hint, setHint] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = threadIds.length;

  const start = async (): Promise<void> => {
    if (isStarting || count === 0) {
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      const { agentIds } = await startBatch({
        getState: useAppStore.getState,
        sessionId,
        threadIds,
        launchChoice: launchChoiceOf({ routing: draft.routing, commitStyle, hint }),
      });
      draft.save(draft.routing);
      onStarted({ count: agentIds.length, model: draft.routing.model });
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setIsStarting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const native = event.nativeEvent;
    if (native.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['composer.submit'] })) {
      event.preventDefault();
      event.stopPropagation();
      void start();
    }
  };

  return (
    <section
      aria-label={REVIEW_LAUNCH_LABEL.strip}
      onKeyDown={onKeyDown}
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle px-4 py-3.5 motion-safe:animate-studio-in"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading text-foreground">{launchTitle({ count })}</h2>
        <IconButton icon={X} label={REVIEW_LAUNCH_LABEL.close} variant="ghost" onClick={onClose} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-label text-faint-foreground">{REVIEW_LAUNCH_LABEL.model}</span>
          <RoutingPicker
            variant="pill"
            connectedProviders={draft.connectedProviders}
            provider={draft.routing.provider}
            model={draft.routing.model}
            effort={{ editable: true, value: draft.routing.effort, onChange: draft.setEffort }}
            disabled={isStarting}
            onProvider={draft.setProvider}
            onModel={draft.setModel}
            recommendation={{ ...draft.suggested, label: SUGGESTED_LABEL }}
            overridden={draft.isOverridden}
            onReset={() => draft.save(null)}
            ariaLabel={REVIEW_LAUNCH_LABEL.model}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-label text-faint-foreground">{REVIEW_LAUNCH_LABEL.commit}</span>
          <SegmentedTabs
            size="sm"
            options={COMMIT_OPTIONS}
            value={commitStyle}
            onChange={setCommitStyle}
            ariaLabel={REVIEW_LAUNCH_LABEL.commitStyle}
          />
        </div>
      </div>
      <Textarea
        autoFocus
        autoGrow
        maxRows={5}
        value={hint}
        onChange={(event) => setHint(event.target.value)}
        placeholder={REVIEW_LAUNCH_LABEL.hintPlaceholder}
        aria-label={REVIEW_LAUNCH_LABEL.hintLabel}
        disabled={isStarting}
      />
      <p className="text-secondary text-faint-foreground">{launchFactLine({ count, limit })}</p>
      {error !== null && (
        <p role="alert" className="text-secondary text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-secondary text-faint-foreground">
          {REVIEW_LAUNCH_LABEL.remembered}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onClose}>
          {REVIEW_LAUNCH_LABEL.cancel}
          <KbdPill aria-hidden className="ml-1 h-4 min-w-4 text-meta">
            Esc
          </KbdPill>
        </Button>
        <Button size="sm" variant="primary" isBusy={isStarting} onClick={() => void start()}>
          {launchStartLabel({ count })}
          <KbdPill
            aria-hidden
            className="ml-1 h-4 min-w-4 border-on-tone/30 bg-on-tone/15 text-meta text-on-tone"
          >
            {shortcutGlyphs('composer.submit')}
          </KbdPill>
        </Button>
      </div>
    </section>
  );
};
