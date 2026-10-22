import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { AppFrame } from '../../audit/AppFrame';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { OneFlowLeadCenter } from './OneFlowLeadCenter';
import type { OneFlowRoute } from './OneFlowRouteLine';
import { OneFlowRunCenter } from './OneFlowRunCenter';
import { seedOneFlow, type SeedParams } from './oneFlowSeed';

export type OneFlowCenter = Readonly<
  { kind: 'app' } | { kind: 'run'; route: OneFlowRoute } | { kind: 'lead'; route: OneFlowRoute }
>;

export type OneFlowClicks = Readonly<{
  labels: ReadonlyArray<string>;
  selector: string;
}>;

type Props = {
  readonly seed: SeedParams;
  readonly center: OneFlowCenter;
  readonly clicks?: OneFlowClicks;
};

const NO_CLICKS: OneFlowClicks = { labels: [], selector: 'button' };

type CenterParams = {
  readonly session: Session;
  readonly center: OneFlowCenter;
};

const centerOf = ({ session, center }: CenterParams) => {
  if (center.kind === 'run') {
    return <OneFlowRunCenter session={session} route={center.route} />;
  }
  if (center.kind === 'lead') {
    return <OneFlowLeadCenter session={session} route={center.route} />;
  }
  return undefined;
};

export const OneFlowScene = ({ seed, center, clicks = NO_CLICKS }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  useSceneClicks({
    isReady: session !== null,
    labels: clicks.labels,
    selector: clicks.selector,
    match: 'prefix',
    intervalMs: 400,
  });
  useEffect(() => {
    setSession(seedOneFlow(seed));
  }, [seed]);
  if (session === null) {
    return null;
  }
  return (
    <AppFrame
      view="session"
      isRailCollapsed={false}
      hasPane
      center={centerOf({ session, center })}
    />
  );
};
