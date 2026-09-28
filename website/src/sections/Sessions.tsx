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
      eyebrow: 'Overview and activity',
      heading: 'One session for all your agents',
      lead: 'Each one has a single job and starts from the same brief.',
    }}
  >
    <Frame figure={RUN_AGENTS}>
      <div className="contrastCols">
        <div>
          <h3 className="cellTitle was">One long conversation</h3>
          <p className="cellText">
            The plan, the code, the tests and the review pile up in one thread. The model loses the
            start, and changing tool means telling the story again.
          </p>
        </div>
        <div>
          <h3 className="cellTitle">With Goodboy</h3>
          <p className="cellText">
            A scout reads, a planner decides, implementers write and a tester checks. Each one stays
            short, so the model keeps all of it.
          </p>
        </div>
      </div>
    </Frame>
    <SwitchAndFind />
    <Workspace />
  </Chapter>
);
