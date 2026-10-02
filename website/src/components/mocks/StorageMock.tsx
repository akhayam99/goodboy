import './StorageMock.css';
import { MockStage } from './MockStage';
import { MockChip, MockRow, MockWindow } from './MockWindow';

type Part = {
  readonly name: string;
  readonly size: string;
  readonly verdict: 'Can go' | 'Keep';
};

const PARTS: readonly Part[] = [
  { name: 'Worktree folders', size: '3.1 GB', verdict: 'Can go' },
  { name: 'Artifact copies', size: '1.2 GB', verdict: 'Can go' },
  { name: 'Archived history', size: '0.8 GB', verdict: 'Keep' },
];

export const StorageMock = () => (
  <MockStage label="Storage on a Mac, 5.1 GB in total. Worktree folders and artifact copies can go, archived history stays. Freeing up 4.3 GB.">
    <MockWindow
      className="stoWin"
      title={
        <>
          <span>Storage</span>
          <span className="mkMuted mkSecondary">What Goodboy keeps on this Mac</span>
          <span className="mkSpacer" />
          <span className="mkMono">5.1 GB</span>
        </>
      }
    >
      {PARTS.map((part) => (
        <MockRow key={part.name}>
          <span className="mkGrow">{part.name}</span>
          <span className="mkMono">{part.size}</span>
          <MockChip tone={part.verdict === 'Keep' ? 'neutral' : 'ok'} className="stoVerdict">
            {part.verdict}
          </MockChip>
        </MockRow>
      ))}
      <MockRow className="stoFree">
        <span className="mkSpacer" />
        <span className="stoBtn">Free up 4.3 GB</span>
      </MockRow>
    </MockWindow>
  </MockStage>
);
