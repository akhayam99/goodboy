import { Benefits, type Benefit } from '../components/Benefits';
import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { CHAT } from '../figures';

const ITEMS: readonly Benefit[] = [
  {
    lead: 'Every chat starts briefed.',
    text: 'The goal, the decisions and the plan travel with it, so you stop pasting the backstory.',
  },
  {
    lead: 'The right model for each job.',
    text: 'A light model reads the code, a strong one plans. You stop paying top price for a file search.',
  },
  {
    lead: 'Your checkout stays yours.',
    text: 'Agents edit in their own copy of the repo, so several tasks can run at once without touching your branch.',
  },
  {
    lead: 'Many repos, one goal.',
    text: 'A task can span payments-api and notify-relay, with a branch and a pull request in each.',
  },
  {
    lead: 'Review comments come back as commits.',
    text: 'An agent fixes each one and drafts the reply in your voice. You approve.',
  },
  {
    lead: 'Nothing lost when a plan runs out.',
    text: 'If Claude hits its limit mid-task, the turn can move to another connected provider, and the chat says where it went. After a restart or an update, running agents pick up where they stopped.',
  },
];

export const Developers = () => (
  <Block
    id="developers"
    headingId="h2-developers"
    heading="For developers"
    sub="Less time explaining, more time reviewing finished work."
    isAlt
  >
    <Shot figure={CHAT} />
    <Benefits items={ITEMS} />
    <div className="linkRow">
      <SeeHow anchor="agents-and-chat" />
    </div>
  </Block>
);
