import type { IntegrationBinding } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';

export type ConnectionToolId = IntegrationBinding['provider'];

export type ConnectionState = {
  readonly word: string;
  readonly tone: Extract<Tone, 'warning' | 'danger'> | null;
  readonly reason: string | null;
  readonly setupVerb: string | null;
  readonly isChecking: boolean;
};
