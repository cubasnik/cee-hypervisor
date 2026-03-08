import React from 'react';

const ResourceCard = ({
  icon: Icon,
  iconBgClass,
  title,
  subtitle,
  subtitleClassName = '',
  statusLabel,
  statusColorClass,
  stats = [],
  footerText,
  footerIcon: FooterIcon,
  footerIconClass = 'text-dark-400',
}) => {
  return (
    <div className="card hover:bg-dark-700/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgClass}`}>
            {Icon && <Icon className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className={`text-sm text-dark-400 ${subtitleClassName}`.trim()}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${statusColorClass}`}></div>
          <span className="text-sm text-dark-300 capitalize">{statusLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center space-x-2">
              {StatIcon && <StatIcon className={`w-4 h-4 ${stat.iconClass || 'text-dark-400'}`} />}
              <div>
                <span className="block text-sm text-dark-400">{stat.label}</span>
                <span className="text-white font-medium">{stat.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-dark-700">
        <span className="text-sm text-dark-400">{footerText}</span>
        {FooterIcon && <FooterIcon className={`w-4 h-4 ${footerIconClass}`} />}
      </div>
    </div>
  );
};

export default ResourceCard;