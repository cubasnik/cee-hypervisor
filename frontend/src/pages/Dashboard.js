import React, { useEffect, useState } from 'react';
import { Activity, Server, Monitor, HardDrive } from 'lucide-react';
import { apiService } from '../services/api';
import StatCard from '../components/StatCard';

const formatMemoryGb = (memoryMb) => {
  const memoryGb = Number(memoryMb || 0) / 1024;
  if (memoryGb === 0) {
    return '0 GB';
  }
  if (memoryGb >= 100) {
    return `${memoryGb.toFixed(0)} GB`;
  }
  return `${memoryGb.toFixed(1)} GB`;
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    serversCount: 0,
    clustersCount: 0,
    totalCpuCores: 0,
    totalMemoryGb: 0,
    vmsCount: 0,
    runningVmsCount: 0,
    imagesCount: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const [vmsResponse, imagesResponse, serversResponse, clustersResponse] = await Promise.all([
          apiService.getVMs(),
          apiService.getImages(),
          apiService.getServers(),
          apiService.getClusters(),
        ]);

        if (!isMounted) {
          return;
        }

        const vms = Array.isArray(vmsResponse.data) ? vmsResponse.data : [];
        const images = Array.isArray(imagesResponse.data) ? imagesResponse.data : [];
        const servers = Array.isArray(serversResponse.data) ? serversResponse.data : [];
        const clusters = Array.isArray(clustersResponse.data) ? clustersResponse.data : [];
        const runningVmsCount = vms.filter((vm) => {
          const status = (vm.status || '').toString().toLowerCase();
          return status === 'running' || status === 'запущена';
        }).length;
        const totalCpuCores = servers.reduce((sum, server) => sum + Number(server.cpu_cores || 0), 0);
        const totalMemoryGb = servers.reduce((sum, server) => {
          const memoryMb = Number(server.memory_total || server.memory_mb || 0);
          return sum + memoryMb / 1024;
        }, 0);

        setStats({
          serversCount: servers.length,
          clustersCount: clusters.length,
          totalCpuCores,
          totalMemoryGb,
          vmsCount: vms.length,
          runningVmsCount,
          imagesCount: images.length,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStats({
          serversCount: 0,
          clustersCount: 0,
          totalCpuCores: 0,
          totalMemoryGb: 0,
          vmsCount: 0,
          runningVmsCount: 0,
          imagesCount: 0,
        });
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ядра CPU"
          value={stats.totalCpuCores}
          subtitle={`На ${stats.clustersCount} кластерах`}
          icon={Activity}
          color="text-blue-500"
        />
        <StatCard
          title="ОЗУ"
          value={formatMemoryGb(stats.totalMemoryGb * 1024)}
          subtitle={`На ${stats.serversCount} серверах`}
          icon={Server}
          color="text-green-500"
        />
        <StatCard
          title="ВМ"
          value={stats.vmsCount}
          subtitle={`${stats.runningVmsCount} запущено`}
          icon={Monitor}
          color="text-purple-500"
        />
        <StatCard
          title="Образы"
          value={stats.imagesCount}
          subtitle="ISO, QCOW2, IMG"
          icon={HardDrive}
          color="text-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn-primary">Создать ВМ</button>
          <button className="btn-secondary">Загрузить образ</button>
          <button className="btn-secondary">Добавить сервер</button>
          <button className="btn-secondary">Добавить кластер</button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Последняя активность</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-dark-300">ВМ "vm1" остановлена</span>
            <span className="text-sm text-dark-400">2 минуты назад</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-dark-300">Кластер "ci-cluster" подключен</span>
            <span className="text-sm text-dark-400">1 час назад</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-dark-300">Сервер "node2" доступен</span>
            <span className="text-sm text-dark-400">3 часа назад</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;