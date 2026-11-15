import { isApiProvider, limitsChipOf } from '@goodboy/core/providers';
import { isProviderId } from '@goodboy/types/helpers';
import type { IntegrationKeyCheck } from '../../../store/slices/integrations/state';
import { formatLimitReset } from '../../providers/limits/formatLimitReset';
import { providerRailStatus } from '../../providers/providerRailStatus';
import type { ProviderDisplayInfo } from '../../providers/providers';
import type { ConnectionState } from './connectionState';
import { providerSetupVerb } from './providerSetupVerb';
import { toolStateOf } from './toolStateOf';

type ProviderSubject = {
  readonly kind: 'provider';
  readonly provider: ProviderDisplayInfo;
  readonly state: Parameters<typeof providerRailStatus>[0]['state'];
  readonly nowMs: number;
};

type ToolSubject = {
  readonly kind: 'tool';
  readonly isConnected: boolean;
  readonly hasKey: boolean;
  readonly keyCheck: IntegrationKeyCheck | null;
};

type Params = {
  readonly subject: ProviderSubject | ToolSubject;
};

type ProviderParams = {
  readonly subject: ProviderSubject;
};

type ToolParams = {
  readonly subject: ToolSubject;
};

type VerbParams = {
  readonly verb: string;
};

const BASE: Pick<ConnectionState, 'reason' | 'setupVerb' | 'isChecking'> = {
  reason: null,
  setupVerb: null,
  isChecking: false,
};

const CHECKING: ConnectionState = { ...BASE, word: 'Checking', tone: null, isChecking: true };

const notSetUp = ({ verb }: VerbParams): ConnectionState => ({
  ...BASE,
  word: 'Not set up',
  tone: null,
  setupVerb: verb,
});

const limitStateOf = ({ subject }: ProviderParams): ConnectionState | null => {
  const { provider, state, nowMs } = subject;
  if (!isProviderId(provider.id)) {
    return null;
  }
  const chip = limitsChipOf({
    providerId: provider.id,
    limits: state.providerLimits?.[provider.id],
    nowMs,
  });
  if (chip.state === 'out') {
    const until = chip.resetsAt === null ? '' : formatLimitReset({ iso: chip.resetsAt, nowMs });
    return {
      ...BASE,
      word: until === '' ? 'Out' : `Out until ${until}`,
      tone: 'warning',
      reason: `${provider.label} is out`,
    };
  }
  if (chip.state === 'warning') {
    return {
      ...BASE,
      word: 'About to run out',
      tone: 'warning',
      reason: `${provider.label} is about to run out`,
    };
  }
  return null;
};

const providerStateOf = ({ subject }: ProviderParams): ConnectionState => {
  const { provider, state, nowMs } = subject;
  const verb = providerSetupVerb({ provider });
  if (verb !== null) {
    return notSetUp({ verb });
  }
  if (provider.connection === 'unknown') {
    return CHECKING;
  }
  const status = providerRailStatus({ provider, state, nowMs, isLimitIgnored: true });
  if (status.subtitle !== undefined) {
    const tone = status.tone === 'warning' || status.tone === 'danger' ? status.tone : null;
    return { ...BASE, word: status.subtitle, tone, reason: provider.error };
  }
  const limit = limitStateOf({ subject });
  if (limit !== null) {
    return limit;
  }
  const word = isApiProvider({ id: provider.id }) ? 'Key saved' : 'Signed in';
  return { ...BASE, word, tone: null };
};

const toolConnectionOf = ({ subject }: ToolParams): ConnectionState => {
  const tool = toolStateOf(subject);
  if (tool.kind === 'notSetUp') {
    return notSetUp({ verb: 'Connect' });
  }
  if (tool.kind === 'checking') {
    return CHECKING;
  }
  if (tool.kind === 'keyMissing') {
    return { ...BASE, word: tool.word, tone: 'danger', reason: 'Key missing on this Mac' };
  }
  return { ...BASE, word: tool.word, tone: null };
};

export const connectionStateOf = ({ subject }: Params): ConnectionState =>
  subject.kind === 'provider' ? providerStateOf({ subject }) : toolConnectionOf({ subject });
