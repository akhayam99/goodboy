import { useContext } from 'react';
import { PlanCommentsContext, type PlanCommentsApi } from '../planCommentsContext';

export const usePlanCommentsApi = (): PlanCommentsApi | null => useContext(PlanCommentsContext);
