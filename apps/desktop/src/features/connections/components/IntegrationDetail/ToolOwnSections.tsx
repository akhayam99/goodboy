import type { WorkspaceId } from '@goodboy/types';
import type { KeyBinding } from '../../../../store/slices/integrations/verifyReplacementKey';
import { SentryProjectMap } from '../../../integrations/sentry/SentryProjectMap';
import { SlackAgentPolicy } from '../../../integrations/slack/SlackSettings/SlackAgentPolicy';
import { SlackChannels } from '../../../integrations/slack/SlackSettings/SlackChannels';
import { SlackSignature } from '../../../integrations/slack/SlackSettings/SlackSignature';
import { CHANNELS_SECTION_ID } from './channelsSectionId';
import { ToolSection } from './ToolSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly binding: KeyBinding;
};

export const ToolOwnSections = ({ workspaceId, binding }: Props) => {
  if (binding.provider === 'sentry') {
    return (
      <SentryProjectMap
        workspaceId={workspaceId}
        credentialId={binding.credentialId}
        org={binding.config.org}
      />
    );
  }
  if (binding.provider !== 'slack') {
    return null;
  }
  return (
    <>
      <ToolSection id={CHANNELS_SECTION_ID} label="Channels">
        <SlackChannels workspaceId={workspaceId} slack={binding} />
      </ToolSection>
      <ToolSection label="What agents can do">
        <SlackAgentPolicy workspaceId={workspaceId} slack={binding} />
      </ToolSection>
      <ToolSection label="Signature">
        <SlackSignature workspaceId={workspaceId} slack={binding} />
      </ToolSection>
    </>
  );
};
