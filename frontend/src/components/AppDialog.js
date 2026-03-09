import React, { useEffect } from 'react';

const VARIANT_STYLES = {
  info: {
    badge: 'bg-sky-500/10 text-sky-200 border-sky-500/20',
    action: 'btn-primary page-toolbar-button inline-flex min-h-[42px] items-center justify-center',
    toneLabel: 'Сообщение',
  },
  success: {
    badge: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
    action: 'btn-primary page-toolbar-button inline-flex min-h-[42px] items-center justify-center',
    toneLabel: 'Готово',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-200 border-amber-500/20',
    action: 'btn-primary page-toolbar-button inline-flex min-h-[42px] items-center justify-center',
    toneLabel: 'Внимание',
  },
  danger: {
    badge: 'bg-rose-500/10 text-rose-200 border-rose-500/20',
    action: 'inline-flex min-h-[42px] items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-white font-medium transition-colors duration-200 hover:bg-red-700',
    toneLabel: 'Ошибка',
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
  confirmButtonClassName = '',
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
        <div className="modal-header">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${styles.badge}`}>
            {styles.toneLabel}
          </span>
          <h3 className="modal-title mt-3">{title}</h3>
          {message ? <div className="modal-subtitle whitespace-pre-line">{message}</div> : null}
        </div>
        {content ? <div className={`modal-body ${contentClassName}`.trim()}>{content}</div> : null}
        <div className="modal-actions">
          {cancelLabel && (
            <button className="btn page-toolbar-button inline-flex min-h-[42px] items-center justify-center" onClick={onClose}>{cancelLabel}</button>
          )}
          <button className={`${styles.action} ${confirmButtonClassName}`.trim()} onClick={handleConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default AppDialog;