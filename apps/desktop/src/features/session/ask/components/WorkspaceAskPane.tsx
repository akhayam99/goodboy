import { useState } from 'react';
import { Button, DrawerFrame } from '@goodboy/ui';
import type { ChatId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { useAppStore } from '../../../../store';
import { askInWorkspaceChat } from '../askInWorkspaceChat';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const WorkspaceAskPane = ({ workspaceId, onClose }: Props) => {
  const [question, setQuestion] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [started, setStarted] = useState<ChatId | null>(null);
  const openStudio = useAppStore((state) => state.openStudio);

  const send = async (): Promise<void> => {
    setIsBusy(true);
    const chatId = await askInWorkspaceChat({ workspaceId, question });
    setIsBusy(false);
    if (chatId !== null) {
      setQuestion('');
      setStarted(chatId);
    }
  };

  return (
    <DrawerFrame isDock title="Ask" icon={CONCEPT_ICONS.ask} onClose={onClose}>
      <div className="flex flex-col gap-3 px-2">
        <PromptField
          kind="message"
          label="Ask about the workspace"
          placeholder="Ask about the workspace. It becomes a chat."
          value={question}
          onChange={setQuestion}
          onSubmit={() => void send()}
          isSubmitBlocked={question.trim() === '' || isBusy}
          minRows={3}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            isBusy={isBusy}
            disabled={question.trim() === ''}
            onClick={() => void send()}
          >
            Ask
          </Button>
          {started === null ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openStudio({ studio: { kind: 'chat', chatId: started } })}
            >
              Open in Chat
            </Button>
          )}
        </div>
        {started === null ? null : (
          <p className="text-meta text-faint-foreground">Started in Chat. The answer is there.</p>
        )}
      </div>
    </DrawerFrame>
  );
};
