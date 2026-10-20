import type { FactCardSpec } from '@goodboy/ui';
import { fitCardRows } from '../../../../shared/utils/fitCardRows';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { ChatSessionMarker } from '../../hooks/useChatSessionMarker';

type Params = {
  readonly marker: ChatSessionMarker;
};

export const chatSessionCardOf = ({ marker }: Params): FactCardSpec => {
  const fitted = fitCardRows({
    facts: marker.entries.map((entry) => ({ label: entry.title, value: entry.stageLabel })),
  });
  return {
    title: pluralize(marker.count, 'session'),
    facts: fitted.facts,
    footnote: fitted.footnote ?? 'Click to open the first one',
  };
};
