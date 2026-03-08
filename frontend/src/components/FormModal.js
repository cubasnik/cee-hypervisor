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
        <div className="mb-5">
          <h3 className="modal-title">{title}</h3>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        </div>
        <fieldset disabled={isSubmitting} className={`space-y-4 ${isSubmitting ? 'opacity-80' : ''}`}>
          {children}
        </fieldset>
          <div className="modal-actions">
            <button className="btn" onClick={onClose} disabled={isSubmitting}>{cancelLabel}</button>
            <button className="btn-primary" onClick={onConfirm} disabled={isSubmitting || confirmDisabled}>
              {isSubmitting ? (confirmBusyLabel || confirmLabel) : confirmLabel}
            </button>
          </div>
      </div>
    </div>
  );
};

export default FormModal;