import { SETTING_CHAT_IMAGES } from '../../../features/settings/settings';
import type { GetFn } from './types';

type Params = {
  readonly state: ReturnType<GetFn>;
};

export const isChatImagesOn = ({ state }: Params): boolean =>
  state.settings[SETTING_CHAT_IMAGES] !== 'false';
