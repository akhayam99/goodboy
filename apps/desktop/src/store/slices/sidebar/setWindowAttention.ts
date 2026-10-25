import type { AttentionReport } from '../../../shared/lib/attentionChannel';
import type { SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

type Params = {
  readonly report: AttentionReport;
};

export const setWindowAttention = ({ set }: FactoryParams) => {
  return ({ report }: Params): void => {
    set((state) => {
      const current = state.attentionFromWindows[report.workspaceId];
      const next = {
        count: report.count,
        tone: report.tone ?? 'warning',
        reasonWords: report.reasonWords,
      } as const;
      if (
        current !== undefined &&
        current.count === next.count &&
        current.tone === next.tone &&
        current.reasonWords.join('\n') === next.reasonWords.join('\n')
      ) {
        return state;
      }
      return {
        attentionFromWindows: { ...state.attentionFromWindows, [report.workspaceId]: next },
      };
    });
  };
};
