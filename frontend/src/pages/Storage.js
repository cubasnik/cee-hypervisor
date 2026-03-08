import React, { useCallback, useEffect, useState } from 'react';
import { Database, Plus, HardDrive, FolderOpen } from 'lucide-react';
import { apiService } from '../services/api';
import ActionButton from '../components/ActionButton';
import AppDialog from '../components/AppDialog';
import EmptyState from '../components/EmptyState';
import FormModal from '../components/FormModal';
import LoadingState from '../components/LoadingState';
import AppToast from '../components/AppToast';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import StatCard from '../components/StatCard';
import StatusMessage from '../components/StatusMessage';
import { useDialog } from '../hooks/useDialog';
import { useTimedMessage } from '../hooks/useTimedMessage';

const formatSize = (sizeBytes) => {
  const size = Number(sizeBytes || 0);
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }
  return `${size} B`;
};

const Storage = () => {
  const [volumes, setVolumes] = useState([]);
  const [overview, setOverview] = useState({ pools_count: 0, volumes_count: 0, backups_status: 'Недоступно' });
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const { dialog, openDialog, closeDialog } = useDialog();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const [newVolume, setNewVolume] = useState({ pool: '', name: '', size_gb: 10 });

  const loadStorage = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getStorage();
      setOverview(response.data?.overview || { pools_count: 0, volumes_count: 0, backups_status: 'Недоступно' });
      setPools(Array.isArray(response.data?.pools) ? response.data.pools : []);
      setVolumes(Array.isArray(response.data?.volumes) ? response.data.volumes : []);
      if (showMessage) {
        showUpdateMessage('Обновление выполнено');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки хранилищ');
      setOverview({ pools_count: 0, volumes_count: 0, backups_status: 'Недоступно' });
      setPools([]);
      setVolumes([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadStorage(false);
  }, [loadStorage]);

  const handleCreateChange = (field) => (event) => {
    const value = field === 'size_gb' ? Number(event.target.value) : event.target.value;
    setNewVolume((current) => ({ ...current, [field]: value }));
  };

  const createErrors = {
    pool: !newVolume.pool ? 'Выберите пул хранения.' : '',
    name: !newVolume.name.trim() ? 'Укажите имя тома.' : '',
    size_gb: !newVolume.size_gb || Number(newVolume.size_gb) < 1 ? 'Укажите размер не меньше 1 GB.' : '',
  };

  const hasCreateErrors = Boolean(createErrors.pool || createErrors.name || createErrors.size_gb);

  const isFieldInvalid = (field) => Boolean((createAttempted || touchedFields[field]) && createErrors[field]);

  const getFieldClassName = (field) => `input w-full${isFieldInvalid(field) ? ' input-error' : ''}`;

  const markFieldTouched = (field) => () => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const resetCreateValidation = () => {
    setCreateAttempted(false);
    setTouchedFields({});
  };

  const openCreateModal = () => {
    resetCreateValidation();
    setNewVolume((current) => ({ ...current, pool: pools[0] || current.pool || '' }));
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }
    resetCreateValidation();
    setShowCreate(false);
  };

  const isCreateDisabled = hasCreateErrors;

  const submitCreate = async () => {
    if (isCreating) {
      return;
    }

    setCreateAttempted(true);

    if (hasCreateErrors) {
      return;
    }

    try {
      setIsCreating(true);
      await apiService.createStorageVolume(newVolume);
      resetCreateValidation();
      setShowCreate(false);
      setNewVolume({ pool: pools[0] || '', name: '', size_gb: 10 });
      await loadStorage(true);
    } catch (err) {
      openDialog({
        title: 'Не удалось создать том',
        message: err.response?.data?.detail || err.message || 'Ошибка создания тома',
        variant: 'danger',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions>
        <RefreshButton onClick={() => loadStorage(true)} loading={loading} />
        <ActionButton icon={Plus} label="Создать том" onClick={openCreateModal} disabled={pools.length === 0} />
      </PageActions>

      <FormModal
        isOpen={showCreate}
        title="Создать том"
        subtitle="Выберите пул хранения и задайте параметры нового тома."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isCreating}
        confirmDisabled={isCreateDisabled}
        onClose={closeCreateModal}
        onConfirm={submitCreate}
      >
        <div className="modal-field">
          <label className="modal-label">Пул хранения</label>
          <select className={getFieldClassName('pool')} value={newVolume.pool} onChange={handleCreateChange('pool')} onBlur={markFieldTouched('pool')}>
            {pools.map((poolName) => (
              <option key={poolName} value={poolName}>{poolName}</option>
            ))}
          </select>
          {isFieldInvalid('pool') && <p className="text-xs text-red-400">{createErrors.pool}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Имя тома</label>
          <input className={getFieldClassName('name')} value={newVolume.name} onChange={handleCreateChange('name')} onBlur={markFieldTouched('name')} />
          {isFieldInvalid('name') && <p className="text-xs text-red-400">{createErrors.name}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Размер (GB)</label>
          <input type="number" min="1" className={getFieldClassName('size_gb')} value={newVolume.size_gb} onChange={handleCreateChange('size_gb')} onBlur={markFieldTouched('size_gb')} />
          {isFieldInvalid('size_gb') && <p className="text-xs text-red-400">{createErrors.size_gb}</p>}
        </div>
      </FormModal>

      <AppDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        variant={dialog.variant}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        onConfirm={dialog.onConfirm}
        onClose={closeDialog}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Тома"
          value={overview.volumes_count}
          subtitle="Найденные тома"
          icon={HardDrive}
          color="text-cyan-400"
        />
        <StatCard
          title="Пулы хранения"
          value={overview.pools_count}
          subtitle="Доступные пулы хранения"
          icon={FolderOpen}
          color="text-yellow-400"
        />
        <StatCard
          title="Бэкапы"
          value={overview.backups_status}
          subtitle="Интеграция с S3/NFS"
          icon={Database}
          color="text-green-400"
        />
      </div>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка хранилищ...' : ''} />

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Список томов</h3>
        </div>

        {volumes.length === 0 && !loading ? (
          <EmptyState
            icon={Database}
            title="Тома не найдены"
            description="Создайте том, чтобы он появился здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Имя</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Размер</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Пул хранения</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((volume) => (
                  <tr key={volume.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="py-3 px-4 text-white">{volume.name}</td>
                    <td className="py-3 px-4 text-dark-300">{formatSize(volume.size_bytes)}</td>
                    <td className="py-3 px-4 text-dark-300">{volume.status}</td>
                    <td className="py-3 px-4 text-dark-300">{volume.pool}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Storage;