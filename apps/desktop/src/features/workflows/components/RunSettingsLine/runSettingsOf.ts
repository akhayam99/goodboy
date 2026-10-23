import { formatUsd } from '@goodboy/ui';
import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';
import type { ProviderId, WorkflowAutonomy, WorkflowRun } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { asksWordsOf } from '../../asksWordsOf';
import { runAutonomyOf } from '../../runAutonomy';

export type RunSettingWords = SettingWords;

export type RunSettings = Readonly<{
  asks: RunSettingWords;
  limit: RunSettingWords;
  models: RunSettingWords;
}>;

type Params = {
  readonly run: WorkflowRun;
  readonly workspaceName: string;
  readonly workspaceAutonomy: WorkflowAutonomy;
  readonly sessionCapUsd: number | null;
  readonly spentUsd: number;
  readonly providers: ReadonlyArray<ProviderId>;
};

type ProvidersParams = {
  readonly providers: ReadonlyArray<ProviderId>;
};

const namesOf = ({ providers }: ProvidersParams): string =>
  providers.map((provider) => PROVIDER_LABEL[provider]).join(', ');

type AsksParams = Pick<Params, 'run' | 'workspaceName' | 'workspaceAutonomy'>;

const asksOf = ({ run, workspaceName, workspaceAutonomy }: AsksParams): RunSettingWords =>
  asksWordsOf({
    own: runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy }),
    workspaceName,
    workspaceAutonomy,
  });

type LimitParams = Pick<Params, 'run' | 'sessionCapUsd' | 'spentUsd'>;

type AmountParams = {
  readonly amount: number | null;
};

const amountOf = ({ amount }: AmountParams): string =>
  amount === null ? 'none' : formatUsd(amount);

const limitOf = ({ run, sessionCapUsd, spentUsd }: LimitParams): RunSettingWords => {
  const runLimit = run.spendLimitUsd ?? null;
  const limits = [runLimit, sessionCapUsd].filter((limit): limit is number => limit !== null);
  const first = limits.length === 0 ? null : Math.min(...limits);
  const chain = `This run ${amountOf({ amount: runLimit })}, then session ${amountOf({
    amount: sessionCapUsd,
  })}.`;
  if (first === null) {
    return {
      value: spentUsd === 0 ? 'none' : `${formatUsd(spentUsd)} spent`,
      source: '',
      chain: `${chain} Nothing stops this run.`,
    };
  }
  return {
    value: `${formatUsd(spentUsd)} of ${formatUsd(first)}`,
    source: first === runLimit ? 'this run' : 'from session',
    chain: `${chain} ${formatUsd(first)} comes first.`,
  };
};

type ModelsParams = Pick<Params, 'run' | 'workspaceName' | 'providers'>;

const modelsOf = ({ run, workspaceName, providers }: ModelsParams): RunSettingWords => {
  const own = (run.providerPool ?? []).filter((provider) => providers.includes(provider));
  const inherited = namesOf({ providers });
  if (own.length === 0) {
    return {
      value: `Auto on ${inherited}`,
      source: `from ${workspaceName}`,
      chain: `This run: none set. ${workspaceName}: ${inherited}. ${workspaceName} wins.`,
    };
  }
  const names = namesOf({ providers: own });
  return {
    value: `Auto on ${names}`,
    source: 'this run',
    chain: `This run: ${names}. ${workspaceName}: ${inherited}. The run wins.`,
  };
};

export const runSettingsOf = ({
  run,
  workspaceName,
  workspaceAutonomy,
  sessionCapUsd,
  spentUsd,
  providers,
}: Params): RunSettings => ({
  asks: asksOf({ run, workspaceName, workspaceAutonomy }),
  limit: limitOf({ run, sessionCapUsd, spentUsd }),
  models: modelsOf({ run, workspaceName, providers }),
});
