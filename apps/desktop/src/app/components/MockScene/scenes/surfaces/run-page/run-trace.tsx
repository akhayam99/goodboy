import type { ComponentType } from 'react';
import { RunPageScene } from './RunPageScene';
import { runTraceSceneOf } from './runTraceSceneOf';

export const RUN_TRACE_SCENES = {
  'run-page-trace': () => <RunPageScene state="working" theme="dark" extend={runTraceSceneOf} />,
  'run-page-trace-light': () => (
    <RunPageScene state="working" theme="light" extend={runTraceSceneOf} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
