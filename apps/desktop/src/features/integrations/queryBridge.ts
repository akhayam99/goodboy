import { invokeCommand } from '../../shared/lib/invokeCommand';

export const isQueryBridgeServing = async (): Promise<boolean> => {
  try {
    return await invokeCommand<boolean>('query_bridge_serving');
  } catch {
    return false;
  }
};
