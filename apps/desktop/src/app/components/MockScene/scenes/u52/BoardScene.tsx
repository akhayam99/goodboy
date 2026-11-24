import { useEffect, useState } from 'react';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
} from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore, useSessions } from '../../../../../store';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';

type BoardCards = 0 | 3 | 9;

type Props = {
  readonly theme: 'dark' | 'light';
  readonly cards: BoardCards;
};

type Ask = {
  readonly sessionId: SessionId;
  readonly text: string;
};

type IdParams = {
  readonly value: string;
};

const sessionIdOf = ({ value }: IdParams): SessionId =>
  brandId<SessionId>({ value: `mock-board-session-${value}` });

const WAITING: ReadonlyArray<SessionId> = [
  sessionIdOf({ value: 'notify-backoff' }),
  sessionIdOf({ value: 'settlement-rounding' }),
];

const MORE_ASKS: ReadonlyArray<Ask> = [
  {
    sessionId: sessionIdOf({ value: 'rate-limit' }),
    text: 'Cap the payments-api limiter at 50 requests per second for Acme?',
  },
  {
    sessionId: sessionIdOf({ value: 'onboarding-copy' }),
    text: 'Keep the Northwind welcome copy or use the shorter one?',
  },
  {
    sessionId: sessionIdOf({ value: 'signing-secret' }),
    text: 'Rotate the signing secret now or at the next release?',
  },
  {
    sessionId: sessionIdOf({ value: 'checkout-retry' }),
    text: 'Retry a declined checkout once or twice?',
  },
  {
    sessionId: sessionIdOf({ value: 'payout-export' }),
    text: 'Stream the Cascadia payout export in pages of 500 or 1000 rows?',
  },
  {
    sessionId: sessionIdOf({ value: 'admin-pagination' }),
    text: 'Show 25 or 50 rows per page in the Harborline admin?',
  },
  {
    sessionId: sessionIdOf({ value: 'reconciliation-export' }),
    text: 'Reconcile ledger-core against the snapshot of today or of yesterday?',
  },
];

const ASKED_AT = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

type QuestionParams = {
  readonly ask: Ask;
  readonly index: number;
};

const questionOf = ({ ask, index }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: `mock-u52-question-${index}` }),
  sessionId: ask.sessionId,
  text: ask.text,
  suggestedAnswers: ['Yes', 'No'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: ASKED_AT,
});

const extraAsksOf = ({ cards }: Pick<Props, 'cards'>): ReadonlyArray<Ask> =>
  MORE_ASKS.slice(0, Math.max(0, cards - WAITING.length));

const seedNeedsYouBoard = ({ cards }: Pick<Props, 'cards'>): void => {
  seedBoardScene();
  useAppStore.setState((state) => ({
    sessions:
      cards === 0
        ? state.sessions.filter((session) => !WAITING.includes(session.id))
        : state.sessions,
    sessionOpenQuestions:
      cards === 0
        ? {}
        : {
            ...state.sessionOpenQuestions,
            ...Object.fromEntries(
              extraAsksOf({ cards }).map((ask, index) => [
                ask.sessionId,
                [questionOf({ ask, index })],
              ]),
            ),
          },
  }));
};

export const BoardScene = ({ theme, cards }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sessions = useSessions();
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedNeedsYouBoard({ cards });
    setIsReady(true);
  }, [cards, theme]);
  return isReady ? (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
    </main>
  ) : null;
};
