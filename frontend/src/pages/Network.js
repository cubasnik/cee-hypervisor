import React, { useCallback, useEffect, useState } from 'react';
import { Network as NetworkIcon, Plus, Wifi, Globe } from 'lucide-react';
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

const Network = () => {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const { dialog, openDialog, closeDialog } = useDialog();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const [newNetwork, setNewNetwork] = useState({
    name: '',
    subnet: '192.168.100.0/24',
    mode: 'isolated',
    dhcp_enabled: true,
  });

  const loadNetworks = useCallback(async (showMessage = true) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getNetworks();
      setNetworks(Array.isArray(response.data) ? response.data : []);
      if (showMessage) {
        showUpdateMessage('Обновление выполнено');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки сетей');
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    loadNetworks(false);
  }, [loadNetworks]);

  const dhcpEnabledCount = networks.filter((network) => network.dhcp_enabled).length;
  const routedNetworksCount = networks.filter((network) => network.type === 'nat' || network.type === 'route').length;

  const createErrors = {
    name: !newNetwork.name.trim() ? 'Укажите имя сети.' : '',
    subnet: !newNetwork.subnet.trim() ? 'Укажите подсеть.' : '',
  };

  const hasCreateErrors = Boolean(createErrors.name || createErrors.subnet);

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
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }
    resetCreateValidation();
    setShowCreate(false);
  };

  const getTypeLabel = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'nat':
        return 'NAT';
      case 'route':
        return 'Маршрутизируемая';
      case 'bridge':
        return 'Мост';
      case 'open':
        return 'Открытая';
      default:
        return 'Изолированная';
    }
  };

  const handleCreateChange = (field) => (event) => {
    const value = field === 'dhcp_enabled' ? event.target.checked : event.target.value;
    setNewNetwork((current) => ({ ...current, [field]: value }));
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
      await apiService.createNetwork(newNetwork);
      resetCreateValidation();
      setShowCreate(false);
      setNewNetwork({
        name: '',
        subnet: '192.168.100.0/24',
        mode: 'isolated',
        dhcp_enabled: true,
      });
      await loadNetworks(true);
    } catch (err) {
      openDialog({
        title: 'Не удалось создать сеть',
        message: err.response?.data?.detail || err.message || 'Ошибка создания сети',
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
        <RefreshButton onClick={() => loadNetworks(true)} loading={loading} />
        <ActionButton icon={Plus} label="Создать сеть" onClick={openCreateModal} />
      </PageActions>

      <FormModal
        isOpen={showCreate}
        title="Создать сеть"
        subtitle="Укажите параметры виртуальной сети для libvirt."
        confirmLabel="Создать"
        confirmBusyLabel="Создание..."
        isSubmitting={isCreating}
        confirmDisabled={isCreateDisabled}
        onClose={closeCreateModal}
        onConfirm={submitCreate}
      >
        <div className="modal-field">
          <label className="modal-label">Имя сети</label>
          <input className={getFieldClassName('name')} value={newNetwork.name} onChange={handleCreateChange('name')} onBlur={markFieldTouched('name')} />
          {isFieldInvalid('name') && <p className="text-xs text-red-400">{createErrors.name}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Подсеть</label>
          <input className={getFieldClassName('subnet')} value={newNetwork.subnet} onChange={handleCreateChange('subnet')} onBlur={markFieldTouched('subnet')} />
          {isFieldInvalid('subnet') && <p className="text-xs text-red-400">{createErrors.subnet}</p>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Тип сети</label>
          <select className="input w-full" value={newNetwork.mode} onChange={handleCreateChange('mode')}>
            <option value="isolated">Изолированная</option>
            <option value="nat">NAT</option>
            <option value="route">Маршрутизируемая</option>
          </select>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-dark-700 bg-dark-900/60 px-3 py-3 text-sm text-dark-200">
          <input type="checkbox" checked={newNetwork.dhcp_enabled} onChange={handleCreateChange('dhcp_enabled')} />
          <span>Включить DHCP для этой сети</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Виртуальные сети"
          value={networks.length}
          subtitle="Доступные виртуальные сети"
          icon={NetworkIcon}
          color="text-emerald-400"
        />
        <StatCard
          title="DHCP"
          value={dhcpEnabledCount}
          subtitle="Сетей с включенным DHCP"
          icon={Wifi}
          color="text-blue-400"
        />
        <StatCard
          title="Маршрутизация"
          value={routedNetworksCount}
          subtitle="Маршрутизируемые сети"
          icon={Globe}
          color="text-purple-400"
        />
      </div>

      <StatusMessage message={error} />
      <LoadingState message={loading ? 'Загрузка сетей...' : ''} />

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Список сетей</h3>
        </div>

        {networks.length === 0 && !loading ? (
          <EmptyState
            icon={NetworkIcon}
            title="Сети не найдены"
            description="Создайте сеть, чтобы она появилась здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Имя</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Тип</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Подсеть</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Подключенные ВМ</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Статус</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((network) => (
                  <tr key={network.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="py-3 px-4 text-white">{network.name}</td>
                    <td className="py-3 px-4 text-dark-300">{getTypeLabel(network.type)}</td>
                    <td className="py-3 px-4 text-dark-300">{network.subnet}</td>
                    <td className="py-3 px-4 text-dark-300">{network.connected_vms}</td>
                    <td className="py-3 px-4 text-dark-300">{network.status === 'online' ? 'Онлайн' : 'Офлайн'}</td>
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

export default Network;