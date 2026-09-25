import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { ConversationSource } from '../../../../shared/components/Conversation/types';
import { useConversationPane } from '../../../../shared/components/Conversation/useConversationPane';

type Props = {
  readonly title: string;
  readonly source: ConversationSource;
};

export const ConversationScenePane = ({ title, source }: Props) => {
  const conversation = useConversationPane({ source, resetKey: title });

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col overflow-hidden rounded-lg border border-border-soft bg-background">
      <PaneShell scroll="body" title={title} dock={conversation.composer}>
        <RecordSections sections={[{ ...conversation.section, label: `${title} conversation` }]} />
      </PaneShell>
    </div>
  );
};
