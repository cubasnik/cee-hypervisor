import React, { useState } from 'react';
import { Camera, RotateCw, Trash2, Plus } from 'lucide-react';
import ActionButton from '../components/ActionButton';
import AppToast from '../components/AppToast';
import EmptyState from '../components/EmptyState';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import { useTimedMessage } from '../hooks/useTimedMessage';

const Snapshots = () => {
  const [snapshots] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    showUpdateMessage('Обновление выполнено');
    setTimeout(() => setIsRefreshing(false), 400);
  };

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      <PageActions>
        <RefreshButton onClick={handleRefresh} loading={isRefreshing} />
        <ActionButton icon={Plus} label="Создать снимок" disabled />
      </PageActions>

      <div className="card">
        {snapshots.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Снимки не найдены"
            description="Создайте ВМ и выполните снимок, чтобы он появился здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Имя</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">ВМ</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Дата создания</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Размер</th>
                  <th className="text-left py-3 px-4 font-medium text-dark-300">Действия</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="py-3 px-4 text-white">{snapshot.name}</td>
                    <td className="py-3 px-4 text-dark-300">{snapshot.vm}</td>
                    <td className="py-3 px-4 text-dark-300">{snapshot.created}</td>
                    <td className="py-3 px-4 text-dark-300">{snapshot.size}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button className="p-1 text-blue-400 hover:text-blue-300 transition-colors" title="Восстановить">
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

export default Snapshots;