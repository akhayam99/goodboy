import './BoardMock.css';
import type { ReactNode } from 'react';
import { CircleHelp, GitPullRequest } from './icons';
import { ToneBar, type Tone } from './kit';
import { MockStage } from './MockStage';

type Props = {
  readonly className?: string;
};

type Card = {
  readonly title: string;
  readonly repo: string;
  readonly pullRequest?: number;
  readonly hasQuestion?: boolean;
};

type Column = {
  readonly name: string;
  readonly tone: Tone;
  readonly isBreathing?: boolean;
  readonly cards: readonly [Card, Card];
};

const COLUMNS: readonly Column[] = [
  {
    name: 'Building',
    tone: 'neutral',
    cards: [
      { title: 'Draft the payout delay notice', repo: 'notify-relay' },
      { title: 'Rotate the processor signing secret', repo: 'payments-api' },
    ],
  },
  {
    name: 'Running',
    tone: 'info',
    isBreathing: true,
    cards: [
      { title: 'Speed up the payout export', repo: 'ledger-core' },
      { title: 'Nightly reconciliation job', repo: 'ledger-core' },
    ],
  },
  {
    name: 'Needs you',
    tone: 'warning',
    cards: [
      { title: 'Fix the rounding drift in exports', repo: 'ledger-core', hasQuestion: true },
      { title: 'Warn merchants before a hold', repo: 'notify-relay', hasQuestion: true },
    ],
  },
  {
    name: 'In review',
    tone: 'success',
    cards: [
      { title: 'Stop retried webhook credits', repo: 'payments-api', pullRequest: 318 },
      { title: 'Reconcile export with the ledger', repo: 'ledger-core', pullRequest: 90 },
    ],
  },
  {
    name: 'Done',
    tone: 'merged',
    cards: [
      { title: 'Bump the lockfile after the audit', repo: 'payments-api', pullRequest: 198 },
      { title: 'Retire the legacy export route', repo: 'notify-relay', pullRequest: 205 },
    ],
  },
  {
    name: 'Archived',
    tone: 'neutral',
    cards: [
      { title: 'Update the refund policy copy', repo: 'payments-api' },
      { title: 'Fix a flaky retry test in the export', repo: 'ledger-core' },
    ],
  },
];

const ARIA_LABEL =
  'Board with six lanes, two cards each, every card with its title and project. Building: draft the payout delay notice, rotate the processor signing secret. Running: speed up the payout export, nightly reconciliation job. Needs you: two cards, each with an open question. In review: stop retried webhook credits on pull request 318, reconcile export with the ledger on pull request 90. Done: bump the lockfile after the audit on merged pull request 198, retire the legacy export route on merged pull request 205. Archived: update the refund policy copy, fix a flaky retry test in the export.';

type SignalParams = {
  readonly card: Card;
  readonly isBreathing: boolean;
};

const signalOf = ({ card, isBreathing }: SignalParams): ReactNode => {
  if (card.pullRequest !== undefined) {
    return (
      <span className="brdPr">
        <GitPullRequest size={12} />#{card.pullRequest}
      </span>
    );
  }
  if (card.hasQuestion === true) {
    return (
      <span className="brdAction">
        <CircleHelp size={13} />
      </span>
    );
  }
  if (isBreathing) {
    return <span className="brdRunning" aria-hidden="true" />;
  }
  return null;
};

export const BoardMock = ({ className }: Props) => (
  <MockStage label={ARIA_LABEL} className={className}>
    <div className="brdBoard">
      {COLUMNS.map(({ name, tone, isBreathing = false, cards }) => (
        <section key={name} className="brdCol" data-tone={tone}>
          <h4 className="brdHead">
            <span className="brdHeadLabel">{name}</span>
            <span className="brdCount">{cards.length}</span>
          </h4>
          {cards.map((card) => (
            <article key={card.title} className="brdCard">
              <ToneBar tone={tone} isBreathing={isBreathing} />
              <span className="brdTitle">{card.title}</span>
              <span className="brdFoot">
                <span className="brdRepo">{card.repo}</span>
                {signalOf({ card, isBreathing })}
              </span>
            </article>
          ))}
        </section>
      ))}
    </div>
  </MockStage>
);
