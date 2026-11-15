import type { ComponentType } from 'react';
import { brandId, type AgentId } from '@goodboy/types';
import { IMPLEMENTER_ID } from '../../u24/autoSceneSeed';
import { RunPageScene } from './RunPageScene';
import { runTraceSceneOf } from './runTraceSceneOf';

const SUB_AGENT_ID = brandId<AgentId>({ value: 'mock-auto-scout-apply' });

export const RUN_AGENT_SCENES = {
  'run-page-agent': () => (
    <RunPageScene
      state="working"
      theme="dark"
      extend={runTraceSceneOf}
      shownAgentId={IMPLEMENTER_ID}
    />
  ),
  'run-page-agent-light': () => (
    <RunPageScene
      state="working"
      theme="light"
      extend={runTraceSceneOf}
      shownAgentId={IMPLEMENTER_ID}
    />
  ),
  'run-page-subagent': () => (
    <RunPageScene
      state="working"
      theme="dark"
      extend={runTraceSceneOf}
      shownAgentId={SUB_AGENT_ID}
    />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
