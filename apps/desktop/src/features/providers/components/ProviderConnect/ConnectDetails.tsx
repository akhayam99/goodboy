import { Divider } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { EscapeHatch } from './EscapeHatch';
import { GuidePanel } from './GuidePanel';
import type { ProviderGuide } from './guides';
import { InlineTerminal } from '../InlineTerminal';
import { CommandPreview } from '@goodboy/ui';

type Props = {
  readonly providerId: ProviderId;
  readonly runId: string | null;
  readonly command: string | null;
  readonly action: ProviderLifecycleAction | null;
  readonly guide: ProviderGuide;
};

export const ConnectDetails = ({ providerId, runId, command, action, guide }: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {runId !== null && <InlineTerminal runId={runId} isActive heightClass="h-44" />}
      {command !== null && <CommandPreview command={command} />}
      {command !== null && action !== null && (
        <EscapeHatch command={command} providerId={providerId} action={action} />
      )}
      <Divider />
      <GuidePanel guide={guide} />
    </div>
  );
};
