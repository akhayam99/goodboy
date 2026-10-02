import './Cluster.css';
import type { ReactNode } from 'react';
import { CardRow } from '../../components/CardRow';
import { AskCodeMock } from '../../components/mocks/AskCodeMock';
import { BoardMock } from '../../components/mocks/BoardMock';
import { DiffReviewMock } from '../../components/mocks/DiffReviewMock';
import { HandoffMock } from '../../components/mocks/HandoffMock';
import { InboxMock } from '../../components/mocks/InboxMock';
import { SessionMock } from '../../components/mocks/SessionMock';
import { StorageMock } from '../../components/mocks/StorageMock';
import { TwoWaysBars } from '../../components/mocks/TwoWaysBars';
import { WorkflowRunMock } from '../../components/mocks/WorkflowRunMock';
import { SITE } from '../../site';

export type MockKey =
  'session' | 'board' | 'handoff' | 'workflow' | 'diff' | 'inbox' | 'bars' | 'askcode' | 'storage';

export type FeatureItem = {
  readonly title: string;
  readonly text: string;
  readonly group: string;
  readonly main?: true;
  readonly also?: string;
  readonly shown?: true;
};

export type FeatureGuide = {
  readonly area: string;
  readonly label: string;
};

export type FeatureCluster = {
  readonly id: string;
  readonly title: string;
  readonly lead: string;
  readonly groups: readonly string[];
  readonly mocks: readonly MockKey[];
  readonly guides: readonly FeatureGuide[];
  readonly items: readonly FeatureItem[];
};

type Props = {
  readonly cluster: FeatureCluster;
};

const MOCKS: Readonly<Record<MockKey, () => ReactNode>> = {
  session: () => <SessionMock />,
  board: () => <BoardMock />,
  handoff: () => <HandoffMock />,
  workflow: () => <WorkflowRunMock />,
  diff: () => <DiffReviewMock />,
  inbox: () => <InboxMock />,
  bars: () => <TwoWaysBars />,
  askcode: () => <AskCodeMock />,
  storage: () => <StorageMock />,
};

export const Cluster = ({ cluster }: Props) => {
  const headingId = `${cluster.id}-title`;
  const cards = cluster.items
    .filter((item) => item.main === true)
    .map((item) => ({ key: item.title, title: item.title, caption: item.text }));
  const also = cluster.items.flatMap((item) =>
    item.also === undefined || item.shown !== true ? [] : [item.also],
  );

  return (
    <section id={cluster.id} className="ftCluster" aria-labelledby={headingId}>
      <div className="ftClusterTop">
        <header className="ftClusterHead">
          <h2 id={headingId} className="chapterTitle" data-reveal="">
            {cluster.title}
          </h2>
          <p className="lead" data-reveal="">
            {cluster.lead}
          </p>
        </header>
        {cluster.mocks.length === 0 ? null : (
          <div className="ftMocks">
            {cluster.mocks.map((key) => (
              <div className="ftMock" key={key} data-reveal="">
                {MOCKS[key]?.() ?? null}
              </div>
            ))}
          </div>
        )}
      </div>
      <CardRow label={cluster.title} columns={cards.length === 4 ? 4 : 3} items={cards} hasDots />
      {also.length === 0 ? null : (
        <p className="ftAlso" data-reveal="">
          Also: {also.join(', ')}
        </p>
      )}
      <p className="ftGuide" data-reveal="">
        <span>In the guide:</span>
        {cluster.guides.map((guide) => (
          <a key={guide.area} className="refLink" href={SITE.featureDoc(guide.area)}>
            {guide.label}
          </a>
        ))}
      </p>
    </section>
  );
};
