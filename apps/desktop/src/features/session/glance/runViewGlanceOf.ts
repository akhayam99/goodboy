import { decisionFailureOf } from '../../workflows/decisionFailureOf';
import type { RunView } from '../components/AgentTree/useRunView';
import { runGlanceOf } from './runGlanceOf';
import type { Glance } from './glanceOf';

type Params = {
  readonly view: RunView;
};

export const runViewGlanceOf = ({ view }: Params): Glance =>
  runGlanceOf({
    isDiscarded: view.isDiscarded,
    isCompleted: view.isCompleted,
    isDynamic: view.isDynamic,
    doneCount: view.doneCount,
    stepCount: view.stepCount,
    primary: view.primary?.kind ?? null,
    failure: decisionFailureOf({ orchestrator: view.orchestrator.state }),
  });
