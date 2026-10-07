import './Tour.css';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Chapter } from '../components/Chapter';
import { BoardMock } from '../components/mocks/BoardMock';
import { DiffReviewMock } from '../components/mocks/DiffReviewMock';
import { InboxMock } from '../components/mocks/InboxMock';
import { WorkflowRunMock } from '../components/mocks/WorkflowRunMock';

type Stop = {
  readonly id: string;
  readonly tab: string;
  readonly title: string;
  readonly text: string;
  readonly href: string;
  readonly mock: ReactNode;
};

const STOPS: readonly Stop[] = [
  {
    id: 'inbox',
    tab: 'Inbox',
    title: 'Turn an issue into a task',
    text: 'Items from all your tools sit in one list. Open one and the task starts with its goal filled in.',
    href: '/features#tools',
    mock: <InboxMock />,
  },
  {
    id: 'workflow',
    tab: 'Workflow',
    title: 'Split a big goal into steps',
    text: 'Goodboy runs the parts in order and waits for each one. Several agents can work side by side.',
    href: '/features#workflows',
    mock: <WorkflowRunMock />,
  },
  {
    id: 'review',
    tab: 'Review',
    title: 'Check what the agents wrote before it merges',
    text: 'An agent turns each comment into a commit and drafts the reply. You accept, edit or skip.',
    href: '/features#review',
    mock: <DiffReviewMock />,
  },
  {
    id: 'board',
    tab: 'Board',
    title: 'See where every task stands',
    text: 'Building, running, needs you, in review, done and archived. Each card shows its pull request and what it cost.',
    href: '/features#running',
    mock: <BoardMock />,
  },
];

export const Tour = () => {
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    setSelected(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = STOPS.length - 1;
    const targets = new Map<string, number>([
      ['ArrowRight', selected === last ? 0 : selected + 1],
      ['ArrowLeft', selected === 0 ? last : selected - 1],
      ['Home', 0],
      ['End', last],
    ]);
    const target = targets.get(event.key);
    if (target === undefined) {
      return;
    }
    select(target);
    event.preventDefault();
  };

  return (
    <Chapter id="tour" head={{ heading: 'From issue to merged pull request' }}>
      <div className="tourWrap" data-reveal="">
        <div className="tourTabs" role="tablist" aria-label="Tour" onKeyDown={onKeyDown}>
          {STOPS.map((stop, index) => (
            <button
              key={stop.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tour-tab-${stop.id}`}
              className="tourTab"
              aria-selected={selected === index}
              aria-controls={`tour-panel-${stop.id}`}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
            >
              {stop.tab}
            </button>
          ))}
        </div>
        {STOPS.map((stop, index) => (
          <div
            key={stop.id}
            role="tabpanel"
            id={`tour-panel-${stop.id}`}
            className="tourPanel"
            aria-labelledby={`tour-tab-${stop.id}`}
            tabIndex={0}
            hidden={selected !== index}
          >
            <div className="tourText">
              <h3 className="tourTitle">{stop.title}</h3>
              <p className="tourCopy">{stop.text}</p>
              <p>
                <a
                  className="textLink"
                  href={stop.href}
                  data-see-more=""
                  aria-label={`See more about ${stop.tab.toLowerCase()}`}
                >
                  See more
                </a>
              </p>
            </div>
            <div className="tourMock">{stop.mock}</div>
          </div>
        ))}
      </div>
    </Chapter>
  );
};
