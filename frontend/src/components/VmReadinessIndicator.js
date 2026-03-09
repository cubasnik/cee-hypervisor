import React from 'react';

const getReadinessTone = (vm) => {
  if (!vm) {
    return {
      container: 'border-dark-700 bg-dark-900/60 text-dark-200',
      badge: 'border-dark-600 bg-dark-800/80 text-dark-200',
      label: 'Не выбрана',
      title: 'Готовность ВМ',
      reason: 'Выберите ВМ, чтобы увидеть её рабочее состояние.',
    };
  }

  const normalizedStatus = (vm.status || '').toString().toLowerCase();
  const hasDiskInfo = Boolean(vm.disk_path || vm.storage_volume || vm.storage_pool);

  if (normalizedStatus === 'running') {
    if (hasDiskInfo) {
      return {
        container: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
        badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100',
        label: 'Готова',
        title: 'Готовность ВМ',
        reason: `ВМ запущена и использует ${vm.storage_pool || 'системный путь хранения'}.`,
      };
    }

    return {
      container: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
      badge: 'border-amber-500/30 bg-amber-500/15 text-amber-100',
      label: 'Требует проверки',
      title: 'Готовность ВМ',
      reason: 'ВМ запущена, но её диск или путь хранения не удалось определить.',
    };
  }

  if (normalizedStatus === 'paused' || normalizedStatus === 'приостановлена') {
    return {
      container: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
      badge: 'border-amber-500/30 bg-amber-500/15 text-amber-100',
      label: 'Приостановлена',
      title: 'Готовность ВМ',
      reason: 'Перед использованием ВМ нужно вернуть в рабочее состояние.',
    };
  }

  if (normalizedStatus === 'stopped' || normalizedStatus === 'остановлена') {
    return {
      container: 'border-dark-700 bg-dark-900/60 text-dark-200',
      badge: 'border-dark-600 bg-dark-800/80 text-dark-200',
      label: 'Остановлена',
      title: 'Готовность ВМ',
      reason: 'Для работы или backup в online-режиме ВМ нужно запустить.',
    };
  }

  return {
    container: 'border-dark-700 bg-dark-900/60 text-dark-200',
    badge: 'border-dark-600 bg-dark-800/80 text-dark-200',
    label: 'Неизвестно',
    title: 'Готовность ВМ',
    reason: 'Состояние ВМ не удалось определить.',
  };
};

const VmReadinessIndicator = ({ vm, compact = false, showReason = true, className = '' }) => {
  const tone = getReadinessTone(vm);

  if (compact) {
    return (
      <div className={`rounded-lg border px-3 py-2 text-xs ${tone.container} ${className}`.trim()}>
        <div className="flex items-center justify-between gap-2">
          <span className="uppercase tracking-wide opacity-80">{tone.title}</span>
          <span className={`rounded-full border px-2 py-0.5 font-medium ${tone.badge}`}>
            {tone.label}
          </span>
        </div>
        {showReason ? <div className="mt-1 leading-5 opacity-80">{tone.reason}</div> : null}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone.container} ${className}`.trim()}>
      <div className="font-medium text-white/95">{tone.title}</div>
      <div className="mt-1">{tone.label}</div>
      {showReason ? <div className="mt-1 text-xs opacity-80">{tone.reason}</div> : null}
    </div>
  );
};

export default VmReadinessIndicator;