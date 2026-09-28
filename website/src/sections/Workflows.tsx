import { Chapter } from '../components/Chapter';
import { Frame } from '../components/Frame';
import { RUN_CANVAS } from '../figures';
import { Context } from './Context';
import { WorkflowsGrid } from './WorkflowsGrid';

export const Workflows = () => (
  <Chapter
    id="workflows"
    isBand
    head={{
      eyebrow: 'Workflows',
      heading: 'Split a big goal into several steps',
      lead: 'An orchestrator picks what runs next and waits for it to finish. Inside a step, several agents can work side by side.',
    }}
  >
    <Frame figure={RUN_CANVAS} isCanvas />
    <WorkflowsGrid />
    <Context />
  </Chapter>
);
