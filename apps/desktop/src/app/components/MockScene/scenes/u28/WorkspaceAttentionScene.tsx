import { useEffect } from 'react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { R4SwitcherScene } from '../u25/R4SwitcherScene';

const NORTHWIND = brandId<WorkspaceId>({ value: 'mock-r4-workspace-northwind' });
const ACME = brandId<WorkspaceId>({ value: 'mock-r4-workspace-acme' });

export const WorkspaceAttentionScene = () => {
  useEffect(() => {
    useAppStore.setState({
      attentionFromDatabase: {
        [NORTHWIND]: {
          count: 2,
          tone: 'danger',
          reasonWords: ['Checks failing', '1 question for you'],
        },
        [ACME]: { count: 1, tone: 'warning', reasonWords: ['1 question for you'] },
      },
    });
  }, []);

  return <R4SwitcherScene />;
};
