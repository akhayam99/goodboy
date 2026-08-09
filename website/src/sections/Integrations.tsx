import type { CSSProperties } from 'react';
import { BrandMark, BRAND_COLOR, type BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type IntegrationCard = {
  readonly brand: BrandId;
  readonly name: string;
  readonly blurb: string;
  readonly flow: string;
};

const CARDS: ReadonlyArray<IntegrationCard> = [
  {
    brand: 'github',
    name: 'GitHub',
    blurb:
      'Every pull request with your name on it, one inbox. Hand a review comment to an agent to resolve.',
    flow: 'comment → agent → resolved',
  },
  {
    brand: 'gitlab',
    name: 'GitLab',
    blurb: 'Merge requests and issues get the same treatment as GitHub, side by side.',
    flow: 'MR !77 → task → merged',
  },
  {
    brand: 'linear',
    name: 'Linear',
    blurb:
      'Pick an issue and launch. Already shipped a PR for it? Continue on that branch instead of starting fresh.',
    flow: 'LIN-241 → task → PR',
  },
  {
    brand: 'sentry',
    name: 'Sentry',
    blurb:
      "An error becomes a task, with the error's full trail (the stack trace) written into the goal.",
    flow: 'error → task → fix',
  },
  {
    brand: 'bitbucket',
    name: 'Bitbucket',
    blurb:
      'Pull requests get their own inbox next to GitHub and GitLab, with build status and review comments in the same screen.',
    flow: 'PR #42 → task → merged',
  },
  {
    brand: 'jira',
    name: 'Jira',
    blurb:
      "Browse the project's issues and launch one straight into a task, with the summary and description already in the goal.",
    flow: 'PROJ-88 → task → PR',
  },
  {
    brand: 'slack',
    name: 'Slack',
    blurb: 'Turn a channel thread into a task, with the whole conversation carried into the goal.',
    flow: 'thread → task → PR',
  },
];

export const Integrations = () => (
  <section className="block alt" id="integrations" aria-labelledby="h2-integrations">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-integrations">
          The cards write themselves
        </h2>
        <p className="sub rv" style={delay(80)}>
          The task usually starts somewhere else, in an issue, a pull request, or a crash report.{' '}
          <b>One click</b> makes it a card with the goal written for you, done when the PR merges.
        </p>
      </div>
      <div className="igrid">
        {CARDS.map((card, index) => (
          <div
            key={card.brand}
            className={`icard rv${index === 0 ? ' wide' : ''}`}
            style={{ ...delay(index * 60), '--brand': BRAND_COLOR[card.brand] } as CSSProperties}
          >
            <div className="ihead">
              <BrandMark brand={card.brand} size={18} />
              <h3>{card.name}</h3>
            </div>
            <p>{card.blurb}</p>
            <div className="flow">{card.flow}</div>
          </div>
        ))}
      </div>
      <a
        className="more rv"
        style={delay(CARDS.length * 60)}
        href={`${SITE.vision}#integration-surface`}
      >
        See the integration roadmap <span className="arr">→</span>
      </a>
    </div>
  </section>
);
