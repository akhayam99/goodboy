import type {
  IsoDateTime,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  SecurityFinding,
  SecurityFindingId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { seedBrandSettings } from './settingsBrandSeed';

const HOUR_MS = 60 * 60 * 1000;

const hoursAgo = (hours: number): IsoDateTime =>
  new Date(Date.now() - hours * HOUR_MS).toISOString() as IsoDateTime;

const PAYMENTS_ID = 'mock-settings-payments' as ProjectId;
const SCRIPT_ID = 'mock-brand-script-seed-sandbox' as ProjectScriptId;

const SCRIPTS: ReadonlyArray<ProjectScript> = [
  {
    id: SCRIPT_ID,
    projectId: PAYMENTS_ID,
    name: 'seed-sandbox',
    body: 'pnpm --filter payments-api seed:sandbox',
    sortOrder: 0,
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(26),
  },
  {
    id: 'mock-brand-script-replay-webhooks' as ProjectScriptId,
    projectId: PAYMENTS_ID,
    name: 'replay-webhooks',
    body: 'pnpm --filter payments-api webhooks:replay --since 7d --dry-run',
    sortOrder: 1,
    createdAt: hoursAgo(80),
    updatedAt: hoursAgo(80),
  },
];

const FINDING: SecurityFinding = {
  id: 'mock-brand-finding-seed-sandbox' as SecurityFindingId,
  workspaceId: SETTINGS_WORKSPACE_ID,
  projectId: PAYMENTS_ID,
  subjectKind: 'script',
  subjectId: SCRIPT_ID,
  secretKind: 'generic-secret',
  fingerprint: 'sha256:7b3e91d04a6f2c58e1b0d9a4c3f6e287',
  last4: '9f2c',
  firstSeenAt: hoursAgo(26),
};

const seedFindings = (): void => {
  seedBrandSettings();
  useAppStore.setState({
    projectScripts: { [SETTINGS_WORKSPACE_ID]: SCRIPTS },
    openSecurityFindings: { [SETTINGS_WORKSPACE_ID]: [FINDING] },
    dismissedSecurityFindings: { [SETTINGS_WORKSPACE_ID]: [] },
    loadSecurityFindings: async () => undefined,
    dismissSecurityFinding: async () => undefined,
    flagSecurityFindingAgain: async () => undefined,
  });
};

export const BrandSecurityFindingsScene = () => (
  <SettingsFrame focus={{ scope: 'app', section: 'security-findings' }} seed={seedFindings} />
);
