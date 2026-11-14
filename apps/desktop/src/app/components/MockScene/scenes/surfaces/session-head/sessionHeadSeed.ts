import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../../store';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { branchPlace, sessionPlace } from '../../../../../../store/slices/navigation/place';

type Params = {
  readonly lens: LensKind | null;
  readonly isBranch?: boolean;
  readonly theme?: 'dark' | 'light';
};

const SESSION_ID = brandId<SessionId>({ value: 'mock-board-session-payout-export' });

export const sessionHeadSeed =
  ({ lens, isBranch = false, theme = 'dark' }: Params) =>
  (): void => {
    applyDocumentTheme({ theme });
    const state = useAppStore.getState();
    const mountPath = state.sessionProjectMounts[SESSION_ID]?.[0]?.worktreePath ?? null;
    useAppStore.setState({ currentSessionId: SESSION_ID });
    useAppStore.getInitialState().navigate({
      to: isBranch
        ? branchPlace({ sessionId: SESSION_ID, mountPath, tab: 'pr' })
        : sessionPlace({ sessionId: SESSION_ID, lens }),
      mode: 'replace',
    });
  };
