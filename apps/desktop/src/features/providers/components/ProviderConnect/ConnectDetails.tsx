import { Divider } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { EscapeHatch } from './EscapeHatch';
import { GuidePanel } from './GuidePanel';
import type { ProviderGuide } from './guides';
import { InlineTerminal } from '../InlineTerminal';
import { CommandPreview } from '@goodboy/ui';

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
