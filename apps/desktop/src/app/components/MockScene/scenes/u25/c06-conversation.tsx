import type { ComponentType } from 'react';
import { C06AgentScene } from './C06AgentScene';
import { C06AgentsScene } from './C06AgentsScene';

const MENU_CLICKS: ReadonlyArray<string> = ['More agent actions'];
const TURN_DETAIL_CLICKS: ReadonlyArray<string> = ['Turn detail'];

export const U25_C06_CONVERSATION_SCENES = {
  'c06-agent-working': () => <C06AgentScene state="working" />,
  'c06-agent-finished': () => <C06AgentScene state="finished" />,
  'c06-agent-failed': () => <C06AgentScene state="failed" />,
  'c06-agent-steps': () => <C06AgentScene state="failed" isStepsOpen isTranscriptOpen />,
  'c06-agent-permission': () => <C06AgentScene state="permission" />,
  'c06-agent-delegating': () => <C06AgentScene state="delegating" />,
  'c06-agent-transcript': () => <C06AgentScene state="finished" isTranscriptOpen />,
  'c06-agent-menu': () => <C06AgentScene state="finished" clicks={MENU_CLICKS} />,
  'c06-turn-detail': () => <C06AgentScene state="finished" clicks={TURN_DETAIL_CLICKS} />,
  'c06-agents-list': () => <C06AgentsScene isEmpty={false} />,
  'c06-agents-empty': () => <C06AgentsScene isEmpty />,
} satisfies Readonly<Record<string, ComponentType>>;
