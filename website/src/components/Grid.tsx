import './Grid.css';
import { GridCell, type Cell } from './GridCell';

type Props = {
  readonly label: string;
  readonly cells: readonly Cell[];
};

export const Grid = ({ label, cells }: Props) => (
  <ul className={cells.length === 3 ? 'grid three' : 'grid'} aria-label={label}>
    {cells.map((cell) => (
      <GridCell key={cell.title} cell={cell} />
    ))}
  </ul>
);
