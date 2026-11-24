import type { ComponentType } from 'react';
import { LogoFootScene } from './LogoFootScene';

export const U50_LOGO_FOOT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-logo-foot-light': () => <LogoFootScene theme="light" hasUpdate={false} />,
  'u50-logo-foot-dark': () => <LogoFootScene theme="dark" hasUpdate={false} />,
  'u50-logo-foot-update-light': () => <LogoFootScene theme="light" hasUpdate />,
  'u50-logo-foot-update-dark': () => <LogoFootScene theme="dark" hasUpdate />,
  'u50-logo-foot-unread-light': () => (
    <LogoFootScene theme="light" hasUpdate={false} hasUnseenRelease />
  ),
  'u50-logo-foot-unread-dark': () => (
    <LogoFootScene theme="dark" hasUpdate={false} hasUnseenRelease />
  ),
};
