import type { AutoBridgeCall, AutoBridgeRequest } from './autoBridgeProtocol';
import { isRecord } from '@goodboy/types/helpers';

const PUBLISH_ACTS = ['confirm', 'decline', 'retry', 'put_back'] as const;

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
  if (kind === 'sendNow') {
    return isText(value['treeId']) && isText(value['rowId']);
  }
  if (kind === 'rerunChecks') {
    return isText(value['delegationId']);
  }
  if (kind === 'publish') {
    const ids = value['delegationIds'];
    return (
      PUBLISH_ACTS.some((act) => act === value['act']) &&
      Array.isArray(ids) &&
      ids.length > 0 &&
      ids.every(isText)
    );
  }
  if (kind === 'userTurn') {
    return isText(value['messageId']) && isTurn(value['turn']);
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
