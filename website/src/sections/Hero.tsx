import './Hero.css';
import { SessionCard, type Pr, type Stage } from '../components/SessionCard';
import type { BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type Card = {
  readonly goal: string;
  readonly stage: Stage;
  readonly stageLabel: string;
  readonly project: string;
  readonly pr?: Pr;
  readonly tags?: readonly string[];
  readonly cost: string;
  readonly on: readonly BrandId[];
};

const WALL: readonly Card[] = [
  {
    goal: 'Ship LIN-241, bulk archive for notifications',
    stage: 'run',
    stageLabel: 'running',
    project: 'api',
    tags: ['LIN-241'],
    pr: { label: 'PR #1045', state: 'draft' },
    cost: '$1.61',
    on: ['anthropic', 'codex', 'cursor'],
  },
  {
    goal: 'Fix the TypeError in the ingest worker',
    stage: 'run',
    stageLabel: 'running',
    project: 'api',
    tags: ['SENTRY-1382'],
    cost: '$0.19',
    on: ['codex'],
  },
  {
    goal: 'Split the billing worker out of the monolith',
    stage: 'rev',
    stageLabel: 'in review',
    project: 'billing',
    pr: { label: 'PR #212', state: 'green' },
    cost: '$1.84',
    on: ['anthropic', 'cursor'],
  },
  {
    goal: 'Rate limit the login endpoint',
    stage: 'you',
    stageLabel: 'needs you',
    project: 'auth',
    cost: '$0.44',
    on: ['anthropic'],
  },
  {
    goal: 'De-flake the websocket reconnect test',
    stage: 'done',
    stageLabel: 'done',
    project: 'web',
    pr: { label: 'PR #3038', state: 'merged' },
    cost: '$0.31',
    on: ['codex'],
  },
  {
    goal: 'Upgrade Playwright and fix the snapshot drift',
    stage: 'build',
    stageLabel: 'building',
    project: 'web',
    pr: { label: 'PR #3041', state: 'open' },
    cost: '$0.27',
    on: ['cursor'],
  },
  {
    goal: 'Rotate webhook secrets after the Sentry alert',
    stage: 'you',
    stageLabel: 'needs you',
    project: 'infra',
    cost: '$0.84',
    on: ['anthropic'],
  },
  {
    goal: 'Backfill missing indexes on events table',
    stage: 'done',
    stageLabel: 'done',
    project: 'api',
    pr: { label: 'PR #1039', state: 'merged' },
    cost: '$0.77',
    on: ['codex'],
  },
];

export const Hero = () => (
  <section id="hero" aria-labelledby="h2-hero">
    <div className="wrap heroGrid hr-grid">
      <div className="heroCopy">
        <h1 className="rvi-lead" id="h2-hero">
          Stop <span className="hl">re&#8209;explaining yourself.</span>
        </h1>
        <p className="sub rvi-lead" style={delay(80)}>
          Goodboy is a free desktop app that runs a team of coding agents on your work. You describe
          it once, and Goodboy decides which agent goes next.
        </p>
        <div className="ctaRow hr-cta rvi" style={delay(160)}>
          <a className="btn" href="#install">
            Install
          </a>
          <a className="btn ghost" href={SITE.repo}>
            Star on GitHub
          </a>
        </div>
        <p className="reassure rvi" style={delay(240)}>
          <b>Free and open source (MIT), every feature included.</b> It lives on your computer, no
          account.
        </p>
        <p className="reassure rvi" style={delay(300)}>
          <b>No new bill.</b> It runs on the Claude, ChatGPT or Cursor plan you already pay for.
        </p>
        <p className="reassure rvi" style={delay(360)}>
          <b>Switch model mid-task and nothing resets.</b> The goal, the decisions and the summary
          belong to the task, so the next agent already has them.
        </p>
      </div>
      <div className="wall rvi" style={delay(200)} aria-hidden="true">
        <div className="wallCol">
          {[...WALL, ...WALL].map((card, i) => (
            <SessionCard key={`${card.goal}-${i}`} {...card} />
          ))}
        </div>
      </div>
    </div>
  </section>
);
