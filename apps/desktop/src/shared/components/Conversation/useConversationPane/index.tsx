import type { ReactNode } from 'react';
import type { RecordSection } from '../../StudioDetail/RecordSections/types';
import { Conversation } from '..';
import { ConversationComposer } from '../ConversationComposer';
import { countMessages } from '../countMessages';
import type { ConversationSource } from '../types';
import { useConversation } from '../useConversation';

type Params = {
  readonly source: ConversationSource;
  readonly resetKey: string;
};

type Result = {
  readonly section: RecordSection;
  readonly composer: ReactNode;
};

export const useConversationPane = ({ source, resetKey }: Params): Result => {
  const model = useConversation({ source, resetKey });
  const composer = model.canSend ? <ConversationComposer source={source} model={model} /> : null;

  return {
    section: {
      key: 'conversation',
      kind: 'conversation',
      label: 'Conversation',
      ...(source.error == null && { count: countMessages({ threads: source.threads }) }),
      isCollapsible: false,
      defaultOpen: true,
      content: (
        <div className="flex min-w-0 flex-col gap-4">
          <Conversation source={source} model={model} />
          {composer}
        </div>
      ),
    },
    composer: null,
  };
};
