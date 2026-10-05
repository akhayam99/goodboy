import './SharedContext.css';
import { CardRow, type CardRowItem } from '../components/CardRow';
import { Chapter } from '../components/Chapter';
import { HandoffMock } from '../components/mocks/HandoffMock';
import { Statement } from '../components/Statement';

const FACTS: readonly CardRowItem[] = [
  {
    key: 'changes',
    title: 'See what changed',
    caption: 'The panel marks what was added or replaced since you last looked.',
  },
  {
    key: 'repos',
    title: 'One task, several repos',
    caption: 'Each branch gets its own git worktree.',
  },
];

export const SharedContext = () => (
  <Chapter id="context" tone="stage" label="Shared context">
    <div className="sharedContext">
      <Statement
        headingId="context-title"
        eyebrow="Shared context"
        eyebrowKind="group"
        heading="Stop re-explaining yourself"
        lead="Goals and decisions live inside the task. The next agent reads them instead of asking you."
        isCentered
        className="sharedContextHead"
      />
      <div className="sharedContextMock" data-reveal="">
        <HandoffMock />
      </div>
      <div className="sharedContextFacts" data-reveal="">
        <CardRow label="Shared context facts" columns={2} items={FACTS} />
      </div>
      <p className="sharedContextMore" data-reveal="">
        <a
          className="textLink"
          href="/features#context"
          data-see-more=""
          aria-label="See more about shared context"
        >
          See more
        </a>
      </p>
    </div>
  </Chapter>
);
