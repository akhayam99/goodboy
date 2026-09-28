import { RunList } from '../components/mocks/RunList';
import { Beat } from './Beat';

export const JobsAndModels = () => (
  <Beat
    id="how"
    isBand
    leadIn="One agent doing everything loses track of the start"
    heading="Each job gets its own agent and the right model"
    body="A scout reads the code, a planner decides, implementers write and a tester checks. Put a light model on the quick jobs and a strong one on the plan, or let Auto choose for each role."
    links={[{ label: 'How roles work', anchor: 'roles' }]}
  >
    <RunList />
  </Beat>
);
