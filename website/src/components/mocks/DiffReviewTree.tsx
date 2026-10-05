import { Check } from './icons';

type TreeFile = {
  readonly name: string;
  readonly state: 'active' | 'viewed' | 'none';
  readonly note: boolean;
};

const FILES: readonly TreeFile[] = [
  { name: 'applyWebhook.ts', state: 'active', note: true },
  { name: 'dedupe.ts', state: 'viewed', note: false },
];

export const DiffReviewTree = () => (
  <nav aria-hidden className="dfrTree">
    <p className="dfrTreeCount">1 of 2 viewed</p>
    <span className="dfrTreeBar">
      <i />
    </span>
    <p className="dfrTreeFolder">
      <svg className="dfrRing" viewBox="0 0 12 12" aria-hidden>
        <circle cx="6" cy="6" r="4.5" className="dfrRingTrack" />
        <circle cx="6" cy="6" r="4.5" pathLength="100" className="dfrRingFill" />
      </svg>
      <span>webhooks</span>
      <span className="dfrTreeNum">2</span>
    </p>
    {FILES.map((file) => (
      <p key={file.name} className="dfrTreeFile" data-state={file.state}>
        <span className="dfrTreeMark">{file.state === 'viewed' ? <Check size={11} /> : null}</span>
        <span className="dfrTreeName">{file.name}</span>
        {file.note ? <span className="dfrTreeNum">1</span> : null}
      </p>
    ))}
  </nav>
);
