import os

import libvirt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter()


class StorageVolumeItem(BaseModel):
  id: str
  name: str
  size_bytes: int
  status: str
  pool: str


class StorageOverview(BaseModel):
  pools_count: int
  volumes_count: int
  backups_status: str


class StorageResponse(BaseModel):
  overview: StorageOverview
  pools: list[str]
  volumes: list[StorageVolumeItem]


class StorageVolumeCreate(BaseModel):
  pool: str
  name: str
  size_gb: int


def _get_libvirt_conn() -> libvirt.virConnect:  # type: ignore[name-defined]
  uri = os.getenv("LIBVIRT_URI", "qemu:///system")
  try:
    conn = libvirt.open(uri)  # type: ignore[no-untyped-call]
    if conn is None:
      raise HTTPException(status_code=500, detail="Не удалось подключиться к libvirt")
    return conn
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка подключения к libvirt: {exc}")


@router.get("/storage", response_model=StorageResponse)
async def get_storage() -> StorageResponse:
  conn = _get_libvirt_conn()

  try:
    pools = conn.listAllStoragePools()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка получения хранилищ: {exc}")

  volumes: list[StorageVolumeItem] = []
  for pool in pools:
    try:
      pool_name = pool.name()  # type: ignore[no-untyped-call]
      for volume_name in pool.listVolumes():  # type: ignore[no-untyped-call]
        try:
          volume = pool.storageVolLookupByName(volume_name)  # type: ignore[no-untyped-call]
          info = volume.info()  # type: ignore[no-untyped-call]
          size_bytes = int(info[1]) if len(info) > 1 else 0
        except libvirt.libvirtError:
          size_bytes = 0

        volumes.append(
          StorageVolumeItem(
            id=f"{pool_name}:{volume_name}",
            name=volume_name,
            size_bytes=size_bytes,
            status="Доступен",
            pool=pool_name,
          )
        )
    except libvirt.libvirtError:
      continue

  overview = StorageOverview(
    pools_count=len(pools),
    volumes_count=len(volumes),
    backups_status="Недоступно",
  )
  return StorageResponse(overview=overview, pools=[pool.name() for pool in pools], volumes=volumes)


@router.post("/storage/volumes", response_model=StorageVolumeItem)
async def create_storage_volume(payload: StorageVolumeCreate) -> StorageVolumeItem:
  if payload.size_gb <= 0:
    raise HTTPException(status_code=400, detail="Размер тома должен быть больше нуля")

  conn = _get_libvirt_conn()

  try:
    pool = conn.storagePoolLookupByName(payload.pool)  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=404, detail=f"Пул хранения не найден: {exc}")

  capacity_bytes = payload.size_gb * 1024 * 1024 * 1024
  volume_xml = f"""
  <volume>
    <name>{payload.name}</name>
    <capacity unit='bytes'>{capacity_bytes}</capacity>
    <allocation unit='bytes'>0</allocation>
    <target>
      <format type='qcow2'/>
    </target>
  </volume>
  """.strip()

  try:
    volume = pool.createXML(volume_xml, 0)  # type: ignore[no-untyped-call]
    info = volume.info()  # type: ignore[no-untyped-call]
    size_bytes = int(info[1]) if len(info) > 1 else capacity_bytes
    pool.refresh(0)  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка создания тома: {exc}")

  return StorageVolumeItem(
    id=f"{payload.pool}:{payload.name}",
    name=payload.name,
    size_bytes=size_bytes,
    status="Доступен",
    pool=payload.pool,
  )