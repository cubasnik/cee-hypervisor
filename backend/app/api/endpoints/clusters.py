import os

import libvirt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ClusterItem(BaseModel):
  id: str
  name: str
  type: str
  status: str
  cpu_cores: int
  memory: int
  hosts: int


def _get_libvirt_conn() -> libvirt.virConnect:  # type: ignore[name-defined]
  uri = os.getenv("LIBVIRT_URI", "qemu:///system")
  try:
    conn = libvirt.open(uri)  # type: ignore[no-untyped-call]
    if conn is None:
      raise HTTPException(status_code=500, detail="Не удалось подключиться к libvirt")
    return conn
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка подключения к libvirt: {exc}")


@router.get("/clusters", response_model=list[ClusterItem])
async def list_clusters() -> list[ClusterItem]:
  conn = _get_libvirt_conn()

  try:
    info = conn.getInfo()  # type: ignore[no-untyped-call]
    hostname = conn.getHostname()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка получения данных кластера: {exc}")

  cluster_name = f"{(hostname or 'local').split('.')[0]}-cluster"
  cpu_cores = int(info[2]) if len(info) > 2 else 0
  memory = int(info[1]) if len(info) > 1 else 0

  return [
    ClusterItem(
      id=cluster_name,
      name=cluster_name,
      type="libvirt",
      status="online",
      cpu_cores=cpu_cores,
      memory=memory,
      hosts=1,
    )
  ]


@router.get("/clusters/{cluster_id}", response_model=ClusterItem)
async def get_cluster(cluster_id: str) -> ClusterItem:
  clusters = await list_clusters()
  for cluster in clusters:
    if cluster.id == cluster_id:
      return cluster
  raise HTTPException(status_code=404, detail=f"Кластер '{cluster_id}' не найден")
