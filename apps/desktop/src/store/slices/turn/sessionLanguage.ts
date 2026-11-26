import type { Agent, Session, SessionId, TurnEvent, Workflow, WorkflowRunId } from '@goodboy/types';
import { sessionLanguageTurnRule } from '@goodboy/core/language';

const FIRST_MESSAGE_MAX_LENGTH = 280;

type OwnWordsParams = {
  readonly session: Session;
  readonly transcript?: ReadonlyArray<TurnEvent>;
};

export const sessionOwnWordsOf = ({ session, transcript = [] }: OwnWordsParams): string => {
  if (session.titleUserEdited) {
    return session.goal.trim();
  }
  for (const event of transcript) {
    const isOperatorText =
      (event.kind === 'user_text' && event.deliveredBy == null) || event.kind === 'operator_text';
    if (!isOperatorText) {
      continue;
    }
    const written = event.text.trim();
    if (written.length > 0) {
      return written.slice(0, FIRST_MESSAGE_MAX_LENGTH);
    }
  }
  const goalSlot = session.contextSlots.find((slot) => slot.key === 'goal' && slot.enabled);
  const slotText = goalSlot?.value.trim() ?? '';
  if (slotText.length > 0) {
    return slotText.slice(0, FIRST_MESSAGE_MAX_LENGTH);
  }
  return session.goal.trim();
};

type TranscriptParams = {
  readonly state: {
    readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
    readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  };
  readonly sessionId: SessionId;
  readonly isLastTextMachine?: boolean;
};

export const sessionTranscriptOf = ({
  state,
  sessionId,
  isLastTextMachine = false,
}: TranscriptParams): ReadonlyArray<TurnEvent> => {
  const events = [...(state.sessionPhaseRuns[sessionId] ?? [])]
    .sort((left, right) => (left.ordinal ?? 0) - (right.ordinal ?? 0))
    .flatMap((agent) => state.transcripts[agent.id] ?? []);
  if (!isLastTextMachine) {
    return events;
  }
  const lastText = events.map((event) => event.kind).lastIndexOf('user_text');
  return events.filter((_event, index) => index !== lastText);
};

type SourceParams = {
  readonly session: Session;
  readonly transcript?: ReadonlyArray<TurnEvent>;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly workflowRunId?: WorkflowRunId;
};

export const resolveSessionLanguageGoal = ({
  session,
  transcript,
  workflows,
  workflowRunId,
}: SourceParams): string => {
  const run =
    workflowRunId == null
      ? undefined
      : session.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  const runGoal = run?.goal?.trim() ?? '';
  if (runGoal.length > 0) {
    return runGoal;
  }
  const template =
    run == null ? undefined : workflows.find((candidate) => candidate.id === run.workflowId);
  const templateGoal = template?.goal?.trim() ?? '';
  if (templateGoal.length > 0) {
    return templateGoal;
  }
  return sessionOwnWordsOf({ session, ...(transcript != null && { transcript }) });
};

export type SessionLanguageAnchor = {
  readonly source: 'goal' | 'message';
  readonly text: string;
};

type GuardParams = {
  readonly anchor: SessionLanguageAnchor;
};

export const buildSessionLanguageGuard = ({ anchor }: GuardParams): string => {
  const trimmed = anchor.text.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const header =
    anchor.source === 'goal'
      ? 'The operator stated the goal of this session as:'
      : 'The operator last wrote to this session:';
  return [
    '[session-language]',
    header,
    trimmed,
    sessionLanguageTurnRule({ anchorLabel: anchor.source, anchorText: trimmed }),
    '[/session-language]',
  ].join('\n');
};
