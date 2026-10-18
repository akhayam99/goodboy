import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { AppFrame } from '../audit/AppFrame';
import { SESSION } from '../activityRunSeed';
import { TESTER_ID } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const ANSWER = [
  'Three tests added in payments-api, all pass.',
  '',
  '- **Trailer grep:** no commit in the range carries a stray trailer.',
  '- **Remote check:** `origin` and the local branch point at the same commit.',
  '- **Retry test:** a repeated key in applyCredit is rejected once.',
].join('\n');

type ViewParams = {
  readonly view: AutoTreeView;
};

const withAnswer = ({ view }: ViewParams): AutoTreeView => ({
  ...view,
  delegations: view.delegations.map((delegation) =>
    delegation.childAgentId === TESTER_ID
      ? {
          ...delegation,
          result: {
            ...(typeof delegation.result === 'object' && delegation.result !== null
              ? delegation.result
              : {}),
            declared: { summary: ANSWER },
          },
        }
      : delegation,
  ),
});

export const P18DrawerScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedC07({ state: 'done', place: 'auto', pane: 'tester' });
    const current = useAppStore.getState();
    useAppStore.setState({
      sessions: [{ ...SESSION, permissionMode: 'bypassPermissions' }],
      agentProviderOverride: { ...current.agentProviderOverride, [TESTER_ID]: 'anthropic' },
      agentModelOverride: { ...current.agentModelOverride, [TESTER_ID]: 'opus-5.5' },
      autoTreeViews: {
        ...current.autoTreeViews,
        [SESSION.id]: (current.autoTreeViews[SESSION.id] ?? []).map((view) => withAnswer({ view })),
      },
    });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
