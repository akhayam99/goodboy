import { useContext } from 'react';
import { ToastContext, type ShowToast } from './toastContext';

const NO_TOAST: ShowToast = () => undefined;

export const useShowToast = (): ShowToast => useContext(ToastContext)?.showToast ?? NO_TOAST;
