import type { GetFn, SetFn } from './types';

type Params = { skipUnknownPr?: boolean };

export const sweepGithub = (_set: SetFn, get: GetFn) => {
  return (opts?: Params) => {
    if (!get().githubStatus?.available) {
      return;
    }
    const { sessions, sessionBranches, sessionGithub, currentSessionId } = get();
    const subOpts = { silent: true, retries: 1 } as const;
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
      if (session.id === currentSessionId) {
        void head.then(() => get().refreshSessionPrDetail(session.id, subOpts));
      }
    }
  };
};
