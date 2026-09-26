import type { SessionId } from '@goodboy/types';
import type { ImpactScope } from '../../../features/impact/lib';
import type { InboxKind, InboxProvider } from '../../../features/inbox/types';
import type { SettingsFocus } from '../../../features/settings/components/SettingsStudio/types';

export type InboxStudioFocus = {
  readonly provider: InboxProvider | null;
  readonly kind: InboxKind | null;
  readonly recordKey: string | null;
  readonly sessionId: SessionId | null;
};

export type StudioPlace =
  | { readonly kind: 'settings'; readonly focus: SettingsFocus }
  | { readonly kind: 'guide' }
  | { readonly kind: 'report' }
  | { readonly kind: 'companion' }
  | { readonly kind: 'addWorkspace' }
  | { readonly kind: 'workflow' }
  | { readonly kind: 'inbox'; readonly focus: InboxStudioFocus | null }
  | { readonly kind: 'impact'; readonly scope: ImpactScope | null }
  | { readonly kind: 'changelog' }
  | { readonly kind: 'notifications' };

export type StudioKind = StudioPlace['kind'];

type KeyParams = {
  readonly studio: StudioPlace;
};

const joined = (parts: ReadonlyArray<string | null | undefined>): string =>
  parts.filter((part): part is string => part != null && part !== '').join('/');

export const studioKey = ({ studio }: KeyParams): string => {
  switch (studio.kind) {
    case 'settings':
      return joined(['settings', studio.focus.scope, studio.focus.section]);
    case 'inbox':
      return joined(['inbox', studio.focus?.provider, studio.focus?.recordKey]);
    case 'impact':
      return joined(['impact', studio.scope?.kind]);
    case 'workflow':
      return 'workflows';
    case 'addWorkspace':
      return 'add-workspace';
    case 'guide':
    case 'report':
    case 'companion':
    case 'changelog':
    case 'notifications':
      return studio.kind;
    default: {
      const unreachable: never = studio;
      return unreachable;
    }
  }
};
