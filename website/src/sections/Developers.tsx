import './Developers.css';
import { Benefits, type Benefit } from '../components/Benefits';
import { Fragment } from '../components/Fragment';
import { Frame } from '../components/Frame';
import { DEV_DIFF, DEV_HISTORY } from '../figures';

const ITEMS: readonly Benefit[] = [
  {
    lead: 'Rewrite history before you push.',
    text: 'Drag commits to fold, squash, reorder or drop them, and see the branch after Apply before it moves. Every rewrite keeps a backup for 30 days.',
  },
  {
    lead: 'Branches that do not pile up.',
    text: 'Goodboy knows which branches it made and which have merged, and lists the ones safe to delete. You choose what happens after a merge.',
  },
  {
    lead: 'Review comments become commits.',
    text: 'An agent writes each fix as a local commit and drafts the reply in your voice. Accept, edit or skip, then Push posts the replies and resolves the threads.',
  },
  {
    lead: 'A reviewer agent goes first.',
    text: 'Start a Review agent on the branch. Its comments land as notes on the diff, and reach the pull request only when you post them.',
  },
];

export const Developers = () => (
  <div className="developers">
    <Fragment
      id="developers"
      eyebrow="For developers"
      eyebrowKind="audience"
      heading="Review what the agents wrote before it merges"
      body="The diff has syntax colors, word-level changes, split or unified view and a Viewed tick per file. Quote any line into a note or a question for an agent."
      figures={[DEV_DIFF]}
      isMirrored
    />
    <Frame figure={DEV_HISTORY}>
      <Benefits items={ITEMS} />
    </Frame>
  </div>
);
