import './BoardMock.css';
import {
  AppBrandIcon,
  Bot,
  ChevronRight,
  CircleHelp,
  GitPullRequest,
  type AppBrandId,
} from './icons';
import { GroupLabel, RepoChip, ToneBar, type Tone } from './kit';
import { MockStage } from './MockStage';

type Props = {
  readonly className?: string;
};

type Card = {
  readonly title: string;
  readonly reason?: string;
  readonly repo: string;
  readonly cost: string;
  readonly age: string;
  readonly agents?: number;
  readonly sources?: readonly AppBrandId[];
  readonly hasPullRequest?: boolean;
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
      {
        title: 'Draft the payout delay notice',
        reason: 'no PR yet',
        repo: 'notify-relay',
        cost: '$1.20',
        age: '40m ago',
      },
      {
        title: 'Rotate the processor signing secret',
        reason: 'no PR yet',
        repo: 'payments-api',
        cost: '$0.46',
        age: '1h ago',
      },
    ],
  },
  {
    name: 'Running',
    tone: 'info',
    isBreathing: true,
    cards: [
      {
        title: 'Speed up the payout export',
        reason: 'agent running',
        repo: 'ledger-core',
        cost: '$0.88',
        age: '12m ago',
        agents: 1,
      },
      {
        title: 'Nightly reconciliation job',
        reason: 'agent running',
        repo: 'ledger-core',
        cost: '$2.15',
        age: '25m ago',
        agents: 2,
      },
    ],
  },
  {
    name: 'Needs you',
    tone: 'warning',
    cards: [
      {
        title: 'Fix the rounding drift in exports',
        reason: '1 open question',
        repo: 'ledger-core',
        cost: '$0.58',
        age: '1h ago',
        sources: ['jira'],
        hasQuestion: true,
      },
      {
        title: 'Warn merchants before a hold',
        reason: '1 open question',
        repo: 'notify-relay',
        cost: '$0.02',
        age: '5h ago',
        hasQuestion: true,
      },
    ],
  },
  {
    name: 'In review',
    tone: 'success',
    cards: [
      {
        title: 'Stop retried webhook credits',
        reason: 'PR #318 awaiting review',
        repo: 'ledger-core',
        cost: '$3.47',
        age: '6h ago',
        sources: ['linear'],
        hasPullRequest: true,
      },
      {
        title: 'Reconcile export with the ledger',
        reason: 'draft PR #90',
        repo: 'ledger-core',
        cost: '$4.82',
        age: '2d ago',
        sources: ['jira'],
        hasPullRequest: true,
      },
    ],
  },
  {
    name: 'Done',
    tone: 'merged',
    cards: [
      {
        title: 'Bump the lockfile after the audit',
        reason: 'PR #198 merged',
        repo: 'payments-api',
        cost: '$1.64',
        age: '3d ago',
        hasPullRequest: true,
      },
      {
        title: 'Retire the legacy export route',
        reason: 'PR #205 merged',
        repo: 'notify-relay',
        cost: '$2.10',
        age: '4d ago',
        hasPullRequest: true,
      },
    ],
  },
  {
    name: 'Archived',
    tone: 'neutral',
    cards: [
      {
        title: 'Update the refund policy copy',
        repo: 'payments-api',
        cost: '$0.74',
        age: '5d ago',
      },
      {
        title: 'Fix a flaky retry test in the export',
        repo: 'ledger-core',
        cost: '$1.31',
        age: '9d ago',
      },
    ],
  },
];

const ARIA_LABEL =
  'Board with six lanes, two cards each. Building: draft the payout delay notice, rotate the processor signing secret. Running: speed up the payout export, nightly reconciliation job. Needs you: two cards, each with one open question. In review: stop retried webhook credits on PR 318, reconcile export with the ledger on draft PR 90. Done: bump the lockfile after the audit on merged PR 198, retire the legacy export route on merged PR 205. Archived: update the refund policy copy, fix a flaky retry test in the export.';

export const BoardMock = ({ className }: Props) => (
  <MockStage label={ARIA_LABEL} className={className}>
    <div className="brdBoard">
      {COLUMNS.map(({ name, tone, isBreathing = false, cards }) => (
        <section key={name} className="brdCol" data-tone={tone}>
          <h4 className="brdHead">
            <GroupLabel label={name} className="brdHeadLabel" />
            <span className="brdCount">{cards.length}</span>
          </h4>
          {cards.map((card) => (
            <article key={card.title} className="brdCard">
              <ToneBar tone={tone} isBreathing={isBreathing} />
              <span className="brdMain">
                <span className="brdTop">
                  {card.hasPullRequest === true ? (
                    <span className="brdPr">
                      <GitPullRequest size={14} />
                    </span>
                  ) : null}
                  <span className="brdTitle">{card.title}</span>
                </span>
                {card.reason === undefined ? null : (
                  <span className="brdReason">{card.reason}</span>
                )}
              </span>
              <span className="brdSide">
                {card.hasQuestion === true ? (
                  <span className="brdAction">
                    <CircleHelp size={14} />
                  </span>
                ) : null}
                <ChevronRight size={14} className="brdChevron" />
              </span>
              <span className="brdFoot">
                <span className="brdFootStart">
                  {card.agents === undefined ? null : (
                    <span className="brdAgents">
                      <Bot size={12} />
                      <span>{card.agents}</span>
                    </span>
                  )}
                  <RepoChip name={card.repo} />
                  {card.sources?.map((source) => (
                    <span
                      key={source}
                      className="brdSource"
                      style={{ color: `var(--g-provider-${source})` }}
                    >
                      <AppBrandIcon brand={source} size={14} />
                    </span>
                  ))}
                </span>
                <span className="brdFootEnd">
                  <span>{card.cost}</span>
                  <span className="brdAge">{card.age}</span>
                </span>
              </span>
            </article>
          ))}
        </section>
      ))}
    </div>
  </MockStage>
);
