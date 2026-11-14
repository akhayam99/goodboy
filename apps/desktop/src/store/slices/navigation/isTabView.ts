import { SESSION_TAB_LENSES } from './sessionTabLenses';
import type { SessionView } from './types';

type Params = {
  readonly view: SessionView;
};

export const isTabView = ({ view }: Params): boolean =>
  view.agentId === null &&
  (view.target === null || view.target.kind === 'question') &&
  (view.lens === null || SESSION_TAB_LENSES.has(view.lens));
