import { brandId, type SessionId } from '@goodboy/types';
import { SessionTools } from '../../../../../features/session/components/SessionTools';

const SESSION_ID = brandId<SessionId>({ value: 'mock-rail-order-session-settlement' });

export const RailOrderToolsScene = () => (
  <main className="flex min-h-screen bg-background text-foreground">
    <h1 className="flex-1 p-6 text-ui text-muted-foreground">Fix the settlement replay</h1>
    <SessionTools sessionId={SESSION_ID} />
  </main>
);
