import { useEffect, useState } from 'react';
import type { IsoDateTime } from '@goodboy/types';
import { LaunchSessionPanel } from '../../../../../features/integrations/components/LaunchSessionPanel';
import { launchSpecFor } from '../../../../../features/inbox/launchSpecFor';
import { startLabelOf } from '../../../../../features/inbox/startFromRecord';
import type { InboxRecord } from '../../../../../features/inbox/types';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { seedStudioChrome } from '../shellChrome';

const noop = () => undefined;

const POSTED_AT = '2026-10-07T08:40:00.000Z' as IsoDateTime;

const SLACK_RECORD: InboxRecord = {
  key: 'slack:thread:C0PAY:1759826400.000100',
  provider: 'slack',
  kind: 'thread',
  identifier: '#payments-alerts',
  title: 'Two accounts were credited twice overnight, can someone look at the webhook retries?',
  state: 'active',
  stateLabel: 'Active',
  updatedAt: POSTED_AT,
  url: '',
  context: '4 replies',
  payload: {
    provider: 'slack',
    kind: 'thread',
    channel: { id: 'C0PAY', name: 'payments-alerts', isMember: true, topic: null, memberCount: 12 },
    head: {
      ts: '1759826400.000100',
      threadTs: '1759826400.000100',
      userId: null,
      botId: null,
      text: 'Two accounts were credited twice overnight, can someone look at the webhook retries?',
      subtype: null,
      replyCount: 4,
      replyUserCount: 3,
      postedAt: POSTED_AT,
      latestReplyAt: POSTED_AT,
      reactions: [],
    },
    sessionId: null,
  },
};

export const StartPanelSlackScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    seedStudioChrome();
    setIsReady(true);
  }, []);

  const spec = launchSpecFor({ record: SLACK_RECORD });
  const label = startLabelOf({ record: SLACK_RECORD });
  if (!isReady || spec === null || label === null) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-10">
      <div className="w-96">
        <LaunchSessionPanel
          workspaceId={WORKSPACE_ID}
          linkedSessionId={null}
          goalSeed={spec.goalSeed}
          externalTask={spec.externalTask}
          startLabel={label}
          briefSource={null}
          onClose={noop}
        />
      </div>
    </main>
  );
};
