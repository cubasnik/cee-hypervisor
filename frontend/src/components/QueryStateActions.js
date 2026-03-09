import React from 'react';
import { Link2, X } from 'lucide-react';

const QueryStateActions = ({
  activeIndicators = [],
  onCopyLink,
  onResetAll,
  onRemoveIndicator,
  copyLabel = 'Скопировать ссылку',
  resetLabel = 'Сбросить всё',
  actionButtonClassName = 'page-toolbar-button',
  className = '',
}) => {
  if (activeIndicators.length > 0) {
    return (
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3 text-sm text-cyan-100 ${className}`.trim()}>
        <span className="text-cyan-200">Активные параметры:</span>
        {activeIndicators.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
            <span>{item.label}</span>
            {onRemoveIndicator ? (
              <button
                type="button"
                className="rounded-full p-0.5 text-cyan-200 transition-colors hover:bg-cyan-500/20 hover:text-white"
                onClick={() => onRemoveIndicator(item.id)}
                aria-label={`Убрать параметр ${item.label}`}
                title={`Убрать параметр ${item.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <button className={`btn ${actionButtonClassName}`.trim()} onClick={onCopyLink}>
          <span className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span>{copyLabel}</span>
          </span>
        </button>
        {onResetAll ? (
          <button className={`btn ${actionButtonClassName}`.trim()} onClick={onResetAll}>
            {resetLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex justify-end ${className}`.trim()}>
      <button className={`btn ${actionButtonClassName}`.trim()} onClick={onCopyLink}>
        <span className="inline-flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          <span>{copyLabel}</span>
        </span>
      </button>
    </div>
  );
};

export default QueryStateActions;