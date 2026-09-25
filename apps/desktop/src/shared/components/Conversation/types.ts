import type { ReactNode } from 'react';

export type ConversationAuthor = {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly handle: string | null;
};

export type ConversationMessageStatus = 'sent' | 'sending' | 'failed';

export type ConversationMessage = {
  readonly id: string;
  readonly author: ConversationAuthor;
  readonly createdAt: string;
  readonly body: string;
  readonly status: ConversationMessageStatus;
};

export type ConversationThread = {
  readonly id: string;
  readonly head: ConversationMessage;
  readonly replies: ReadonlyArray<ConversationMessage>;
  readonly anchor: string | null;
  readonly isResolved: boolean | null;
};

export type ConversationReplyMode = 'thread' | 'quote' | 'none';

export type ConversationCapabilities = {
  readonly reply: ConversationReplyMode;
  readonly startThread: boolean;
  readonly resolve: boolean;
  readonly react: boolean;
};

export type ConversationPostParams = {
  readonly body: string;
  readonly threadId: string | null;
};

export type ConversationResolveParams = {
  readonly threadId: string;
  readonly isResolved: boolean;
};

export type ConversationResolveError = {
  readonly threadId: string;
  readonly message: string;
};

export type ConversationSource = {
  readonly toolLabel: string;
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly capabilities: ConversationCapabilities;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onPost: ((params: ConversationPostParams) => Promise<void>) | null;
  readonly onResolve: ((params: ConversationResolveParams) => Promise<void>) | null;
  readonly resolveError: ConversationResolveError | null;
  readonly emptyDescription: string;
  readonly footnote: string | null;
  readonly composerNote: string | null;
  readonly renderMessageFooter: ((message: ConversationMessage) => ReactNode) | null;
};
