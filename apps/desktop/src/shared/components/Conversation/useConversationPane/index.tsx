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

  return {
    section: {
      key: 'conversation',
      kind: 'conversation',
      label: 'Conversation',
      count: countMessages({ threads: source.threads }),
      isCollapsible: false,
      defaultOpen: true,
      content: <Conversation source={source} model={model} />,
    },
    composer: model.canSend ? <ConversationComposer source={source} model={model} /> : null,
  };
};
