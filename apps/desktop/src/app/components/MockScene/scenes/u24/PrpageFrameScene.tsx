import { useEffect, useState } from 'react';
import { UnderTrailContext } from '@goodboy/ui';
import type { DiffComment } from '@goodboy/types';
import type { BranchTab } from '../../../../../store/slices/navigation/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { StudioBandContext } from '../../../../../shared/components/StudioShell/studioBandContext';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { PageSheet } from '../PageSheet';
import { SESSION, SESSION_ID } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed, type PrPageVariant } from '../u23/prPageSeed';

const OPEN_DELAY_MS = 400;

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const NOTE: DiffComment = {
  id: 'mock-u24-prpage-frame-note',
  sessionId: SESSION_ID,
  filePath: 'src/ledger/postCredit.ts',
  body: 'Return the prior credit instead of posting a second one.',
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-10T08:40:00.000Z' }),
  anchor: { side: 'new', lineNumber: 14 },
  authorKind: 'user',
};

type Props = {
  readonly variant: PrPageVariant;
  readonly tab?: BranchTab;
  readonly isQueued?: boolean;
  readonly hasNote?: boolean;
  readonly stageWidth?: number;
  readonly isRailOpen?: boolean;
};

const queue = (): void => {
  useAppStore.setState((state) => {
    const current = state.sessionGithub[SESSION_ID];
    if (current === undefined || current.pr === null) {
      return state;
    }
    return {
      sessionGithub: {
        ...state.sessionGithub,
        [SESSION_ID]: {
          ...current,
          pr: { ...current.pr, state: 'queued', mergeQueue: { position: 3 } },
        },
      },
    };
  });
};

export const PrpageFrameScene = ({
  variant,
  tab = 'pr',
  isQueued = false,
  hasNote = false,
  stageWidth,
  isRailOpen = false,
}: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyPrPageSeed({ variant });
    if (isQueued) {
      queue();
    }
    useAppStore.setState((state) => ({
      branchTab: { ...state.branchTab, [SESSION_ID]: tab },
      ...(hasNote && { diffComments: { [SESSION_ID]: [NOTE] } }),
    }));
    setIsReady(true);
  }, [hasNote, isQueued, tab, variant]);

  useEffect(() => {
    if (!isReady || !isRailOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      [...document.querySelectorAll<HTMLElement>('button')]
        .find((button) => button.textContent?.trim() === 'Sections')
        ?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, isRailOpen]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="flex h-screen overflow-hidden bg-background text-foreground"
      style={stageWidth === undefined ? undefined : { width: stageWidth }}
    >
      <PageSheet>
        <UnderTrailContext.Provider value>
          <StudioBandContext.Provider value={null}>
            <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
          </StudioBandContext.Provider>
        </UnderTrailContext.Provider>
      </PageSheet>
    </main>
  );
};
