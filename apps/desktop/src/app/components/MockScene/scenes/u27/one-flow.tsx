import type { ComponentType } from 'react';
import { NewSessionPageScene } from '../u24/NewSessionPageScene';
import { OneFlowScene, type OneFlowCenter, type OneFlowClicks } from './oneFlow/OneFlowScene';
import { ONE_FLOW_GOAL, PRESET_NAME } from './oneFlow/oneFlowSeed';

const APP: OneFlowCenter = { kind: 'app' };

const NEW_MENU: OneFlowClicks = { labels: ['New'], selector: 'button[aria-haspopup="menu"]' };

const CHANGE_MENU: OneFlowClicks = {
  labels: ['Change'],
  selector: '[data-one-flow-change] button[aria-haspopup="menu"]',
};

const GOAL = `${ONE_FLOW_GOAL} of harbor-portal on every width, and keep the 390px layout working.`;

const ROUTED: OneFlowCenter = {
  kind: 'run',
  route: {
    shape: 'plan',
    closeness: 'adapt',
    choice: `Plan from ${PRESET_NAME}, 3 steps · Adapt as it goes`,
    why: 'Your ask matches the preset and changes six pages',
  },
};

const ADAPTED: OneFlowCenter = {
  kind: 'run',
  route: {
    shape: 'plan',
    closeness: 'adapt',
    choice: `Plan from ${PRESET_NAME}, 4 steps · Adapt as it goes · 1 change`,
    why: 'Step 3 added for the billing table',
  },
};

const LEAD: OneFlowCenter = {
  kind: 'lead',
  route: {
    shape: 'lead',
    closeness: null,
    choice: 'One agent that starts what it needs',
    why: 'A check across pages, and no preset fits',
  },
};

export const U27_ONE_FLOW_SCENES = {
  'u27-one-flow-before-overview': () => (
    <OneFlowScene seed={{ era: 'before', place: 'overview' }} center={APP} />
  ),
  'u27-one-flow-before-new-menu': () => (
    <OneFlowScene seed={{ era: 'before', place: 'overview' }} center={APP} clicks={NEW_MENU} />
  ),
  'u27-one-flow-before-new-session': () => (
    <NewSessionPageScene state={{ choice: 'workflow', isPreset: true, goal: GOAL }} />
  ),
  'u27-one-flow-before-preset-run': () => (
    <OneFlowScene seed={{ era: 'before', place: 'preset' }} center={APP} />
  ),
  'u27-one-flow-before-orchestrated': () => (
    <OneFlowScene seed={{ era: 'before', place: 'orchestrated' }} center={APP} />
  ),
  'u27-one-flow-before-agent': () => (
    <OneFlowScene seed={{ era: 'before', place: 'agent' }} center={APP} />
  ),
  'u27-one-flow-before-auto': () => (
    <OneFlowScene seed={{ era: 'before', place: 'auto' }} center={APP} />
  ),
  'u27-one-flow-after-entry': () => (
    <OneFlowScene seed={{ era: 'after', place: 'runs' }} center={APP} />
  ),
  'u27-one-flow-after-routed': () => (
    <OneFlowScene
      seed={{ era: 'after', place: 'orchestrated', isJustStarted: true }}
      center={ROUTED}
      clicks={CHANGE_MENU}
    />
  ),
  'u27-one-flow-after-preset': () => (
    <OneFlowScene
      seed={{ era: 'after', place: 'orchestrated', drawerStepKey: 'plan-billing' }}
      center={ADAPTED}
    />
  ),
  'u27-one-flow-after-single-agent': () => (
    <OneFlowScene seed={{ era: 'after', place: 'auto' }} center={LEAD} />
  ),
  'u27-one-flow-after-runs': () => (
    <OneFlowScene seed={{ era: 'before', place: 'runs' }} center={APP} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
