import React from 'react';

const LoadingState = ({ message, className = '' }) => {
  if (!message) {
    return null;
  }

  return <div className={`text-sm text-dark-300 ${className}`.trim()}>{message}</div>;
};

export default LoadingState;