import { R4ColumnScene } from '../u25/R4ColumnScene';
import { useSelectSidebarRows } from './useSelectSidebarRows';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isMulti: boolean;
};

export const BranchesSessionsScene = ({ theme, isMulti }: Props) => {
  useSelectSidebarRows({ isEnabled: isMulti });
  return <R4ColumnScene theme={theme} />;
};
