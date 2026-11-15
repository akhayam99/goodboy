import { isApiProvider } from '@goodboy/core/providers';
import { Chip } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';
import { useProviderHealth } from '../../../shared/hooks/useProviderHealth';
import { sentenceCase } from '../../../shared/utils/sentenceCase';
import { CLI_LABEL } from '../cliLabel';
import { checkedLine } from '../providerHealthCopy';
import type { ProviderDisplayInfo } from '../providers';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly planLabel: string | null;
  readonly isReady: boolean;
};

type FactsParams = Props & {
  readonly keyName: string | null;
  readonly checked: string | null;
};

const CLOCK_MS = 60_000;

const factsOf = ({ info, planLabel, isReady, keyName, checked }: FactsParams) => {
  const cli = info.version === null ? null : `${CLI_LABEL[info.id]} ${info.version}`;
  const checkedFact = checked === null ? null : sentenceCase({ text: checked });
  if (isApiProvider({ id: info.id })) {
    return ['API key', keyName, 'Runs through OpenCode', checkedFact];
  }
  if (!isReady) {
    return [cli];
  }
  return [planLabel === null ? null : `${planLabel} plan`, info.identity, cli, checkedFact];
};

export const ProviderFacts = ({ info, planLabel, isReady }: Props) => {
  const health = useProviderHealth({ providerId: info.id });
  const nowMs = useNow(CLOCK_MS);
  const credential = useAppStore((state) =>
    state.providerCredentials.find((item) => item.providerId === info.id),
  );
  const keyName = credential === undefined ? null : `${credential.label} ${credential.hint}`;
  const facts = factsOf({
    info,
    planLabel,
    isReady,
    keyName,
    checked: checkedLine({ health, nowMs }),
  }).filter((fact): fact is string => fact !== null);
  if (facts.length === 0) {
    return null;
  }
  return (
    <ul aria-label={`${info.label} facts`} className="flex min-w-0 flex-wrap items-center gap-2">
      {facts.map((fact) => (
        <li key={fact} className="min-w-0">
          <Chip kind="reference" tone="neutral" label={fact} />
        </li>
      ))}
    </ul>
  );
};
