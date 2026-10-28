import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { trimTrailingSeparators } from '../../../../../store/slices/terminal/terminalOwner';
import { useNow } from '../../../../../shared/hooks/useNow';
import { queueEstimate } from '../queueEstimate';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

type WaitingWriter =
  | Readonly<{ kind: 'this-session' }>
  | Readonly<{ kind: 'unknown' }>
  | Readonly<{ kind: 'session'; sessionTitle: string }>;

export type WriterWaitView = Readonly<{
  folderName: string | null;
  partName?: string;
  writer: WaitingWriter;
  minutes: number | null;
}>;

const NO_EVENTS: ReadonlyArray<never> = [];

export const useWriterWait = ({ sessionId, agentId }: Params): WriterWaitView | null => {
  const wait = useAppStore((state) =>
    agentId === null ? undefined : state.agentWriterWait[agentId],
  );
  const holder = wait?.blockedBy ?? null;
  const folderName = useAppStore((state) => {
    if (wait === undefined) {
      return null;
    }
    const blocked = trimTrailingSeparators({ path: wait.blockedPath });
    for (const project of state.projects) {
      if (
        project.kind === 'folder' &&
        trimTrailingSeparators({ path: project.rootPath }) === blocked
      ) {
        return project.name;
      }
    }
    return null;
  });
  const holderAgent = useAppStore((state) => {
    if (holder === null) {
      return null;
    }
    for (const runs of Object.values(state.sessionPhaseRuns)) {
      const found = runs.find((run) => run.id === holder);
      if (found !== undefined) {
        return found;
      }
    }
    return null;
  });
  const holderSessionId = holderAgent?.sessionId ?? null;
  const holderTitle = useAppStore((state) =>
    holderSessionId === null ? null : (sessionById(state.sessions, holderSessionId)?.goal ?? null),
  );
  const holderTurn = useAppStore((state) =>
    holderAgent === null ? undefined : state.agentTurnState[holderAgent.id],
  );
  const holderEvents = useAppStore((state) =>
    holderAgent === null ? NO_EVENTS : (state.transcripts[holderAgent.id] ?? NO_EVENTS),
  );
  const nowMs = useNow(30_000, wait !== undefined);
  if (wait === undefined) {
    return null;
  }
  const isRunning = holderTurn?.kind === 'running';
  const minutes = queueEstimate({
    events: holderEvents,
    runningRunId: isRunning ? holderTurn.runId : null,
    runningSinceMs: isRunning ? Date.parse(holderTurn.startedAt) : null,
    nowMs,
  });
  const writer: WaitingWriter =
    holderSessionId === sessionId
      ? { kind: 'this-session' }
      : holderTitle === null || holderTitle.trim() === ''
        ? { kind: 'unknown' }
        : { kind: 'session', sessionTitle: holderTitle };
  return {
    folderName,
    ...(wait.blockedPart !== undefined && { partName: wait.blockedPart }),
    writer,
    minutes,
  };
};
