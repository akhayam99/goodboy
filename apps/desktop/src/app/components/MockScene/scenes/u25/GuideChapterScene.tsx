import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { HelpStudio } from '../../../HelpStudio';
import { requestGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';

const noop = () => undefined;

type Props = {
  readonly chapter: string;
};

export const GuideChapterScene = ({ chapter }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    requestGuideChapter(chapter);
    setIsReady(true);
  }, [chapter]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <HelpStudio tab="guide" onClose={noop} onOpenScreen={noop} />
      </main>
    </ToastProvider>
  );
};
