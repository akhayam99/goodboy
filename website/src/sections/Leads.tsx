import './Leads.css';
import { Benefits, type Benefit } from '../components/Benefits';
import { Frame } from '../components/Frame';
import { Statement } from '../components/Statement';
import { BOARD } from '../figures';

const ITEMS: readonly Benefit[] = [
  {
    lead: 'Where every task stands.',
    text: 'The board sorts sessions into building, running, needs you and in review, and moves them as the work changes.',
  },
  {
    lead: 'What it cost.',
    text: 'Each card shows its pull request and its spend so far. Impact adds it up by provider and model.',
  },
  {
    lead: 'No surprise bills.',
    text: 'Set a monthly cap per provider, and Goodboy warns you before you cross it, not after.',
  },
  {
    lead: 'Work starts from your tracker.',
    text: 'Pick an issue from Linear, Jira, GitHub or Sentry and the session opens with its brief drafted.',
  },
  {
    lead: 'Decisions you can read.',
    text: 'Plans, decisions and reports are written down next to the task, not buried in a chat.',
  },
];

export const Leads = () => (
  <section className="leads" id="leads" aria-labelledby="leads-title">
    <Statement
      headingId="leads-title"
      eyebrow="For leads and project managers"
      eyebrowKind="audience"
      heading="See what is building, running or waiting on you"
      lead="The board sorts every task by where it stands, with its pull request and its cost so far."
    />
    <Frame figure={BOARD}>
      <Benefits items={ITEMS} />
    </Frame>
  </section>
);
