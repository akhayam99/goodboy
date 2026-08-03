import type { Tone } from '@goodboy/ui';
import type { ResolverActionRole } from './resolverActions';

export const RESOLVER_ACTION_TONE: Record<ResolverActionRole, Tone> = {
  primary: 'info',
  alert: 'warning',
  danger: 'danger',
  neutral: 'neutral',
};
