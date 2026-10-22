import { PageColumn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { KeepAliveWorkSurface } from '../../../../KeepAliveWorkSurface';
import { OneFlowRouteLine, type OneFlowRoute } from './OneFlowRouteLine';

type Props = {
  readonly session: Session;
  readonly route: OneFlowRoute;
};

export const OneFlowLeadCenter = ({ session, route }: Props) => (
  <div className="@container flex h-full min-h-0 flex-col">
    <div data-one-flow-route="" className="flex shrink-0 pt-3">
      <PageColumn>
        <OneFlowRouteLine route={route} changeCount={0} />
      </PageColumn>
    </div>
    <div className="relative min-h-0 flex-1">
      <KeepAliveWorkSurface sessionId={session.id} isActive />
    </div>
  </div>
);
