import './Sessions.css';
import { Chapter } from '../components/Chapter';
import { Frame } from '../components/Frame';
import { RUN_AGENTS } from '../figures';
import { SwitchAndFind } from './SwitchAndFind';
import { Workspace } from './Workspace';

export const Sessions = () => (
  <Chapter
    id="how"
    isBand
    head={{
      eyebrow: 'Inside a session',
      heading: 'One session, many chats',
      lead: 'A task gets one session, and inside it each chat has one job.',
    }}
  >
    <Frame figure={RUN_AGENTS}>
      <div className="contrastCols">
        <div>
          <h3 className="cellTitle was">With one chat</h3>
          <p className="cellText">
            The plan, the code, the tests and the review pile up in one thread. The model loses the
            start, and changing tool means telling the story again.
          </p>
        </div>
        <div>
          <h3 className="cellTitle">With Goodboy</h3>
          <p className="cellText">
            A scout reads, a planner decides, implementers write and a tester checks. Each chat
            stays short, so the model keeps all of it.
          </p>
        </div>
      </div>
    </Frame>
    <SwitchAndFind />
    <Workspace />
  </Chapter>
);
