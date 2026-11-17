import type { ComponentType } from 'react';
import { RailOrderDoorsScene } from './RailOrderDoorsScene';
import { RailOrderToolsScene } from './RailOrderToolsScene';
import { RailQuietToolsScene } from './RailQuietToolsScene';
import { RailSignalToolsScene } from './RailSignalToolsScene';

export const U28_RAIL_ORDER_BADGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'session-tools-order': RailOrderToolsScene,
  'session-tools-quiet': RailQuietToolsScene,
  'session-tools-signal': RailSignalToolsScene,
  'sessions-door-counts': RailOrderDoorsScene,
};
