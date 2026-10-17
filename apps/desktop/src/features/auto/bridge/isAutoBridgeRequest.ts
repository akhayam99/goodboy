import type { AutoBridgeCall, AutoBridgeRequest } from './autoBridgeProtocol';

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

const isTurn = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value['agentId']) &&
  isText(value['sessionId']) &&
  isText(value['workspaceId']) &&
  typeof value['text'] === 'string' &&
  (value['images'] === undefined || Array.isArray(value['images']));

const isCall = (value: unknown): value is AutoBridgeCall => {
  if (!isRecord(value)) {
    return false;
  }
  const kind = value['kind'];
  if (kind === 'stop' || kind === 'retry') {
    return isText(value['treeId']);
  }
  if (kind === 'userTurn') {
    return isTurn(value['turn']);
  }
  if (kind === 'decision') {
    return (
      isText(value['delegationId']) &&
      (value['decision'] === 'confirm' || value['decision'] === 'decline')
    );
  }
  return false;
};

export const isAutoBridgeRequest = (value: unknown): value is AutoBridgeRequest =>
  isRecord(value) && isText(value['id']) && isCall(value['call']);
