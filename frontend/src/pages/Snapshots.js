import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, HardDrive, RotateCw, ShieldCheck, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import ActionButton from '../components/ActionButton';
import AppDialog from '../components/AppDialog';
import AppToast from '../components/AppToast';
import BackupFiltersToolbar from '../components/BackupFiltersToolbar';
import EmptyState from '../components/EmptyState';
import FormInlineHelp from '../components/FormInlineHelp';
import FormModal from '../components/FormModal';
import LoadingState from '../components/LoadingState';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import StatCard from '../components/StatCard';
import StatusMessage from '../components/StatusMessage';
import VmReadinessIndicator from '../components/VmReadinessIndicator';
import { useQueryStateUrl } from '../hooks/useQueryStateUrl';
import { useDialog } from '../hooks/useDialog';
import { useTimedMessage } from '../hooks/useTimedMessage';
import {
  buildQueryStateIndicators,
  commitSingleQueryStateValue,
  createQueryStateIndicator,
  createQueryStateUpdatesConfig,
  createQueryStateValueConfig,
  removeQueryStateValueWhenDefault,
} from '../utils/queryState';

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

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

const formatMode = (value) => {
  if (value === 'online') {
    return 'Live backup';
  }
  return 'Offline backup';
};

const formatConsistency = (value) => {
  if (value === 'crash-consistent-live') {
    return 'crash-consistent';
  }
  return value || 'crash-consistent';
};

const formatConsistencyBadge = (value) => {
  return {
    label: 'Crash-consistent',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderHighlightedText = (value, query) => {
  const text = value || '-';
  if (!query || text === '-') {
    return text;
  }

  const pattern = escapeRegExp(query);
  const splitMatcher = new RegExp(`(${pattern})`, 'ig');
  const exactMatcher = new RegExp(`^${pattern}$`, 'i');
  const parts = String(text).split(splitMatcher);

  return parts.map((part, index) => (
    exactMatcher.test(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-cyan-500/20 px-1 text-cyan-100">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  ));
};

const BACKUP_TYPE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'live', label: 'Live' },
  { id: 'offline', label: 'Offline' },
  { id: 'crash-consistent', label: 'Crash-consistent' },
];

const BACKUP_SORT_OPTIONS = ['date', 'size', 'type'];
const DEFAULT_SORT_BY = 'date';
const DEFAULT_SORT_DIRECTION = 'desc';
const DISK_SEARCH_DEBOUNCE_MS = 350;
const EXPANDED_QUERY_KEY = 'ex';
const LEGACY_EXPANDED_QUERY_KEY = 'expanded';

const BACKUP_PRESET_IDS = {
  FIRST: 'first-available',
  RUNNING: 'running',
  STOPPED: 'stopped',
};

const getBackupTypeFromParams = (params) => {
  const value = params.get('backupType') || 'all';
  return BACKUP_TYPE_FILTERS.some((filter) => filter.id === value) ? value : 'all';
};

const getDiskSearchFromParams = (params) => params.get('diskSearch') || '';

const getExpandedTokenFromParams = (params) => params.get(EXPANDED_QUERY_KEY) || params.get(LEGACY_EXPANDED_QUERY_KEY) || '';

const hasCompactExpandedParams = (params) => params.has(EXPANDED_QUERY_KEY);

const getSortByFromParams = (params) => {
  const value = params.get('sortBy') || DEFAULT_SORT_BY;
  return BACKUP_SORT_OPTIONS.includes(value) ? value : DEFAULT_SORT_BY;
};

const getSortDirectionFromParams = (params) => {
  const value = params.get('sortDir') || DEFAULT_SORT_DIRECTION;
  return value === 'asc' ? 'asc' : DEFAULT_SORT_DIRECTION;
};

const areStringArraysEqual = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

const encodeExpandedIndexes = (indexes) => {
  if (indexes.length === 0) {
    return '';
  }

  const uniqueIndexes = Array.from(new Set(indexes)).sort((left, right) => left - right);
  const ranges = [];
  let rangeStart = uniqueIndexes[0];
  let previous = uniqueIndexes[0];

  for (let index = 1; index < uniqueIndexes.length; index += 1) {
    const current = uniqueIndexes[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(rangeStart === previous ? rangeStart.toString(36) : `${rangeStart.toString(36)}-${previous.toString(36)}`);
    rangeStart = current;
    previous = current;
  }

  ranges.push(rangeStart === previous ? rangeStart.toString(36) : `${rangeStart.toString(36)}-${previous.toString(36)}`);
  return ranges.join('.');
};

const decodeExpandedIndexes = (token) => {
  if (!token.trim()) {
    return [];
  }

  const indexes = [];
  const segments = token.split('.').map((value) => value.trim()).filter(Boolean);

  segments.forEach((segment) => {
    const [startRaw, endRaw] = segment.split('-');
    const start = Number.parseInt(startRaw, 36);
    const end = endRaw ? Number.parseInt(endRaw, 36) : start;

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      return;
    }

    for (let value = start; value <= end; value += 1) {
      indexes.push(value);
    }
  });

  return indexes;
};

const decodeExpandedIdsFromParams = (params, visibleBackups) => {
  const compactToken = getExpandedTokenFromParams(params);
  if (!compactToken) {
    return [];
  }

  if (hasCompactExpandedParams(params)) {
    return decodeExpandedIndexes(compactToken)
      .map((index) => visibleBackups[index]?.id)
      .filter(Boolean);
  }

  return compactToken
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const encodeExpandedIdsForParams = (expandedIds, visibleBackups) => {
  const indexMap = new Map(visibleBackups.map((backup, index) => [backup.id, index]));
  const indexes = expandedIds
    .map((backupId) => indexMap.get(backupId))
    .filter((value) => Number.isInteger(value));

  return encodeExpandedIndexes(indexes);
};

const matchesBackupType = (backup, filter) => {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'live') {
    return backup?.mode === 'online';
  }
  if (filter === 'offline') {
    return backup?.mode !== 'online';
  }
  if (filter === 'crash-consistent') {
    return true;
  }
  return true;
};

const matchesDiskSearch = (disk, query) => {
  if (!query) {
    return true;
  }

  const haystack = [
    disk?.target_dev,
    disk?.file_name,
    disk?.original_path,
    disk?.backup_file_path,
    disk?.format,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
};

const getBackupTypeSortValue = (backup) => {
  const mode = backup?.mode === 'online' ? 'live' : 'offline';
  const consistency = 'crash-consistent';
  return `${mode}-${consistency}`;
};

const sortBackups = (items, sortBy, sortDirection) => {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const sorted = [...items].sort((left, right) => {
    if (sortBy === 'size') {
      return (Number(left?.total_size_bytes || 0) - Number(right?.total_size_bytes || 0)) * direction;
    }

    if (sortBy === 'type') {
      return getBackupTypeSortValue(left).localeCompare(getBackupTypeSortValue(right)) * direction;
    }

    const leftDate = new Date(left?.created_at || 0).getTime();
    const rightDate = new Date(right?.created_at || 0).getTime();
    return (leftDate - rightDate) * direction;
  });

  return sorted;
};

const Snapshots = () => {
  const [backups, setBackups] = useState([]);
  const [vms, setVms] = useState([]);
  const [storage, setStorage] = useState({ pools: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [showRestoreBackup, setShowRestoreBackup] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [pendingBackupId, setPendingBackupId] = useState('');
  const [expandedBackupIds, setExpandedBackupIds] = useState([]);
  const [diskSearch, setDiskSearch] = useState('');
  const [debouncedDiskSearch, setDebouncedDiskSearch] = useState('');
  const [backupTypeFilter, setBackupTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState(DEFAULT_SORT_BY);
  const [sortDirection, setSortDirection] = useState(DEFAULT_SORT_DIRECTION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createVmName, setCreateVmName] = useState('');
  const [selectedBackupPreset, setSelectedBackupPreset] = useState(BACKUP_PRESET_IDS.FIRST);
  const [restoreForm, setRestoreForm] = useState({ target_name: '', storage_pool: '', start_vm: false });
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const { dialog, openDialog, closeDialog } = useDialog();
  const { searchParams, removeQueryIndicator, resetAllQueryIndicators, commitQueryState, copyCurrentLink } = useQueryStateUrl({
    onCopySuccess: showUpdateMessage,
    onCopyError: (copyError) => {
      openDialog({
        title: 'Не удалось скопировать ссылку',
        message: copyError.message || 'Буфер обмена недоступен в текущем браузере.',
        variant: 'warning',
      });
    },
  });

  const loadBackups = useCallback(async (showMessage = false) => {
    try {
      setLoading(true);
      setError('');
      const [backupsResponse, vmsResponse, storageResponse] = await Promise.all([
        apiService.getBackups(),
        apiService.getVMs(),
        apiService.getStorage(),
      ]);

      setBackups(Array.isArray(backupsResponse.data) ? backupsResponse.data : []);
      setVms(Array.isArray(vmsResponse.data) ? vmsResponse.data : []);
      setStorage(storageResponse.data || { pools: [] });

      if (showMessage) {
        showUpdateMessage('Данные обновлены');
      }
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message || 'Не удалось загрузить резервные копии');
      setBackups([]);
      setVms([]);
      setStorage({ pools: [] });
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadBackups(false);
  }, [loadBackups]);

  useEffect(() => {
    const nextDiskSearch = getDiskSearchFromParams(searchParams);
    setDiskSearch(nextDiskSearch);
    setDebouncedDiskSearch(nextDiskSearch);
    setBackupTypeFilter(getBackupTypeFromParams(searchParams));
    setSortBy(getSortByFromParams(searchParams));
    setSortDirection(getSortDirectionFromParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedDiskSearch(diskSearch.trim());
    }, DISK_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [diskSearch]);

  const filteredBackups = useMemo(
    () => backups.filter((backup) => matchesBackupType(backup, backupTypeFilter)),
    [backups, backupTypeFilter]
  );

  const visibleBackups = useMemo(
    () => sortBackups(filteredBackups, sortBy, sortDirection),
    [filteredBackups, sortBy, sortDirection]
  );

  useEffect(() => {
    const nextExpandedIds = decodeExpandedIdsFromParams(searchParams, visibleBackups);
    setExpandedBackupIds((current) => (areStringArraysEqual(current, nextExpandedIds) ? current : nextExpandedIds));
  }, [searchParams, visibleBackups]);

  const backupableVms = useMemo(
    () => vms.filter((vm) => vm?.name),
    [vms]
  );

  const activePools = useMemo(
    () => (Array.isArray(storage.pools) ? storage.pools : []).filter((pool) => ['online', 'degraded', 'building'].includes(pool.status)),
    [storage]
  );

  const totalBackupSize = useMemo(
    () => backups.reduce((sum, backup) => sum + Number(backup.total_size_bytes || 0), 0),
    [backups]
  );

  const selectedVm = useMemo(
    () => backupableVms.find((vm) => vm.name === createVmName) || null,
    [backupableVms, createVmName]
  );

  const normalizedDiskSearch = useMemo(
    () => diskSearch.trim().toLowerCase(),
    [diskSearch]
  );

  const allFilteredExpanded = visibleBackups.length > 0 && visibleBackups.every((backup) => expandedBackupIds.includes(backup.id));
  const encodedExpanded = useMemo(
    () => encodeExpandedIdsForParams(expandedBackupIds, visibleBackups),
    [expandedBackupIds, visibleBackups]
  );

  const activeIndicators = useMemo(() => {
    return buildQueryStateIndicators([
      createQueryStateIndicator('diskSearch', debouncedDiskSearch),
      backupTypeFilter !== 'all'
        ? createQueryStateIndicator(
            'backupType',
            BACKUP_TYPE_FILTERS.find((filter) => filter.id === backupTypeFilter)?.label || backupTypeFilter
          )
        : null,
      sortBy !== DEFAULT_SORT_BY
        ? createQueryStateIndicator('sortBy', sortBy === 'size' ? 'Размер' : sortBy === 'type' ? 'Тип' : 'Дата')
        : null,
      sortDirection !== DEFAULT_SORT_DIRECTION
        ? createQueryStateIndicator('sortDir', sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию')
        : null,
      expandedBackupIds.length > 0 ? createQueryStateIndicator('expanded', expandedBackupIds.length) : null,
    ]);
  }, [backupTypeFilter, debouncedDiskSearch, expandedBackupIds.length, sortBy, sortDirection]);

  const queryStateConfig = useMemo(() => ({
    diskSearch: createQueryStateValueConfig({
      queryKey: 'diskSearch',
      value: debouncedDiskSearch,
      reset: () => {
        setDiskSearch('');
        setDebouncedDiskSearch('');
      },
      resetKeys: ['diskSearch'],
    }),
    backupType: createQueryStateValueConfig({
      queryKey: 'backupType',
      value: backupTypeFilter,
      removeWhen: removeQueryStateValueWhenDefault('all'),
      reset: () => setBackupTypeFilter('all'),
      resetKeys: ['backupType'],
    }),
    sortBy: createQueryStateValueConfig({
      queryKey: 'sortBy',
      value: sortBy,
      removeWhen: removeQueryStateValueWhenDefault(DEFAULT_SORT_BY),
      reset: () => setSortBy(DEFAULT_SORT_BY),
      resetKeys: ['sortBy'],
    }),
    sortDir: createQueryStateValueConfig({
      queryKey: 'sortDir',
      value: sortDirection,
      removeWhen: removeQueryStateValueWhenDefault(DEFAULT_SORT_DIRECTION),
      reset: () => setSortDirection(DEFAULT_SORT_DIRECTION),
      resetKeys: ['sortDir'],
    }),
    expanded: createQueryStateUpdatesConfig({
      updates: {
        [EXPANDED_QUERY_KEY]: encodedExpanded,
        [LEGACY_EXPANDED_QUERY_KEY]: '',
      },
      reset: () => setExpandedBackupIds([]),
      resetKeys: [EXPANDED_QUERY_KEY, LEGACY_EXPANDED_QUERY_KEY],
    }),
  }), [backupTypeFilter, debouncedDiskSearch, encodedExpanded, sortBy, sortDirection]);

  useEffect(() => {
    if (getDiskSearchFromParams(searchParams) === debouncedDiskSearch) {
      return;
    }

    commitQueryState(queryStateConfig, ['diskSearch']);
  }, [commitQueryState, debouncedDiskSearch, queryStateConfig, searchParams]);

  useEffect(() => {
    if (getExpandedTokenFromParams(searchParams) === encodedExpanded && !searchParams.get(LEGACY_EXPANDED_QUERY_KEY)) {
      return;
    }

    commitQueryState(queryStateConfig, ['expanded']);
  }, [commitQueryState, encodedExpanded, queryStateConfig, searchParams]);

  const openCreateModal = () => {
    setCreateVmName(backupableVms[0]?.name || '');
    setSelectedBackupPreset(BACKUP_PRESET_IDS.FIRST);
    setShowCreateBackup(true);
  };

  const selectBackupPresetVm = (presetId, selector) => {
    const nextVm = selector(backupableVms);
    if (nextVm?.name) {
      setSelectedBackupPreset(presetId);
      setCreateVmName(nextVm.name);
    }
  };

  const openRestoreModal = (backup) => {
    setSelectedBackup(backup);
    setRestoreForm({
      target_name: `${backup.vm_name}-restored`,
      storage_pool: '',
      start_vm: false,
    });
    setShowRestoreBackup(true);
  };

  const toggleBackupDetails = (backupId) => {
    setExpandedBackupIds((current) => (
      current.includes(backupId)
        ? current.filter((item) => item !== backupId)
        : [...current, backupId]
    ));
  };

  const toggleExpandAll = () => {
    setExpandedBackupIds((current) => {
      const filteredIds = visibleBackups.map((backup) => backup.id);
      const hasAllFiltered = filteredIds.every((backupId) => current.includes(backupId));

      if (hasAllFiltered) {
        return current.filter((backupId) => !filteredIds.includes(backupId));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const handleDiskSearchChange = (value) => {
    setDiskSearch(value);
  };

  const handleBackupTypeChange = (value) => {
    commitSingleQueryStateValue(commitQueryState, 'backupType', {
      value,
      apply: () => setBackupTypeFilter(value),
      removeWhen: removeQueryStateValueWhenDefault('all'),
      reset: () => setBackupTypeFilter('all'),
      resetKeys: ['backupType'],
    });
  };

  const handleSortByChange = (value) => {
    commitSingleQueryStateValue(commitQueryState, 'sortBy', {
      value,
      apply: () => setSortBy(value),
      removeWhen: removeQueryStateValueWhenDefault(DEFAULT_SORT_BY),
      reset: () => setSortBy(DEFAULT_SORT_BY),
      resetKeys: ['sortBy'],
    });
  };

  const handleSortDirectionChange = () => {
    const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    commitSingleQueryStateValue(commitQueryState, 'sortDir', {
      value: nextDirection,
      apply: () => setSortDirection(nextDirection),
      removeWhen: removeQueryStateValueWhenDefault(DEFAULT_SORT_DIRECTION),
      reset: () => setSortDirection(DEFAULT_SORT_DIRECTION),
      resetKeys: ['sortDir'],
    });
  };

  const handleResetQueryState = () => {
    resetAllQueryIndicators(queryStateConfig);
  };

  const handleRemoveIndicator = useCallback(
    (indicatorId) => {
      removeQueryIndicator(indicatorId, queryStateConfig);
    },
    [queryStateConfig, removeQueryIndicator]
  );

  const submitCreateBackup = async () => {
    if (!createVmName || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiService.createBackup(createVmName);
      setSelectedBackupPreset(BACKUP_PRESET_IDS.FIRST);
      setShowCreateBackup(false);
      await loadBackups(true);
    } catch (submitError) {
      openDialog({
        title: 'Не удалось создать резервную копию',
        message: submitError.response?.data?.detail || submitError.message || 'Неизвестная ошибка',
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRestoreBackup = async () => {
    if (!selectedBackup || !restoreForm.target_name.trim() || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiService.restoreBackup(selectedBackup.id, {
        target_name: restoreForm.target_name.trim(),
        storage_pool: restoreForm.storage_pool || null,
        start_vm: restoreForm.start_vm,
      });
      setShowRestoreBackup(false);
      setSelectedBackup(null);
      await loadBackups(true);
    } catch (submitError) {
      openDialog({
        title: 'Не удалось восстановить резервную копию',
        message: submitError.response?.data?.detail || submitError.message || 'Неизвестная ошибка',
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBackup = (backup) => {
    openDialog({
      title: `Удалить резервную копию ${backup.id}?`,
      message: `Файлы резервной копии ${backup.id} будут удалены с диска. Это действие нельзя отменить.`,
      variant: 'danger',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      onConfirm: async () => {
        try {
          setPendingBackupId(backup.id);
          await apiService.deleteBackupEntry(backup.id);
          closeDialog();
          await loadBackups(true);
        } catch (submitError) {
          openDialog({
            title: 'Не удалось удалить резервную копию',
            message: submitError.response?.data?.detail || submitError.message || 'Неизвестная ошибка',
            variant: 'danger',
          });
        } finally {
          setPendingBackupId('');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions meta="Backup сохраняет XML, диски и NVRAM. Для running VM используется live external snapshot с последующим merge-back.">
        <RefreshButton onClick={() => loadBackups(true)} loading={loading} />
        <ActionButton icon={Camera} label="Создать backup" onClick={openCreateModal} disabled={backupableVms.length === 0} />
      </PageActions>

      <FormModal
        isOpen={showCreateBackup}
        title="Создать резервную копию"
        subtitle="Будут сохранены XML-конфиг ВМ и все file-based диски. Для running VM будет использован live snapshot, если он поддерживается libvirt."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isSubmitting}
        confirmDisabled={!createVmName}
        onClose={() => !isSubmitting && setShowCreateBackup(false)}
        onConfirm={submitCreateBackup}
      >
        <FormInlineHelp
          title="Быстрый выбор ВМ"
          description="Можно сразу выбрать типовой сценарий резервного копирования, а затем проверить итоговую ВМ вручную."
          selectedPreset={selectedBackupPreset}
          presets={[
            { id: BACKUP_PRESET_IDS.FIRST, label: 'Первая доступная', description: 'Любая backupable VM', onClick: () => selectBackupPresetVm(BACKUP_PRESET_IDS.FIRST, (items) => items[0]), disabled: backupableVms.length === 0 },
            { id: BACKUP_PRESET_IDS.RUNNING, label: 'Running VM', description: 'Live backup', onClick: () => selectBackupPresetVm(BACKUP_PRESET_IDS.RUNNING, (items) => items.find((item) => String(item.status || '').toLowerCase() === 'running')), disabled: !backupableVms.some((item) => String(item.status || '').toLowerCase() === 'running') },
            { id: BACKUP_PRESET_IDS.STOPPED, label: 'Stopped VM', description: 'Offline backup', onClick: () => selectBackupPresetVm(BACKUP_PRESET_IDS.STOPPED, (items) => items.find((item) => String(item.status || '').toLowerCase() !== 'running')), disabled: !backupableVms.some((item) => String(item.status || '').toLowerCase() !== 'running') },
          ]}
          tips={[
            'Для running VM backup будет crash-consistent, если live snapshot поддерживается.',
            'Для выключенной VM backup обычно предсказуемее и проще по цепочке дисков.',
          ]}
        />
        <div className="modal-field">
          <label className="modal-label">Исходная ВМ</label>
          <select className="input w-full" value={createVmName} onChange={(event) => {
            setSelectedBackupPreset('');
            setCreateVmName(event.target.value);
          }}>
            <option value="">Выберите ВМ</option>
            {backupableVms.map((vm) => (
              <option key={vm.id} value={vm.name}>{vm.name} ({vm.status || 'unknown'})</option>
            ))}
          </select>
          {backupableVms.length === 0 ? <p className="modal-hint text-amber-300">Нет доступных ВМ для резервного копирования.</p> : null}
        </div>
        <VmReadinessIndicator vm={selectedVm} />
        {selectedVm?.status === 'running' ? (
          <div className="modal-note border-amber-500/20 bg-amber-500/5 text-amber-100">
            Live backup будет создан как crash-consistent для файловых дисков ВМ.
          </div>
        ) : null}
      </FormModal>

      <FormModal
        isOpen={showRestoreBackup}
        title="Восстановить резервную копию"
        subtitle="Резервная копия будет восстановлена как новая ВМ с новым именем."
        confirmLabel="Восстановить"
        confirmBusyLabel="Восстановление..."
        isSubmitting={isSubmitting}
        confirmDisabled={!restoreForm.target_name.trim()}
        onClose={() => {
          if (!isSubmitting) {
            setShowRestoreBackup(false);
            setSelectedBackup(null);
          }
        }}
        onConfirm={submitRestoreBackup}
      >
        <div className="modal-field">
          <label className="modal-label">Имя новой ВМ</label>
          <input
            className="input w-full"
            value={restoreForm.target_name}
            onChange={(event) => setRestoreForm((current) => ({ ...current, target_name: event.target.value }))}
            placeholder="Например: vm-restored-01"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Пул хранения</label>
          <select
            className="input w-full"
            value={restoreForm.storage_pool}
            onChange={(event) => setRestoreForm((current) => ({ ...current, storage_pool: event.target.value }))}
          >
            <option value="">Системный путь (/var/lib/libvirt/images)</option>
            {activePools.map((pool) => (
              <option key={pool.id} value={pool.name}>{pool.name}</option>
            ))}
          </select>
        </div>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={restoreForm.start_vm}
            onChange={(event) => setRestoreForm((current) => ({ ...current, start_vm: event.target.checked }))}
          />
          <span>Запустить ВМ после восстановления</span>
        </label>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Резервные копии"
          value={backups.length}
          subtitle="Всего сохраненных наборов"
          icon={ShieldCheck}
          color="text-yellow-400"
        />
        <StatCard
          title="ВМ для backup"
          value={backupableVms.length}
          subtitle="Offline и live сценарии"
          icon={Camera}
          color="text-cyan-400"
        />
        <StatCard
          title="Общий объем"
          value={formatSize(totalBackupSize)}
          subtitle="Суммарный размер backup"
          icon={HardDrive}
          color="text-emerald-400"
        />
      </div>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка резервных копий...' : ''} />

      <div className="card">
        {backups.length > 0 ? (
          <BackupFiltersToolbar
            searchValue={diskSearch}
            onSearchChange={handleDiskSearchChange}
            typeFilters={BACKUP_TYPE_FILTERS}
            activeType={backupTypeFilter}
            onTypeChange={handleBackupTypeChange}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortByChange={handleSortByChange}
            onSortDirectionChange={handleSortDirectionChange}
            visibleCount={visibleBackups.length}
            expandedCount={visibleBackups.filter((backup) => expandedBackupIds.includes(backup.id)).length}
            allExpanded={allFilteredExpanded}
            onToggleExpandAll={toggleExpandAll}
            activeIndicators={activeIndicators}
            onResetAll={handleResetQueryState}
            onCopyLink={() => copyCurrentLink(activeIndicators)}
            onRemoveIndicator={handleRemoveIndicator}
          />
        ) : null}
        {backups.length === 0 && !loading ? (
          <EmptyState
            icon={Camera}
            title="Резервные копии не найдены"
            description="Создайте backup выключенной ВМ, чтобы он появился здесь."
          />
        ) : filteredBackups.length === 0 && !loading ? (
          <EmptyState
            icon={Camera}
            title="Фильтр не дал результатов"
            description="Сбросьте type-фильтр или измените условия отбора резервных копий."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="table-header-cell text-left">ID</th>
                  <th className="table-header-cell text-left">ВМ</th>
                  <th className="table-header-cell text-left">Создан</th>
                  <th className="table-header-cell text-left">Дисков</th>
                  <th className="table-header-cell text-left">Размер</th>
                  <th className="table-header-cell text-left">Статус</th>
                  <th className="table-header-cell text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleBackups.map((backup) => {
                  const isPending = pendingBackupId === backup.id;
                  const isExpanded = expandedBackupIds.includes(backup.id);
                  const backupDisks = Array.isArray(backup.disks) ? backup.disks : [];
                  const matchedDisks = backupDisks.filter((disk) => matchesDiskSearch(disk, normalizedDiskSearch));
                  const diskList = Array.isArray(backup.disks) ? backup.disks.map((disk) => disk.target_dev).filter(Boolean).join(', ') : '';
                  const consistencyBadge = formatConsistencyBadge(backup.consistency);
                  return (
                    <React.Fragment key={backup.id}>
                      <tr className="border-b border-dark-700 hover:bg-dark-700/50">
                        <td className="table-cell-strong">
                          <div>{backup.id}</div>
                          <div className="max-w-[320px] truncate text-xs text-dark-400" title={backup.backup_path || '-'}>
                            {backup.backup_path || '-'}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div>{backup.vm_name}</div>
                          <div className="text-xs text-dark-400">
                            {diskList ? `Диски: ${diskList}` : 'Диски не указаны'}
                          </div>
                        </td>
                        <td className="table-cell-muted whitespace-nowrap">{formatDate(backup.created_at)}</td>
                        <td className="table-cell-muted">{backup.disks_count}</td>
                        <td className="table-cell-muted">
                          <div>{formatSize(backup.total_size_bytes)}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                              {formatMode(backup.mode)}
                            </span>
                            <span className={`rounded-full border px-2 py-1 ${consistencyBadge.className}`}>
                              {consistencyBadge.label}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell-muted">
                          <div>{backup.status || 'ready'}</div>
                          {Array.isArray(backup.warnings) && backup.warnings.length > 0 ? (
                            <div className="max-w-[260px] text-xs text-amber-300" title={backup.warnings.join(' | ')}>
                              {backup.warnings.join(' | ')}
                            </div>
                          ) : null}
                        </td>
                        <td className="table-cell-actions">
                          <div className="table-actions-row">
                            <button className="btn table-action-button" onClick={() => toggleBackupDetails(backup.id)} title={`${isExpanded ? 'Скрыть' : 'Показать'} детали backup ${backup.id}`}>
                              {isExpanded ? <ChevronUp className="table-action-icon" /> : <ChevronDown className="table-action-icon" />}
                              <span>{isExpanded ? 'Скрыть' : 'Дет.'}</span>
                            </button>
                            <button className="btn table-action-button table-action-button-compact" onClick={() => openRestoreModal(backup)} title={`Восстановить backup ${backup.id}`}>
                              <RotateCw className="table-action-icon" />
                              <span>Восст.</span>
                            </button>
                            <button
                              className="btn table-action-button text-red-200 hover:text-white"
                              onClick={() => handleDeleteBackup(backup)}
                              disabled={isPending}
                              title={`Удалить backup ${backup.id}`}
                            >
                              <Trash2 className="table-action-icon" />
                              <span>{isPending ? '...' : 'Удал.'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b border-dark-700 bg-dark-900/40">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
                              <div className="space-y-3 rounded-xl border border-dark-700 bg-dark-900/70 p-4 text-sm text-dark-200">
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-dark-400">Backup path</div>
                                  <div className="mt-1 break-all">{backup.backup_path || '-'}</div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-dark-400">Mode</div>
                                  <div className="mt-1">{formatMode(backup.mode)}</div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-dark-400">Consistency</div>
                                  <div className="mt-1">{formatConsistency(backup.consistency)}</div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-dark-400">NVRAM</div>
                                  <div className="mt-1">{backup.has_nvram ? 'Сохранён' : 'Нет'}</div>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-dark-900/70 px-4 py-3 text-sm text-dark-200">
                                  <div>
                                    <div className="text-white">Диски</div>
                                    <div className="text-xs text-dark-400">
                                      {normalizedDiskSearch ? `Найдено ${matchedDisks.length} из ${backupDisks.length}` : `${backupDisks.length} в backup`}
                                    </div>
                                  </div>
                                  {normalizedDiskSearch ? (
                                    <div className="text-xs text-cyan-200">
                                      Фильтр: {diskSearch}
                                    </div>
                                  ) : null}
                                </div>
                                {matchedDisks.length > 0 ? matchedDisks.map((disk) => (
                                  <div key={`${backup.id}-${disk.target_dev}-${disk.file_name}`} className="rounded-xl border border-dark-700 bg-dark-900/70 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <div className="font-medium text-white">{renderHighlightedText(disk.target_dev || 'disk', normalizedDiskSearch)}</div>
                                        <div className="text-xs text-dark-400">{renderHighlightedText(disk.file_name || '-', normalizedDiskSearch)}</div>
                                      </div>
                                      <div className="text-sm text-dark-300">{renderHighlightedText(disk.format || 'qcow2', normalizedDiskSearch)} / {formatSize(disk.size_bytes)}</div>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      <div>
                                        <div className="text-xs uppercase tracking-wide text-dark-400">Original path</div>
                                        <div className="mt-1 break-all text-sm text-dark-200">{renderHighlightedText(disk.original_path || '-', normalizedDiskSearch)}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs uppercase tracking-wide text-dark-400">Backup file</div>
                                        <div className="mt-1 break-all text-sm text-dark-200">{renderHighlightedText(disk.backup_file_path || '-', normalizedDiskSearch)}</div>
                                      </div>
                                    </div>
                                  </div>
                                )) : (
                                  <div className="rounded-xl border border-dark-700 bg-dark-900/70 p-4 text-sm text-dark-300">
                                    {backupDisks.length === 0 ? 'Подробности по дискам отсутствуют.' : 'По текущему поисковому фильтру диски не найдены.'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {backups.length > 0 ? (
        <div className="modal-note border-cyan-500/20 bg-cyan-500/5 text-sm text-cyan-100">
          Восстановление создаёт новую ВМ и не изменяет исходную резервную копию. Для running VM backup помечается как live и сохраняется как crash-consistent.
        </div>
      ) : null}

      {backups.length === 0 && backupableVms.length > 0 ? (
        <div className="modal-note border-amber-500/20 bg-amber-500/5 text-sm text-amber-100">
          Для создания резервной копии выберите ВМ. Для выключенной ВМ создаётся offline backup, для running ВМ система попытается сделать live snapshot и вернуть диск в исходную цепочку после копирования.
        </div>
      ) : null}

      {activePools.length === 0 ? (
        <div className="modal-note border-dark-700 bg-dark-900/60 text-sm text-dark-200">
          Восстановление в пул хранения станет доступно после запуска хотя бы одного пула. Сейчас восстановление можно выполнять в системный каталог по умолчанию.
        </div>
      ) : null}
    </div>
  );
};

export default Snapshots;