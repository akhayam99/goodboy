import type { AppState } from '../../../../../store/types';
import { listSessionPrFetches } from '../../../../../store/slices/github/resolveSessionPrFetch';

type Params = {
  readonly state: AppState;
};

type Inputs = Pick<
  AppState,
  | 'sessions'
  | 'sessionProjectMounts'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionActiveProject'
  | 'mountGithub'
>;

type Memo = {
  readonly inputs: Inputs;
  readonly signature: string;
};

let memo: Memo | null = null;

const INPUT_KEYS = [
  'sessions',
  'sessionProjectMounts',
  'sessionMounts',
  'sessionActiveMount',
  'sessionActiveProject',
  'mountGithub',
] as const satisfies ReadonlyArray<keyof Inputs>;

const OPEN_STATES: ReadonlySet<string> = new Set(['draft', 'open', 'approved', 'queued']);

export const watchSignatureOf = ({ state }: Params): string => {
  const inputs: Inputs = {
    sessions: state.sessions,
    sessionProjectMounts: state.sessionProjectMounts,
    sessionMounts: state.sessionMounts,
    sessionActiveMount: state.sessionActiveMount,
    sessionActiveProject: state.sessionActiveProject,
    mountGithub: state.mountGithub,
  };
  if (memo !== null && INPUT_KEYS.every((key) => memo?.inputs[key] === inputs[key])) {
    return memo.signature;
  }
  const seen = new Set<string>();
  let signature = '';
  for (const session of state.sessions) {
    for (const target of listSessionPrFetches({ state, sessionId: session.id })) {
      const pr = state.mountGithub?.[target.mount.id]?.pr ?? null;
      const key = `${session.id}|${target.mount.id}`;
      if (pr === null || !OPEN_STATES.has(pr.state) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      signature += `${key}|${pr.number}|${pr.headSha ?? ''}|${pr.checks ?? ''};`;
    }
  }
  memo = { inputs, signature };
  return signature;
};
