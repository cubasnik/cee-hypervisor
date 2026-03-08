import os
from typing import List

def list_local_iso_images(images_dir: str) -> List[dict]:
    """Возвращает список поддерживаемых образов из указанной директории."""
    import logging
    logging.info(f"[IMAGES] Сканируется папка: {images_dir}")
    allowed_ext = {'.iso', '.qcow2', '.img', '.vmdk', '.vdi'}
    if not os.path.exists(images_dir):
        logging.warning(f"[IMAGES] Папка не найдена: {images_dir}")
        return []
    files = []
    for fname in os.listdir(images_dir):
        ext = os.path.splitext(fname)[1].lower()
        if ext in allowed_ext:
            fpath = os.path.join(images_dir, fname)
            size = os.path.getsize(fpath)
            files.append({
                'name': fname,
                'path': os.path.abspath(fpath),
                'type': ext[1:],  # без точки
                'size': size
            })
    return files
