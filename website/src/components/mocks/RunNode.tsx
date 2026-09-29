import type { ChipKind } from '../../data/harborline';

type Props = {
  readonly state: ChipKind;
  readonly number: number;
};

export const RunNode = ({ state, number }: Props) => (
  <span className="mk-node" aria-hidden="true">
    {state === 'done' ? (
      <svg viewBox="0 0 16 16" focusable="false">
        <path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      number
    )}
  </span>
);
