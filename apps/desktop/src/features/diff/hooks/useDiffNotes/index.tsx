import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { AgentId, DiffComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, agentPlace } from '../../../../store';
import { useAskAgent } from '../useAskAgent';
import type { DiffComments, DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
};

export type DiffNotes = {
  readonly comments: DiffComments;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly openNotes: ReadonlyArray<DiffComment>;
};

type ThreadParams = {
  readonly note: DiffComment;
  readonly agentName: string | null;
  readonly onViewAgent: (agentId: AgentId) => void;
};

export const noteThread = ({ note, agentName, onViewAgent }: ThreadParams): DiffThread => {
  const consumedBy = note.consumedByAgentId ?? null;
  return {
    id: note.id,
    filePath: note.filePath,
    anchor: note.anchor ?? null,
    body: note.body,
    tone: note.status === 'consumed' ? 'info' : 'primary',
    author: 'You',
    isAgent: false,
    createdAt: note.createdAt,
    statusLabel:
      note.status === 'resolved'
        ? 'Resolved'
        : note.status === 'consumed'
          ? 'With agent'
          : 'Open note',
    isResolved: note.status === 'resolved',
    canEdit: false,
    canResolve: note.status === 'open',
    canReopen: note.status !== 'open',
    footer:
      note.status === 'consumed' ? (
        consumedBy !== null && agentName !== null ? (
          <button
            type="button"
            onClick={() => onViewAgent(consumedBy)}
            className="inline-flex w-fit items-center gap-0.5 rounded-sm text-2xs text-info hover:underline"
          >
            Picked up by {agentName}
            <ArrowUpRight size={10} aria-hidden />
          </button>
        ) : (
          <span className="text-2xs text-muted-foreground">Picked up by a removed agent</span>
        )
      ) : undefined,
  };
};

export const useDiffNotes = ({ sessionId }: Params): DiffNotes => {
  const notes = useDiffComments(sessionId);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const addDiffComment = useAppStore((s) => s.addDiffComment);
  const resolveDiffComment = useAppStore((s) => s.resolveDiffComment);
  const reopenDiffComment = useAppStore((s) => s.reopenDiffComment);
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment);
  const navigate = useAppStore((s) => s.navigate);
  const askAgent = useAskAgent({ sessionId });

  const comments = useMemo<DiffComments>(() => {
    const names = new Map(phaseRuns.map((run) => [run.id, run.name] as const));
    const onViewAgent = (agentId: AgentId) => {
      navigate({ to: agentPlace({ sessionId, agentId }) });
    };
    return {
      threads: notes.map((note) =>
        noteThread({
          note,
          agentName: note.consumedByAgentId ? (names.get(note.consumedByAgentId) ?? null) : null,
          onViewAgent,
        }),
      ),
      submitLabel: 'Add note',
      composerLabel: 'Note',
      allowFileLevel: true,
      onSubmit: (filePath, anchor, body) =>
        void addDiffComment(sessionId, filePath, body, anchor ?? undefined),
      onAskAgent: askAgent,
      onResolve: (id) => void resolveDiffComment(sessionId, id),
      onReopen: (id) => void reopenDiffComment(sessionId, id),
      onDelete: (id) => void deleteDiffComment(sessionId, id),
    };
  }, [
    addDiffComment,
    askAgent,
    deleteDiffComment,
    notes,
    phaseRuns,
    reopenDiffComment,
    resolveDiffComment,
    navigate,
    sessionId,
  ]);

  const openNotes = useMemo(() => notes.filter((note) => note.status === 'open'), [notes]);

  return { comments, notes, openNotes };
};
