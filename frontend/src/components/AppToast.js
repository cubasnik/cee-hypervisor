import React from 'react';

const AppToast = ({ message, variant = 'success' }) => {
  if (!message) {
    return null;
  }

  const toneClass = variant === 'success'
    ? 'border-green-500/30 bg-green-600 text-white shadow-green-950/30'
    : 'border-blue-500/30 bg-blue-600 text-white shadow-blue-950/30';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className={`min-w-[220px] max-w-xl rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${toneClass}`}>
        {message}
      </div>
    </div>
  );
};

export default AppToast;