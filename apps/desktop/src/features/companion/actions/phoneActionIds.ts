import type { ActionId } from '../contract/primitives';
import type { TrainRequestEntry } from '../contract/actions';
import { sendSequenceOf } from './sendSequence';
import { startSequenceOf, trainSequenceOf } from './startState';
import { digestOf } from './versions';

type MergeParams = {
  readonly prNumber: number;
  readonly headSha: string;
};

export const mergePrActionIdOf = ({ prNumber, headSha }: MergeParams): ActionId =>
  `act:mergePr:${prNumber}:${headSha}`;

type StartParams = {
  readonly workspaceId: string;
};

export const startActionIdOf = ({ workspaceId }: StartParams): ActionId =>
  `act:startSession:${workspaceId}:${startSequenceOf({ workspaceId })}`;

type TrainParams = {
  readonly workspaceId: string;
  readonly entries: ReadonlyArray<TrainRequestEntry>;
};

export const trainActionIdOf = ({ workspaceId, entries }: TrainParams): ActionId => {
  const key = entries
    .map((entry) => `${entry.sessionId}#${entry.prNumber}@${entry.expectedHeadSha}`)
    .join(',');
  return `act:mergeTrain:${workspaceId}:${digestOf({ text: key })}.${trainSequenceOf()}`;
};

type StopParams = {
  readonly trainId: string;
};

export const stopTrainActionIdOf = ({ trainId }: StopParams): ActionId =>
  `act:stopTrain:${trainId}:stop`;

type ChatParams = {
  readonly chatId: string;
};

type ChatVersionParams = ChatParams & {
  readonly version: string;
};

export const chatSendKeyOf = ({ chatId }: ChatParams): string => `chat:${chatId}`;

export const chatSendVersionOf = ({ chatId }: ChatParams): string =>
  sendSequenceOf({ agentId: chatSendKeyOf({ chatId }) });

export const sendChatActionIdOf = ({ chatId, version }: ChatVersionParams): ActionId =>
  `act:sendChatMessage:${chatId}:${version}`;

type WorkspaceParams = {
  readonly workspaceId: string;
};

export const chatCreateKeyOf = ({ workspaceId }: WorkspaceParams): string =>
  `create-chat:${workspaceId}`;

export const chatCreateVersionOf = ({ workspaceId }: WorkspaceParams): string =>
  sendSequenceOf({ agentId: chatCreateKeyOf({ workspaceId }) });

export const createChatActionIdOf = ({ workspaceId }: WorkspaceParams): ActionId =>
  `act:createChat:${workspaceId}:${chatCreateVersionOf({ workspaceId })}`;
