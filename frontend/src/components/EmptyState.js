import React from 'react';

const EmptyState = ({
  icon: Icon,
  title,
  description,
  className = 'py-16 text-center',
}) => {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center text-dark-400">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-700">
          {Icon && <Icon className="h-8 w-8" />}
        </div>
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default EmptyState;