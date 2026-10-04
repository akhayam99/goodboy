import type { ProviderId } from '@goodboy/types';
import { Notice } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { splitRuleProviders } from '../../utils/providerSupport';

type Props = {
  readonly workspaceName: string;
  readonly activeProviders: ReadonlyArray<ProviderId>;
};

export const IgnoredDenyNotice = ({ workspaceName, activeProviders }: Props) => {
  const { ignorers } = splitRuleProviders({ providers: activeProviders });
  const names = ignorers.map((provider) => PROVIDER_LABEL[provider]);
  const joined =
    names.length < 2
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return (
    <Notice
      tone="warning"
      placement="inline"
      title="Deny rules only stop Claude"
      body={`In ${workspaceName}, ${joined} also ${names.length === 1 ? 'runs' : 'run'} agents. For work that must never happen, pick Claude for that session, or set the default to Read only.`}
    />
  );
};
