import { useCallback, useState } from 'react';

const DEFAULT_DIALOG_STATE = {
  isOpen: false,
  title: '',
  message: '',
  content: null,
  variant: 'info',
  confirmLabel: 'Закрыть',
  cancelLabel: null,
  onConfirm: null,
  panelClassName: '',
  contentClassName: '',
};

export const useDialog = () => {
  const [dialog, setDialog] = useState(DEFAULT_DIALOG_STATE);

  const closeDialog = useCallback(() => {
    setDialog(DEFAULT_DIALOG_STATE);
  }, []);

  const openDialog = useCallback((config = {}) => {
    setDialog({
      ...DEFAULT_DIALOG_STATE,
      isOpen: true,
      ...config,
    });
  }, []);

  return {
    dialog,
    openDialog,
    closeDialog,
  };
};

export default useDialog;