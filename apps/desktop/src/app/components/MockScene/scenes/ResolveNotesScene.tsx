import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { useAppStore } from '../../../../store';
import { LOCAL_SOURCE_KEY } from '../../../../store/slices/review-source/types';
import { SESSION, SESSION_ID } from './resolveSeed';
import { seedResolveNotes } from './resolveNotesSeed';

export const ResolveNotesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveNotes();
    useAppStore.setState({ reviewSourceKeys: { [SESSION_ID]: LOCAL_SOURCE_KEY } });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <ReviewPane session={SESSION} />
    </main>
  );
};
