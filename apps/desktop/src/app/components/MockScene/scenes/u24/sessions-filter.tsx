import type { ComponentType } from 'react';
import { SessionsFunnelOpenScene } from './SessionsFunnelOpenScene';
import { SessionsFunnelScene } from './SessionsFunnelScene';
import { SessionsHiddenScene } from './SessionsHiddenScene';
import { SessionsNoMatchScene } from './SessionsNoMatchScene';

export const U24_SESSIONS_FILTER_SCENES: Readonly<Record<string, ComponentType>> = {
  'sessions-funnel': SessionsFunnelScene,
  'sessions-funnel-open': SessionsFunnelOpenScene,
  'sessions-hidden': SessionsHiddenScene,
  'sessions-nomatch': SessionsNoMatchScene,
};
