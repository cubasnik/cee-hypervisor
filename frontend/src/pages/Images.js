
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Link as LinkIcon, Download, Trash2, RefreshCw, FolderOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import AppDialog from '../components/AppDialog';
import AppToast from '../components/AppToast';
import EmptyState from '../components/EmptyState';
import PageActions from '../components/PageActions';
import RefreshButton from '../components/RefreshButton';
import { useDialog } from '../hooks/useDialog';
import { useTimedMessage } from '../hooks/useTimedMessage';

const IMAGES_CACHE_KEY = 'cee.images.cache';
const IMAGES_CACHE_TTL_MS = 30000;

// Форматирование размера файла (байты → МБ/ГБ)
function formatSize(size) {
  if (size === undefined) return '';
  if (size > 1024 * 1024 * 1024) return (size / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
  if (size > 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' МБ';
  if (size > 1024) return (size / 1024).toFixed(2) + ' КБ';
  return size + ' Б';
}

function getImageType(name) {
  const parts = (name || '').split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function buildImageEntry(name, size) {
  return {
    id: name,
    name,
    size,
    type: getImageType(name),
  };
}

function mergeImages(currentImages, nextImages) {
  const map = new Map();

  [...currentImages, ...nextImages].forEach((image) => {
    if (!image?.name) {
      return;
    }

    const previous = map.get(image.name) || {};
    map.set(image.name, {
      ...previous,
      ...image,
      id: image.id || previous.id || image.name,
      name: image.name,
      type: image.type || previous.type || getImageType(image.name),
      size: image.size ?? previous.size,
    });
  });

  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function ImportResultSection({ title, count, items, tone }) {
  const toneStyles = {
    success: 'border-green-500/30 bg-green-500/10 text-green-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    muted: 'border-dark-700 bg-dark-900/70 text-dark-200',
  };

  return (
    <section className={`rounded-xl border p-4 ${toneStyles[tone] || toneStyles.muted}`}>
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-dark-100">
          {count}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto pr-1 text-sm text-dark-100">
          {items.map((item) => (
            <li key={`${title}-${item}`} className="break-all rounded-lg bg-black/10 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-dark-300">Нет файлов в этой категории.</p>
      )}
    </section>
  );
}

const Images = () => {
  const location = useLocation();
  const [images, setImages] = useState(() => {
    try {
      const cachedValue = sessionStorage.getItem(IMAGES_CACHE_KEY);
      const parsed = cachedValue ? JSON.parse(cachedValue) : null;
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  });
  const [urlInput, setUrlInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeUpload, setActiveUpload] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [urlAttempted, setUrlAttempted] = useState(false);
  const [folderAttempted, setFolderAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    url: false,
    folder: false,
  });
  const [progress, setProgress] = useState(0); // 0-100
  const fetchRequestRef = useRef(0);
  const { dialog, openDialog, closeDialog } = useDialog();
  const { message: updateMsg, showMessage: showUpdateMessage } = useTimedMessage();
  const allowedExtensions = ['.iso', '.qcow2', '.img', '.vmdk', '.vdi'];
  const trimmedUrl = urlInput.trim();
  const trimmedFolder = folderInput.trim();
  const lowerTrimmedUrl = trimmedUrl.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((ext) => lowerTrimmedUrl.endsWith(ext));
  const isHttpUrl = /^https?:\/\//i.test(trimmedUrl);
  const isFileUrl = /^file:\/\//i.test(trimmedUrl);
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(trimmedUrl) || /^\\\\/.test(trimmedUrl);
  const urlError = !trimmedUrl
    ? 'Укажите http(s) ссылку или локальный путь к файлу образа.'
    : !hasAllowedExtension
      ? 'Нужно указать путь именно к файлу ISO, QCOW2, IMG, VMDK или VDI.'
      : !(isHttpUrl || isFileUrl || isWindowsPath)
        ? 'Поддерживаются http(s), file:// и локальные пути Windows к файлу.'
        : '';
  const isUrlInvalid = Boolean((urlAttempted || touchedFields.url) && urlError);
  const isFolderFileUrl = /^file:\/\//i.test(trimmedFolder);
  const isFolderWindowsPath = /^[a-zA-Z]:[\\/]/.test(trimmedFolder) || /^\\\\/.test(trimmedFolder);
  const lowerTrimmedFolder = trimmedFolder.toLowerCase();
  const folderLooksLikeFile = allowedExtensions.some((ext) => lowerTrimmedFolder.endsWith(ext));
  const folderError = !trimmedFolder
    ? 'Укажите локальный путь к папке с образами.'
    : /^https?:\/\//i.test(trimmedFolder)
      ? 'Для массового импорта укажите локальную папку, а не http(s) URL.'
      : folderLooksLikeFile
        ? 'Для массового импорта укажите путь к папке, а не к одному файлу.'
        : !(isFolderFileUrl || isFolderWindowsPath)
          ? 'Поддерживаются file:// и локальные пути Windows к папке.'
          : '';
  const isFolderInvalid = Boolean((folderAttempted || touchedFields.folder) && folderError);

  const buildImportSummaryContent = (result) => (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-dark-700 bg-dark-900/70 p-4">
        <p className="text-xs uppercase tracking-wide text-dark-400">Источник</p>
        <p className="mt-2 break-all text-sm text-white">{result.source_path}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ImportResultSection
          title="Импортировано"
          count={result.imported_count}
          items={result.imported_files || []}
          tone="success"
        />
        <ImportResultSection
          title="Уже были в проекте"
          count={result.skipped_existing_count}
          items={result.skipped_existing || []}
          tone="warning"
        />
        <ImportResultSection
          title="Неподдерживаемые"
          count={result.skipped_unsupported_count}
          items={result.skipped_unsupported || []}
          tone="muted"
        />
      </div>
    </div>
  );

  const finishUploadState = useCallback(() => {
    setIsLoading(false);
    setActiveUpload(null);
    setTimeout(() => setProgress(0), 500);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(IMAGES_CACHE_KEY, JSON.stringify({
        items: images,
        savedAt: Date.now(),
      }));
    } catch {
      // Ignore cache write failures.
    }
  }, [images]);

  const fetchImages = useCallback(async ({ showMessage = true, silent = false } = {}) => {
    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;

    try {
      if (!silent) {
        setIsRefreshing(true);
      }
      const res = await apiService.getImages();
      if (fetchRequestRef.current !== requestId) {
        return;
      }
      setImages(res.data);
      if (showMessage) {
        showUpdateMessage('Обновление выполнено');
      }
    } catch (e) {
      if (fetchRequestRef.current !== requestId) {
        return;
      }
    } finally {
      if (!silent && fetchRequestRef.current === requestId) {
        setIsRefreshing(false);
      }
    }
  }, [showUpdateMessage]);

  useEffect(() => {
    if (location.pathname === '/images') {
      let shouldFetch = true;

      try {
        const cachedValue = sessionStorage.getItem(IMAGES_CACHE_KEY);
        const parsed = cachedValue ? JSON.parse(cachedValue) : null;
        const isFresh = Number.isFinite(parsed?.savedAt) && (Date.now() - parsed.savedAt) < IMAGES_CACHE_TTL_MS;
        if (isFresh && Array.isArray(parsed?.items) && parsed.items.length > 0) {
          shouldFetch = false;
        }
      } catch {
        shouldFetch = true;
      }

      if (shouldFetch) {
        fetchImages({ showMessage: false, silent: true });
      }
    }
  }, [fetchImages, location.pathname]);

  const markFieldTouched = (field) => {
    setTouchedFields((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setSelectedFileName('');
      setFileError('Выберите файл образа.');
      return;
    }

    const isAllowedFile = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isAllowedFile) {
      setSelectedFileName(file.name);
      setFileError('Поддерживаются только ISO, QCOW2, IMG, VMDK и VDI.');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setSelectedFileName(file.name);
    setFileError('');
    setIsLoading(true);
    setActiveUpload('file');
    setProgress(0);
    let didFinishUpload = false;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiService.uploadImage(formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        }
      });
      const uploadedName = response.data?.filename || file.name;
      setImages((currentImages) => mergeImages(currentImages, [buildImageEntry(uploadedName, file.size)]));
      setProgress(100);
      finishUploadState();
      didFinishUpload = true;
      setSelectedFileName('');
      fetchImages({ showMessage: false, silent: true });
    } catch (error) {
      openDialog({
        title: 'Не удалось загрузить файл',
        message: error.response?.data?.detail || 'Ошибка загрузки файла.',
        variant: 'danger',
      });
    } finally {
      if (!didFinishUpload) {
        finishUploadState();
      }
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleUrlUpload = async () => {
    setUrlAttempted(true);
    if (urlError) {
      return;
    }

    setIsLoading(true);
    setActiveUpload('url');
    setProgress(0);
    let didFinishUpload = false;
    const progressInterval = setInterval(() => {
      setProgress((current) => (current >= 90 ? 90 : current + 10));
    }, 250);

    try {
      const response = await apiService.uploadImageByURL(trimmedUrl);
      clearInterval(progressInterval);
      const uploadedName = response.data?.filename || trimmedUrl.split(/[\\/]/).pop();
      if (uploadedName) {
        setImages((currentImages) => mergeImages(currentImages, [buildImageEntry(uploadedName)]));
      }
      setProgress(100);
      finishUploadState();
      didFinishUpload = true;
      setUrlInput('');
      setUrlAttempted(false);
      setTouchedFields((prev) => ({
        ...prev,
        url: false,
      }));
      fetchImages({ showMessage: false, silent: true });
    } catch (error) {
      clearInterval(progressInterval);
      openDialog({
        title: 'Не удалось загрузить по URL',
        message: error.response?.data?.detail || 'Ошибка загрузки файла по URL.',
        variant: 'danger',
      });
    } finally {
      clearInterval(progressInterval);
      if (!didFinishUpload) {
        finishUploadState();
      }
    }
  };

  const handleDirectoryImport = async () => {
    setFolderAttempted(true);
    if (folderError) {
      return;
    }

    setIsLoading(true);
    setActiveUpload('folder');
    setProgress(0);
    let didFinishUpload = false;
    const progressInterval = setInterval(() => {
      setProgress((current) => (current >= 90 ? 90 : current + 10));
    }, 250);

    try {
      const response = await apiService.importImagesFromDirectory(trimmedFolder);
      clearInterval(progressInterval);
      const importedImages = (response.data?.imported_files || []).map((name) => buildImageEntry(name));
      if (importedImages.length > 0) {
        setImages((currentImages) => mergeImages(currentImages, importedImages));
      }
      setProgress(100);
      finishUploadState();
      didFinishUpload = true;
      setFolderInput('');
      setFolderAttempted(false);
      setTouchedFields((prev) => ({
        ...prev,
        folder: false,
      }));
      fetchImages({ showMessage: false, silent: true });
      openDialog({
        title: 'Импорт завершён',
        message: 'Результат импорта из выбранной папки.',
        content: buildImportSummaryContent(response.data),
        variant: 'success',
        panelClassName: 'max-w-4xl',
      });
    } catch (error) {
      clearInterval(progressInterval);
      openDialog({
        title: 'Не удалось импортировать папку',
        message: error.response?.data?.detail || 'Ошибка импорта образов из папки.',
        variant: 'danger',
      });
    } finally {
      clearInterval(progressInterval);
      if (!didFinishUpload) {
        finishUploadState();
      }
    }
  };

  const handleDeleteImage = async (id) => {
    if (!id) return;
    openDialog({
      title: 'Удалить образ',
      message: 'Образ будет удален из проекта. Это действие нельзя отменить.',
      variant: 'warning',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      onConfirm: async () => {
        try {
          await apiService.deleteImage(id);
          setImages((currentImages) => currentImages.filter((image) => image.name !== id));
          closeDialog();
          fetchImages({ showMessage: false, silent: true });
        } catch (e) {
          openDialog({
            title: 'Не удалось удалить образ',
            message: 'Ошибка удаления образа.',
            variant: 'danger',
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <AppToast message={updateMsg} />
      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="w-full flex items-center mb-2">
          <div className="flex-1 h-2 bg-dark-700 rounded overflow-hidden mr-2">
            <div
              className="h-full bg-green-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-white min-w-[32px] text-right" style={{width: 32}}>{progress}%</span>
        </div>
      )}
      <PageActions meta={`${images.length} образов`}>
        <RefreshButton onClick={() => fetchImages({ showMessage: true })} loading={isRefreshing} disabled={isLoading} />
      </PageActions>

      <AppDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        content={dialog.content}
        variant={dialog.variant}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        onConfirm={dialog.onConfirm}
        onClose={closeDialog}
        panelClassName={dialog.panelClassName}
        contentClassName={dialog.contentClassName}
      />

      {/* Upload Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* File Upload */}
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Загрузить файл</h3>
            <p className="text-dark-400 text-center mb-6">ISO, QCOW2, IMG</p>
            
            <label className={`btn-primary cursor-pointer ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              {activeUpload === 'file' ? 'Загрузка...' : 'Выбрать файл'}
              <input 
                type="file" 
                className="hidden" 
                accept=".iso,.qcow2,.img,.vmdk,.vdi"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </label>
            {selectedFileName && !fileError && (
              <p className="mt-3 text-sm text-dark-300 text-center break-all">{selectedFileName}</p>
            )}
            {fileError && (
              <p className="mt-3 text-xs text-red-400 text-center">{fileError}</p>
            )}
          </div>
        </div>

        {/* URL Upload */}
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center mb-4">
              <LinkIcon className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Загрузить по URL или пути</h3>
            <p className="text-dark-400 text-center mb-6">http(s), file:// или локальный путь Windows к файлу образа</p>
            
            <div className="w-full space-y-3">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={() => markFieldTouched('url')}
                placeholder="C:\\Images\\ubuntu.iso или https://example.com/ubuntu.iso"
                className={`input ${isUrlInvalid ? 'input-error' : ''}`}
              />
              {isUrlInvalid && (
                <p className="text-xs text-red-400">{urlError}</p>
              )}
              <button 
                onClick={handleUrlUpload}
                disabled={isLoading || Boolean(urlError)}
                className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {activeUpload === 'url' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Загрузить</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Импортировать все из папки</h3>
            <p className="text-dark-400 text-center mb-6">Скопировать все поддерживаемые образы из локального каталога в проект</p>

            <div className="w-full space-y-3">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onBlur={() => markFieldTouched('folder')}
                placeholder="C:\\Users\\Alexey\\Desktop\\min\\vNE\\Images"
                className={`input ${isFolderInvalid ? 'input-error' : ''}`}
              />
              {isFolderInvalid && (
                <p className="text-xs text-red-400">{folderError}</p>
              )}
              <button
                onClick={handleDirectoryImport}
                disabled={isLoading || Boolean(folderError)}
                className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {activeUpload === 'folder' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
                <span>Импортировать папку</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Images Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 font-medium text-dark-300">#</th>
                <th className="text-left py-3 px-4 font-medium text-dark-300">Имя файла</th>
                <th className="text-left py-3 px-4 font-medium text-dark-300">Размер</th>
                <th className="text-left py-3 px-4 font-medium text-dark-300">Тип</th>
                <th className="text-left py-3 px-4 font-medium text-dark-300">Действия</th>
              </tr>
            </thead>
            <tbody>
              {images.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <EmptyState
                      icon={Upload}
                      title="Образы не найдены"
                      description="Загрузите ISO-, QCOW2- или IMG-образ, чтобы увидеть его здесь."
                      className="py-4 text-center"
                    />
                  </td>
                </tr>
              ) : (
                images.map((image, index) => (
                  <tr key={image.id || (image.name + '-' + index)} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="py-3 px-4 text-dark-300">{index + 1}</td>
                    <td className="py-3 px-4 text-white">{image.name}</td>
                    <td className="py-3 px-4 text-dark-300">{formatSize(image.size)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-primary-600 text-white text-xs rounded">
                        {image.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      <a
                        href={"/api/images/download?name=" + encodeURIComponent(image.name)}
                        className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Скачать"
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button 
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        onClick={() => handleDeleteImage(image.name)}
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Images;