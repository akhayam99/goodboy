import { AUTO_GATES, AUTO_OWN_PROVIDERS } from '@goodboy/core';
import type { AppStore } from '../../store/store';

const OFF_REASON = 'Auto is not available in this build.';
const NO_PROVIDER_REASON = 'Connect Claude, Codex, Cursor or Gemini to use Auto.';

type Params = {
  readonly state: Pick<AppStore, 'providers'>;
  readonly isReleased?: boolean;
};

export const autoUnavailableReason = ({
  state,
  isReleased = AUTO_GATES.isDelegationEnabled,
}: Params): string | null => {
  if (!isReleased) {
    return OFF_REASON;
  }
  const isConnected = AUTO_OWN_PROVIDERS.some((provider) =>
    state.providers.some((entry) => entry.id === provider && entry.connection === 'connected'),
  );
  return isConnected ? null : NO_PROVIDER_REASON;
};
