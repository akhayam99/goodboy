import type { SessionId } from '@goodboy/types';

export const SESSION_SETUP_STEPS = ['goal', 'project', 'work'] as const;

export type SessionSetupStep = (typeof SESSION_SETUP_STEPS)[number];

export type SessionStartState = {
  readonly blankSessionId: SessionId | null;
  readonly goodboyNamedSessionId: SessionId | null;
  readonly sessionSetupSkips: Readonly<Record<SessionId, ReadonlyArray<SessionSetupStep>>>;
  readonly sessionSetupOpenStep: Readonly<Record<SessionId, SessionSetupStep>>;
};

export const initialSessionStartState: SessionStartState = {
  blankSessionId: null,
  goodboyNamedSessionId: null,
  sessionSetupSkips: {},
  sessionSetupOpenStep: {},
};
