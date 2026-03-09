import React from 'react';

const FormInlineHelp = ({
  title = 'Быстрые настройки',
  description = '',
  presets = [],
  selectedPreset = '',
  tips = [],
  className = '',
}) => {
  if (!description && presets.length === 0 && tips.length === 0) {
    return null;
  }

  return (
    <div className={`modal-assist ${className}`.trim()}>
      <div className="space-y-1">
        <div className="modal-assist-title">{title}</div>
        {description ? <p className="modal-assist-text">{description}</p> : null}
      </div>

      {presets.length > 0 ? (
        <div className="modal-assist-presets">
          {presets.map((preset) => {
            const isActive = preset.isActive ?? (preset.id && preset.id === selectedPreset);

            return (
              <button
                key={preset.id || preset.label}
                type="button"
                className={`modal-preset-button${isActive ? ' is-active' : ''}`}
                onClick={preset.onClick}
                disabled={preset.disabled}
                title={preset.description || preset.label}
                aria-pressed={Boolean(isActive)}
              >
                <span>{preset.label}</span>
                {preset.description ? <span className="modal-preset-caption">{preset.description}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="modal-assist-list">
          {tips.map((tip) => (
            <p key={tip} className="modal-assist-tip">{tip}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FormInlineHelp;