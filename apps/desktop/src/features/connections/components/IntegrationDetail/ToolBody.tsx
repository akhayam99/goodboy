import { useState } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { KeyBinding } from '../../../../store/slices/integrations/verifyReplacementKey';
import type { ToolState } from '../../model/toolStateOf';
import { ToolUsesSection } from '../ToolUsesSection';
import { AccountSection } from './AccountSection';
import { CHANNELS_SECTION_ID } from './channelsSectionId';
import { KeyMissingNotice } from './KeyMissingNotice';
import { ToolOwnSections } from './ToolOwnSections';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly binding: KeyBinding;
  readonly label: string;
  readonly toolState: ToolState;
};

const openChannels = (): void => {
  appScrollIntoView({ element: document.getElementById(CHANNELS_SECTION_ID), block: 'start' });
};

export const ToolBody = ({ workspaceId, workspaceName, binding, label, toolState }: Props) => {
  const [isReplacing, setIsReplacing] = useState(false);
  const isKeyMissing = toolState.kind === 'keyMissing';
  const replace = () => setIsReplacing(true);
  const done = () => setIsReplacing(false);

  return (
    <>
      {isKeyMissing ? (
        <KeyMissingNotice
          workspaceId={workspaceId}
          binding={binding}
          label={label}
          isReplacing={isReplacing}
          onReplace={replace}
          onReplaceDone={done}
        />
      ) : null}
      <ToolUsesSection
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        tool={binding.provider}
        label={label}
        isPaused={isKeyMissing}
        onOpenChannels={openChannels}
      />
      <AccountSection
        workspaceId={workspaceId}
        binding={binding}
        label={label}
        toolState={toolState}
        isReplacing={isReplacing}
        onReplace={replace}
        onReplaceDone={done}
      />
      <ToolOwnSections workspaceId={workspaceId} binding={binding} />
    </>
  );
};
