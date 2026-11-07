import { HINT_NODE_SEED } from '../surfaces/hint-node/hintNodeSeed';

const TRACE_FILE_NAME = 'checkout-trace.png';

const TRACE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">',
  '<rect width="480" height="300" fill="hsl(210 32% 94%)"/>',
  '<rect x="24" y="24" width="432" height="36" rx="8" fill="hsl(210 45% 68%)"/>',
  '<rect x="24" y="84" width="300" height="14" rx="6" fill="hsl(210 30% 78%)"/>',
  '<rect x="24" y="112" width="380" height="14" rx="6" fill="hsl(210 30% 82%)"/>',
  '<text x="24" y="276" font-family="sans-serif" font-size="18" fill="hsl(210 40% 30%)">checkout trace</text>',
  '</svg>',
].join('');

type Params = {
  readonly cmd: string;
  readonly payload: unknown;
};

export const traceImageOf = ({ cmd, payload }: Params): string | undefined => {
  if (cmd !== 'attachment_read') {
    return undefined;
  }
  const relPath = HINT_NODE_SEED.imageRelPathOf({ payload });
  if (relPath === null || !relPath.endsWith(TRACE_FILE_NAME)) {
    return undefined;
  }
  return `data:image/svg+xml,${encodeURIComponent(TRACE_SVG)}`;
};
