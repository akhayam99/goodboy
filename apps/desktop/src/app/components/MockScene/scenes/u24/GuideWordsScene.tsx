import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { GuideStudio } from '../../../../../features/settings/components/GuideStudio';
import { requestGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';

const noop = () => undefined;

export const GuideWordsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    requestGuideChapter('words');
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <GuideStudio onClose={noop} />
      </main>
    </ToastProvider>
  );
};
