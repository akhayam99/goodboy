import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';

export type ConnectionsFocus =
  | {
      readonly kind: 'provider';
      readonly provider: ProviderId;
      readonly action?: ProviderLifecycleAction;
      readonly section?: string;
    }
  | {
      readonly kind: 'tool';
      readonly tool: IntegrationGlyphProvider;
    }
  | {
      readonly kind: 'calendar';
    };
