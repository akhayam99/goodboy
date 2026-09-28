import { Chapter } from '../components/Chapter';
import { Frame } from '../components/Frame';
import { RUN_PARALLEL } from '../figures';
import { Context } from './Context';
import { WorkflowsGrid } from './WorkflowsGrid';

export const Workflows = () => (
  <Chapter
    id="workflows"
    isBand
    head={{
      eyebrow: 'Workflows',
      heading: 'Run a goal as steps, each a fresh agent',
      lead: 'An orchestrator picks each next step and waits for it to finish. Inside a step, several agents can work side by side.',
    }}
  >
    <Frame figure={RUN_PARALLEL} />
    <WorkflowsGrid />
    <Context />
  </Chapter>
);
