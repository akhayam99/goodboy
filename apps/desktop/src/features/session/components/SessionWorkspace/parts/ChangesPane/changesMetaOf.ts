import { changesCountLabelOf } from '../../../../../file-versions/changesCountLabelOf';
import type { TurnChangesSummary } from '../../../../../file-versions/turnChanges';

type Params = Readonly<{ counts: TurnChangesSummary }>;

const KEPT = 'versions kept until 30 days after this session ends';

export const changesMetaOf = ({ counts }: Params): string =>
  `${changesCountLabelOf({ counts }) ?? 'No files changed yet'} · ${KEPT}`;
