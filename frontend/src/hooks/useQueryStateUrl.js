import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buildQueryStatePreview } from '../utils/queryState';

export const useQueryStateUrl = ({ onCopySuccess, onCopyError } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const applyQueryIndicatorConfig = useCallback((indicatorIds, config = {}) => {
    const ids = Array.isArray(indicatorIds)
      ? indicatorIds
      : [indicatorIds];
    const indicatorConfigs = ids
      .map((indicatorId) => config[indicatorId])
      .filter(Boolean);

    if (indicatorConfigs.length === 0) {
      return false;
    }

    indicatorConfigs.forEach((indicatorConfig) => {
      indicatorConfig.reset?.();
    });

    const nextParams = new URLSearchParams(searchParams);
    let hasParamChanges = false;

    indicatorConfigs.forEach((indicatorConfig) => {
      if (Array.isArray(indicatorConfig.resetKeys) && indicatorConfig.resetKeys.length > 0) {
        indicatorConfig.resetKeys.forEach((key) => nextParams.delete(key));
        hasParamChanges = true;
      }

      if (indicatorConfig.updates && Object.keys(indicatorConfig.updates).length > 0) {
        Object.entries(indicatorConfig.updates).forEach(([key, value]) => {
          const shouldRemove = typeof indicatorConfig.removeWhen === 'function'
            ? indicatorConfig.removeWhen(key, value)
            : true;

          if (shouldRemove) {
            nextParams.delete(key);
          } else {
            nextParams.set(key, value);
          }

          hasParamChanges = true;
        });
      }
    });

    if (hasParamChanges) {
      setSearchParams(nextParams);
    }

    return true;
  }, [searchParams, setSearchParams]);

  const updateQueryParams = useCallback((updates, options = {}) => {
    const { removeWhen } = options;
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      const shouldRemove = typeof removeWhen === 'function'
        ? removeWhen(key, value)
        : !value;

      if (shouldRemove) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const resetQueryParams = useCallback((keys) => {
    const nextParams = new URLSearchParams(searchParams);
    keys.forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const removeQueryIndicator = useCallback((indicatorId, config = {}) => {
    return applyQueryIndicatorConfig(indicatorId, config);
  }, [applyQueryIndicatorConfig]);

  const resetAllQueryIndicators = useCallback((config = {}) => {
    return applyQueryIndicatorConfig(Object.keys(config), config);
  }, [applyQueryIndicatorConfig]);

  const commitQueryState = useCallback((config = {}, entryIds = Object.keys(config)) => {
    const ids = Array.isArray(entryIds)
      ? entryIds
      : [entryIds];
    const stateConfigs = ids
      .map((entryId) => config[entryId])
      .filter(Boolean);

    if (stateConfigs.length === 0) {
      return false;
    }

    stateConfigs.forEach((stateConfig) => {
      stateConfig.apply?.();
    });

    const nextParams = new URLSearchParams(searchParams);
    let hasParamChanges = false;

    stateConfigs.forEach((stateConfig) => {
      const updates = typeof stateConfig.getApplyUpdates === 'function'
        ? stateConfig.getApplyUpdates()
        : stateConfig.applyUpdates;

      if (!updates || Object.keys(updates).length === 0) {
        return;
      }

      Object.entries(updates).forEach(([key, value]) => {
        const shouldRemove = typeof stateConfig.applyRemoveWhen === 'function'
          ? stateConfig.applyRemoveWhen(key, value)
          : !value;

        if (shouldRemove) {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }

        hasParamChanges = true;
      });
    });

    if (hasParamChanges) {
      setSearchParams(nextParams);
    }

    return true;
  }, [searchParams, setSearchParams]);

  const copyCurrentLink = useCallback(async (activeIndicators = []) => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onCopySuccess?.(`Ссылка скопирована: ${buildQueryStatePreview(activeIndicators)}`);
    } catch (error) {
      onCopyError?.(error);
    }
  }, [onCopyError, onCopySuccess]);

  return {
    searchParams,
    setSearchParams,
    updateQueryParams,
    resetQueryParams,
    removeQueryIndicator,
    resetAllQueryIndicators,
    commitQueryState,
    copyCurrentLink,
  };
};

export default useQueryStateUrl;