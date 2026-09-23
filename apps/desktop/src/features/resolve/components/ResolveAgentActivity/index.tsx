import { useMemo } from 'react';
import { Activity, Square } from 'lucide-react';
import {
  CardAction,
  CardActionSlot,
  MetaRow,
  SectionHeader,
  cn,
  formatUsd,
  Eyebrow,
} from '@goodboy/ui';
import { stripControlMarkers } from '@goodboy/core';
import type { Agent, ResolveAttempt, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useTranscript } from '../../../../store/transcript';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { RESOLVE_ITEM_LABEL, attemptPhaseLabel, sharedRunCostLabel } from '../../resolveItemCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly attempt: ResolveAttempt;
  readonly costUsd: number | null;
  readonly runThreadCount: number;
  readonly isViewActionShown: boolean;
  readonly onViewAgent: () => void;
  readonly onStop: () => void;
};

const PREVIEW_LINES = 3;

const previewOf = ({ text }: { readonly text: string }): string => {
  const lines = stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.slice(0, PREVIEW_LINES).join('\n');
};

export const ResolveAgentActivity = ({
  sessionId,
  attempt,
  costUsd,
  runThreadCount,
  isViewActionShown,
  onViewAgent,
  onStop,
}: Props) => {
  const transcript = useTranscript(attempt.agentId);
  const outputSummary = useAppStore(
    (s) =>
      (s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === attempt.agentId,
      )?.outputSummary ?? null,
  );
  const turnState = useAppStore((s) => s.agentTurnState[attempt.agentId] ?? null);
  const isRunning = attempt.phase === 'running';
  const lastAssistantText = useMemo(() => {
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return item.text.trim();
      }
    }
    return '';
  }, [transcript]);
  const summary = outputSummary?.trim() ?? '';
  const preview =
    lastAssistantText === ''
      ? summary === ''
        ? ''
        : previewOf({ text: summary })
      : previewOf({ text: lastAssistantText });
  const phase =
    isRunning && turnState?.kind === 'blocked'
      ? RESOLVE_ITEM_LABEL.waitingOnYou
      : attemptPhaseLabel({ phase: attempt.phase });

  return (
    <div className="group/resolve-run flex min-w-0 flex-col gap-2">
      <SectionHeader
        label={RESOLVE_ITEM_LABEL.run}
        headingLevel={3}
        action={
          <CardActionSlot label="Run actions">
            {isViewActionShown && (
              <CardAction
                icon={Activity}
                label={RESOLVE_ITEM_LABEL.viewWork}
                onClick={onViewAgent}
              />
            )}
            {isRunning && (
              <CardAction icon={Square} label={RESOLVE_ITEM_LABEL.stop} onClick={onStop} />
            )}
          </CardActionSlot>
        }
      />
      <p
        className={cn(
          'w-fit rounded-md text-xs leading-4 text-foreground',
          isRunning && 'spin-border spin-border-info px-2 py-1',
        )}
      >
        {phase}
      </p>
      {preview !== '' && (
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow label={RESOLVE_ITEM_LABEL.latest} />
          <p className="min-w-0 max-w-[65ch] whitespace-pre-line break-words text-xs leading-4 text-muted-foreground">
            {preview}
          </p>
        </div>
      )}
      <MetaRow
        className="text-3xs"
        items={[
          <span key="model" className="font-mono">
            {attempt.model}
          </span>,
          attempt.provider,
          attempt.effort === null ? null : `effort ${attempt.effort}`,
          costUsd === null ? (
            <span key="cost">{RESOLVE_ITEM_LABEL.costUnavailable}</span>
          ) : (
            <span key="cost" className="tabular-nums">
              {runThreadCount > 1
                ? sharedRunCostLabel({ cost: formatUsd(costUsd), count: runThreadCount })
                : formatUsd(costUsd)}
            </span>
          ),
        ]}
      />
    </div>
  );
};
