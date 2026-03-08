import React from 'react';

const PageActions = ({ meta, children }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-[24px] text-sm text-dark-400">{meta || null}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
};

export default PageActions;