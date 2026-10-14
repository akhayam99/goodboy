import { invokeCommand } from '../../shared/lib/invokeCommand';

export const isQueryBridgeServing = async (): Promise<boolean> => {
  try {
    return await invokeCommand<boolean>('query_bridge_serving');
  } catch {
    return false;
  }
};

export const queryBridgeAgentCommand = async (): Promise<string | null> => {
  try {
    return await invokeCommand<string | null>('query_bridge_agent_command');
  } catch {
    return null;
  }
};
