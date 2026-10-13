import { useEffect, useState } from 'react';
import type { ChatId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';
import type { SidebarNavConfig } from '../u23/sidebarNavSeed';
import { seedSideSignals } from './b-side-signals';
import { seedSideInfoValues } from './seedSideInfoValues';

const MANY: Partial<SidebarNavConfig> = { lens: 'agents', branches: 3, hasDiff: true };
const ONE: Partial<SidebarNavConfig> = { lens: 'agents', branches: 1, hasDiff: true };

type Props = {
  readonly config: Partial<SidebarNavConfig>;
  readonly isFramed?: boolean;
};

const SideInfoScene = ({ config, isFramed = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedSideSignals({ isBusy: true });
    useAppStore.setState({
      chatStreams: {},
      unreadChatIds: [brandedId<ChatId>({ value: 'mock-p-side-info-chat' })],
    });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <SidebarNavColumnScene config={config} isFramed={isFramed} onSeeded={seedSideInfoValues} />
  );
};

export const U25_P_SIDE_INFO_SCENES = {
  'side-info-branches': () => <SideInfoScene config={MANY} />,
  'side-info-branch': () => <SideInfoScene config={ONE} />,
  'side-info-framed': () => <SideInfoScene config={MANY} isFramed />,
};
