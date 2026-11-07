import { CHECK_STATE, READ_FAILED } from '../../slices/notifications/errorRecovery';
import { brandId } from '@goodboy/types';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MessageAttachment,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { askDenialEventOf } from '../../slices/permissions/askDenialEventOf';
import { deniedPromptOf } from '../../slices/permissions/deniedPromptOf';
import { heldOnceAllowsOf } from '../../slices/permissions/heldOnceAllowsOf';
import { resolvedAsksAtWrite } from '../../slices/permissions/resolvedAsksAtWrite';
import { scopedReadGrantsOf } from '../../slices/permissions/scopedReadGrantsOf';
import { withHeldAnswers } from '../../slices/permissions/withHeldAnswers';
import { storeAutoImages } from './storeAutoImages';
import type { ReportErrorParams } from '../../slices/notifications/reportError';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { sessionById } from '../../slices/sessions/sessionIndex';
import { ReportedError } from '../../slices/notifications/reportedError';
import { AUTO_CONFINED_ROLE } from '../../slices/turn/confinedRoleOf';
import type { SendTurnInput, SendTurnResult } from '../../slices/turn/types';
import { AUTO_STARTING_SENTENCE } from '../../../features/auto/autoStartingSentence';

type LoadTreesParams = {
  readonly sessionId: SessionId;
};

type AutoTurnState = Readonly<{
  sessions: ReadonlyArray<Pick<Session, 'id' | 'workspaceId'>>;
  sessionPhaseRuns: Readonly<
    Record<SessionId, ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'parentAgentId'>>>
  >;
  selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  transcripts: Readonly<Record<AgentId, ReadonlyArray<TurnEvent>>>;
  agentTurnState: Readonly<Record<AgentId, TurnState>>;
  reportError: (params: ReportErrorParams) => Promise<void>;
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
  loadAutoTrees: (params: LoadTreesParams) => Promise<void>;
}>;

export type RouteAutoUserTurnParams = Readonly<{
  get: () => AutoTurnState;
  input: SendTurnInput;
  storeImages?: typeof storeAutoImages;
}>;

const AUTO_ATTACHMENTS_MESSAGE = 'Auto takes images in a message, not other files yet.';
const AUTO_IMAGES_LOST_MESSAGE = 'Auto could not keep the images. Attach them again.';
const AUTO_MESSAGE_LOST_MESSAGE = 'Auto could not take your message. Send it again in a moment.';

const AUTO_NO_RUNTIME_MESSAGE = AUTO_STARTING_SENTENCE;

const REFUSED_TITLE = "Auto didn't get your message";

type RefuseParams = {
  readonly get: () => AutoTurnState;
  readonly input: SendTurnInput;
  readonly message: string;
};

const refuse = async ({ get, input, message }: RefuseParams): Promise<never> => {
  const error = new ReportedError(message);
  await get().reportError({
    recovery: CHECK_STATE,
    title: REFUSED_TITLE,
    error,
    sessionId: input.sessionId,
  });
  throw error;
};

const QUEUED: SendTurnResult = { blockedOverBudget: false };

type DeniedParams = {
  readonly get: () => AutoTurnState;
  readonly input: SendTurnInput;
  readonly agentId: AgentId;
};

const askDenialOf = ({ get, input, agentId }: DeniedParams) => {
  const { transcripts, agentTurnState } = get();
  const { denied: asks, held } = resolvedAsksAtWrite({
    events: transcripts[agentId] ?? [],
    turnState: agentTurnState[agentId],
    origin: input.origin,
    given: input.resolvedAsks,
  });
  const denied = deniedPromptOf({ asks, content: input.content, prompt: input.content });
  return {
    asks,
    text: withHeldAnswers({ held, prompt: denied }),
    grants: scopedReadGrantsOf({
      grants: [...(input.permissionOnceAllows ?? []), ...heldOnceAllowsOf({ held })],
    }),
  };
};

type StoreImages = typeof storeAutoImages;

type KeepParams = {
  readonly get: () => AutoTurnState;
  readonly input: SendTurnInput;
  readonly storeImages: StoreImages;
};

const keptImages = async ({
  get,
  input,
  storeImages,
}: KeepParams): Promise<ReadonlyArray<MessageAttachment>> => {
  try {
    return await storeImages({ sessionId: input.sessionId, images: input.attachments ?? [] });
  } catch (cause) {
    await get().reportError({
      recovery: CHECK_STATE,
      title: REFUSED_TITLE,
      error: cause,
      sessionId: input.sessionId,
    });
    throw new ReportedError(AUTO_IMAGES_LOST_MESSAGE);
  }
};

export const routeAutoUserTurn = async ({
  get,
  input,
  storeImages = storeAutoImages,
}: RouteAutoUserTurnParams): Promise<SendTurnResult | null> => {
  if (input.origin !== undefined && input.origin !== 'operator') {
    return null;
  }
  const state = get();
  const agentId = input.agentId ?? state.selectedAgentId[input.sessionId] ?? null;
  if (agentId === null) {
    return null;
  }
  const agent = (state.sessionPhaseRuns[input.sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (
    agent === undefined ||
    agent.kind !== AUTO_CONFINED_ROLE ||
    agent.parentAgentId !== undefined
  ) {
    return null;
  }
  const session = sessionById(state.sessions, input.sessionId);
  if (session === undefined) {
    return null;
  }
  const port = currentAutoUserTurnPort();
  if (port === null) {
    return refuse({ get, input, message: AUTO_NO_RUNTIME_MESSAGE });
  }
  const given = input.attachments ?? [];
  if (given.some((attachment) => !attachment.mimeType.startsWith('image/'))) {
    return refuse({ get, input, message: AUTO_ATTACHMENTS_MESSAGE });
  }
  const images = await keptImages({ get, input, storeImages });
  const queued: { outboxId: string | null; isRepeat: boolean } = {
    outboxId: null,
    isRepeat: false,
  };
  const denial = askDenialOf({ get, input, agentId });
  const result = await port({
    agentId,
    sessionId: input.sessionId,
    workspaceId: session.workspaceId,
    text: denial.text,
    ...(images.length > 0 && { images }),
    ...(denial.grants.length > 0 && { permissionOnceAllows: denial.grants }),
    ...(input.deliveryId !== undefined && { deliveryId: input.deliveryId }),
    onQueued: ({ rowId, isRepeat = false }) => {
      queued.outboxId = rowId;
      queued.isRepeat = isRepeat;
    },
  });
  if (result === 'lost') {
    return refuse({ get, input, message: AUTO_MESSAGE_LOST_MESSAGE });
  }
  const deniedAt = brandId<IsoDateTime>({ value: new Date().toISOString() });
  for (const ask of denial.asks) {
    state.appendTurnEvent(
      agentId,
      input.sessionId,
      askDenialEventOf({
        runId: ask.runId,
        toolUseId: ask.toolUseId,
        reason: input.content,
        at: deniedAt,
      }),
    );
  }
  await state.loadAutoTrees({ sessionId: input.sessionId }).catch((error: unknown) =>
    state.reportError({
      recovery: READ_FAILED,
      title: "Couldn't read the Auto agents",
      error,
      sessionId: input.sessionId,
    }),
  );
  if (!queued.isRepeat) {
    state.appendTurnEvent(agentId, input.sessionId, {
      kind: 'operator_text',
      runId: brandId<ProviderRunId>({ value: `operator-${crypto.randomUUID()}` }),
      text: input.content,
      ...(images.length > 0 && { attachments: images }),
      ...(queued.outboxId !== null && { outboxId: queued.outboxId }),
      at: brandId<IsoDateTime>({ value: new Date().toISOString() }),
    });
  }
  input.onStarted?.();
  return QUEUED;
};
