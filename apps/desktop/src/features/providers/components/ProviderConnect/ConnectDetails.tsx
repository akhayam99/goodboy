import { Divider } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { EscapeHatch } from '../ProviderConnectModal/EscapeHatch';
import { GuidePanel } from '../ProviderConnectModal/GuidePanel';
import type { ProviderGuide } from '../ProviderConnectModal/guides';
import { InlineTerminal } from '../ProviderLifecycleTile/InlineTerminal';
import { CommandPreview } from './CommandPreview';

type Props = {
  readonly providerId: ProviderId;
  readonly runId: string | null;
  readonly command: string | null;
  readonly guide: ProviderGuide;
};

export const ConnectDetails = ({ providerId, runId, command, guide }: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {runId !== null && <InlineTerminal runId={runId} isActive heightClass="h-44" />}
      {command !== null && <CommandPreview command={command} />}
      {command !== null && <EscapeHatch command={command} providerId={providerId} />}
      <Divider />
      <GuidePanel guide={guide} />
    </div>
  );
};
