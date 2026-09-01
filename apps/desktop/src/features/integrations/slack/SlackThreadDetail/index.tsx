import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useMemo, type ReactNode } from 'react';
import { HeaderBand } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { resolveDetailFields, slackThreadFields } from '../../../../shared/detail-fields';
import type { SlackChannel, SlackMessage, SlackUser } from '../client';
import { buildThreadProperties } from '../buildThreadProperties';
import { slackUserNames } from '../nameMaps';
import { slackThreadTitle } from '../threadFormulas';
import { ThreadConversation } from '../ThreadConversation';
import type { SlackThreadActions } from '../useSlackThreadActions';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly channelName: string;
  readonly rootText: string;
  readonly url: string | null;
  readonly messages: ReadonlyArray<SlackMessage>;
  readonly users: ReadonlyArray<SlackUser>;
  readonly channels: ReadonlyArray<SlackChannel>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly actions: SlackThreadActions;
  readonly fit?: Fit;
  readonly dock?: ReactNode;
};

export const SlackThreadDetail = ({
  channelName,
  rootText,
  url,
  messages,
  users,
  channels,
  isLoading,
  error,
  onRetry,
  actions,
  fit = 'fill',
  dock,
}: Props) => {
  const userNames = useMemo(() => slackUserNames({ users }), [users]);
  const properties = useMemo(
    () =>
      resolveDetailFields({
        registry: slackThreadFields,
        entity: buildThreadProperties({ channelName, messages, userNames }),
      }),
    [channelName, messages, userNames],
  );
  const title = slackThreadTitle({ text: rootText });

  return (
    <StudioDetailLayout
      fit={fit}
      dock={dock}
      header={
        <HeaderBand
          title={title !== '' ? title : `#${channelName}`}
          meta={
            <span className="font-mono text-2xs text-muted-foreground">{`#${channelName}`}</span>
          }
          actions={
            url != null && url !== '' ? (
              <ExternalRefActions url={url} label="thread" hostLabel="Slack" />
            ) : null
          }
        />
      }
      properties={properties}
    >
      <ThreadConversation
        messages={messages}
        users={users}
        channels={channels}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        actions={actions}
      />
    </StudioDetailLayout>
  );
};
