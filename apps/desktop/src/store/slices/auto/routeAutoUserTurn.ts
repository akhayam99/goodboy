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
} from '@goodboy/types';
import { storeAutoImages } from './storeAutoImages';
import type { ReportErrorParams } from '../notifications/reportError';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { sessionById } from '../sessions/sessionIndex';
import { ReportedError } from '../notifications/reportedError';
import { AUTO_CONFINED_ROLE } from '../turn/confinedRoleOf';
import type { SendTurnInput, SendTurnResult } from '../turn/types';

type AutoTurnState = Readonly<{
  sessions: ReadonlyArray<Pick<Session, 'id' | 'workspaceId'>>;
  sessionPhaseRuns: Readonly<
    Record<SessionId, ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'parentAgentId'>>>
  >;
  selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  reportError: (params: ReportErrorParams) => Promise<void>;
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
}>;

export type RouteAutoUserTurnParams = Readonly<{
  get: () => AutoTurnState;
  input: SendTurnInput;
  storeImages?: typeof storeAutoImages;
}>;

const AUTO_ATTACHMENTS_MESSAGE = 'Auto takes images in a message, not other files yet.';
const AUTO_IMAGES_LOST_MESSAGE = 'Auto could not keep the images. Attach them again.';
const AUTO_MESSAGE_LOST_MESSAGE = 'Auto could not take your message. Send it again in a moment.';

const REFUSED_TITLE = "Auto didn't get your message";

type RefuseParams = {
  readonly get: () => AutoTurnState;
  readonly input: SendTurnInput;
  readonly message: string;
};

const refuse = async ({ get, input, message }: RefuseParams): Promise<never> => {
  const error = new ReportedError(message);
  await get().reportError({ title: REFUSED_TITLE, error, sessionId: input.sessionId });
  throw error;
};

const QUEUED: SendTurnResult = { blockedOverBudget: false };

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
    await get().reportError({ title: REFUSED_TITLE, error: cause, sessionId: input.sessionId });
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
  const port = currentAutoUserTurnPort();
  if (port === null) {
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
  const given = input.attachments ?? [];
  if (given.some((attachment) => !attachment.mimeType.startsWith('image/'))) {
    return refuse({ get, input, message: AUTO_ATTACHMENTS_MESSAGE });
  }
  const images = await keptImages({ get, input, storeImages });
  const result = await port({
    agentId,
    sessionId: input.sessionId,
    workspaceId: session.workspaceId,
    text: input.content,
    ...(images.length > 0 && { images }),
  });
  if (result === 'lost') {
    return refuse({ get, input, message: AUTO_MESSAGE_LOST_MESSAGE });
  }
  state.appendTurnEvent(agentId, input.sessionId, {
    kind: 'operator_text',
    runId: brandId<ProviderRunId>({ value: `operator-${crypto.randomUUID()}` }),
    text: input.content,
    ...(images.length > 0 && { attachments: images }),
    at: brandId<IsoDateTime>({ value: new Date().toISOString() }),
  });
  input.onStarted?.();
  return QUEUED;
};
