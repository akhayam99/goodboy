import type { PrSeriesId, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../shared/components/Toast';
import type { AppStore } from '../../../store/store';

type Params = {
  readonly sessionId: SessionId;
  readonly seriesId: PrSeriesId;
  readonly name: string;
  readonly mergeSeriesInOrder: AppStore['mergeSeriesInOrder'];
  readonly showToast: ShowToast;
};

export const mergeSeriesAction = ({
  sessionId,
  seriesId,
  name,
  mergeSeriesInOrder,
  showToast,
}: Params) => ({
  label: 'Merge in order',
  isDisabled: false,
  requiresConfirm: true,
  failureTitle: `Couldn't merge ${name} in order`,
  run: async () => {
    const result = await mergeSeriesInOrder({ sessionId, seriesId });
    if (result.kind === 'gone') {
      return;
    }
    if (result.merged > 0) {
      showToast({
        kind: result.kind === 'done' ? 'success' : 'warning',
        message: `Merged ${result.merged} ${result.merged === 1 ? 'part' : 'parts'} of ${name} in order`,
      });
    }
    if (result.kind === 'stopped') {
      throw new Error(`Stopped before part ${result.partLabel}: ${result.reason}`);
    }
  },
});
