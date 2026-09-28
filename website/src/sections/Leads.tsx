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
    lead: 'What it cost so far.',
    text: 'Each card carries its pull request and what its agents have spent, updated as they run.',
  },
  {
    lead: 'What needs you.',
    text: 'A task waiting on an answer moves to Needs you, with its open question on the card.',
  },
];

export const Leads = () => (
  <section className="leads" id="leads" aria-labelledby="leads-title">
    <Statement
      headingId="leads-title"
      eyebrow="For leads and project managers"
      eyebrowKind="audience"
      heading="See what is building, running or waiting on you"
    />
    <Frame figure={BOARD}>
      <Benefits items={ITEMS} />
    </Frame>
  </section>
);
