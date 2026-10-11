import { goodboyStopRoute, type GoodboyStopRoute } from './goodboyStopRoute';
import { settleStopping } from './settleStopping';
import type { GetFn, SetFn, StopGoodboyRowParams } from './types';

type OwnStopParams = {
  readonly get: GetFn;
  readonly route: Exclude<GoodboyStopRoute, { readonly kind: 'process' }>;
};

const runOwnStop = async ({ get, route }: OwnStopParams): Promise<void> => {
  switch (route.kind) {
    case 'script':
      await get().cancelScript(route.sessionId, route.scriptKey);
      return;
    case 'terminal':
      get().closeTerminalTab({ owner: route.owner, tabId: route.tabId });
      return;
    case 'turn':
      await get().cancelCurrentTurn(route.sessionId, route.agentId, 'user');
      return;
  }
};

export const stopGoodboyRow = (set: SetFn, get: GetFn) => {
  return async ({ spawnId }: StopGoodboyRowParams): Promise<void> => {
    const entry = get().monitorLedger.find((row) => row.spawnId === spawnId);
    if (entry === undefined) {
      return;
    }
    const route = goodboyStopRoute({ entry, state: get() });
    if (route.kind === 'process') {
      await get().stopProcess({ pid: route.pid, isForced: false });
      return;
    }
    set(settleStopping({ pid: entry.pid, progress: 'stopping' }));
    try {
      await runOwnStop({ get, route });
    } catch (error) {
      void get().reportError({ title: "Couldn't stop the process", error });
    } finally {
      set(settleStopping({ pid: entry.pid, progress: null }));
    }
    await get().refreshMonitorSnapshot();
  };
};
