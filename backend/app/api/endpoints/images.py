
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from fastapi.responses import FileResponse
import os
import shutil
import tempfile
from pathlib import PureWindowsPath
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname
import requests
from app.core.images import list_local_iso_images

router = APIRouter()
ALLOWED_IMAGE_EXTENSIONS = {'.iso', '.qcow2', '.img', '.vmdk', '.vdi'}
_BACKEND_ROOT_CACHE: str | None = None
_PROJECT_IMAGES_DIR_CACHE: str | None = None
_LEGACY_MIGRATION_DONE = False


def _get_image_filename(source: str) -> str:
    parsed = urlparse(source)

    if parsed.scheme in {"http", "https", "file"}:
        candidate = os.path.basename(unquote(url2pathname(parsed.path)))
    elif ":\\" in source or source.startswith("\\\\"):
        candidate = PureWindowsPath(source).name
    else:
        candidate = os.path.basename(source)

    return candidate.strip()


def _normalize_windows_path_for_host(path: str) -> str:
    windows_path = path.replace('\\', '/').strip()

    if os.name == 'nt':
        return os.path.abspath(str(PureWindowsPath(path)))

    if len(windows_path) >= 3 and windows_path[1] == ':' and windows_path[2] == '/':
        drive_letter = windows_path[0].lower()
        remainder = windows_path[3:]
        return os.path.abspath(f"/mnt/{drive_letter}/{remainder}")

    return os.path.abspath(windows_path)


def _normalize_host_path(path: str) -> str:
    normalized_path = path.strip()

    if not normalized_path:
        return os.path.abspath(normalized_path)

    if (
        normalized_path.startswith("\\\\")
        or (len(normalized_path) >= 3 and normalized_path[1] == ':' and normalized_path[2] in {'\\', '/'})
    ):
        return _normalize_windows_path_for_host(normalized_path)

    return os.path.abspath(normalized_path)


def _get_backend_root() -> str:
    global _BACKEND_ROOT_CACHE

    if _BACKEND_ROOT_CACHE is None:
        normalized_file_path = _normalize_host_path(__file__)
        _BACKEND_ROOT_CACHE = os.path.abspath(os.path.join(os.path.dirname(normalized_file_path), "..", "..", ".."))

    return _BACKEND_ROOT_CACHE


def _migrate_legacy_image_dirs(destination_dir: str, backend_root: str) -> None:
    global _LEGACY_MIGRATION_DONE

    if _LEGACY_MIGRATION_DONE:
        return

    legacy_candidates = [
        os.path.join(backend_root, "app", "Images"),
    ]

    normalized_backend_root = os.path.normpath(backend_root)
    backend_parts = normalized_backend_root.split(os.sep)
    if len(backend_parts) >= 5 and backend_parts[1] == 'mnt':
        drive_letter = backend_parts[2].upper()
        windows_tail = backend_parts[3:]
        for child_name in os.listdir(backend_root):
            if not child_name or child_name[0].upper() != drive_letter:
                continue

            candidate = os.path.join(backend_root, child_name, *windows_tail, 'Images')
            if candidate not in legacy_candidates:
                legacy_candidates.append(candidate)

    for legacy_path in legacy_candidates:
        if not os.path.isdir(legacy_path) or os.path.abspath(legacy_path) == os.path.abspath(destination_dir):
            continue

        for filename in os.listdir(legacy_path):
            source_path = os.path.join(legacy_path, filename)
            target_path = os.path.join(destination_dir, filename)
            if os.path.isfile(source_path) and not os.path.exists(target_path):
                shutil.move(source_path, target_path)

    _LEGACY_MIGRATION_DONE = True


def _resolve_local_source_path(source: str) -> str | None:
    parsed = urlparse(source)

    if parsed.scheme == "file":
        file_path = unquote(url2pathname(parsed.path))
        if len(file_path) >= 3 and file_path[0] == '/' and file_path[2] == ':':
            file_path = file_path[1:]
        return _normalize_windows_path_for_host(file_path)

    if parsed.scheme in {"http", "https"}:
        return None

    if ":\\" in source or source.startswith("\\\\"):
        return _normalize_windows_path_for_host(source)

    normalized = os.path.abspath(source)
    if os.path.exists(normalized):
        return normalized

    return None


def _copy_image_to_project(source_path: str, destination_dir: str) -> str:
    filename = os.path.basename(source_path)
    destination_path = os.path.join(destination_dir, filename)

    if os.path.abspath(source_path) == os.path.abspath(destination_path):
        raise HTTPException(status_code=400, detail="Файл уже находится в папке проекта")

    with tempfile.NamedTemporaryFile(delete=False, dir=destination_dir, suffix='.part') as temp_file:
        temp_path = temp_file.name

    try:
        shutil.copy2(source_path, temp_path)
        os.replace(temp_path, destination_path)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    return filename

# Папка с общими образами (только просмотр)
def get_common_images_dir():
    return _normalize_host_path("C:/Users/Alexey/Desktop/min/vNE/Images")

# Папка с загруженными в проект образами (загрузка/удаление/скачивание)
def get_project_images_dir():
    global _PROJECT_IMAGES_DIR_CACHE

    if _PROJECT_IMAGES_DIR_CACHE and os.path.exists(_PROJECT_IMAGES_DIR_CACHE):
        return _PROJECT_IMAGES_DIR_CACHE

    configured_path = os.getenv("PROJECT_IMAGES_PATH")
    if configured_path:
        path = _normalize_host_path(configured_path)
    else:
        backend_dir = _get_backend_root()
        path = os.path.join(backend_dir, "Images")

    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

    _migrate_legacy_image_dirs(path, _get_backend_root())
    _PROJECT_IMAGES_DIR_CACHE = path

    return path

# Список доступных ISO из общей папки
@router.get("/common")
async def list_common_images() -> list[dict]:
    images_dir = get_common_images_dir()
    return list_local_iso_images(images_dir)

# Список загруженных в проект ISO
@router.get("/")
async def list_project_images() -> list[dict]:
    images_dir = get_project_images_dir()
    return list_local_iso_images(images_dir)

# Загрузка ISO/QCOW2/IMG-файла в папку backend/Images
@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Недопустимый тип файла")
    images_dir = get_project_images_dir()
    dest_path = os.path.join(images_dir, filename)
    with tempfile.NamedTemporaryFile(delete=False, dir=images_dir, suffix='.part') as temp_file:
        temp_path = temp_file.name

    try:
        with open(temp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)
        os.replace(temp_path, dest_path)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    return {"filename": filename, "status": "uploaded"}

# Загрузка ISO по URL или локальному пути в папку backend/Images
@router.post("/upload-url")
async def upload_image_by_url(url: str = Body(..., embed=True)):
    source = url.strip()
    if not source:
        raise HTTPException(status_code=400, detail="Укажите URL или локальный путь к файлу")

    filename = _get_image_filename(source)
    if not filename:
        raise HTTPException(status_code=400, detail="Укажите путь к файлу образа, а не к папке")

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Недопустимый тип файла")

    images_dir = get_project_images_dir()
    dest_path = os.path.join(images_dir, filename)
    local_source_path = _resolve_local_source_path(source)

    try:
        if local_source_path:
            if os.path.isdir(local_source_path):
                raise HTTPException(status_code=400, detail="Укажите полный путь к файлу образа, а не к папке")
            if not os.path.isfile(local_source_path):
                raise HTTPException(status_code=404, detail="Локальный файл не найден")

            _copy_image_to_project(local_source_path, images_dir)
        else:
            parsed = urlparse(source)
            if parsed.scheme not in {"http", "https"}:
                raise HTTPException(status_code=400, detail="Поддерживаются только http(s) URL, file:// URL или локальный путь к файлу")

            with tempfile.NamedTemporaryFile(delete=False, dir=images_dir, suffix='.part') as temp_file:
                temp_path = temp_file.name

            try:
                with requests.get(source, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    with open(temp_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024*1024):
                            if chunk:
                                f.write(chunk)
                os.replace(temp_path, dest_path)
            except Exception:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {e}")
    return {"filename": filename, "status": "uploaded"}


@router.post("/import-directory")
async def import_images_from_directory(path: str = Body(..., embed=True)):
    source = path.strip()
    if not source:
        raise HTTPException(status_code=400, detail="Укажите локальный путь к папке с образами")

    source_path = _resolve_local_source_path(source)
    if not source_path:
        raise HTTPException(status_code=400, detail="Поддерживаются только file:// URL или локальный путь к папке")
    if not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Папка не найдена")
    if not os.path.isdir(source_path):
        raise HTTPException(status_code=400, detail="Укажите путь к папке, а не к отдельному файлу")

    images_dir = get_project_images_dir()
    imported_files: list[str] = []
    skipped_existing: list[str] = []
    skipped_unsupported: list[str] = []

    for entry in sorted(os.listdir(source_path)):
        entry_path = os.path.join(source_path, entry)
        if not os.path.isfile(entry_path):
            continue

        extension = os.path.splitext(entry)[1].lower()
        if extension not in ALLOWED_IMAGE_EXTENSIONS:
            skipped_unsupported.append(entry)
            continue

        destination_path = os.path.join(images_dir, entry)
        if os.path.exists(destination_path):
            skipped_existing.append(entry)
            continue

        if os.path.abspath(entry_path) == os.path.abspath(destination_path):
            skipped_existing.append(entry)
            continue

        with tempfile.NamedTemporaryFile(delete=False, dir=images_dir, suffix='.part') as temp_file:
            temp_path = temp_file.name

        try:
            shutil.copy2(entry_path, temp_path)
            os.replace(temp_path, destination_path)
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise

        imported_files.append(entry)

    if not imported_files and not skipped_existing and not skipped_unsupported:
        raise HTTPException(status_code=400, detail="В папке нет файлов для импорта")

    return {
        "status": "imported",
        "source_path": source_path,
        "imported_count": len(imported_files),
        "imported_files": imported_files,
        "skipped_existing_count": len(skipped_existing),
        "skipped_existing": skipped_existing,
        "skipped_unsupported_count": len(skipped_unsupported),
        "skipped_unsupported": skipped_unsupported,
    }

# Скачивание файла-образа из backend/Images
@router.get("/download")
async def download_image(name: str):
    images_dir = get_project_images_dir()
    file_path = os.path.join(images_dir, name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(file_path, filename=name, media_type="application/octet-stream")

# Удаление файла-образа из backend/Images
@router.delete("/{name}")
async def delete_image(name: str):
    images_dir = get_project_images_dir()
    file_path = os.path.join(images_dir, name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    try:
        os.remove(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка удаления файла: {e}")
    return {"filename": name, "status": "deleted"}
