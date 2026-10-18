import type { ComponentProps } from 'react';
import { IphonePage } from './components/IphonePage';

type Params = ComponentProps<typeof IphonePage>;

export const iphoneSettingsPage = ({ animationClassName, onStopFailed }: Params) => (
  <IphonePage key="iphone" animationClassName={animationClassName} onStopFailed={onStopFailed} />
);
