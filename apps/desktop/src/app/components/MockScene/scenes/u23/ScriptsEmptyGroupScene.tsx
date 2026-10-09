import { useEffect, useState } from 'react';
import { useSceneClicks } from '../audit/useSceneClicks';
import { ScriptsLensScene } from '../SurfaceAuditScenes';
import { keepScriptMounts } from './keepScriptMounts';

const NORTHWIND_PICK = ['Pin a script of northwind-storefront'] as const;

export const ScriptsEmptyGroupScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    keepScriptMounts({ names: ['northwind-storefront'] });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: NORTHWIND_PICK,
    selector: 'button',
    match: 'prefix',
    intervalMs: 150,
  });

  return <ScriptsLensScene />;
};
