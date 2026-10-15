import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { CiFixStage, CiFixStageStatus } from '../../../../../branch/checks/ciFixStages';
import { CiFixStageGlyph } from './CiFixStageGlyph';

type Props = {
  readonly stages: ReadonlyArray<CiFixStage>;
  readonly word: string;
};

const STAGE_WORD: Readonly<Record<CiFixStageStatus, string>> = {
  done: 'done',
  run: 'running',
  need: 'needs you',
  failed: 'stopped',
  wait: 'waiting',
};

type LabelParams = {
  readonly status: CiFixStageStatus;
};

const labelClassOf = ({ status }: LabelParams): string =>
  status === 'wait' ? 'text-faint-foreground' : 'text-muted-foreground';

export const CiFixStrip = ({ stages, word }: Props) => (
  <ol
    data-testid="ci-fix-strip"
    aria-label={`CI fix stages, ${word}`}
    className="flex shrink-0 items-center gap-1 text-meta"
  >
    {stages.map((stage, index) => (
      <li key={stage.id} className="flex items-center gap-1">
        {index === 0 ? null : (
          <ChevronRight size={ICON_SIZE.mark} aria-hidden className="text-faint-foreground" />
        )}
        <CiFixStageGlyph status={stage.status} />
        <span className={labelClassOf({ status: stage.status })}>
          {stage.label}
          <span className="sr-only">{` ${STAGE_WORD[stage.status]}`}</span>
        </span>
      </li>
    ))}
  </ol>
);
