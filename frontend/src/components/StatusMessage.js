import React from 'react';

const StatusMessage = ({ message, className = '' }) => {
  if (!message) {
    return null;
  }

  return <div className={`text-sm text-red-400 ${className}`.trim()}>Ошибка: {message}</div>;
};

export default StatusMessage;