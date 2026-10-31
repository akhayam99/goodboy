import { useEffect, useState, type ReactNode } from 'react';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { OpenQuestionCluster } from '../../../../../features/chat/components/ChatView/OpenQuestionCluster';
import { QuestionsPane } from '../../../../../features/session/components/SessionWorkspace/parts/QuestionsPane';
import { seedListsPage, type ListsPage, type ListsSeeded } from './listsSeed';

const FRAME_WIDTH = 680;
const FRAME_HEIGHT = 560;

type Props = {
  readonly page: ListsPage;
};

type BodyParams = {
  readonly page: ListsPage;
  readonly seeded: ListsSeeded;
};

const bodyOf = ({ page, seeded }: BodyParams): ReactNode => {
  if (page === 'questions') {
    return <QuestionsPane session={seeded.session} />;
  }
  if (page === 'artifacts') {
    return <ArtifactStudio sessionId={seeded.sessionId} />;
  }
  return <OpenQuestionCluster questions={seeded.questions} sessionId={seeded.sessionId} />;
};

export const ListsScene = ({ page }: Props) => {
  const [seeded, setSeeded] = useState<ListsSeeded | null>(null);

  useEffect(() => {
    setSeeded(seedListsPage({ page }));
  }, [page]);

  if (seeded === null) {
    return null;
  }
  if (page === 'card') {
    return (
      <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
        <div className="p-6">{bodyOf({ page, seeded })}</div>
      </div>
    );
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}>
      <div className="flex h-full min-h-0 flex-col bg-background p-4 text-foreground">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background ring-1 ring-border-soft">
          {bodyOf({ page, seeded })}
        </div>
      </div>
    </div>
  );
};
