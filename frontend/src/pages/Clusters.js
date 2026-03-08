import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Server, Activity } from 'lucide-react';
import { apiService } from '../services/api';
import ActionButton from '../components/ActionButton';
import AppToast from '../components/AppToast';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import ResourceCard from '../components/ResourceCard';
import StatusMessage from '../components/StatusMessage';
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

const Clusters = () => {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();

  const loadClusters = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getClusters();
      setClusters(Array.isArray(response.data) ? response.data : []);
      if (showMessage) {
        showUpdateMessage('Обновление выполнено');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки кластеров');
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadClusters(false);
  }, [loadClusters]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status) => {
    switch ((status || '').toString().toLowerCase()) {
      case 'online':
        return 'Онлайн';
      case 'offline':
        return 'Офлайн';
      case 'maintenance':
        return 'Обслуживание';
      default:
        return 'Неизвестно';
    }
  };

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions>
        <RefreshButton onClick={() => loadClusters(true)} loading={loading} />
        <ActionButton icon={Plus} label="Добавить кластер" />
      </PageActions>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка кластеров...' : ''} />

      {clusters.length === 0 && !loading ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="Кластеры не найдены"
            description="Добавьте кластер, чтобы он появился здесь."
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {clusters.map((cluster, index) => (
          <ResourceCard
            key={cluster.id}
            icon={Layers}
            iconBgClass="bg-primary-600"
            title={cluster.name || `cluster-${index + 1}`}
            subtitle={cluster.type || '-'}
            subtitleClassName="capitalize"
            statusLabel={getStatusLabel(cluster.status)}
            statusColorClass={getStatusColor(cluster.status)}
            stats={[
              { icon: Activity, iconClass: 'text-blue-400', label: 'Ядра CPU', value: `${cluster.cpu_cores ?? 0} ядер` },
              { icon: Server, iconClass: 'text-green-400', label: 'ОЗУ', value: formatMemoryGb(cluster.memory || cluster.memory_mb || 0) },
            ]}
            footerText={`${cluster.hosts ?? 0} серверов в кластере`}
          />
        ))}
      </div>
      )}
    </div>
  );
};

export default Clusters;