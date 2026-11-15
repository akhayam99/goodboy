import type { SessionId } from '@goodboy/types';
import type { ContextDrawerSection, ContextDrawerView } from '../drawer/state';
import { lensPlace } from '../navigation/canonicalLocation';
import { CONTEXT_ROWS } from './contextRows';
import { selectIsContextTabOpen } from './selectIsContextTabOpen';
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
    const isAlreadyOpen = selectIsContextTabOpen({ state, sessionId });
    const seenAt = state.sessionContextSeenAt[sessionId];
    set({
      ...(!isAlreadyOpen &&
        seenAt !== undefined && {
          sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: seenAt },
        }),
    });
    state.navigate({ to: lensPlace({ state, sessionId, lens: 'context' }) });
    get().amendFocus({
      patch: {
        returnRows: {
          [CONTEXT_ROWS.section]: nextSection,
          [CONTEXT_ROWS.view]: view,
          ...(highlight !== undefined &&
            highlight.length > 0 && { [CONTEXT_ROWS.highlight]: highlight.join(',') }),
        },
      },
    });
  };
};
