import { brandId, type AutoRequestId } from '@goodboy/types';
import { delegationReceipt } from './delegationReceipt';
import type { AgentCommand, BridgeOutcome } from './ports';
import { refuseOutcome } from './refuseOutcome';
import type { AgentVerbContext } from './verbContext';

export type RequestStatusParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

export const requestStatus = async ({
  ctx,
  command,
}: RequestStatusParams): Promise<BridgeOutcome> => {
  const raw = command.args['request-id'];
  const requestId = typeof raw === 'string' ? raw.trim() : '';
  if (requestId === '') {
    return refuseOutcome({ code: 'spec_invalid', message: 'request-status needs --request-id' });
  }
  const receipt = await delegationReceipt({
    db: ctx.db,
    treeId: command.grant.treeId,
    requestId: brandId<AutoRequestId>({ value: requestId }),
  });
  if (receipt === null) {
    return { isOk: true, data: { status: 'not_found', requestId } };
  }
  return { isOk: true, data: { status: 'accepted', ...receipt } };
};
