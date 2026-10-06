import { Copy, SquareArrowOutUpRight } from 'lucide-react';
import type { CrumbMenuModel } from '@goodboy/ui';
import { branchPlace, fixRunTranscript } from '../../../../store/slices/navigation/place';
import { openUrl } from '../../../../shared/lib/editor';
import { conversationMenu } from '../../trail/menus/conversationMenu';
import type { TrailMenuScope } from './trailMenuScope';

export const reviewThreadCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel => {
  const { sessionId, queueRows, threadId, prNumber, navigate, copy } = scope;
  const current = queueRows.find((row) => row.thread.threadId === threadId) ?? null;
  const url = current?.commentThread?.head.url ?? null;
  return conversationMenu({
    rows: queueRows,
    currentThreadId: threadId,
    prNumber,
    actions:
      url === null
        ? []
        : [
            {
              id: 'open-github',
              label: 'Open on GitHub',
              icon: SquareArrowOutUpRight,
              confirm: null,
              onRun: () => void openUrl(url),
            },
            {
              id: 'copy-link',
              label: 'Copy link',
              icon: Copy,
              confirm: null,
              onRun: () => void copy({ text: url }),
            },
          ],
    onSelect: (row) => {
      const agentId = row.attempt?.agentId ?? null;
      if (agentId !== null) {
        navigate(fixRunTranscript({ sessionId, agentId, threadId: row.thread.threadId }));
        return;
      }
      navigate({
        to: branchPlace({ sessionId, threadId: row.thread.threadId }),
        mode: 'replace',
      });
    },
  });
};
