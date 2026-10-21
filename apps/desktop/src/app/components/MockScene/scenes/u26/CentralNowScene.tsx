import { useEffect, useMemo, useState } from 'react';
import { branchEntriesOf } from '../../../../../features/session/central/branches/branchStoryOf';
import { cardOrderOf } from '../../../../../features/session/central/branches/cardOrderOf';
import { liveGroupsOf } from '../../../../../features/session/central/now/liveGroupsOf';
import { needsYouCountOf } from '../../../../../features/session/central/now/needsYouCountOf';
import { nowStateOf } from '../../../../../features/session/central/now/nowStateOf';
import { NowBlockView } from '../../../../../features/session/central/now/NowBlockView';
import { statusSentenceOf } from '../../../../../features/session/central/now/statusSentenceOf';
import {
  NOW_CLOCK,
  NOW_SESSION,
} from '../../../../../features/session/central/now/testing/nowModelOf';
import { WorkTimeContext } from '../../../../../features/workTreeModel/workTimeSource';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { centralNowSeedOf, type CentralNowVariant } from './centralNowSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly variant: CentralNowVariant;
};

const COLUMN_WIDTH = 640;

const WIDE_COLUMN_WIDTH = 760;

export const CentralNowScene = ({ theme, variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const seed = useMemo(() => centralNowSeedOf({ variant }), [variant]);
  const groups = useMemo(
    () => liveGroupsOf({ model: seed.model, agents: seed.agents, now: NOW_CLOCK }),
    [seed],
  );
  const entries = useMemo(
    () =>
      branchEntriesOf({
        facts: seed.facts,
        cardOrderByMountId: cardOrderOf({ cards: seed.branchCards }),
        detailByMountId: new Map(),
      }),
    [seed],
  );
  useEffect(() => {
    applyDocumentTheme({ theme });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  const state = nowStateOf({
    groups,
    cards: seed.cards,
    hasMergedRequest: false,
    hasDoneWork: seed.doneOutcome !== null,
  });
  return (
    <div data-shot className="p-6">
      <div
        data-central-column
        style={{ width: variant === 'story-one-project' ? WIDE_COLUMN_WIDTH : COLUMN_WIDTH }}
        className="max-w-full"
      >
        <WorkTimeContext.Provider value={seed.source}>
          <NowBlockView
            sessionId={NOW_SESSION}
            state={state}
            sentence={statusSentenceOf({
              groups,
              cards: seed.cards,
              doneOutcome: seed.doneOutcome,
              facts: seed.facts,
            })}
            needsYouCount={needsYouCountOf({ cards: seed.cards })}
            onShowNext={() => undefined}
            groups={groups}
            entries={entries}
          />
        </WorkTimeContext.Provider>
      </div>
    </div>
  );
};
