import React from 'react';

const FormModal = ({
  isOpen,
  title,
  subtitle,
  confirmLabel = 'Сохранить',
  confirmBusyLabel,
  cancelLabel = 'Отмена',
  isSubmitting = false,
  confirmDisabled = false,
  onClose,
  onConfirm,
  children,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        </div>
        <div className="modal-body">
          <fieldset disabled={isSubmitting} className={`space-y-4 ${isSubmitting ? 'opacity-80' : ''}`}>
            {children}
          </fieldset>
        </div>
        <div className="modal-actions">
          <button className="btn page-toolbar-button inline-flex min-h-[42px] items-center justify-center" onClick={onClose} disabled={isSubmitting}>{cancelLabel}</button>
          <button className="btn-primary page-toolbar-button inline-flex min-h-[42px] items-center justify-center" onClick={onConfirm} disabled={isSubmitting || confirmDisabled}>
            {isSubmitting ? (confirmBusyLabel || confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormModal;