import React from 'react';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'text-primary-500' }) => {
  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-4">
        {Icon && <Icon className={`w-6 h-6 ${color}`} />}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-2xl font-bold text-white mb-2">{value}</p>
      {subtitle && <p className="text-sm text-dark-400">{subtitle}</p>}
    </div>
  );
};

export default StatCard;