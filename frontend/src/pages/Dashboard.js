import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, HardDrive, Monitor, Play, Plus, Server } from 'lucide-react';
import { apiService } from '../services/api';
import ActionButton from '../components/ActionButton';
import AppToast from '../components/AppToast';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import StatCard from '../components/StatCard';
import StatusMessage from '../components/StatusMessage';
import VmReadinessIndicator from '../components/VmReadinessIndicator';
import { useTimedMessage } from '../hooks/useTimedMessage';

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
  const navigate = useNavigate();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const [stats, setStats] = useState({
    serversCount: 0,
    clustersCount: 0,
    totalCpuCores: 0,
    totalMemoryGb: 0,
    vmsCount: 0,
    runningVmsCount: 0,
    imagesCount: 0,
  });
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runningVms = useMemo(
    () => vms.filter((vm) => {
      const status = (vm.status || '').toString().toLowerCase();
      return status === 'running' || status === 'запущена';
    }),
    [vms]
  );

  const loadStats = useCallback(async (showMessage = false) => {
    try {
      setLoading(true);
      setError('');
      const [vmsResponse, imagesResponse, serversResponse, clustersResponse] = await Promise.all([
        apiService.getVMs(),
        apiService.getImages(),
        apiService.getServers(),
        apiService.getClusters(),
      ]);

      const nextVms = Array.isArray(vmsResponse.data) ? vmsResponse.data : [];
      const images = Array.isArray(imagesResponse.data) ? imagesResponse.data : [];
      const servers = Array.isArray(serversResponse.data) ? serversResponse.data : [];
      const clusters = Array.isArray(clustersResponse.data) ? clustersResponse.data : [];
      const runningVmsCount = nextVms.filter((vm) => {
        const status = (vm.status || '').toString().toLowerCase();
        return status === 'running' || status === 'запущена';
      }).length;
      const totalCpuCores = servers.reduce((sum, server) => sum + Number(server.cpu_cores || 0), 0);
      const totalMemoryGb = servers.reduce((sum, server) => {
        const memoryMb = Number(server.memory_total || server.memory_mb || 0);
        return sum + memoryMb / 1024;
      }, 0);

      setVms(nextVms);
      setStats({
        serversCount: servers.length,
        clustersCount: clusters.length,
        totalCpuCores,
        totalMemoryGb,
        vmsCount: nextVms.length,
        runningVmsCount,
        imagesCount: images.length,
      });
      if (showMessage) {
        showUpdateMessage('Панель управления обновлена');
      }
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message || 'Ошибка загрузки панели управления');
      setVms([]);
      setStats({
        serversCount: 0,
        clustersCount: 0,
        totalCpuCores: 0,
        totalMemoryGb: 0,
        vmsCount: 0,
        runningVmsCount: 0,
        imagesCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadStats(false);
    const intervalId = window.setInterval(() => {
      loadStats(false);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions meta="Статистика обновляется автоматически каждые 15 секунд.">
        <RefreshButton onClick={() => loadStats(true)} loading={loading} />
        <ActionButton icon={Plus} label="Создать ВМ" onClick={() => navigate('/vms')} />
        <ActionButton icon={HardDrive} label="Загрузить образ" onClick={() => navigate('/images')} />
      </PageActions>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Обновление панели управления...' : ''} />

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

      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn-primary page-toolbar-button" onClick={() => navigate('/vms')}>Создать ВМ</button>
          <button className="btn page-toolbar-button" onClick={() => navigate('/images')}>Загрузить образ</button>
          <button className="btn page-toolbar-button" onClick={() => navigate('/servers')}>Открыть серверы</button>
          <button className="btn page-toolbar-button" onClick={() => navigate('/clusters')}>Открыть кластеры</button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-white">Активные ВМ</h2>
            <p className="text-sm text-dark-400 mt-1">Список виртуальных машин со статусом "Работает".</p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
            Активно: {runningVms.length}
          </span>
        </div>

        {runningVms.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="Активных ВМ нет"
            description="Когда виртуальные машины будут запущены, они появятся здесь."
          />
        ) : (
          <div className="space-y-3">
            {runningVms.map((vm) => (
              <div key={vm.id} className="flex items-center justify-between gap-4 rounded-xl border border-dark-700 bg-dark-900/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{vm.name}</span>
                  </div>
                  <p className="mt-1 text-sm text-dark-400">
                    {vm.cpu_cores ?? vm.cpu ?? '-'} CPU, {formatMemoryGb(vm.memory_mb ?? vm.memory ?? 0)} RAM, {vm.storage_pool || 'Системный путь'}
                  </p>
                  <VmReadinessIndicator vm={vm} compact className="mt-3 max-w-xl" />
                </div>
                <button className="btn page-toolbar-button" onClick={() => navigate(`/vms?vm=${encodeURIComponent(vm.name)}`)}>
                  Открыть ВМ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;