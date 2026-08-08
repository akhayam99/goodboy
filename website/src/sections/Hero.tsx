import { SessionCard } from '../components/SessionCard';
import type { BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type Card = {
  readonly goal: string;
  readonly stage: 'you' | 'run' | 'rev' | 'build' | 'done';
  readonly stageLabel: string;
  readonly tags: readonly string[];
  readonly cost: string;
  readonly on: readonly BrandId[];
};

const WALL: readonly Card[] = [
  {
    goal: 'Fix the TypeError in the ingest worker',
    stage: 'run',
    stageLabel: 'running',
    tags: ['SENTRY-1382'],
    cost: '$0.19',
    on: ['codex'],
  },
  {
    goal: 'Add rate limits to the public API',
    stage: 'run',
    stageLabel: 'running',
    tags: ['LIN-198'],
    cost: '$0.58',
    on: ['anthropic', 'codex'],
  },
  {
    goal: 'Split the billing worker out of the monolith',
    stage: 'rev',
    stageLabel: 'in review',
    tags: ['PR #468'],
    cost: '$1.84',
    on: ['anthropic', 'cursor'],
  },
  {
    goal: 'Answer the review comments on PR #479',
    stage: 'you',
    stageLabel: 'needs you',
    tags: ['2 comments'],
    cost: '$0.44',
    on: ['cursor'],
  },
  {
    goal: 'De-flake the websocket reconnect test',
    stage: 'done',
    stageLabel: 'done',
    tags: ['merged'],
    cost: '$0.31',
    on: ['codex'],
  },
  {
    goal: 'Upgrade Playwright and fix the snapshot drift',
    stage: 'build',
    stageLabel: 'building',
    tags: ['ci running'],
    cost: '$0.27',
    on: ['gemini'],
  },
  {
    goal: 'Write the migration guide for v0.2',
    stage: 'run',
    stageLabel: 'running',
    tags: ['docs'],
    cost: '$0.12',
    on: ['anthropic'],
  },
  {
    goal: 'Wire Sentry release tags into deploys',
    stage: 'done',
    stageLabel: 'done',
    tags: ['merged'],
    cost: '$0.44',
    on: ['moonshot'],
  },
];

export const Hero = () => (
  <section id="hero">
    <div className="wrap heroGrid">
      <div className="heroCopy">
        <h1 className="rv">
          Stop <span className="hl">re&#8209;explaining yourself.</span>
        </h1>
        <p className="sub rv" style={delay(80)}>
          Goodboy is a free desktop app that runs a team of AI agents on your work. You describe it
          once, and Goodboy decides which agent goes next.
        </p>
        <div className="ctaRow rv" style={delay(160)}>
          <a className="btn" href="#install">
            Install
          </a>
          <a className="btn ghost" href={SITE.repo}>
            Star on GitHub
          </a>
        </div>
        <p className="reassure rv" style={delay(240)}>
          <b>Free and open source (MIT), every feature included.</b> Local, no account. Runs on
          macOS and Linux.
        </p>
        <p className="reassure rv" style={delay(300)}>
          <b>No new bill.</b> It runs on the Claude, ChatGPT or Cursor plan you already pay for. The
          prices you see are what that work would have cost by the token.
        </p>
      </div>
      <div className="wall rv" style={delay(200)} aria-hidden="true">
        <div className="wallCol">
          {[...WALL, ...WALL].map((card, i) => (
            <SessionCard key={`${card.goal}-${i}`} {...card} />
          ))}
        </div>
      </div>
    </div>
  </section>
);
