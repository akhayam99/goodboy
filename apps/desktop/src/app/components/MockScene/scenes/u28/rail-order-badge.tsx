import type { ComponentType } from 'react';
import { RailCountsToolsScene } from './RailCountsToolsScene';
import { RailOrderDoorsScene } from './RailOrderDoorsScene';
import { RailOrderToolsScene } from './RailOrderToolsScene';

export const U28_RAIL_ORDER_BADGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'session-tools-counts': RailCountsToolsScene,
  'session-tools-order': RailOrderToolsScene,
  'sessions-door-counts': RailOrderDoorsScene,
};
