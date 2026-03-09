import React from 'react';
import { RefreshCw } from 'lucide-react';

const RefreshButton = ({ onClick, loading = false, disabled = false, label = 'Обновить', className = '' }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`btn-primary page-toolbar-button flex items-center space-x-2 ${className}`.trim()}
      title={loading ? 'Обновление...' : label}
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      <span>{loading ? 'Обновление...' : label}</span>
    </button>
  );
};

export default RefreshButton;