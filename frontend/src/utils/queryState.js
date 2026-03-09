const QUERY_INDICATOR_PRIORITY = {
  diskSearch: 10,
  filterSearch: 10,
  filterPoolSearch: 20,
  vm: 30,
  backupType: 40,
  filterPool: 40,
  pool: 50,
  filterUsage: 60,
  volume: 70,
  sortBy: 80,
  sortDir: 90,
  expanded: 100,
};

const QUERY_INDICATOR_PREFIX = {
  diskSearch: 'Поиск',
  filterSearch: 'Поиск',
  filterPoolSearch: 'Поиск пула',
  vm: 'ВМ',
  backupType: 'Тип',
  filterPool: 'Пул',
  pool: 'Пул',
  filterUsage: 'Состояние',
  volume: 'Том',
  sortBy: 'Сортировка',
  sortDir: 'Порядок',
  expanded: 'Раскрыто',
};

export const createQueryStateIndicator = (id, value, options = {}) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const prefix = options.prefix || QUERY_INDICATOR_PREFIX[id] || id;
  const valueLabel = options.valueLabel ?? String(value);

  return {
    id,
    label: `${prefix}: ${valueLabel}`,
  };
};

export const removeQueryStateValueWhenEmpty = (key, value) => !value;

export const removeQueryStateValueWhenDefault = (defaultValue) => (key, value) => !value || value === defaultValue;

export const createQueryStateConfigEntry = ({
  apply,
  applyUpdates,
  applyRemoveWhen,
  getApplyUpdates,
  reset,
  resetKeys = [],
} = {}) => ({
  apply,
  applyUpdates,
  applyRemoveWhen,
  getApplyUpdates,
  reset,
  resetKeys,
});

export const createQueryStateValueConfig = ({
  queryKey,
  value,
  apply,
  removeWhen = removeQueryStateValueWhenEmpty,
  reset,
  resetKeys = [queryKey],
}) => createQueryStateConfigEntry({
  apply,
  applyRemoveWhen: removeWhen,
  getApplyUpdates: () => ({
    [queryKey]: value,
  }),
  reset,
  resetKeys,
});

export const createDraftQueryStateValueConfig = ({
  queryKey,
  value,
  applyValue = value,
  setApplied,
  setDraft,
  resetValue = '',
  removeWhen = removeQueryStateValueWhenEmpty,
}) => createQueryStateValueConfig({
  queryKey,
  value,
  apply: () => {
    setApplied(applyValue);
  },
  removeWhen,
  reset: () => {
    setApplied(resetValue);
    setDraft(resetValue);
  },
  resetKeys: [queryKey],
});

export const createQueryStateUpdatesConfig = ({
  apply,
  removeWhen = removeQueryStateValueWhenEmpty,
  reset,
  resetKeys = [],
  updates,
}) => createQueryStateConfigEntry({
  apply,
  applyRemoveWhen: removeWhen,
  applyUpdates: updates,
  reset,
  resetKeys,
});

export const createQueryStateResetConfig = ({
  reset,
  resetKeys = [],
}) => createQueryStateConfigEntry({
  reset,
  resetKeys,
});

export const commitSingleQueryStateValue = (commitQueryState, entryId, {
  queryKey = entryId,
  value,
  apply,
  removeWhen = removeQueryStateValueWhenEmpty,
  reset,
  resetKeys = [queryKey],
}) => commitQueryState({
  [entryId]: createQueryStateValueConfig({
    queryKey,
    value,
    apply,
    removeWhen,
    reset,
    resetKeys,
  }),
}, [entryId]);

export const commitSingleQueryStateUpdates = (commitQueryState, entryId, {
  apply,
  removeWhen = removeQueryStateValueWhenEmpty,
  reset,
  resetKeys = [],
  updates,
}) => commitQueryState({
  [entryId]: createQueryStateUpdatesConfig({
    apply,
    removeWhen,
    reset,
    resetKeys,
    updates,
  }),
}, [entryId]);

export const buildQueryStateIndicators = (items) => (
  items
    .filter((item) => item && item.id && item.label)
    .sort((left, right) => {
      const leftPriority = QUERY_INDICATOR_PRIORITY[left.id] ?? 500;
      const rightPriority = QUERY_INDICATOR_PRIORITY[right.id] ?? 500;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.label.localeCompare(right.label, 'ru');
    })
    .map(({ id, label }) => ({ id, label }))
);

export const buildQueryStatePreview = (indicators) => {
  if (!indicators.length) {
    return 'без дополнительных параметров';
  }

  const preview = indicators
    .slice(0, 3)
    .map((item) => item.label)
    .join(', ');

  return indicators.length > 3 ? `${preview} и ещё ${indicators.length - 3}` : preview;
};

export default buildQueryStatePreview;