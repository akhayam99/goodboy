import './TwoWays.css';
import { Chapter } from '../components/Chapter';
import { TwoWaysBars } from '../components/mocks/TwoWaysBars';

export const TwoWays = () => (
  <Chapter
    id="two-ways"
    tone="band"
    head={{
      eyebrow: 'Providers, limits and cost',
      heading: 'The same task, run two ways',
      lead: "A bug fix doesn't need one agent that remembers everything. Give each step a fresh one and pay only for what it reads.",
    }}
  >
    <div className="twoWaysBody" data-reveal="">
      <TwoWaysBars />
      <p className="twoWaysFoot">
        <span>Example run on the Harborline webhook fix.</span>
        <a className="textLink" href="/features#providers" data-see-more="">
          See more about cost
        </a>
      </p>
    </div>
  </Chapter>
);
