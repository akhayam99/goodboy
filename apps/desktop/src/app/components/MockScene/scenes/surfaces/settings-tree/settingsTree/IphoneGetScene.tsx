import { useEffect, useState } from 'react';
import { IphoneEmpty } from '../../../../../../../features/companion/components/IphonePage/IphoneEmpty';
import { installIphoneIpc } from './installIphoneIpc';

const SCENE_ONLY_LINK = 'https://testflight.apple.com/join/Harborline';

export const IphoneGetScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    installIphoneIpc({ moment: 'empty' });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 bg-background p-6">
      <IphoneEmpty link={SCENE_ONLY_LINK} />
    </div>
  );
};
