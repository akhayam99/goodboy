import { Benefits, type Benefit } from '../components/Benefits';
import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { DEVELOPERS } from '../figures';

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
    lead: 'Pull request, diff and review in one path.',
    text: 'The pull request page opens its diff and its review comments one step away, and Back walks you out the way you came.',
  },
  {
    lead: 'History you can rewrite without worry.',
    text: 'Drag commits to fold, squash, move or drop them, and see the branch after Apply before anything moves. Every rewrite keeps a backup for 30 days.',
  },
  {
    lead: 'Branches that do not pile up.',
    text: 'Goodboy knows which branches it made, which ones merged and which are safe to delete, and you choose what happens after a merge.',
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
  >
    <Shot figure={DEVELOPERS} />
    <Benefits items={ITEMS} />
    <div className="linkRow">
      <SeeHow anchor="branch-history" />
    </div>
  </Block>
);
