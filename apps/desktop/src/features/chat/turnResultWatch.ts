import { extractClusterDone, extractStepDone, hasBlockingQuestion } from '@goodboy/core';
import type { AgentId, ProviderRunId, TurnEvent } from '@goodboy/types';
import { isTurnActivity } from './isTurnActivity';
import { lingeringTurns } from './lingeringTurns';
import { TURN_END_MS } from './turnEndGrace';

type Params = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId | null;
  readonly stop: () => void;
  readonly finish: () => void;
};

type ObserveParams = {
  readonly event: TurnEvent;
};

type TextParams = {
  readonly text: string;
};

type ArmParams = {
  readonly waitMs: number;
};

const isClosingText = ({ text }: TextParams): boolean =>
  extractStepDone(text) !== null ||
  extractClusterDone(text) !== null ||
  hasBlockingQuestion({ assistantText: text });

const BACKGROUND_NOTE = 'moved to the background';

const mentionsBackground = ({ event }: ObserveParams): boolean => {
  if (event.kind !== 'tool_call_end') {
    return false;
  }
  const output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output);
  return typeof output === 'string' && output.includes(BACKGROUND_NOTE);
};

export const createTurnResultWatch = ({ runId, agentId, stop, finish }: Params) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let text = '';
  let hasBackgroundTask = false;
  let isAfterResult = false;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (agentId !== null) {
      lingeringTurns.clear({ agentId, runId });
    }
  };

  const arm = ({ waitMs }: ArmParams): void => {
    clear();
    if (agentId !== null) {
      lingeringTurns.mark({ agentId, runId });
    }
    timer = setTimeout(() => {
      stop();
      timer = setTimeout(() => {
        timer = null;
        finish();
      }, TURN_END_MS.force);
    }, waitMs);
  };

  const observe = ({ event }: ObserveParams): void => {
    if (isAfterResult && isTurnActivity({ event })) {
      clear();
      isAfterResult = false;
      hasBackgroundTask = false;
      text = '';
    }
    if (event.kind === 'assistant_text') {
      text += event.delta;
    }
    if (mentionsBackground({ event })) {
      hasBackgroundTask = true;
    }
    if (event.kind !== 'done') {
      return;
    }
    isAfterResult = true;
    const isClosed = isClosingText({ text });
    text = '';
    arm({ waitMs: isClosed || !hasBackgroundTask ? TURN_END_MS.grace : TURN_END_MS.background });
  };

  return { observe, clear };
};
