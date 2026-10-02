import { AskCodeMock } from './mocks/AskCodeMock';
import type { ReactNode } from 'react';
import { BoardMock } from './mocks/BoardMock';
import { DiffReviewMock } from './mocks/DiffReviewMock';
import { HandoffMock } from './mocks/HandoffMock';
import { InboxMock } from './mocks/InboxMock';
import { SessionMock } from './mocks/SessionMock';
import { StorageMock } from './mocks/StorageMock';
import { WorkflowRunMock } from './mocks/WorkflowRunMock';

type Props = {
  readonly mock: string;
};

const MOCKS: ReadonlyMap<string, ReactNode> = new Map<string, ReactNode>([
  ['SessionMock', <SessionMock />],
  ['HandoffMock', <HandoffMock />],
  ['InboxMock', <InboxMock />],
  ['WorkflowRunMock', <WorkflowRunMock />],
  ['DiffReviewMock', <DiffReviewMock />],
  ['BoardMock', <BoardMock />],
  ['StorageMock', <StorageMock />],
  ['AskCodeMock', <AskCodeMock />],
]);

export const FidelityView = ({ mock }: Props) => {
  return <main className="fidelityView">{MOCKS.get(mock) ?? null}</main>;
};
