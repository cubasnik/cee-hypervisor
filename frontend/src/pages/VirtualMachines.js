import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Square, RotateCcw, Plus, Settings, Monitor } from 'lucide-react';
import { apiService } from '../services/api';
import ActionButton from '../components/ActionButton';
import AppDialog from '../components/AppDialog';
import EmptyState from '../components/EmptyState';
import FormInlineHelp from '../components/FormInlineHelp';
import FormModal from '../components/FormModal';
import LoadingState from '../components/LoadingState';
import AppToast from '../components/AppToast';
import PageActions from '../components/PageActions';
import QueryStateActions from '../components/QueryStateActions';
import RefreshButton from '../components/RefreshButton';
import StatusMessage from '../components/StatusMessage';
import VmReadinessIndicator from '../components/VmReadinessIndicator';
import { useDialog } from '../hooks/useDialog';
import useQueryStateUrl from '../hooks/useQueryStateUrl';
import { useTimedMessage } from '../hooks/useTimedMessage';
import {
  buildQueryStateIndicators,
  createQueryStateIndicator,
  createQueryStateResetConfig,
} from '../utils/queryState';

const getNextPresetName = (baseName, existingNames) => {
  const normalizedNames = new Set(existingNames.map((name) => String(name || '').toLowerCase()));
  if (!normalizedNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let suffix = 2;
  while (normalizedNames.has(`${baseName}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${baseName}-${suffix}`;
};

const VM_PRESET_CONFIG = {
  mini: {
    name: 'vm-mini',
    cpu_cores: 1,
    memory_mb: 1024,
    disk_gb: 10,
  },
  service: {
    name: 'vm-service',
    cpu_cores: 2,
    memory_mb: 2048,
    disk_gb: 20,
  },
  database: {
    name: 'vm-db',
    cpu_cores: 4,
    memory_mb: 4096,
    disk_gb: 40,
  },
};

const VirtualMachines = () => {
  const [vms, setVms] = useState([]);
  const [storagePools, setStoragePools] = useState([]);
  const [storageVolumes, setStorageVolumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedVmPreset, setSelectedVmPreset] = useState('mini');
  const [createAttempted, setCreateAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [pendingVmAction, setPendingVmAction] = useState(null);
  const { dialog, openDialog, closeDialog } = useDialog();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const { searchParams, removeQueryIndicator, resetAllQueryIndicators, copyCurrentLink } = useQueryStateUrl({
    onCopySuccess: showUpdateMessage,
    onCopyError: () => showUpdateMessage('Не удалось скопировать ссылку'),
  });
  const rowRefs = useRef({});

  const loadVMs = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError(null);
      const [vmResponse, storageResponse] = await Promise.all([
        apiService.getVMs(),
        apiService.getStorage(),
      ]);
      setVms(vmResponse.data || []);
      setStoragePools(Array.isArray(storageResponse.data?.pools) ? storageResponse.data.pools : []);
      setStorageVolumes(Array.isArray(storageResponse.data?.volumes) ? storageResponse.data.volumes : []);
      if (showMessage) {
        showUpdateMessage('Данные обновлены');
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Ошибка загрузки списка виртуальных машин'
      );
      setStoragePools([]);
      setStorageVolumes([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadVMs(false);
  }, [loadVMs]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
      case 'запущена':
        return 'bg-green-500';
      case 'stopped':
      case 'остановлена':
        return 'bg-red-500';
      case 'paused':
      case 'приостановлена':
        return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status) => {
    const normalized = (status || '').toString().toLowerCase();
    if (normalized === 'running') return 'Работает';
    if (normalized === 'stopped') return 'Остановлена';
    if (normalized === 'paused') return 'Приостановлена';
    return status || 'Неизвестно';
  };

  const runVmAction = async (id, action, request, failureTitle) => {
    if (pendingVmAction?.id === id) {
      return;
    }

    try {
      setPendingVmAction({ id, action });
      await request(id);
      await loadVMs();
    } catch (err) {
      openDialog({
        title: failureTitle,
        message: err.response?.data?.detail || err.message || 'Неизвестная ошибка',
        variant: 'danger',
      });
    } finally {
      setPendingVmAction(null);
    }
  };

  const handleStart = async (id) => {
    await runVmAction(id, 'start', apiService.startVM, 'Не удалось запустить ВМ');
  };

  const handleStop = async (id) => {
    await runVmAction(id, 'stop', apiService.stopVM, 'Не удалось остановить ВМ');
  };

  const handleRestart = async (id) => {
    await runVmAction(id, 'restart', apiService.restartVM, 'Не удалось перезапустить ВМ');
  };

  const activeStoragePools = useMemo(
    () => storagePools.filter((pool) => pool.status === 'online' || pool.status === 'degraded' || pool.status === 'building'),
    [storagePools]
  );

  const selectedVmName = searchParams.get('vm') || '';
  const selectedPoolName = searchParams.get('pool') || '';
  const selectedVolumeName = searchParams.get('volume') || '';
  const activeQueryIndicators = useMemo(() => {
    return buildQueryStateIndicators([
      createQueryStateIndicator('vm', selectedVmName),
      createQueryStateIndicator('pool', selectedPoolName),
      createQueryStateIndicator('volume', selectedVolumeName),
    ]);
  }, [selectedPoolName, selectedVmName, selectedVolumeName]);

  useEffect(() => {
    const targetNode = rowRefs.current[selectedVmName];
    if (selectedVmName && targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedVmName, vms]);

  const [showCreate, setShowCreate] = useState(false);
  const [newVm, setNewVm] = useState({ name: '', cpu_cores: 1, memory_mb: 1024, disk_gb: 10, disk_mode: 'create', storage_pool: '', existing_volume: '' });

  const usedStorageVolumeKeys = useMemo(
    () => new Set(
      vms
        .filter((vm) => vm.storage_pool && vm.storage_volume)
        .map((vm) => `${vm.storage_pool}::${vm.storage_volume}`)
    ),
    [vms]
  );

  const availableExistingVolumes = useMemo(() => {
    if (!newVm.storage_pool) {
      return [];
    }
    return storageVolumes.filter(
      (volume) => volume.pool === newVm.storage_pool && !usedStorageVolumeKeys.has(`${volume.pool}::${volume.name}`)
    );
  }, [newVm.storage_pool, storageVolumes, usedStorageVolumeKeys]);

  const buildVmPresetForm = useCallback((presetId, currentForm = newVm) => {
    const preset = VM_PRESET_CONFIG[presetId] || VM_PRESET_CONFIG.mini;
    return {
      ...currentForm,
      name: getNextPresetName(preset.name, vms.map((vm) => vm.name)),
      cpu_cores: preset.cpu_cores,
      memory_mb: preset.memory_mb,
      disk_gb: preset.disk_gb,
      disk_mode: 'create',
      storage_pool: currentForm.storage_pool || activeStoragePools[0]?.name || '',
      existing_volume: '',
    };
  }, [activeStoragePools, newVm, vms]);

  const handleCreate = () => {
    setCreateAttempted(false);
    setTouchedFields({});
    setSelectedVmPreset('mini');
    setNewVm(buildVmPresetForm('mini', {
      name: '',
      cpu_cores: 1,
      memory_mb: 1024,
      disk_gb: 10,
      disk_mode: 'create',
      storage_pool: activeStoragePools[0]?.name || '',
      existing_volume: '',
    }));
    setShowCreate(true);
  };

  const handleCreateChange = (field) => (e) => {
    const value = e.target.value;
    setSelectedVmPreset('');
    setNewVm((s) => ({
      ...s,
      existing_volume: field === 'disk_mode' || field === 'storage_pool' ? '' : s.existing_volume,
      [field]: field === 'name' || field === 'storage_pool' || field === 'disk_mode' || field === 'existing_volume' ? value : Number(value),
    }));
  };

  const applyVmPreset = (presetId) => {
    resetCreateValidation();
    setSelectedVmPreset(presetId);
    setNewVm((current) => buildVmPresetForm(presetId, current));
  };

  const createErrors = {
    name: !newVm.name.trim() ? 'Введите имя виртуальной машины.' : '',
    cpu_cores: Number(newVm.cpu_cores) < 1 ? 'Укажите хотя бы 1 ядро CPU.' : '',
    memory_mb: Number(newVm.memory_mb) < 128 ? 'Укажите не меньше 128 MB ОЗУ.' : '',
    disk_gb: newVm.disk_mode === 'create' && Number(newVm.disk_gb) < 1 ? 'Укажите размер диска не меньше 1 GB.' : '',
    storage_pool: newVm.disk_mode === 'existing' && !newVm.storage_pool ? 'Выберите пул хранения для существующего тома.' : '',
    existing_volume: newVm.disk_mode === 'existing' && !newVm.existing_volume ? 'Выберите существующий том.' : '',
  };

  const hasCreateErrors = Boolean(createErrors.name || createErrors.cpu_cores || createErrors.memory_mb || createErrors.disk_gb || createErrors.storage_pool || createErrors.existing_volume);

  const isFieldInvalid = (field) => Boolean((createAttempted || touchedFields[field]) && createErrors[field]);

  const getFieldClassName = (field) => `input w-full${isFieldInvalid(field) ? ' input-error' : ''}`;

  const markFieldTouched = (field) => () => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const resetCreateValidation = () => {
    setCreateAttempted(false);
    setTouchedFields({});
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
      await apiService.createVM(newVm);
      resetCreateValidation();
      setSelectedVmPreset('mini');
      setShowCreate(false);
      setNewVm({ name: '', cpu_cores: 1, memory_mb: 1024, disk_gb: 10, disk_mode: 'create', storage_pool: activeStoragePools[0]?.name || '', existing_volume: '' });
      await loadVMs(false);
      openDialog({
        title: `ВМ ${newVm.name} создана`,
        message: `Виртуальная машина ${newVm.name} добавлена в список.`,
        variant: 'success',
      });
    } catch (err) {
      openDialog({
        title: 'Не удалось создать ВМ',
        message: err.response?.data?.detail || err.message || 'Неизвестная ошибка',
        variant: 'danger',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSettings = (vm) => {
    openDialog({
      title: `Параметры ВМ ${vm.name}`,
      message:
        `Ядра CPU: ${vm.cpu_cores ?? vm.cpu}\n` +
        `ОЗУ: ${vm.memory_mb ?? vm.memory} MB\n` +
        `Диск: ${vm.disk_gb ?? vm.disk ?? '-'} GB\n` +
        `Хранилище: ${vm.storage_pool || 'Системный путь'}\n` +
        `Том: ${vm.storage_volume || '-'}\n` +
        `Путь: ${vm.disk_path || '-'}\n` +
        `Кластер: ${vm.cluster_id ?? vm.cluster ?? '-'}`,
      variant: 'info',
    });
  };

  const handleResetQueryState = () => {
    resetAllQueryIndicators(queryStateConfig);
  };

  const queryStateConfig = useMemo(() => ({
    vm: createQueryStateResetConfig({
      resetKeys: ['vm'],
    }),
    pool: createQueryStateResetConfig({
      resetKeys: ['pool', 'volume'],
    }),
    volume: createQueryStateResetConfig({
      resetKeys: ['volume'],
    }),
  }), []);

  const handleRemoveIndicator = useCallback(
    (indicatorId) => {
      removeQueryIndicator(indicatorId, queryStateConfig);
    },
    [queryStateConfig, removeQueryIndicator]
  );

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions>
        <RefreshButton onClick={() => loadVMs(true)} loading={loading} />
        <ActionButton icon={Plus} label="Создать ВМ" onClick={handleCreate} />
      </PageActions>

      <FormModal
        isOpen={showCreate}
        title="Создать ВМ"
        subtitle="Задайте базовые параметры виртуальной машины."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isCreating}
        confirmDisabled={isCreateDisabled}
        onClose={closeCreateModal}
        onConfirm={submitCreate}
      >
        <FormInlineHelp
          title="Быстрые пресеты ВМ"
          description="Используйте готовые стартовые профили, а затем при необходимости уточните параметры вручную."
          selectedPreset={selectedVmPreset}
          presets={[
            { id: 'mini', label: 'Мини', description: 'vm-mini, 1 CPU / 1 GB / 10 GB', onClick: () => applyVmPreset('mini') },
            { id: 'service', label: 'Сервис', description: 'vm-service, 2 CPU / 2 GB / 20 GB', onClick: () => applyVmPreset('service') },
            { id: 'database', label: 'База', description: 'vm-db, 4 CPU / 4 GB / 40 GB', onClick: () => applyVmPreset('database') },
          ]}
          tips={[
            'Режим существующего тома подходит, если диск уже подготовлен в пуле хранения.',
            'Если пул хранения не выбран, диск будет создан в системном каталоге libvirt.',
          ]}
        />
        <div className="modal-field">
          <label className="modal-label">Имя ВМ</label>
          <input className={getFieldClassName('name')} value={newVm.name} onChange={handleCreateChange('name')} onBlur={markFieldTouched('name')} placeholder="Например: vm-app-01" />
          {isFieldInvalid('name') && <p className="modal-error">{createErrors.name}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">CPU, ядер</label>
          <input type="number" min="1" className={getFieldClassName('cpu_cores')} value={newVm.cpu_cores} onChange={handleCreateChange('cpu_cores')} onBlur={markFieldTouched('cpu_cores')} placeholder="Например: 2" />
          {isFieldInvalid('cpu_cores') && <p className="modal-error">{createErrors.cpu_cores}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">ОЗУ, MB</label>
          <input type="number" min="128" className={getFieldClassName('memory_mb')} value={newVm.memory_mb} onChange={handleCreateChange('memory_mb')} onBlur={markFieldTouched('memory_mb')} placeholder="Например: 2048" />
          {isFieldInvalid('memory_mb') && <p className="modal-error">{createErrors.memory_mb}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Режим диска</label>
          <select className="input w-full" value={newVm.disk_mode} onChange={handleCreateChange('disk_mode')}>
            <option value="create">Создать новый том</option>
            <option value="existing">Использовать существующий том</option>
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">Размер диска, GB</label>
          <input type="number" min="1" className={getFieldClassName('disk_gb')} value={newVm.disk_gb} onChange={handleCreateChange('disk_gb')} onBlur={markFieldTouched('disk_gb')} disabled={newVm.disk_mode !== 'create'} placeholder="Например: 20" />
          {isFieldInvalid('disk_gb') && <p className="modal-error">{createErrors.disk_gb}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Пул хранения</label>
          <select className={getFieldClassName('storage_pool')} value={newVm.storage_pool} onChange={handleCreateChange('storage_pool')} onBlur={markFieldTouched('storage_pool')}>
            <option value="">Системный путь (/var/lib/libvirt/images)</option>
            {activeStoragePools.map((pool) => (
              <option key={pool.id} value={pool.name}>{pool.name}</option>
            ))}
          </select>
          {isFieldInvalid('storage_pool') && <p className="modal-error">{createErrors.storage_pool}</p>}
          <p className="modal-hint">Если выбран пул хранения, диск ВМ будет создан как том qcow2 внутри этого пула.</p>
        </div>
        {newVm.disk_mode === 'existing' && (
          <div className="modal-field">
            <label className="modal-label">Существующий том</label>
            <select className={getFieldClassName('existing_volume')} value={newVm.existing_volume} onChange={handleCreateChange('existing_volume')} onBlur={markFieldTouched('existing_volume')}>
              <option value="">Выберите том</option>
              {availableExistingVolumes.map((volume) => (
                <option key={volume.id} value={volume.name}>{volume.name}</option>
              ))}
            </select>
            {isFieldInvalid('existing_volume') && <p className="modal-error">{createErrors.existing_volume}</p>}
            {newVm.storage_pool && availableExistingVolumes.length === 0 && <p className="modal-hint text-amber-300">В выбранном пуле пока нет доступных томов.</p>}
          </div>
        )}
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

      <div className="card">
        <StatusMessage message={error} className="mb-4" />
        <LoadingState message={loading ? 'Загрузка списка ВМ...' : ''} className="mb-4" />
        <QueryStateActions
          className="mb-4"
          activeIndicators={activeQueryIndicators}
          onCopyLink={() => copyCurrentLink(activeQueryIndicators)}
          onResetAll={activeQueryIndicators.length > 0 ? handleResetQueryState : undefined}
          onRemoveIndicator={handleRemoveIndicator}
        />
        {selectedVmName && !loading && (
          <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Выделена ВМ <span className="font-medium">{selectedVmName}</span> из раздела Хранилище.
          </div>
        )}
        {vms.length === 0 && !loading ? (
          <EmptyState
            icon={Monitor}
            title="ВМ не найдены"
            description="Создайте ВМ, чтобы она появилась здесь."
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="table-header-cell text-left">Имя</th>
                <th className="table-header-cell text-left">Статус</th>
                <th className="table-header-cell text-left">Ядра CPU</th>
                <th className="table-header-cell text-left">ОЗУ</th>
                <th className="table-header-cell text-left">Диск</th>
                <th className="table-header-cell text-left">Хранилище</th>
                <th className="table-header-cell text-left">Том</th>
                <th className="table-header-cell text-left">Готовность</th>
                <th className="table-header-cell-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {vms.map((vm) => (
                <tr
                  key={vm.id}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current[vm.name] = node;
                    }
                  }}
                  className={`border-b border-dark-700 hover:bg-dark-700/50 ${selectedVmName === vm.name ? 'bg-cyan-500/10' : ''}`}
                >
                  <td className="table-cell-strong font-medium">{vm.name}</td>
                  <td className="table-cell">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(vm.status)}`}></div>
                      <span className="text-dark-300 capitalize">
                        {getStatusLabel(vm.status)}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell-muted">{vm.cpu_cores ?? vm.cpu} ядро</td>
                  <td className="table-cell-muted">{vm.memory_mb ?? vm.memory} MB</td>
                  <td className="table-cell-muted">{vm.disk_gb ?? vm.disk} GB</td>
                  <td className="table-cell-muted">
                    {vm.storage_pool ? (
                      <Link
                        to={`/storage?pool=${encodeURIComponent(vm.storage_pool)}`}
                        className={`underline decoration-cyan-500/50 underline-offset-2 hover:text-white ${selectedPoolName === vm.storage_pool && !selectedVolumeName ? 'text-cyan-200' : 'text-dark-300'}`}
                      >
                        {vm.storage_pool}
                      </Link>
                    ) : 'Системный путь'}
                  </td>
                  <td className="table-cell-muted">
                    {vm.storage_pool && vm.storage_volume ? (
                      <Link
                        to={`/storage?pool=${encodeURIComponent(vm.storage_pool)}&volume=${encodeURIComponent(vm.storage_volume)}`}
                        className={`underline decoration-cyan-500/50 underline-offset-2 hover:text-white ${selectedPoolName === vm.storage_pool && selectedVolumeName === vm.storage_volume ? 'text-cyan-200' : 'text-dark-300'}`}
                      >
                        {vm.storage_volume}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="table-cell min-w-[220px]">
                    <VmReadinessIndicator vm={vm} compact />
                  </td>
                  <td className="table-cell-actions">
                    {(() => {
                      const isRowPending = pendingVmAction?.id === vm.id;
                      const pendingAction = pendingVmAction?.action;

                      return (
                    <div className="inline-flex items-center justify-end space-x-2">
                      <button
                        className={`table-action-icon-button ${isRowPending ? 'text-dark-500 cursor-not-allowed' : 'text-green-400 hover:text-green-300'}`}
                        title={isRowPending && pendingAction === 'start' ? `Запуск ВМ ${vm.name}...` : `Запустить ВМ ${vm.name}`}
                        onClick={() => handleStart(vm.id)}
                        disabled={isRowPending}
                      >
                        <Play className={`table-action-icon ${isRowPending && pendingAction === 'start' ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        className={`table-action-icon-button ${isRowPending ? 'text-dark-500 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
                        title={isRowPending && pendingAction === 'stop' ? `Остановка ВМ ${vm.name}...` : `Остановить ВМ ${vm.name}`}
                        onClick={() => handleStop(vm.id)}
                        disabled={isRowPending}
                      >
                        <Square className={`table-action-icon ${isRowPending && pendingAction === 'stop' ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        className={`table-action-icon-button ${isRowPending ? 'text-dark-500 cursor-not-allowed' : 'text-yellow-400 hover:text-yellow-300'}`}
                        title={isRowPending && pendingAction === 'restart' ? `Перезапуск ВМ ${vm.name}...` : `Перезапустить ВМ ${vm.name}`}
                        onClick={() => handleRestart(vm.id)}
                        disabled={isRowPending}
                      >
                        <RotateCcw className={`table-action-icon ${isRowPending && pendingAction === 'restart' ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        className={`table-action-icon-button ${isRowPending ? 'text-dark-500 cursor-not-allowed' : 'text-dark-400 hover:text-white'}`}
                        title={`Параметры ВМ ${vm.name}`}
                        onClick={() => handleSettings(vm)}
                        disabled={isRowPending}
                      >
                        <Settings className="table-action-icon" />
                      </button>
                      {isRowPending && (
                        <span className="ml-2 text-xs text-dark-400">
                          {pendingAction === 'start' ? 'Запуск...' : pendingAction === 'stop' ? 'Остановка...' : 'Перезапуск...'}
                        </span>
                      )}
                    </div>
                      );
                    })()}
                  </td>
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

export default VirtualMachines;