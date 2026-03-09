import React from 'react';

const ActionButton = ({ icon: Icon, label, disabled = false, onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-primary page-toolbar-button flex items-center space-x-2 ${className}`.trim()}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );
};

export default ActionButton;