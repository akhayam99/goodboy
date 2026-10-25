import { dispatchWindowEvent } from '../../shared/lib/dispatchWindowEvent';
import type { OpenSettingsDetail } from '../../shared/lib/dispatchWindowEvent/windowEvents';

type Params = OpenSettingsDetail;

export const openSettings = ({
  scope,
  section,
  tool,
  provider,
  action,
  flow,
  door: isDoor,
}: Params): void => {
  dispatchWindowEvent({
    name: 'goodboy:open-settings',
    detail: {
      scope,
      ...(section !== undefined && { section }),
      ...(tool !== undefined && { tool }),
      ...(provider !== undefined && { provider }),
      ...(action !== undefined && { action }),
      ...(flow !== undefined && { flow }),
      ...(isDoor !== undefined && { door: isDoor }),
    },
  });
};
