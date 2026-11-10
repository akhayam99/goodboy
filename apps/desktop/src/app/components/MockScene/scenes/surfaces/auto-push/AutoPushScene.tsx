import { useEffect, useState } from 'react';
import { AutoDelegationLines } from '../../../../../../features/auto/chat/AutoDelegationLines';
import { FIXTURE_SESSION } from '../../../../../../features/auto/testing/autoViewFixtures';
import { useAppStore } from '../../../../../../store';
import { PageSheet } from '../../PageSheet';
import { autoPushViewOf, type AutoPushVariant } from './autoPushSeed';

type Props = {
  readonly variant: AutoPushVariant;
};

export const AutoPushScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [view] = useState(() => autoPushViewOf({ variant }));
  useEffect(() => {
    useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
    setIsReady(true);
  }, [view]);
  if (!isReady) {
    return null;
  }
  return (
    <PageSheet>
      <div className="flex min-w-0 flex-col p-4">
        <AutoDelegationLines
          sessionId={FIXTURE_SESSION}
          view={view}
          delegations={view.delegations}
          agents={[]}
          onOpenChild={() => undefined}
        />
      </div>
    </PageSheet>
  );
};
