import { useEffect } from 'react';
import { ScriptsLensScene } from '../SurfaceAuditScenes';
import { keepScriptMounts } from './keepScriptMounts';

export const ScriptsRowsScene = () => {
  useEffect(() => keepScriptMounts({ names: ['ledger-core'] }), []);
  return <ScriptsLensScene />;
};
