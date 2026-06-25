import type { GetFn, SetFn } from './types';

type Params = { skipUnknownPr?: boolean };

export const sweepGithub = (set: SetFn, get: GetFn) => {
  return (opts?: Params) => {
    if (!get().githubStatus?.available) {
      set({ boardReady: true });
      return;
    }
    const wsAtStart = get().currentWorkspaceId;
    const { sessions, sessionBranches, sessionGithub, currentSessionId } = get();
    const subOpts = { silent: true, retries: 1 } as const;
    const promises: Promise<void>[] = [];
    for (const session of sessions) {
      if (!sessionBranches[session.id]) {
        continue;
      }
      const cached = sessionGithub[session.id];
      const pr = cached?.pr;
      if (pr && (pr.state === 'merged' || pr.state === 'closed')) {
        continue;
      }
      if (opts?.skipUnknownPr && cached?.fetchedAt && pr === null) {
        continue;
      }
      const head = get().refreshSessionPr(session.id, subOpts);
      promises.push(head);
      if (session.id === currentSessionId) {
        void head.then(() => get().refreshSessionPrDetail(session.id, subOpts));
      }
    }
    if (promises.length > 0) {
      void Promise.all(promises).then(() => {
        if (get().currentWorkspaceId === wsAtStart) {
          set({ boardReady: true });
        }
      });
    }
  };
};
