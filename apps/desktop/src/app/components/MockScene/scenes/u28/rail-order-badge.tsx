import type { ComponentType } from 'react';
import { RailOrderDoorsScene } from './RailOrderDoorsScene';
import { RailOrderToolsScene } from './RailOrderToolsScene';

export const U28_RAIL_ORDER_BADGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'session-tools-order': RailOrderToolsScene,
  'sessions-door-counts': RailOrderDoorsScene,
};
