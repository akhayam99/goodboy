import { useState } from 'react';
import { brandId, type DiffComment, type IsoDateTime, type MountId } from '@goodboy/types';
import { noteThreadId } from '../../../../../features/resolve/notes/noteThread';
import { useAppStore } from '../../../../../store';
import { RunPageScene } from '../surfaces/run-page/RunPageScene';
import { AUTO_ROOT_ID, AUTO_SESSION, type AutoSceneData } from '../u24/autoSceneSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

type ExtendParams = {
  readonly scene: AutoSceneData;
};

const AT = brandId<IsoDateTime>({ value: '2026-10-13T11:52:00.000Z' });

const NOTES: ReadonlyArray<DiffComment> = [
  {
    id: 'mock-note-idempotency-header',
    sessionId: AUTO_SESSION.id,
    filePath: 'src/webhooks/idempotency.ts',
    body: 'This key check belongs in the webhook layer, not in each handler. Follow the refunds route as the model: the layer reads the key once and the handler only gets a clean event. Write new code for this, do not touch the legacy KeyGuard.',
    status: 'open',
    createdAt: AT,
    anchor: { side: 'new', lineNumber: 24 },
    authorKind: 'user',
  },
  {
    id: 'mock-note-idempotency-retry',
    sessionId: AUTO_SESSION.id,
    filePath: 'src/webhooks/retryPolicy.ts',
    body: 'Same for the retry: it should read the key from the layer too.',
    status: 'open',
    createdAt: AT,
    anchor: { side: 'new', lineNumber: 9 },
    authorKind: 'user',
  },
];

const linkToNotes = ({ scene }: ExtendParams): AutoSceneData => ({
  ...scene,
  agents: scene.agents.map((agent) =>
    agent.id === AUTO_ROOT_ID
      ? {
          ...agent,
          sourceKind: 'comment_run',
          sourceThreadIds: NOTES.map((note) => noteThreadId({ noteId: note.id })),
          mountId: brandId<MountId>({ value: 'mock-run-mount-payments' }),
        }
      : agent,
  ),
});

export const CommentRunPageScene = ({ theme }: Props) => {
  useState(() => {
    useAppStore.setState((state) => ({
      diffComments: { ...state.diffComments, [AUTO_SESSION.id]: NOTES },
    }));
    return true;
  });
  return <RunPageScene state="working" theme={theme} isLead extend={linkToNotes} />;
};
