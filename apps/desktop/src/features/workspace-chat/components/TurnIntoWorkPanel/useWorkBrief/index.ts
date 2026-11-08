import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatMessageId, ChatSummary, ProjectId } from '@goodboy/types';
import { activeChatBackend } from '../../../activeChatBackend';
import { summarizeChatForWork } from '../../../summarizeChatForWork';
import type { WorkBrief } from '../../../workBrief';
import type { WorkBriefDrafts } from '../../../hooks/useWorkBriefDrafts';
import type { WorkDrafterChoice } from '../../../workDrafter';

type Params = {
  readonly chat: ChatSummary;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly anchorMessageId: ChatMessageId | null;
  readonly drafter: WorkDrafterChoice | null;
  readonly projectNames: ReadonlyArray<string>;
  readonly drafts: WorkBriefDrafts;
};

type UpToParams = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly anchorMessageId: ChatMessageId | null;
};

type PatchParams = {
  readonly next: Partial<WorkBrief>;
};

export type WorkBriefModel = {
  readonly brief: WorkBrief | null;
  readonly pickedProjectIds: ReadonlyArray<ProjectId> | null;
  readonly patch: (params: PatchParams) => void;
  readonly setProjectIds: (ids: ReadonlyArray<ProjectId>) => void;
  readonly discard: () => void;
};

const upTo = ({ messages, anchorMessageId }: UpToParams): ReadonlyArray<ChatMessage> => {
  const index = messages.findIndex((message) => message.id === anchorMessageId);
  return index === -1 ? messages : messages.slice(0, index + 1);
};

export const useWorkBrief = ({
  chat,
  messages,
  anchorMessageId,
  drafter,
  projectNames,
  drafts,
}: Params): WorkBriefModel => {
  const [brief, setBrief] = useState<WorkBrief | null>(null);
  const [pickedProjectIds, setProjectIds] = useState<ReadonlyArray<ProjectId> | null>(null);
  const isRestorable = useRef(true);

  useEffect(() => {
    if (drafter === null) {
      return undefined;
    }
    let isCurrent = true;
    const saved = isRestorable.current ? drafts.read({ anchorMessageId }) : null;
    isRestorable.current = false;
    if (saved !== null) {
      setBrief(saved.brief);
      setProjectIds(saved.projectIds);
      return undefined;
    }
    setBrief(null);
    setProjectIds(null);
    void summarizeChatForWork({
      backend: activeChatBackend,
      chat: {
        title: chat.title,
        provider: drafter.provider,
        model: drafter.model,
        ...(drafter.effort != null && { effort: drafter.effort }),
      },
      messages: upTo({ messages, anchorMessageId }),
      projectNames,
    }).then((next) => {
      if (!isCurrent) {
        return;
      }
      setBrief(next);
    });
    return () => {
      isCurrent = false;
    };
  }, [chat.id, anchorMessageId, drafter?.provider, drafter?.model, drafter?.effort]);

  useEffect(() => {
    if (brief === null) {
      return;
    }
    drafts.write({ draft: { anchorMessageId, brief, projectIds: pickedProjectIds } });
  }, [brief, pickedProjectIds]);

  const patch = ({ next }: PatchParams): void =>
    setBrief((current) => (current === null ? current : { ...current, ...next }));

  return { brief, pickedProjectIds, patch, setProjectIds, discard: drafts.clear };
};
