import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { usePoll } from '../../../../shared/lib/usePoll';
import { addPickedElements } from '../../addPickedElements';
import { browserHost } from '../../browserHost';
import { isTabGone } from '../../isTabGone';
import type { BrowserPickedElement, BrowserPickRead } from '../../types';

const PICK_PULL_MS = 150;

const AGENT_GONE = 'agent-gone';

const NO_PICKS: ReadonlyArray<BrowserPickedElement> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly liveId: string | null;
  readonly pageTitle: string;
  readonly isShown: boolean;
  readonly onError: (params: ErrorParams) => void;
};

type ErrorParams = {
  readonly error: unknown;
};

type Gesture = {
  readonly token: number;
  readonly liveId: string;
  readonly doc: string;
};

type PendingStart = {
  readonly token: number;
  readonly liveId: string;
};

type TabParams = {
  readonly tabId: string;
};

type TokenParams = {
  readonly token: number;
};

type NoteParams = {
  readonly text: string;
};

type AgentParams = {
  readonly agentId: AgentId;
};

type AnswerParams = {
  readonly gesture: Gesture;
  readonly answer: BrowserPickRead;
};

export type PickTarget = {
  readonly agentId: AgentId;
  readonly name: string;
};

export type ElementPick = {
  readonly canPick: boolean;
  readonly isPicking: boolean;
  readonly isAdding: boolean;
  readonly picks: ReadonlyArray<BrowserPickedElement>;
  readonly note: string;
  readonly agentId: AgentId | null;
  readonly agentName: string | null;
  readonly targets: ReadonlyArray<PickTarget>;
  readonly setNote: (params: NoteParams) => void;
  readonly chooseAgent: (params: AgentParams) => void;
  readonly toggle: () => void;
  readonly leave: () => void;
  readonly add: () => void;
};

type KeyParams = {
  readonly picks: ReadonlyArray<BrowserPickedElement>;
};

const pickKeyOf = ({ picks }: KeyParams): string =>
  picks
    .map((pick) => `${pick.selector}|${pick.isSourceSettled ? 1 : 0}|${pick.source?.line ?? 0}`)
    .join(',');

export const useElementPick = ({
  sessionId,
  liveId,
  pageTitle,
  isShown,
  onError,
}: Params): ElementPick => {
  const [chosenAgent, setChosenAgent] = useState<AgentId | null>(null);
  const target = useHandOutputToAgent({ sessionId, agentId: chosenAgent });
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [picks, setPicks] = useState<ReadonlyArray<BrowserPickedElement>>(NO_PICKS);
  const [note, setNoteText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const tokenRef = useRef(0);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<PendingStart | null>(null);
  const heldRef = useRef<number | null>(null);
  const roundRef = useRef(0);
  const pickKeyRef = useRef('');
  const isReading = useRef(false);
  const liveIdRef = useRef(liveId);
  liveIdRef.current = liveId;
  useMonitorPolling({ isEnabled: gesture !== null });

  const end = useCallback((): void => {
    tokenRef.current += 1;
    gestureRef.current = null;
    pendingRef.current = null;
    roundRef.current = 0;
    pickKeyRef.current = '';
    setGesture(null);
    setPicks(NO_PICKS);
    setNoteText('');
  }, []);

  const stopPage = useCallback(
    ({ tabId }: TabParams): void => {
      void browserHost.pick({ tabId, sessionId, op: 'stop', round: 0 }).catch((error: unknown) => {
        if (!isTabGone({ error })) {
          onError({ error });
        }
      });
    },
    [onError, sessionId],
  );

  const leave = useCallback((): void => {
    const current = gestureRef.current;
    end();
    if (current !== null) {
      stopPage({ tabId: current.liveId });
    }
  }, [end, stopPage]);

  const stopAbandoned = useCallback(
    ({ tabId }: TabParams): void => {
      if (gestureRef.current?.liveId === tabId || pendingRef.current?.liveId === tabId) {
        return;
      }
      stopPage({ tabId });
    },
    [stopPage],
  );

  const settlePending = useCallback(({ token }: TokenParams): void => {
    if (pendingRef.current?.token === token) {
      pendingRef.current = null;
    }
  }, []);

  const apply = useCallback(
    ({ gesture: asked, answer }: AnswerParams): void => {
      if (gestureRef.current?.token !== asked.token || heldRef.current === asked.token) {
        return;
      }
      if (!answer.isHeard || !answer.isOn || answer.doc !== asked.doc) {
        end();
        return;
      }
      roundRef.current = answer.round;
      const key = pickKeyOf({ picks: answer.picks });
      if (key !== pickKeyRef.current) {
        pickKeyRef.current = key;
        setPicks(answer.picks);
      }
    },
    [end],
  );

  const start = useCallback((): void => {
    if (liveId === null || !target.canHandOff) {
      return;
    }
    tokenRef.current += 1;
    const token = tokenRef.current;
    pendingRef.current = { token, liveId };
    void browserHost
      .pick({ tabId: liveId, sessionId, op: 'start', round: 0 })
      .then((answer) => {
        settlePending({ token });
        if (tokenRef.current !== token || liveIdRef.current !== liveId) {
          stopAbandoned({ tabId: liveId });
          return;
        }
        if (!answer.isHeard || !answer.isOn || answer.doc === null) {
          onError({ error: new Error('pick-unavailable') });
          return;
        }
        const started = { token, liveId, doc: answer.doc };
        gestureRef.current = started;
        roundRef.current = answer.round;
        setGesture(started);
      })
      .catch((failure: unknown) => {
        settlePending({ token });
        const isCurrent = tokenRef.current === token;
        if (!isTabGone({ error: failure })) {
          stopAbandoned({ tabId: liveId });
        }
        if (isCurrent) {
          onError({ error: failure });
        }
      });
  }, [liveId, onError, sessionId, settlePending, stopAbandoned, target.canHandOff]);

  usePoll({
    run: () => {
      const asked = gestureRef.current;
      if (asked === null || isReading.current || heldRef.current === asked.token) {
        return;
      }
      isReading.current = true;
      void browserHost
        .pick({ tabId: asked.liveId, sessionId, op: 'read', round: roundRef.current })
        .then((answer) => apply({ gesture: asked, answer }))
        .catch((error: unknown) => {
          if (gestureRef.current?.token !== asked.token || heldRef.current === asked.token) {
            return;
          }
          leave();
          if (!isTabGone({ error })) {
            onError({ error });
          }
        })
        .finally(() => {
          isReading.current = false;
        });
    },
    everyMs: PICK_PULL_MS,
    isEnabled: gesture !== null,
    gate: 'visible',
    restartKey: gesture === null ? '' : String(gesture.token),
  });

  useEffect(() => {
    const current = gestureRef.current ?? pendingRef.current;
    if (current !== null && (current.liveId !== liveId || !isShown)) {
      leave();
    }
  }, [isShown, leave, liveId]);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      pendingRef.current = null;
      const current = gestureRef.current;
      if (current !== null) {
        void Promise.allSettled([
          browserHost.pick({ tabId: current.liveId, sessionId, op: 'stop', round: 0 }),
        ]);
      }
    },
    [sessionId],
  );

  const add = useCallback((): void => {
    const asked = gestureRef.current;
    const agentId = target.agentId;
    if (asked === null || agentId === null || picks.length === 0 || isAdding) {
      return;
    }
    const elements = picks;
    const text = note;
    const title = pageTitle;
    const queue = target.queue;
    heldRef.current = asked.token;
    setIsAdding(true);
    void addPickedElements({
      sessionId,
      tabId: asked.liveId,
      doc: asked.doc,
      agentId,
      elements,
      note: text,
      pageTitle: title,
      queue,
      isTabStill: () => liveIdRef.current === asked.liveId,
    })
      .then((result) => {
        if (result === 'agent-gone') {
          onError({ error: new Error(AGENT_GONE) });
          return;
        }
        if (gestureRef.current?.token === asked.token) {
          end();
        }
      })
      .catch((failure: unknown) => onError({ error: failure }))
      .finally(() => setIsAdding(false));
  }, [end, isAdding, note, onError, pageTitle, picks, sessionId, target.agentId, target.queue]);

  return {
    canPick: liveId !== null && target.canHandOff,
    isPicking: gesture !== null,
    isAdding,
    picks,
    note,
    agentId: target.agentId,
    agentName: target.agentName,
    targets: phaseRuns.map((run) => ({ agentId: run.id, name: run.name })),
    setNote: ({ text }) => setNoteText(text),
    chooseAgent: ({ agentId }) => setChosenAgent(agentId),
    toggle: () => {
      if (gestureRef.current !== null) {
        leave();
        return;
      }
      start();
    },
    leave,
    add,
  };
};
