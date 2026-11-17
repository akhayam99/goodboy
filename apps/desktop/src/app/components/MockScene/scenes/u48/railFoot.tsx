import type { ComponentType } from 'react';
import { RailFootScene } from './RailFootScene';

export const U48_RAIL_FOOT_SCENES: Readonly<Record<string, ComponentType>> = {
  'rail-foot-rest': () => <RailFootScene kind="rest" isCardOpen={false} />,
  'rail-foot-available': () => <RailFootScene kind="available" isCardOpen />,
  'rail-foot-downloading': () => <RailFootScene kind="downloading" isCardOpen />,
  'rail-foot-ready': () => <RailFootScene kind="ready" isCardOpen />,
  'rail-foot-running': () => <RailFootScene kind="running" isCardOpen />,
  'rail-foot-queued': () => <RailFootScene kind="queued" isCardOpen />,
  'rail-foot-failed': () => <RailFootScene kind="failed" isCardOpen />,
};
