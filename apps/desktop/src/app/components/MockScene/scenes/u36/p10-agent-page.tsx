import type { ComponentType } from 'react';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';
import { C06AgentScene } from '../u25/C06AgentScene';
import { P10ChildComposerScene } from './P10ChildComposerScene';

const CHILD_WORKING: C07Seed = { state: 'working', place: 'child', pane: 'implementer' };

const CHILD_DONE: C07Seed = { state: 'done', place: 'child', pane: 'tester' };

export const U36_P10_AGENT_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p10-child-page': () => <C07AutoFrame seed={CHILD_WORKING} />,
  'u36-p10-child-result': () => <C07AutoFrame seed={CHILD_DONE} />,
  'u36-p10-child-composer-light': () => <P10ChildComposerScene theme="light" />,
  'u36-p10-child-composer-dark': () => <P10ChildComposerScene theme="dark" />,
  'u36-p10-steps': () => <C06AgentScene state="finished" isTranscriptOpen />,
};
