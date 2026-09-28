import { Chapter } from '../components/Chapter';
import { Frame } from '../components/Frame';
import { BUILDER } from '../figures';
import { Context } from './Context';
import { WorkflowsGrid } from './WorkflowsGrid';

export const Workflows = () => (
  <Chapter
    id="workflows"
    head={{
      eyebrow: 'Workflows',
      heading: 'Run a goal as steps, each a fresh agent',
      lead: 'An orchestrator picks each next agent after the last one finishes. You set the guidance, the providers it may use, and a spend cap.',
    }}
  >
    <Frame figure={BUILDER} />
    <WorkflowsGrid />
    <Context />
  </Chapter>
);
