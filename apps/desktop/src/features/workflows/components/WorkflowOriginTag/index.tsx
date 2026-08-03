import type { WorkflowOrigin } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

const LABEL: Record<WorkflowOrigin, string> = {
  library: 'preset',
  custom: 'custom',
  orchestrated: 'orchestrated',
};

const TITLE: Record<WorkflowOrigin, string> = {
  library: 'Shipped with Goodboy',
  custom: 'Built step by step',
  orchestrated: 'Steps decided at runtime',
};

const TONE: Record<WorkflowOrigin, Tone> = {
  library: 'neutral',
  custom: 'neutral',
  orchestrated: 'accent',
};

type Props = {
  readonly origin: WorkflowOrigin;
};

export const WorkflowOriginTag = ({ origin }: Props) => (
  <Chip
    tone={TONE[origin]}
    size="xs"
    width="lg"
    shape="badge"
    bordered={false}
    label={LABEL[origin]}
    title={TITLE[origin]}
    className="shrink-0 uppercase tracking-eyebrow"
  />
);
