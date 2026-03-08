import React, { useCallback, useEffect, useState } from 'react';
import { Server, Plus, Activity, HardDrive, Wifi } from 'lucide-react';
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

const Servers = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();

  const loadServers = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getServers();
      setServers(Array.isArray(response.data) ? response.data : []);
      if (showMessage) {
        showUpdateMessage('Обновление выполнено');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки серверов');
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadServers(false);
  }, [loadServers]);

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
        <RefreshButton onClick={() => loadServers(true)} loading={loading} />
        <ActionButton icon={Plus} label="Добавить сервер" />
      </PageActions>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка серверов...' : ''} />

      {servers.length === 0 && !loading ? (
        <div className="card">
          <EmptyState
            icon={Server}
            title="Серверы не найдены"
            description="Подключите сервер, чтобы он появился здесь."
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {servers.map((server, index) => (
          <ResourceCard
            key={server.id}
            icon={Server}
            iconBgClass="bg-purple-600"
            title={server.name || `server-${index + 1}`}
            subtitle={server.hostname || server.host || '-'}
            statusLabel={getStatusLabel(server.status)}
            statusColorClass={getStatusColor(server.status)}
            stats={[
              { icon: Activity, iconClass: 'text-blue-400', label: 'Ядра CPU', value: `${server.cpu_cores ?? 0} ядер` },
              { icon: HardDrive, iconClass: 'text-green-400', label: 'ОЗУ', value: formatMemoryGb(server.memory_total || server.memory_mb || 0) },
            ]}
            footerText={`Кластер: ${server.cluster || server.cluster_name || '-'}`}
            footerIcon={Wifi}
            footerIconClass="text-green-400"
          />
        ))}
      </div>
      )}
    </div>
  );
};

export default Servers;