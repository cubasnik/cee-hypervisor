import React, { useEffect } from 'react';

const VARIANT_STYLES = {
  info: {
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    action: 'btn-primary',
  },
  success: {
    badge: 'bg-green-500/15 text-green-300 border-green-500/30',
    action: 'btn-primary',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    action: 'btn-primary',
  },
  danger: {
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    action: 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200',
  },
};

const AppDialog = ({
  isOpen,
  title,
  message,
  content,
  variant = 'info',
  confirmLabel = 'OK',
  cancelLabel,
  onConfirm,
  onClose,
  panelClassName = '',
  contentClassName = '',
}) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
      return;
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel ${panelClassName}`.trim()} onClick={(event) => event.stopPropagation()}>
        <div className="mb-5">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${styles.badge}`}>
            {variant === 'danger' ? 'Ошибка' : variant === 'warning' ? 'Внимание' : variant === 'success' ? 'Успешно' : 'Информация'}
          </span>
          <h3 className="modal-title mt-3">{title}</h3>
          {message ? <div className="modal-subtitle whitespace-pre-line">{message}</div> : null}
          {content ? <div className={contentClassName}>{content}</div> : null}
        </div>
        <div className="modal-actions">
          {cancelLabel && (
            <button className="btn" onClick={onClose}>{cancelLabel}</button>
          )}
          <button className={styles.action} onClick={handleConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default AppDialog;