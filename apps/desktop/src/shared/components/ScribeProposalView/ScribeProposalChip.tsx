import { AlertTriangle, Check } from 'lucide-react';
import { ICON_SIZE } from '../conceptIcons';
import { openUrl } from '../../lib/editor';
import type { ScribeProposalState } from '../../hooks/useScribeProposal';

type Props = {
  readonly state: ScribeProposalState | null;
};

export const ScribeProposalChip = ({ state }: Props) => {
  if (state === null) {
    return <span className="text-meta text-muted-foreground">Earlier version</span>;
  }
  if (state.kind === 'creating') {
    return <span className="text-meta text-shimmer">Creating</span>;
  }
  if (state.kind === 'created') {
    const label = `Created #${state.number}`;
    const url = state.url;
    return (
      <span className="inline-flex items-center gap-1 text-meta text-success">
        <Check size={ICON_SIZE.row} aria-hidden />
        {url === null ? (
          label
        ) : (
          <button type="button" className="hover:underline" onClick={() => void openUrl(url)}>
            {label}
          </button>
        )}
      </span>
    );
  }
  if (state.kind === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-meta text-danger">
        <AlertTriangle size={ICON_SIZE.row} aria-hidden />
        Failed
      </span>
    );
  }
  return <span className="text-meta text-muted-foreground">Not opened yet</span>;
};
