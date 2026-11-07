import type { SessionId } from '@goodboy/types';
import type { ContextDrawerSection, ContextDrawerView } from '../drawer/state';
import { selectOpenDrawer } from '../drawer/selectOpenDrawer';
import { DEFAULT_CONTEXT_SECTION } from './state';
import type { GetFn, SetFn } from './types';

export type OpenContextDrawerParams = {
  readonly sessionId: SessionId;
  readonly section?: ContextDrawerSection;
  readonly view?: ContextDrawerView;
  readonly highlight?: ReadonlyArray<number>;
};

export const openContextDrawer = (set: SetFn, get: GetFn) => {
  return ({ sessionId, section, view = 'current', highlight }: OpenContextDrawerParams): void => {
    const state = get();
    const nextSection = section ?? DEFAULT_CONTEXT_SECTION;
    const current = selectOpenDrawer(state);
    const isAlreadyOpen =
      current !== null && current.kind === 'context' && current.sessionId === sessionId;
    const seenAt = state.sessionContextSeenAt[sessionId];
    set({
      ...(!isAlreadyOpen &&
        seenAt !== undefined && {
          sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: seenAt },
        }),
    });
    state.openDrawer({
      kind: 'context',
      sessionId,
      payload: {
        section: nextSection,
        view,
        ...(highlight !== undefined && highlight.length > 0 && { highlight }),
      },
    });
  };
};
