import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Database,
  Filter,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Play,
  Plus,
  RotateCw,
  Search,
  Server,
  Settings,
  Square,
  Trash2,
} from 'lucide-react';
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
import StatCard from '../components/StatCard';
import StatusMessage from '../components/StatusMessage';
import { useQueryStateUrl } from '../hooks/useQueryStateUrl';
import { useDialog } from '../hooks/useDialog';
import { useTimedMessage } from '../hooks/useTimedMessage';
import {
  buildQueryStateIndicators,
  createQueryStateIndicator,
  createDraftQueryStateValueConfig,
  removeQueryStateValueWhenDefault,
} from '../utils/queryState';

const EMPTY_OVERVIEW = {
  pools_count: 0,
  active_pools_count: 0,
  volumes_count: 0,
  backups_status: 'Недоступно',
};

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

const getPoolStatusLabel = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'online':
      return 'Онлайн';
    case 'building':
      return 'Инициализация';
    case 'degraded':
      return 'С ошибками';
    case 'inaccessible':
      return 'Недоступен';
    default:
      return 'Офлайн';
  }
};

const getPoolStatusClassName = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'online':
      return 'bg-emerald-400';
    case 'building':
      return 'bg-sky-400';
    case 'degraded':
      return 'bg-amber-400';
    case 'inaccessible':
      return 'bg-red-400';
    default:
      return 'bg-dark-500';
  }
};

const getVmStatusLabel = (status) => {
  const normalized = (status || '').toString().toLowerCase();
  if (normalized === 'running' || normalized === 'запущена') {
    return 'Работает';
  }
  if (normalized === 'stopped' || normalized === 'остановлена') {
    return 'Остановлена';
  }
  if (normalized === 'paused' || normalized === 'приостановлена') {
    return 'Приостановлена';
  }
  if (normalized === 'suspended') {
    return 'Приостановлена';
  }
  return status || 'Неизвестно';
};

const getVmStatusClassName = (status) => {
  const normalized = (status || '').toString().toLowerCase();
  if (normalized === 'running' || normalized === 'запущена') {
    return 'bg-emerald-400';
  }
  if (normalized === 'paused' || normalized === 'приостановлена' || normalized === 'suspended') {
    return 'bg-amber-400';
  }
  if (normalized === 'stopped' || normalized === 'остановлена') {
    return 'bg-red-400';
  }
  return 'bg-dark-500';
};

const getUsageFilterFromParams = (params) => {
  const value = params.get('filterUsage') || 'all';
  return ['all', 'attached', 'free'].includes(value) ? value : 'all';
};

const getAppliedPoolFilterFromParams = (params) => params.get('filterPool') || '';
const getAppliedPoolSearchFromParams = (params) => params.get('filterPoolSearch') || '';
const getAppliedSearchFromParams = (params) => params.get('filterSearch') || '';

const STORAGE_FILTER_LABELS = {
  attached: 'Только подключенные',
  free: 'Только свободные',
};

const EGGPLANT_HEADER_TEXT_CLASS = 'text-[#6b3f6f]';
const DEFAULT_POOL_SORT = { key: 'name', direction: 'asc' };
const DEFAULT_VOLUME_SORT = { key: 'pool', direction: 'asc' };
const STORAGE_ACCENT_BUTTON_CLASS = 'page-toolbar-button';

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

const toPathSlug = (value) => {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'storage';
};

const VmDetailField = ({ label, value, valueClassName = 'text-white', multiline = false, actions = null }) => (
  <div className="rounded-lg border border-dark-700 bg-dark-900/60 px-4 py-3">
    <div className="text-dark-400">{label}</div>
    <div className={`mt-1 ${valueClassName}${multiline ? ' break-all whitespace-pre-wrap' : ''}`.trim()}>{value}</div>
    {actions ? <div className="mt-3">{actions}</div> : null}
  </div>
);

const StorageBadge = ({ label, dotClassName = 'bg-dark-500' }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-dark-600 bg-dark-800 px-3 py-1 text-sm font-medium text-dark-100">
    <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} />
    <span>{label}</span>
  </span>
);

const compareSortValues = (leftValue, rightValue) => {
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue;
  }

  return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'ru', {
    numeric: true,
    sensitivity: 'base',
  });
};

const sortCollection = (items, sortState, accessors) => {
  const accessor = accessors[sortState.key];
  if (!accessor) {
    return items;
  }

  const directionMultiplier = sortState.direction === 'desc' ? -1 : 1;
  return [...items].sort((leftItem, rightItem) => {
    const primaryResult = compareSortValues(accessor(leftItem), accessor(rightItem)) * directionMultiplier;
    if (primaryResult !== 0) {
      return primaryResult;
    }

    return compareSortValues(leftItem.name, rightItem.name);
  });
};

const getNextSortState = (currentSort, nextKey) => {
  if (currentSort.key !== nextKey) {
    return { key: nextKey, direction: 'asc' };
  }

  return {
    key: nextKey,
    direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
  };
};

const SortableHeader = ({ label, sortKey, sortState, onSort, align = 'left' }) => {
  const isActive = sortState.key === sortKey;
  const alignClassName = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  const indicator = isActive ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';

  return (
    <button
      type="button"
      className={`inline-flex w-full items-center gap-2 ${alignClassName} transition-colors hover:text-white`}
      onClick={() => onSort(sortKey)}
      title={`Сортировать по колонке ${label}`}
    >
      <span>{label}</span>
      <span className={`text-xs ${isActive ? 'text-white' : 'text-dark-400'}`}>{indicator}</span>
    </button>
  );
};

const Storage = () => {
  const navigate = useNavigate();
  const [volumes, setVolumes] = useState([]);
  const [vms, setVms] = useState([]);
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateVolume, setShowCreateVolume] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showAttachVolume, setShowAttachVolume] = useState(false);
  const [isCreatingVolume, setIsCreatingVolume] = useState(false);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [selectedPoolPreset, setSelectedPoolPreset] = useState('standard-dir');
  const [selectedVolumePreset, setSelectedVolumePreset] = useState('system');
  const [isAttachingVolume, setIsAttachingVolume] = useState(false);
  const [pendingPoolAction, setPendingPoolAction] = useState(null);
  const [pendingVolumeAction, setPendingVolumeAction] = useState('');
  const [pendingPoolDelete, setPendingPoolDelete] = useState('');
  const [pendingVolumeDelete, setPendingVolumeDelete] = useState('');
  const [createVolumeAttempted, setCreateVolumeAttempted] = useState(false);
  const [createPoolAttempted, setCreatePoolAttempted] = useState(false);
  const [attachVolumeAttempted, setAttachVolumeAttempted] = useState(false);
  const [touchedVolumeFields, setTouchedVolumeFields] = useState({});
  const [touchedPoolFields, setTouchedPoolFields] = useState({});
  const [selectedAttachVmName, setSelectedAttachVmName] = useState('');
  const [volumeToAttach, setVolumeToAttach] = useState(null);
  const [poolSort, setPoolSort] = useState(DEFAULT_POOL_SORT);
  const [volumeSort, setVolumeSort] = useState(DEFAULT_VOLUME_SORT);
  const { dialog, openDialog, closeDialog } = useDialog();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const { searchParams, updateQueryParams, copyCurrentLink, removeQueryIndicator, resetAllQueryIndicators, commitQueryState } = useQueryStateUrl({
    onCopySuccess: showUpdateMessage,
    onCopyError: (copyError) => {
      openDialog({
        title: 'Не удалось скопировать ссылку',
        message: copyError.message || 'Буфер обмена недоступен в текущем браузере.',
        variant: 'warning',
      });
    },
  });
  const poolRefs = useRef({});
  const volumeRefs = useRef({});
  const [newVolume, setNewVolume] = useState({ pool: '', name: '', size_gb: 10 });
  const [newPool, setNewPool] = useState({
    name: '',
    path: '/var/lib/libvirt/images/custom',
    autostart: true,
  });
  const [poolFilter, setPoolFilter] = useState(getAppliedPoolFilterFromParams(searchParams));
  const [usageFilter, setUsageFilter] = useState(getUsageFilterFromParams(searchParams));
  const [poolSearchTerm, setPoolSearchTerm] = useState(getAppliedPoolSearchFromParams(searchParams));
  const [searchTerm, setSearchTerm] = useState(getAppliedSearchFromParams(searchParams));
  const [draftPoolFilter, setDraftPoolFilter] = useState(getAppliedPoolFilterFromParams(searchParams));
  const [draftUsageFilter, setDraftUsageFilter] = useState(getUsageFilterFromParams(searchParams));
  const [draftPoolSearchTerm, setDraftPoolSearchTerm] = useState(getAppliedPoolSearchFromParams(searchParams));
  const [draftSearchTerm, setDraftSearchTerm] = useState(getAppliedSearchFromParams(searchParams));

  const vmsByName = useMemo(
    () => new Map(vms.map((vm) => [vm.name, vm])),
    [vms]
  );

  const poolsByName = useMemo(
    () => new Map(pools.map((pool) => [pool.name, pool])),
    [pools]
  );

  const availableAttachVms = useMemo(
    () => [...vms].sort((leftVm, rightVm) => leftVm.name.localeCompare(rightVm.name, 'ru', { sensitivity: 'base' })),
    [vms]
  );

  const loadStorage = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError('');
      const [storageResult, vmResult] = await Promise.allSettled([
        apiService.getStorage(),
        apiService.getVMs(),
      ]);

      if (storageResult.status !== 'fulfilled') {
        throw storageResult.reason;
      }

      const response = storageResult.value;
      setOverview(response.data?.overview || EMPTY_OVERVIEW);
      setPools(Array.isArray(response.data?.pools) ? response.data.pools : []);
      setVolumes(Array.isArray(response.data?.volumes) ? response.data.volumes : []);
      setVms(vmResult.status === 'fulfilled' && Array.isArray(vmResult.value.data) ? vmResult.value.data : []);
      if (showMessage) {
        showUpdateMessage('Данные обновлены');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки хранилищ');
      setOverview(EMPTY_OVERVIEW);
      setPools([]);
      setVolumes([]);
      setVms([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadStorage(false);
  }, [loadStorage]);

  const activePools = useMemo(
    () => pools.filter((pool) => pool.status === 'online' || pool.status === 'degraded' || pool.status === 'building'),
    [pools]
  );

  const selectedPoolName = searchParams.get('pool') || '';
  const selectedVolumeName = searchParams.get('volume') || '';

  const isAnyFilterActive = Boolean(
    poolFilter ||
    usageFilter !== 'all' ||
    poolSearchTerm.trim() ||
    searchTerm.trim()
  );

  const activeFilterIndicators = useMemo(() => {
    return buildQueryStateIndicators([
      createQueryStateIndicator('filterSearch', searchTerm.trim()),
      createQueryStateIndicator('filterPoolSearch', poolSearchTerm.trim()),
      createQueryStateIndicator('filterPool', poolFilter),
      usageFilter !== 'all'
        ? createQueryStateIndicator('filterUsage', STORAGE_FILTER_LABELS[usageFilter] || usageFilter)
        : null,
    ]);
  }, [poolFilter, poolSearchTerm, searchTerm, usageFilter]);

  useEffect(() => {
    const nextPoolFilter = getAppliedPoolFilterFromParams(searchParams);
    const nextUsageFilter = getUsageFilterFromParams(searchParams);
    const nextPoolSearchTerm = getAppliedPoolSearchFromParams(searchParams);
    const nextSearchTerm = getAppliedSearchFromParams(searchParams);

    setPoolFilter(nextPoolFilter);
    setUsageFilter(nextUsageFilter);
    setPoolSearchTerm(nextPoolSearchTerm);
    setSearchTerm(nextSearchTerm);
    setDraftPoolFilter(nextPoolFilter);
    setDraftUsageFilter(nextUsageFilter);
    setDraftPoolSearchTerm(nextPoolSearchTerm);
    setDraftSearchTerm(nextSearchTerm);
  }, [searchParams]);

  const hasPendingFilterChanges = (
    draftPoolFilter !== poolFilter ||
    draftUsageFilter !== usageFilter ||
    draftPoolSearchTerm !== poolSearchTerm ||
    draftSearchTerm !== searchTerm
  );

  const attachedVolumeCountsByPool = useMemo(() => (
    volumes.reduce((accumulator, volume) => {
      if (volume.attached_vm) {
        accumulator[volume.pool] = (accumulator[volume.pool] || 0) + 1;
      }
      return accumulator;
    }, {})
  ), [volumes]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const normalizedPoolSearchTerm = poolSearchTerm.trim().toLowerCase();

  const filteredVolumes = useMemo(() => (
    volumes.filter((volume) => {
      if (poolFilter && volume.pool !== poolFilter) {
        return false;
      }
      if (normalizedPoolSearchTerm && !(volume.pool || '').toLowerCase().includes(normalizedPoolSearchTerm)) {
        return false;
      }
      if (usageFilter === 'attached' && !volume.attached_vm) {
        return false;
      }
      if (usageFilter === 'free' && volume.attached_vm) {
        return false;
      }
      if (!normalizedSearchTerm) {
        return true;
      }

      const volumeName = (volume.name || '').toLowerCase();
      const attachedVmName = (volume.attached_vm || '').toLowerCase();
      return volumeName.includes(normalizedSearchTerm) || attachedVmName.includes(normalizedSearchTerm);
    })
  ), [normalizedPoolSearchTerm, normalizedSearchTerm, poolFilter, usageFilter, volumes]);

  const filteredPools = useMemo(() => (
    (poolFilter ? pools.filter((pool) => pool.name === poolFilter) : pools)
      .filter((pool) => !normalizedPoolSearchTerm || pool.name.toLowerCase().includes(normalizedPoolSearchTerm))
      .filter((pool) => !normalizedSearchTerm || filteredVolumes.some((volume) => volume.pool === pool.name))
  ), [filteredVolumes, normalizedPoolSearchTerm, normalizedSearchTerm, poolFilter, pools]);

  const sortedPools = useMemo(() => sortCollection(filteredPools, poolSort, {
    name: (pool) => pool.name,
    status: (pool) => getPoolStatusLabel(pool.status),
    path: (pool) => pool.path,
    volumes_count: (pool) => pool.volumes_count,
    allocation_bytes: (pool) => pool.allocation_bytes,
    available_bytes: (pool) => pool.available_bytes,
    attached_count: (pool) => attachedVolumeCountsByPool[pool.name] || 0,
  }), [attachedVolumeCountsByPool, filteredPools, poolSort]);

  const sortedVolumes = useMemo(() => sortCollection(filteredVolumes, volumeSort, {
    name: (volume) => volume.name,
    pool: (volume) => volume.pool,
    format: (volume) => volume.format,
    size_bytes: (volume) => volume.size_bytes,
    attached_vm: (volume) => volume.attached_vm || '',
    path: (volume) => volume.path,
  }), [filteredVolumes, volumeSort]);

  useEffect(() => {
    const refKey = selectedVolumeName ? `${selectedPoolName}:${selectedVolumeName}` : selectedPoolName;
    const targetNode = selectedVolumeName
      ? volumeRefs.current[refKey]
      : poolRefs.current[selectedPoolName];

    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPoolName, selectedVolumeName, pools, volumes]);

  const handleApplyQueryState = () => {
    commitQueryState(queryStateConfig);
  };

  const volumeErrors = {
    pool: !newVolume.pool ? 'Выберите запущенный пул хранения.' : '',
    name: !newVolume.name.trim() ? 'Укажите имя тома.' : '',
    size_gb: !newVolume.size_gb || Number(newVolume.size_gb) < 1 ? 'Укажите размер не меньше 1 GB.' : '',
  };

  const poolErrors = {
    name: !newPool.name.trim() ? 'Укажите имя пула хранения.' : '',
    path: !newPool.path.trim() ? 'Укажите путь к каталогу пула.' : '',
  };

  const hasVolumeErrors = Boolean(volumeErrors.pool || volumeErrors.name || volumeErrors.size_gb);
  const hasPoolErrors = Boolean(poolErrors.name || poolErrors.path);

  const isVolumeFieldInvalid = (field) => Boolean((createVolumeAttempted || touchedVolumeFields[field]) && volumeErrors[field]);
  const isPoolFieldInvalid = (field) => Boolean((createPoolAttempted || touchedPoolFields[field]) && poolErrors[field]);

  const getFieldClassName = (hasError) => `input w-full${hasError ? ' input-error' : ''}`;

  const resetVolumeValidation = () => {
    setCreateVolumeAttempted(false);
    setTouchedVolumeFields({});
  };

  const resetPoolValidation = () => {
    setCreatePoolAttempted(false);
    setTouchedPoolFields({});
  };

  const buildPoolPresetForm = useCallback((presetId) => {
    const baseName = presetId === 'manual-dir' ? 'pool-manual' : 'pool-custom';
    const nextName = getNextPresetName(baseName, pools.map((pool) => pool.name));
    return {
      name: nextName,
      path: `/var/lib/libvirt/images/${toPathSlug(nextName)}`,
      autostart: presetId !== 'manual-dir',
    };
  }, [pools]);

  const buildVolumePresetForm = useCallback((presetId, currentForm = newVolume) => {
    const preset = presetId === 'large'
      ? { name: 'vm-data.qcow2', size_gb: 40 }
      : presetId === 'work'
        ? { name: 'vm-work.qcow2', size_gb: 20 }
        : { name: 'vm-system.qcow2', size_gb: 10 };
    const poolName = currentForm.pool || activePools[0]?.name || pools[0]?.name || '';
    const existingNames = volumes
      .filter((volume) => volume.pool === poolName)
      .map((volume) => volume.name);

    return {
      ...currentForm,
      pool: poolName,
      name: getNextPresetName(preset.name, existingNames),
      size_gb: preset.size_gb,
    };
  }, [activePools, newVolume, pools, volumes]);

  const openCreateVolumeModal = () => {
    resetVolumeValidation();
    setSelectedVolumePreset('system');
    setNewVolume(buildVolumePresetForm('system', {
      pool: activePools[0]?.name || pools[0]?.name || '',
      name: '',
      size_gb: 10,
    }));
    setShowCreateVolume(true);
  };

  const openCreatePoolModal = () => {
    resetPoolValidation();
    setSelectedPoolPreset('standard-dir');
    setNewPool(buildPoolPresetForm('standard-dir'));
    setShowCreatePool(true);
  };

  const closeCreateVolumeModal = () => {
    if (isCreatingVolume) {
      return;
    }
    resetVolumeValidation();
    setShowCreateVolume(false);
  };

  const closeCreatePoolModal = () => {
    if (isCreatingPool) {
      return;
    }
    resetPoolValidation();
    setShowCreatePool(false);
  };

  const closeAttachVolumeModal = () => {
    if (isAttachingVolume) {
      return;
    }

    setAttachVolumeAttempted(false);
    setSelectedAttachVmName('');
    setVolumeToAttach(null);
    setShowAttachVolume(false);
  };

  const handleVolumeChange = (field) => (event) => {
    const value = field === 'size_gb' ? Number(event.target.value) : event.target.value;
    setSelectedVolumePreset('');
    setNewVolume((current) => ({ ...current, [field]: value }));
  };

  const handlePoolChange = (field) => (event) => {
    const value = field === 'autostart' ? event.target.checked : event.target.value;
    setSelectedPoolPreset('');
    setNewPool((current) => ({ ...current, [field]: value }));
  };

  const applyPoolPreset = (presetId) => {
    resetPoolValidation();
    setSelectedPoolPreset(presetId);
    setNewPool(buildPoolPresetForm(presetId));
  };

  const applyVolumePreset = (presetId) => {
    resetVolumeValidation();
    setSelectedVolumePreset(presetId);
    setNewVolume((current) => buildVolumePresetForm(presetId, current));
  };

  const markVolumeFieldTouched = (field) => () => {
    setTouchedVolumeFields((current) => ({ ...current, [field]: true }));
  };

  const markPoolFieldTouched = (field) => () => {
    setTouchedPoolFields((current) => ({ ...current, [field]: true }));
  };

  const submitCreateVolume = async () => {
    if (isCreatingVolume) {
      return;
    }

    setCreateVolumeAttempted(true);
    if (hasVolumeErrors) {
      return;
    }

    try {
      setIsCreatingVolume(true);
      await apiService.createStorageVolume(newVolume);
      resetVolumeValidation();
      setSelectedVolumePreset('system');
      setShowCreateVolume(false);
      setNewVolume({ pool: activePools[0]?.name || '', name: '', size_gb: 10 });
      await loadStorage(true);
    } catch (err) {
      openDialog({
        title: 'Не удалось создать том',
        message: err.response?.data?.detail || err.message || 'Ошибка создания тома',
        variant: 'danger',
      });
    } finally {
      setIsCreatingVolume(false);
    }
  };

  const submitCreatePool = async () => {
    if (isCreatingPool) {
      return;
    }

    setCreatePoolAttempted(true);
    if (hasPoolErrors) {
      return;
    }

    try {
      setIsCreatingPool(true);
      await apiService.createStoragePool(newPool);
      resetPoolValidation();
      setSelectedPoolPreset('standard-dir');
      setShowCreatePool(false);
      setNewPool({
        name: '',
        path: '/var/lib/libvirt/images/custom',
        autostart: true,
      });
      await loadStorage(true);
    } catch (err) {
      openDialog({
        title: 'Не удалось создать пул хранения',
        message: err.response?.data?.detail || err.message || 'Ошибка создания пула хранения',
        variant: 'danger',
      });
    } finally {
      setIsCreatingPool(false);
    }
  };

  const runPoolAction = async (poolName, actionKey, request, failureTitle) => {
    if (pendingPoolAction === `${poolName}:${actionKey}`) {
      return;
    }

    try {
      setPendingPoolAction(`${poolName}:${actionKey}`);
      await request(poolName);
      await loadStorage(true);
    } catch (err) {
      openDialog({
        title: failureTitle,
        message: err.response?.data?.detail || err.message || 'Неизвестная ошибка',
        variant: 'danger',
      });
    } finally {
      setPendingPoolAction(null);
    }
  };

  const handleDeleteVolume = (volume) => {
    openDialog({
      title: `Удалить том ${volume.name}?`,
      message: `Том ${volume.name} будет удален из пула ${volume.pool}. Это действие нельзя отменить.`,
      variant: 'danger',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      onConfirm: async () => {
        try {
          setPendingVolumeDelete(volume.id);
          await apiService.deleteStorageVolume(volume.pool, volume.name);
          closeDialog();
          await loadStorage(true);
        } catch (err) {
          openDialog({
            title: 'Не удалось удалить том',
            message: err.response?.data?.detail || err.message || 'Ошибка удаления тома',
            variant: 'danger',
          });
        } finally {
          setPendingVolumeDelete('');
        }
      },
    });
  };

  const handleDeletePool = (pool, attachedVolume = null) => {
    if (attachedVolume?.attached_vm) {
      openDialog({
        title: 'Удаление пула недоступно',
        message: `Том ${attachedVolume.name} подключен к ВМ ${attachedVolume.attached_vm}. Сначала отключите этот том от ВМ.`,
        variant: 'warning',
      });
      return;
    }

    openDialog({
      title: `Удалить пул ${pool.name}?`,
      message: 'Будет удалено только определение пула в libvirt. Каталог на диске не удаляется. Пул должен быть пустым.',
      variant: 'danger',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      onConfirm: async () => {
        try {
          setPendingPoolDelete(pool.name);
          await apiService.deleteStoragePool(pool.name);
          closeDialog();
          await loadStorage(true);
        } catch (err) {
          openDialog({
            title: 'Не удалось удалить пул хранения',
            message: err.response?.data?.detail || err.message || 'Ошибка удаления пула хранения',
            variant: 'danger',
          });
        } finally {
          setPendingPoolDelete('');
        }
      },
    });
  };

  const openAttachVolumeModal = (volume) => {
    setAttachVolumeAttempted(false);
    setSelectedAttachVmName('');
    setVolumeToAttach(volume);
    setShowAttachVolume(true);
  };

  const submitAttachVolume = async () => {
    if (!volumeToAttach || isAttachingVolume) {
      return;
    }

    setAttachVolumeAttempted(true);
    if (!selectedAttachVmName) {
      return;
    }

    try {
      setIsAttachingVolume(true);
      setPendingVolumeAction(`${volumeToAttach.id}:attach`);
      await apiService.attachStorageVolume(volumeToAttach.pool, volumeToAttach.name, selectedAttachVmName);
      const attachedVolumeName = volumeToAttach.name;
      const attachedVmName = selectedAttachVmName;
      setAttachVolumeAttempted(false);
      setSelectedAttachVmName('');
      setVolumeToAttach(null);
      setShowAttachVolume(false);
      await loadStorage(false);
      showUpdateMessage(`Том ${attachedVolumeName} подключен к ВМ ${attachedVmName}.`);
    } catch (err) {
      openDialog({
        title: 'Не удалось подключить том',
        message: err.response?.data?.detail || err.message || 'Ошибка подключения тома',
        variant: 'danger',
      });
    } finally {
      setPendingVolumeAction('');
      setIsAttachingVolume(false);
    }
  };

  const handleDetachVolume = (volume) => {
    openDialog({
      title: `Отключить том ${volume.name}?`,
      message: `Том ${volume.name} будет отключен от ВМ ${volume.attached_vm}.`,
      variant: 'warning',
      confirmLabel: 'Отключить',
      cancelLabel: 'Отмена',
      onConfirm: async () => {
        try {
          setPendingVolumeAction(`${volume.id}:detach`);
          const detachedVolumeName = volume.name;
          const detachedVmName = volume.attached_vm;
          await apiService.detachStorageVolume(volume.pool, volume.name);
          closeDialog();
          await loadStorage(false);
          showUpdateMessage(`Том ${detachedVolumeName} отключен от ВМ ${detachedVmName}.`);
        } catch (err) {
          openDialog({
            title: 'Не удалось отключить том',
            message: err.response?.data?.detail || err.message || 'Ошибка отключения тома',
            variant: 'danger',
          });
        } finally {
          setPendingVolumeAction('');
        }
      },
    });
  };

  const handleSortPools = (sortKey) => {
    setPoolSort((currentSort) => getNextSortState(currentSort, sortKey));
  };

  const handleSortVolumes = (sortKey) => {
    setVolumeSort((currentSort) => getNextSortState(currentSort, sortKey));
  };

  const handleOpenCurrentVolumeInStorage = (volume) => {
    if (!volume) {
      return;
    }

    closeDialog();
    updateQueryParams({
      pool: volume.pool,
      volume: volume.name,
    });
  };

  const handleOpenCurrentPoolInStorage = (poolName) => {
    if (!poolName) {
      return;
    }

    closeDialog();
    updateQueryParams({
      pool: poolName,
      volume: null,
    });
  };

  const handleOpenVmDetails = (vmName) => {
    const vm = vmsByName.get(vmName);
    if (!vm) {
      openDialog({
        title: 'Параметры ВМ недоступны',
        message: `Не удалось найти виртуальную машину "${vmName}" в текущем списке.`,
        variant: 'warning',
      });
      return;
    }

    const cpuValue = vm.cpu_cores ?? vm.cpu ?? '-';
    const memoryValue = vm.memory_mb ?? vm.memory ?? '-';
    const diskValue = vm.disk_gb ?? vm.disk ?? '-';
    const clusterIdValue = vm.cluster_id ?? vm.cluster ?? '-';
    const storagePoolValue = vm.storage_pool || 'Системный путь';
    const storageVolumeValue = vm.storage_volume || '-';
    const diskPathValue = vm.disk_path || '-';
    const linkedVolume = volumes.find((volume) => {
      if (diskPathValue !== '-' && volume.path === diskPathValue) {
        return true;
      }
      return volume.pool === vm.storage_pool && volume.name === vm.storage_volume;
    }) || null;
    const linkedPool = poolsByName.get(linkedVolume?.pool || vm.storage_pool || '');
    const vmStatusValue = getVmStatusLabel(vm.status);
    const storageFormatValue = linkedVolume?.format || '-';
    const diskTargetValue = linkedVolume?.target_dev || '-';
    const diskRoleValue = linkedVolume
      ? (linkedVolume.is_primary_disk ? 'Основной диск' : 'Дополнительный диск')
      : '-';
    const volumeSizeValue = linkedVolume
      ? formatSize(linkedVolume.size_bytes)
      : (diskValue !== '-' ? `${diskValue} GB` : '-');
    const poolStatusValue = linkedPool ? getPoolStatusLabel(linkedPool.status) : '-';
    const poolAutostartValue = linkedPool ? (linkedPool.autostart ? 'Включен' : 'Выключен') : '-';
    const diskRoleBadge = linkedVolume ? (
      <StorageBadge
        label={diskRoleValue}
        dotClassName={linkedVolume.is_primary_disk ? 'bg-sky-400' : 'bg-violet-400'}
      />
    ) : '-';
    const vmStatusBadge = (
      <StorageBadge
        label={vmStatusValue}
        dotClassName={getVmStatusClassName(vm.status)}
      />
    );
    const poolStatusBadge = linkedPool ? (
      <StorageBadge
        label={poolStatusValue}
        dotClassName={getPoolStatusClassName(linkedPool.status)}
      />
    ) : '-';
    const poolAutostartBadge = linkedPool ? (
      <StorageBadge
        label={poolAutostartValue}
        dotClassName={linkedPool.autostart ? 'bg-emerald-400' : 'bg-dark-500'}
      />
    ) : '-';

    openDialog({
      title: `Параметры ВМ "${vm.name}"`,
      variant: 'info',
      confirmLabel: 'Закрыть',
      confirmButtonClassName: STORAGE_ACCENT_BUTTON_CLASS,
      panelClassName: 'max-w-3xl',
      contentClassName: 'mt-4 space-y-4 text-sm text-dark-100',
      content: (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <VmDetailField label="Имя ВМ" value={vm.name || '-'} />
            <VmDetailField label="Статус" value={vmStatusBadge} />
            <VmDetailField label="cluster_id" value={clusterIdValue} />
            <VmDetailField label="CPU" value={`${cpuValue} vCPU`} />
            <VmDetailField label="ОЗУ" value={`${memoryValue} MB`} />
            <VmDetailField label="Диск" value={`${diskValue} GB`} />
            <VmDetailField label="Пул хранения" value={storagePoolValue} />
            <VmDetailField label="Формат тома" value={storageFormatValue} />
            <VmDetailField label="Том" value={storageVolumeValue} />
            <VmDetailField label="Target dev" value={diskTargetValue} />
            <VmDetailField label="Роль диска" value={diskRoleBadge} />
            <VmDetailField label="Размер тома" value={volumeSizeValue} />
            <VmDetailField label="Статус пула" value={poolStatusBadge} />
            <VmDetailField label="Автозапуск пула" value={poolAutostartBadge} />
          </div>

          <VmDetailField
            label="Путь диска"
            value={diskPathValue}
            multiline
            actions={diskPathValue !== '-' ? (
              <button
                type="button"
                className="btn inline-flex items-center gap-2"
                onClick={() => handleCopyPath(diskPathValue)}
              >
                <Copy className="h-4 w-4" />
                <span>Скопировать путь</span>
              </button>
            ) : null}
          />

          <div className="flex flex-wrap justify-end gap-3">
            {storagePoolValue !== 'Системный путь' && storagePoolValue !== '-' ? (
              <button
                type="button"
                className="btn"
                onClick={() => handleOpenCurrentPoolInStorage(storagePoolValue)}
              >
                Открыть пул в Storage
              </button>
            ) : null}
            {linkedVolume ? (
              <button
                type="button"
                className="btn"
                onClick={() => handleOpenCurrentVolumeInStorage(linkedVolume)}
              >
                Открыть том в Storage
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                closeDialog();
                navigate(`/vms?vm=${encodeURIComponent(vm.name)}`);
              }}
            >
              Перейти на страницу ВМ
            </button>
          </div>
        </>
      ),
    });
  };

  const handleCopyPath = async (path) => {
    if (!path || path === '-') {
      return;
    }

    try {
      await navigator.clipboard.writeText(path);
      showUpdateMessage('Путь скопирован');
    } catch (err) {
      openDialog({
        title: 'Не удалось скопировать путь',
        message: err.message || 'Буфер обмена недоступен в текущем браузере.',
        variant: 'warning',
      });
    }
  };

  const handleResetQueryState = () => {
    resetAllQueryIndicators(queryStateConfig);
  };

  const queryStateConfig = useMemo(() => ({
    filterPool: createDraftQueryStateValueConfig({
      queryKey: 'filterPool',
      value: draftPoolFilter,
      setApplied: setPoolFilter,
      setDraft: setDraftPoolFilter,
    }),
    filterUsage: createDraftQueryStateValueConfig({
      queryKey: 'filterUsage',
      value: draftUsageFilter,
      setApplied: setUsageFilter,
      setDraft: setDraftUsageFilter,
      resetValue: 'all',
      removeWhen: removeQueryStateValueWhenDefault('all'),
    }),
    filterPoolSearch: createDraftQueryStateValueConfig({
      queryKey: 'filterPoolSearch',
      value: draftPoolSearchTerm.trim(),
      applyValue: draftPoolSearchTerm,
      setApplied: setPoolSearchTerm,
      setDraft: setDraftPoolSearchTerm,
    }),
    filterSearch: createDraftQueryStateValueConfig({
      queryKey: 'filterSearch',
      value: draftSearchTerm.trim(),
      applyValue: draftSearchTerm,
      setApplied: setSearchTerm,
      setDraft: setDraftSearchTerm,
    }),
  }), [draftPoolFilter, draftPoolSearchTerm, draftSearchTerm, draftUsageFilter]);

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
        <RefreshButton onClick={() => loadStorage(true)} loading={loading} className={STORAGE_ACCENT_BUTTON_CLASS} />
        <ActionButton icon={FolderPlus} label="Создать пул" onClick={openCreatePoolModal} className={STORAGE_ACCENT_BUTTON_CLASS} />
        <ActionButton icon={Plus} label="Создать том" onClick={openCreateVolumeModal} disabled={pools.length === 0} className={STORAGE_ACCENT_BUTTON_CLASS} />
      </PageActions>

      <FormModal
        isOpen={showCreatePool}
        title="Создать пул хранения"
        subtitle="Укажите имя и каталог для dir-пула libvirt. Каталог будет создан автоматически, если его нет."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isCreatingPool}
        confirmDisabled={hasPoolErrors}
        onClose={closeCreatePoolModal}
        onConfirm={submitCreatePool}
      >
        <FormInlineHelp
          title="Быстрые пресеты пула"
          description="Подставьте типовой каталог и режим автозапуска, а имя укажите под свой контур."
          selectedPreset={selectedPoolPreset}
          presets={[
            { id: 'standard-dir', label: 'Стандартный dir', description: 'pool-custom, автозапуск on', onClick: () => applyPoolPreset('standard-dir') },
            { id: 'manual-dir', label: 'Без автозапуска', description: 'pool-manual, manual mode', onClick: () => applyPoolPreset('manual-dir') },
          ]}
          tips={[
            'Для отдельных проектов лучше использовать отдельный каталог, а не общий системный путь.',
            'Автозапуск удобен для постоянно используемых пулов.',
          ]}
        />
        <div className="modal-field">
          <label className="modal-label">Имя пула хранения</label>
          <input
            className={getFieldClassName(isPoolFieldInvalid('name'))}
            value={newPool.name}
            onChange={handlePoolChange('name')}
            onBlur={markPoolFieldTouched('name')}
            placeholder="Например: vm-images"
          />
          {isPoolFieldInvalid('name') && <p className="modal-error">{poolErrors.name}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Каталог пула</label>
          <input
            className={getFieldClassName(isPoolFieldInvalid('path'))}
            value={newPool.path}
            onChange={handlePoolChange('path')}
            onBlur={markPoolFieldTouched('path')}
            placeholder="Например: /var/lib/libvirt/images/custom"
          />
          {isPoolFieldInvalid('path') && <p className="modal-error">{poolErrors.path}</p>}
          <p className="modal-hint">Поддерживаются Linux/WSL-пути и Windows-пути вида C:\folder\images.</p>
        </div>
        <label className="modal-checkbox">
          <input type="checkbox" checked={newPool.autostart} onChange={handlePoolChange('autostart')} />
          <span>Автозапуск пула при старте libvirt</span>
        </label>
      </FormModal>

      <FormModal
        isOpen={showCreateVolume}
        title="Создать том"
        subtitle="Выберите активный пул хранения и задайте параметры нового qcow2-тома."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isCreatingVolume}
        confirmDisabled={hasVolumeErrors}
        onClose={closeCreateVolumeModal}
        onConfirm={submitCreateVolume}
      >
        <FormInlineHelp
          title="Быстрые пресеты тома"
          description="Выберите типовой размер тома и затем при необходимости скорректируйте имя или пул вручную."
          selectedPreset={selectedVolumePreset}
          presets={[
            { id: 'system', label: 'Системный', description: 'vm-system.qcow2, 10 GB', onClick: () => applyVolumePreset('system') },
            { id: 'work', label: 'Рабочий', description: 'vm-work.qcow2, 20 GB', onClick: () => applyVolumePreset('work') },
            { id: 'large', label: 'Большой', description: 'vm-data.qcow2, 40 GB', onClick: () => applyVolumePreset('large') },
          ]}
          tips={[
            'Том создаётся как qcow2 внутри выбранного пула хранения.',
            'Если пул неактивен, сначала запустите его или создайте новый.',
          ]}
        />
        <div className="modal-field">
          <label className="modal-label">Пул хранения</label>
          <select
            className={getFieldClassName(isVolumeFieldInvalid('pool'))}
            value={newVolume.pool}
            onChange={handleVolumeChange('pool')}
            onBlur={markVolumeFieldTouched('pool')}
          >
            <option value="">Выберите пул</option>
            {activePools.map((pool) => (
              <option key={pool.id} value={pool.name}>{pool.name}</option>
            ))}
          </select>
          {isVolumeFieldInvalid('pool') && <p className="modal-error">{volumeErrors.pool}</p>}
          {activePools.length === 0 && <p className="modal-hint text-amber-300">Нет активных пулов. Сначала запустите или создайте пул хранения.</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Имя тома</label>
          <input
            className={getFieldClassName(isVolumeFieldInvalid('name'))}
            value={newVolume.name}
            onChange={handleVolumeChange('name')}
            onBlur={markVolumeFieldTouched('name')}
            placeholder="Например: vm-disk.qcow2"
          />
          {isVolumeFieldInvalid('name') && <p className="modal-error">{volumeErrors.name}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Размер тома, GB</label>
          <input
            type="number"
            min="1"
            className={getFieldClassName(isVolumeFieldInvalid('size_gb'))}
            value={newVolume.size_gb}
            onChange={handleVolumeChange('size_gb')}
            onBlur={markVolumeFieldTouched('size_gb')}
            placeholder="Например: 20"
          />
          {isVolumeFieldInvalid('size_gb') && <p className="modal-error">{volumeErrors.size_gb}</p>}
        </div>
      </FormModal>

      <FormModal
        isOpen={showAttachVolume}
        title="Подключить том к ВМ"
        subtitle={volumeToAttach ? `Том ${volumeToAttach.name} из пула ${volumeToAttach.pool} будет добавлен как дополнительный диск.` : 'Выберите виртуальную машину для подключения тома.'}
        confirmLabel="Подключить"
        confirmBusyLabel="Подключение..."
        isSubmitting={isAttachingVolume}
        confirmDisabled={!selectedAttachVmName}
        onClose={closeAttachVolumeModal}
        onConfirm={submitAttachVolume}
      >
        <div className="modal-field">
          <label className="modal-label">Виртуальная машина</label>
          <select
            className={getFieldClassName(attachVolumeAttempted && !selectedAttachVmName)}
            value={selectedAttachVmName}
            onChange={(event) => setSelectedAttachVmName(event.target.value)}
          >
            <option value="">Выберите ВМ</option>
            {availableAttachVms.map((vm) => (
              <option key={vm.id} value={vm.name}>{vm.name}</option>
            ))}
          </select>
          {attachVolumeAttempted && !selectedAttachVmName ? <p className="modal-error">Выберите ВМ для подключения тома.</p> : null}
          {availableAttachVms.length === 0 ? <p className="modal-hint text-amber-300">Нет доступных ВМ для подключения тома.</p> : null}
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
          subtitle="Все найденные тома"
          icon={HardDrive}
          color="text-cyan-400"
        />
        <StatCard
          title="Пулы хранения"
          value={overview.pools_count}
          subtitle="Все доступные пулы"
          icon={FolderOpen}
          color="text-yellow-400"
        />
        <StatCard
          title="Активные пулы"
          value={overview.active_pools_count}
          subtitle="Пулы, готовые к работе"
          icon={Server}
          color="text-emerald-400"
        />
      </div>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка хранилищ...' : ''} />

      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl border border-dark-700 bg-dark-900/70 flex items-center justify-center">
            <Filter className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Фильтры</h3>
            <p className="text-sm text-dark-400">Быстрая выборка пулов и томов по занятости.</p>
          </div>
          <button className={`btn-primary ${STORAGE_ACCENT_BUTTON_CLASS}`.trim()} onClick={handleApplyQueryState} disabled={!hasPendingFilterChanges}>
            Применить фильтры
          </button>
          <button className={`btn ${STORAGE_ACCENT_BUTTON_CLASS}`.trim()} onClick={handleResetQueryState} disabled={!isAnyFilterActive}>
            Сбросить фильтры
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="modal-field">
            <label className={`modal-label ${EGGPLANT_HEADER_TEXT_CLASS}`}>Пул хранения</label>
            <select className="input w-full" value={draftPoolFilter} onChange={(event) => setDraftPoolFilter(event.target.value)}>
              <option value="">Все пулы</option>
              {pools.map((pool) => (
                <option key={pool.id} value={pool.name}>{pool.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-field">
            <label className={`modal-label ${EGGPLANT_HEADER_TEXT_CLASS}`}>Состояние томов</label>
            <select className="input w-full" value={draftUsageFilter} onChange={(event) => setDraftUsageFilter(event.target.value)}>
              <option value="all">Все тома</option>
              <option value="attached">Только подключенные</option>
              <option value="free">Только свободные</option>
            </select>
          </div>
          <div className="modal-field">
            <label className={`modal-label ${EGGPLANT_HEADER_TEXT_CLASS}`}>Быстрый поиск по пулу</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
              <input
                className="input w-full pl-10"
                value={draftPoolSearchTerm}
                onChange={(event) => setDraftPoolSearchTerm(event.target.value)}
                placeholder="Например: pool1"
              />
            </div>
          </div>
          <div className="modal-field">
            <label className={`modal-label ${EGGPLANT_HEADER_TEXT_CLASS}`}>Поиск по ВМ или тому</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
              <input
                className="input w-full pl-10"
                value={draftSearchTerm}
                onChange={(event) => setDraftSearchTerm(event.target.value)}
                placeholder="Например: vm-01 или disk.qcow2"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-dark-300">
          <span className="rounded-full border border-dark-700 bg-dark-900/60 px-2.5 py-1">Пулов показано: <span className="text-white">{filteredPools.length}</span></span>
          <span className="rounded-full border border-dark-700 bg-dark-900/60 px-2.5 py-1">Томов показано: <span className="text-white">{filteredVolumes.length}</span></span>
        </div>
        <QueryStateActions
          className="mt-4"
          activeIndicators={activeFilterIndicators}
          actionButtonClassName={STORAGE_ACCENT_BUTTON_CLASS}
          onCopyLink={() => copyCurrentLink(activeFilterIndicators)}
          onResetAll={isAnyFilterActive ? handleResetQueryState : undefined}
          onRemoveIndicator={handleRemoveIndicator}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-white">Пулы хранения</h3>
            <p className="text-sm text-dark-400 mt-1">Сводная таблица по всем пулам хранения в едином стиле со списком томов.</p>
          </div>
        </div>

        {filteredPools.length === 0 && !loading ? (
          <EmptyState
            icon={FolderOpen}
            title="Подходящие пулы не найдены"
            description="Измените фильтр или создайте пул хранения, чтобы он появился здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[26%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[6%]" />
                <col className="w-[12%] lg:w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-dark-700">
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Имя" sortKey="name" sortState={poolSort} onSort={handleSortPools} /></th>
                  <th className={`text-left py-3 pl-2 pr-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Статус" sortKey="status" sortState={poolSort} onSort={handleSortPools} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Путь" sortKey="path" sortState={poolSort} onSort={handleSortPools} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Томов" sortKey="volumes_count" sortState={poolSort} onSort={handleSortPools} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Использовано" sortKey="allocation_bytes" sortState={poolSort} onSort={handleSortPools} /></th>
                  <th className={`text-right py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Свободно" sortKey="available_bytes" sortState={poolSort} onSort={handleSortPools} align="right" /></th>
                  <th className={`text-right py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Исп. ВМ" sortKey="attached_count" sortState={poolSort} onSort={handleSortPools} align="right" /></th>
                  <th className={`text-right py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortedPools.map((pool) => {
                  const isBusy = pendingPoolAction && pendingPoolAction.startsWith(`${pool.name}:`);
                  const isDeleting = pendingPoolDelete === pool.name;
                  const isOnline = pool.status === 'online' || pool.status === 'degraded' || pool.status === 'building';
                  const attachedVolume = volumes.find((volume) => volume.pool === pool.name && volume.attached_vm);
                  const attachedVolumesCount = attachedVolumeCountsByPool[pool.name] || 0;
                  const hasAttachedVolume = Boolean(attachedVolume);
                  const isHighlightedPool = selectedPoolName === pool.name && !selectedVolumeName;
                  return (
                    <tr
                      key={pool.id}
                      ref={(node) => {
                        if (node) {
                          poolRefs.current[pool.name] = node;
                        }
                      }}
                      className={`border-b border-dark-700 align-top hover:bg-dark-700/50 ${isHighlightedPool ? 'bg-cyan-500/10' : ''}`}
                    >
                      <td className="py-4 px-4 text-white font-medium">{pool.name}</td>
                      <td className="py-4 pl-2 pr-4 text-dark-200">
                        <span className="inline-flex items-center gap-2 rounded-full border border-dark-700 bg-dark-900/60 px-3 py-1 text-xs">
                          <span className={`w-2.5 h-2.5 rounded-full ${getPoolStatusClassName(pool.status)}`}></span>
                          <span>{getPoolStatusLabel(pool.status)}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-dark-400">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-left transition-colors hover:text-white"
                          onClick={() => handleCopyPath(pool.path)}
                          title={pool.path ? `${pool.path}\nНажмите, чтобы скопировать` : '-'}
                        >
                          <span className="truncate">{pool.path || '-'}</span>
                          {pool.path && <Copy className="h-3.5 w-3.5 shrink-0 text-lime-300" />}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-dark-300 text-center">{pool.volumes_count}</td>
                      <td className="py-4 px-4 text-dark-300 whitespace-nowrap">{formatSize(pool.allocation_bytes)}</td>
                      <td className="py-4 px-4 text-right text-dark-300 whitespace-nowrap">{formatSize(pool.available_bytes)}</td>
                      <td className="py-4 px-4 text-dark-300 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full border border-dark-700 bg-dark-900/60 px-2.5 py-1 text-xs text-dark-200 w-fit">
                            {attachedVolumesCount}
                          </span>
                          {pool.autostart && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
                              title="Автозапуск включен"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>Авто</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="table-actions-row">
                          <button
                            className="btn table-action-button table-action-button-compact"
                            onClick={() => runPoolAction(pool.name, 'refresh', apiService.refreshStoragePool, 'Не удалось обновить пул хранения')}
                            disabled={!isOnline || isBusy}
                            title={`Обновить пул ${pool.name}`}
                          >
                            <RotateCw className="table-action-icon" />
                            <span>{isBusy && pendingPoolAction === `${pool.name}:refresh` ? '...' : 'Обн.'}</span>
                          </button>
                          {isOnline ? (
                            <button
                              className="btn table-action-button table-action-button-compact text-red-200 hover:text-white"
                              onClick={() => runPoolAction(pool.name, 'stop', apiService.stopStoragePool, 'Не удалось остановить пул хранения')}
                              disabled={isBusy}
                              title={`Остановить пул ${pool.name}`}
                            >
                              <Square className="table-action-icon" />
                              <span>{isBusy && pendingPoolAction === `${pool.name}:stop` ? '...' : 'Стоп'}</span>
                            </button>
                          ) : (
                            <button
                              className="btn-primary table-action-button table-action-button-compact"
                              onClick={() => runPoolAction(pool.name, 'start', apiService.startStoragePool, 'Не удалось запустить пул хранения')}
                              disabled={isBusy}
                              title={`Запустить пул ${pool.name}`}
                            >
                              <Play className="table-action-icon" />
                              <span>{isBusy && pendingPoolAction === `${pool.name}:start` ? '...' : 'Старт'}</span>
                            </button>
                          )}
                          <button
                            className="btn table-action-button text-red-200 hover:text-white"
                            onClick={() => handleDeletePool(pool, attachedVolume)}
                            disabled={isBusy || isDeleting}
                            title={hasAttachedVolume ? `Пул содержит подключенный том ${attachedVolume.name} (ВМ ${attachedVolume.attached_vm})` : 'Удалить пул'}
                          >
                            <Trash2 className="table-action-icon" />
                            <span>{isDeleting ? '...' : hasAttachedVolume ? 'Занят' : 'Удал.'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-white">Список томов</h3>
            <p className="text-sm text-dark-400 mt-1">Тома доступны для подключения к виртуальным машинам.</p>
          </div>
        </div>

        {filteredVolumes.length === 0 && !loading ? (
          <EmptyState
            icon={Database}
            title="Подходящие тома не найдены"
            description="Измените фильтр или создайте том в активном пуле хранения, чтобы он появился здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[27%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-dark-700">
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Имя" sortKey="name" sortState={volumeSort} onSort={handleSortVolumes} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Пул" sortKey="pool" sortState={volumeSort} onSort={handleSortVolumes} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Формат" sortKey="format" sortState={volumeSort} onSort={handleSortVolumes} /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Размер" sortKey="size_bytes" sortState={volumeSort} onSort={handleSortVolumes} /></th>
                  <th className={`text-center py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Используется ВМ" sortKey="attached_vm" sortState={volumeSort} onSort={handleSortVolumes} align="center" /></th>
                  <th className={`text-left py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}><SortableHeader label="Путь" sortKey="path" sortState={volumeSort} onSort={handleSortVolumes} /></th>
                  <th className={`text-right py-3 px-4 font-medium ${EGGPLANT_HEADER_TEXT_CLASS}`}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortedVolumes.map((volume) => {
                  const isDeleting = pendingVolumeDelete === volume.id;
                  const isAttached = Boolean(volume.attached_vm);
                  const isAttaching = pendingVolumeAction === `${volume.id}:attach`;
                  const isDetaching = pendingVolumeAction === `${volume.id}:detach`;
                  const isMutating = isAttaching || isDetaching;
                  const attachedVm = volume.attached_vm ? vmsByName.get(volume.attached_vm) : null;
                  const isPrimaryVmDisk = Boolean(
                    attachedVm && (
                      (attachedVm.disk_path && attachedVm.disk_path === volume.path)
                      || (attachedVm.storage_pool === volume.pool && attachedVm.storage_volume === volume.name)
                    )
                  );
                  const isHighlightedVolume = selectedPoolName === volume.pool && selectedVolumeName === volume.name;
                  return (
                    <tr
                      key={volume.id}
                      ref={(node) => {
                        if (node) {
                          volumeRefs.current[`${volume.pool}:${volume.name}`] = node;
                        }
                      }}
                      className={`border-b border-dark-700 hover:bg-dark-700/50 ${isHighlightedVolume ? 'bg-cyan-500/10' : ''}`}
                    >
                      <td className="py-3 px-4 text-white">{volume.name}</td>
                      <td className="py-3 px-4 text-dark-300">{volume.pool}</td>
                      <td className="py-3 px-4 text-dark-300 uppercase">{volume.format || 'raw'}</td>
                      <td className="py-3 px-4 text-dark-300 whitespace-nowrap">{formatSize(volume.size_bytes)}</td>
                      <td className="py-3 px-4 text-dark-300 text-center">
                        <div className="flex justify-center">
                          {isAttached ? (
                            <div className="flex w-full max-w-[240px] flex-wrap justify-center gap-2">
                              <Link
                                to={`/vms?vm=${encodeURIComponent(volume.attached_vm)}`}
                                className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 transition-colors hover:border-amber-300/60 hover:text-white"
                              >
                                {volume.attached_vm}
                              </Link>
                              {isPrimaryVmDisk ? (
                                <span className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100">
                                  Основной диск
                                </span>
                              ) : null}
                            </div>
                          ) : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-dark-400">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-left transition-colors hover:text-white"
                          onClick={() => handleCopyPath(volume.path)}
                          title={volume.path ? `${volume.path}\nНажмите, чтобы скопировать` : '-'}
                        >
                          <span className="truncate">{volume.path || '-'}</span>
                          {volume.path && <Copy className="h-3.5 w-3.5 shrink-0 text-lime-300" />}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="table-actions-row">
                          {isAttached && (
                            <button
                              className="btn table-action-button table-action-button-compact text-cyan-200 hover:text-white"
                              onClick={() => handleOpenVmDetails(volume.attached_vm)}
                              title={`Параметры ВМ ${volume.attached_vm}`}
                            >
                              <Settings className="table-action-icon" />
                              <span>Парам.</span>
                            </button>
                          )}
                          {isAttached ? (
                            <button
                              className="btn table-action-button table-action-button-compact text-amber-200 hover:text-white"
                              onClick={() => handleDetachVolume(volume)}
                              disabled={isMutating || isPrimaryVmDisk}
                              title={isPrimaryVmDisk ? `Основной диск ВМ ${volume.attached_vm} нельзя отключить` : `Отключить том ${volume.name}`}
                            >
                              <Square className="table-action-icon" />
                              <span>{isPrimaryVmDisk ? 'Осн.' : isDetaching ? '...' : 'Откл.'}</span>
                            </button>
                          ) : (
                            <button
                              className="btn table-action-button table-action-button-compact text-emerald-200 hover:text-white"
                              onClick={() => openAttachVolumeModal(volume)}
                              disabled={isMutating || availableAttachVms.length === 0}
                              title={availableAttachVms.length === 0 ? 'Нет доступных ВМ' : `Подключить том ${volume.name}`}
                            >
                              <Play className="table-action-icon" />
                              <span>{isAttaching ? '...' : 'Подкл.'}</span>
                            </button>
                          )}
                          <button
                            className={`btn table-action-button ${isAttached ? 'text-dark-500 cursor-not-allowed' : 'text-red-200 hover:text-white'}`}
                            onClick={() => handleDeleteVolume(volume)}
                            disabled={isDeleting || isAttached || isMutating}
                            title={isAttached ? `Том ${volume.name} используется ВМ ${volume.attached_vm}` : `Удалить том ${volume.name}`}
                          >
                            <Trash2 className="table-action-icon" />
                            <span className={isAttached ? 'text-rose-300' : ''}>{isDeleting ? '...' : isAttached ? 'Занят' : 'Удал.'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Storage;
