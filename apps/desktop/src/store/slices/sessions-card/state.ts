export const SETTING_SESSIONS_CARD_CLOSED = 'shell.sessionsCardClosed';

export type SessionsCardPhase = 'loading' | 'open' | 'closed';

export type SessionsCardState = {
  readonly sessionsCardPhase: SessionsCardPhase;
};

export const sessionsCardInitialState: SessionsCardState = {
  sessionsCardPhase: 'loading',
};
