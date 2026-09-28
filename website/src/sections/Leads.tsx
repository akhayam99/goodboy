import { Benefits, type Benefit } from '../components/Benefits';
import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
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
  <Block
    id="leads"
    headingId="h2-leads"
    heading="For leads and project managers"
    sub="Look once and you know where every task stands, without asking anyone."
  >
    <Shot figure={BOARD} />
    <Benefits items={ITEMS} />
    <div className="linkRow">
      <SeeHow anchor="the-board" />
    </div>
  </Block>
);
