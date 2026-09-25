import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import {
  AnchoredPopover,
  Button,
  cn,
  PopoverBody,
  PopoverFooter,
  Textarea,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionResolveStyle } from '../../../../store/sessionReplySettings';
import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../../../store/slices/session-view';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { CommentThread } from '../../../github/comment-threads';
import type { AgentKindRouting } from '../../../session/agent-kind';
import { useSuggestedRouting } from '../../../session/hooks/useSuggestedRouting';
import { isSameRouting } from '../../../session/isSameRouting';
import { resolveAgentCount, startResolve } from '../../startResolve';
import {
  RESOLVE_QUEUE_ACTION_LABEL,
  resolveAgentsLine,
  resolveCountLabel,
  resolvePopoverHeading,
  resolveWithLabel,
} from '../../resolveQueueCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly label: string;
  readonly isDisabled?: boolean;
  readonly disabledReason?: string;
  readonly onStarted?: () => void;
};

export const ResolveWithPopover = ({
  sessionId,
  threads,
  label,
  isDisabled = false,
  disabledReason,
  onStarted,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 460,
    expectedWidth: 360,
    width: 'w-[22.5rem] max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const pr = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const lastRouting = useAppStore(
    (state) => (state.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW).lastRouting,
  );
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const setAgentConfig = useAppStore((state) => state.setAgentConfig);
  const resolveStyle = useAppStore(
    useShallow((state) => sessionResolveStyle({ state, sessionId })),
  );
  const setResolveQueueView = useAppStore((state) => state.setResolveQueueView);
  const reportError = useAppStore((state) => state.reportError);
  const suggested = useSuggestedRouting({ sessionId, role: 'resolver' });
  const defaultRouting = lastRouting ?? suggested.routing;
  const lastUsed =
    lastRouting != null && !isSameRouting({ left: lastRouting, right: suggested.routing })
      ? lastRouting
      : null;
  const [draft, setDraft] = useState<AgentKindRouting | null>(null);
  const [note, setNote] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);
  const chosen = draft ?? suggested.routing;
  const count = threads.length;
  const canStart = pr !== null && count > 0 && !isDisabled && !isStarting;

  useEffect(() => {
    if (open) {
      return;
    }
    setDraft(null);
    setNote('');
  }, [open]);

  const start = async ({
    routing,
    hint,
  }: {
    readonly routing: AgentKindRouting;
    readonly hint: string;
  }): Promise<void> => {
    if (pr === null || count === 0 || isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;
    setIsStarting(true);
    try {
      await startResolve({
        sessionId,
        threads,
        pr,
        routing,
        note: hint,
        style: resolveStyle,
        spawnAgent,
        setAgentConfig,
      });
      setResolveQueueView({ sessionId, patch: { lastRouting: routing } });
      close();
      onStarted?.();
    } catch (error) {
      void reportError({ title: "Couldn't start the resolve", error, sessionId });
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  const summaryOf = (routing: AgentKindRouting): string =>
    recommendationSummary({
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
    });

  const agents =
    pr === null || count === 0 ? 1 : resolveAgentCount({ threads, pr, routing: chosen, note });

  return (
    <div className="inline-flex min-w-0 items-stretch">
      <Tooltip
        content={
          isDisabled && disabledReason != null
            ? disabledReason
            : resolveWithLabel({ summary: summaryOf(defaultRouting) })
        }
        anchorClassName="flex"
      >
        <Button
          size="sm"
          variant="primary"
          className="rounded-r-none"
          disabled={!canStart}
          isBusy={isStarting && !open}
          onClick={() => void start({ routing: defaultRouting, hint: '' })}
        >
          {label}
        </Button>
      </Tooltip>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={resolvePopoverHeading({ count })}
        className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
        anchorClassName="flex shrink-0"
        trigger={
          <Tooltip content={RESOLVE_QUEUE_ACTION_LABEL.resolveOptions} anchorClassName="flex">
            <Button
              size="sm"
              variant="primary"
              onClick={toggle}
              disabled={!canStart && !open}
              aria-label={RESOLVE_QUEUE_ACTION_LABEL.resolveOptions}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="rounded-l-none border-l-on-tone/25 px-1.5"
            >
              <ChevronDown
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('shrink-0 motion-safe:transition-transform', open && 'rotate-180')}
              />
            </Button>
          </Tooltip>
        }
      >
        <PopoverBody>
          <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-foreground">
            {resolvePopoverHeading({ count })}
          </p>
          <RoutingPickerBody
            connectedProviders={connectedProviders}
            onClose={close}
            recommendation={{
              ...suggested.routing,
              label: SUGGESTED_LABEL,
              reason: suggested.reason,
            }}
            overridden={draft !== null}
            {...(lastUsed != null && {
              lastUsed: {
                routing: lastUsed,
                active: draft !== null && isSameRouting({ left: draft, right: lastUsed }),
                onSelect: () => setDraft(lastUsed),
              },
            })}
            provider={chosen.provider}
            model={chosen.model}
            effort={{
              editable: true,
              value: chosen.effort,
              onChange: (effort) =>
                setDraft((current) => ({ ...(current ?? suggested.routing), effort })),
            }}
            onProvider={(provider) => {
              if (provider === '') {
                setDraft(null);
                return;
              }
              setDraft((current) => ({ ...(current ?? suggested.routing), provider }));
            }}
            onModel={(model) =>
              setDraft((current) => {
                const base = current ?? suggested.routing;
                return {
                  ...base,
                  model,
                  effort: clampEffortForModel({ model, effort: base.effort }) ?? base.effort,
                };
              })
            }
          />
          <div className="px-2.5 py-2">
            <Textarea
              aria-label={RESOLVE_QUEUE_ACTION_LABEL.note}
              placeholder={RESOLVE_QUEUE_ACTION_LABEL.note}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              minRows={1}
              maxRows={6}
              autoGrow
              disabled={isStarting}
            />
          </div>
        </PopoverBody>
        <PopoverFooter className="flex items-center justify-end gap-2 px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate text-2xs text-faint-foreground">
            {resolveAgentsLine({ agents, count })}
          </span>
          <Button
            size="sm"
            disabled={!canStart}
            isBusy={isStarting}
            onClick={() => void start({ routing: chosen, hint: note })}
          >
            {resolveCountLabel({ count })}
          </Button>
        </PopoverFooter>
      </AnchoredPopover>
    </div>
  );
};
