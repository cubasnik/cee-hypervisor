import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Server,
  HardDrive,
  Camera,
  Network,
  Database,
  LayoutDashboard,
  Layers,
  Monitor,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const menuItems = [
  {
    path: '/dashboard',
    name: 'Панель управления',
    icon: LayoutDashboard,
    color: 'text-blue-400'
  },
  {
    path: '/clusters',
    name: 'Кластеры',
    icon: Layers,
    color: 'text-green-400'
  },
  {
    path: '/servers',
    name: 'Серверы',
    icon: Server,
    color: 'text-purple-400'
  },
  {
    path: '/vms',
    name: 'Виртуальные машины',
    icon: Monitor,
    color: 'text-red-400'
  },
  {
    path: '/images',
    name: 'Образы',
    icon: HardDrive,
    color: 'text-orange-400'
  },
  {
    path: '/snapshots',
    name: 'Резервные копии',
    icon: Camera,
    color: 'text-yellow-400'
  },
  {
    path: '/network',
    name: 'Сети',
    icon: Network,
    color: 'text-emerald-400'
  },
  {
    path: '/storage',
    name: 'Хранилища',
    icon: Database,
    color: 'text-cyan-400'
  }
];

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`bg-dark-800 border-r border-dark-700 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}> 
      {/* Logo */}
      <div className={`p-6 border-b border-dark-700 flex items-center ${collapsed ? 'justify-center' : ''}`}>
        <div className={`flex items-center ${collapsed ? '' : 'space-x-3'}`}>
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-white">CEE Hypervisor</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 p-4 space-y-2 ${collapsed ? 'px-1' : ''}`}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''} flex items-center ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.name : undefined}
            >
              <IconComponent className={`w-5 h-5 ${collapsed ? '' : 'mr-3'} ${item.color}`} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-700">
        <div className={`text-sm text-dark-400 ${collapsed ? 'text-center' : ''}`}> 
          {!collapsed && (
            <div className="flex flex-col items-center">
              <div>ООО "ЭрикссонСофт"</div>
              <a
                href="http://ericssonsoftware.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-1 text-blue-800 hover:text-blue-600 transition-colors cursor-pointer block text-center"
              >
                ericssonsoftware.ru
              </a>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2 flex items-center justify-center">
            <button className="text-dark-400 hover:text-white transition-colors mx-auto block">
              <span className="text-sm">Отключено</span>
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-center">
          <button
            className="text-dark-400 hover:text-white transition-colors text-sm flex items-center justify-center mx-auto"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />} 
            <span className={collapsed ? 'sr-only' : 'ml-2'}>{collapsed ? 'Развернуть' : 'Свернуть'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;