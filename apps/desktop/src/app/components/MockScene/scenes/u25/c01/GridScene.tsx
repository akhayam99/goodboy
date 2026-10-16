import type { ComponentType } from 'react';
import { AgentsGridSpecimen } from './AgentsGridSpecimen';
import { DotsGridSpecimen } from './DotsGridSpecimen';
import { TasksGridSpecimen } from './TasksGridSpecimen';
import { TypeSpecimen } from './TypeSpecimen';

export type GridSceneState = 'list' | 'groups' | 'dots' | 'type';

type Props = {
  readonly state: GridSceneState;
};

const BODY: Record<GridSceneState, ComponentType> = {
  list: AgentsGridSpecimen,
  groups: TasksGridSpecimen,
  dots: DotsGridSpecimen,
  type: TypeSpecimen,
};

export const GridScene = ({ state }: Props) => {
  const Body = BODY[state];
  return (
    <div className="flex w-[960px] flex-col bg-background p-6">
      <Body />
    </div>
  );
};
