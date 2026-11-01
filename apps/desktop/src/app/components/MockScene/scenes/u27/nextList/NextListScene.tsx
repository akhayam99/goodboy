import { useEffect, useState } from 'react';
import { BranchChip } from '../../../../../../features/session/central/branches/BranchChip';
import {
  actionCardsOf,
  type ActionCardModel,
} from '../../../../../../features/session/central/next/actionCardsOf';
import { NextStackView } from '../../../../../../features/session/central/next/NextStackView';
import type { NextBranchName } from '../../../../../../features/session/central/next/nextRowCopyOf';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { SESSION_ID, seedResolveScene } from '../../resolveSeed';
import { NextListBeforeView } from './NextListBeforeView';
import { nextListBeforeActionsFor } from './nextListBeforeActionsFor';
import { NEXT_LIST_BEFORE_CARDS } from './nextListBeforeCards';
import { nextListBuiltActionsFor } from './nextListBuiltActionsFor';
import { NEXT_LIST_BUILT_SOURCES } from './nextListBuiltSources';
import { NEXT_LIST_MOUNTS } from './nextListMounts';

type NextListMoment = 'before' | 'after-decide' | 'after-fix';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly moment: NextListMoment;
};

const COLUMN_WIDTH = 720;

const MOUNTS = Object.values(NEXT_LIST_MOUNTS);

const BUILT_CARDS = actionCardsOf(NEXT_LIST_BUILT_SOURCES);

type ChipParams = {
  readonly mountId: string | null;
};

const chipOf = ({ mountId }: ChipParams) => {
  const mount = MOUNTS.find((candidate) => candidate.mountId === mountId);
  return mount === undefined ? null : (
    <BranchChip label={{ projectName: 'harbor-portal', branch: mount.branch }} />
  );
};

type NameParams = {
  readonly card: ActionCardModel;
};

const branchOf = ({ card }: NameParams): NextBranchName | null => {
  const mount = MOUNTS.find((candidate) => candidate.mountId === card.mountId);
  return mount === undefined ? null : { branch: mount.branch, request: mount.request };
};

export const NextListScene = ({ theme, moment }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedResolveScene({ expandedThreadId: null });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <div data-shot className="p-6">
      <div data-central-column style={{ width: COLUMN_WIDTH }} className="max-w-full">
        {moment === 'before' ? (
          <NextListBeforeView
            cards={NEXT_LIST_BEFORE_CARDS}
            actionsFor={nextListBeforeActionsFor}
            chipFor={({ card }) => chipOf({ mountId: card.mountId })}
          />
        ) : (
          <NextStackView
            sessionId={SESSION_ID}
            cards={BUILT_CARDS}
            actionsFor={nextListBuiltActionsFor}
            chipFor={({ card }) => chipOf({ mountId: card.mountId })}
            branchFor={branchOf}
          />
        )}
      </div>
    </div>
  );
};
