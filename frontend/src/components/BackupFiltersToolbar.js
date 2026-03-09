import React from 'react';
import QueryStateActions from './QueryStateActions';

const BackupFiltersToolbar = ({
  searchValue,
  onSearchChange,
  typeFilters,
  activeType,
  onTypeChange,
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
  visibleCount,
  expandedCount,
  allExpanded,
  onToggleExpandAll,
  activeIndicators = [],
  onResetAll,
  onCopyLink,
  onRemoveIndicator,
}) => {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex-1 max-w-4xl space-y-3">
        <input
          className="input w-full"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Локальный поиск по дискам: vda, qcow2, backup path..."
        />
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((filter) => (
            <button
              key={filter.id}
              className={activeType === filter.id ? 'btn-primary page-toolbar-button' : 'btn page-toolbar-button'}
              onClick={() => onTypeChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap items-center gap-2 text-sm text-dark-300">
          <span>Показано: {visibleCount}</span>
          <span>Раскрыто: {expandedCount}</span>
          <button className="btn page-toolbar-button" onClick={onToggleExpandAll}>
            {allExpanded ? 'Свернуть все' : 'Раскрыть все'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input" value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
            <option value="date">Сортировка: дата</option>
            <option value="size">Сортировка: размер</option>
            <option value="type">Сортировка: тип</option>
          </select>
          <button className="btn page-toolbar-button" onClick={onSortDirectionChange}>
            {sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
          </button>
        </div>
        <QueryStateActions
          activeIndicators={activeIndicators}
          onCopyLink={onCopyLink}
          onResetAll={onResetAll}
          onRemoveIndicator={onRemoveIndicator}
        />
      </div>
    </div>
  );
};

export default BackupFiltersToolbar;