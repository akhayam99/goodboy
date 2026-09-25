import { EmptyState, ErrorStrip } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../conceptIcons';
import { ConversationSkeleton } from './ConversationSkeleton';
import { isContinuation } from './isContinuation';
import { ThreadBlock } from './ThreadBlock';
import type { ConversationSource, ConversationThread } from './types';
import type { ConversationModel } from './useConversation';

type Props = {
  readonly source: ConversationSource;
  readonly model: ConversationModel;
};

type FlatParams = {
  readonly thread: ConversationThread | undefined;
};

const isFlat = ({ thread }: FlatParams): boolean =>
  thread != null &&
  thread.replies.length === 0 &&
  thread.anchor == null &&
  thread.isResolved !== true;

export const Conversation = ({ source, model }: Props) => {
  if (source.isLoading && model.threads.length === 0) {
    return <ConversationSkeleton />;
  }

  if (source.error != null) {
    return (
      <ErrorStrip
        label="the conversation"
        error={new Error(source.error)}
        onRetry={source.onRetry}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {model.threads.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.comments}
          tone={CONCEPT_TONE.comments}
          title="No comments yet"
          description={source.emptyDescription}
          size="inline"
          className="py-5"
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {model.threads.map((thread, index) => {
            const previous = model.threads[index - 1];
            const isHeadContinuation =
              isFlat({ thread }) &&
              isFlat({ thread: previous }) &&
              isContinuation({ previous: previous?.head ?? null, message: thread.head });
            return (
              <li key={thread.id} className="min-w-0">
                <ThreadBlock
                  thread={thread}
                  source={source}
                  model={model}
                  isHeadContinuation={isHeadContinuation}
                />
              </li>
            );
          })}
        </ul>
      )}
      {source.footnote == null ? null : (
        <p className="text-2xs text-muted-foreground">{source.footnote}</p>
      )}
    </div>
  );
};
