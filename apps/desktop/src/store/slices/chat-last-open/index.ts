import { rememberLastChat } from './rememberLastChat';
import type { SliceDeps } from '../../slice-types';

export const createChatLastOpenSlice = ({ set }: SliceDeps) => ({
  rememberLastChat: rememberLastChat({ set }),
});
