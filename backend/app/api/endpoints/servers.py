import os

import libvirt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ServerItem(BaseModel):
  id: str
  name: str
  hostname: str
  status: str
  cpu_cores: int
  memory_total: int
  cluster: str | None = None


def _get_libvirt_conn() -> libvirt.virConnect:  # type: ignore[name-defined]
  uri = os.getenv("LIBVIRT_URI", "qemu:///system")
  try:
    conn = libvirt.open(uri)  # type: ignore[no-untyped-call]
    if conn is None:
      raise HTTPException(status_code=500, detail="Не удалось подключиться к libvirt")
    return conn
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка подключения к libvirt: {exc}")


@router.get("/servers", response_model=list[ServerItem])
async def list_servers() -> list[ServerItem]:
  conn = _get_libvirt_conn()

  try:
    info = conn.getInfo()  # type: ignore[no-untyped-call]
    hostname = conn.getHostname()  # type: ignore[no-untyped-call]
    libvirt_uri = conn.getURI()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка получения данных сервера: {exc}")

  memory_total = int(info[1]) if len(info) > 1 else 0
  cpu_cores = int(info[2]) if len(info) > 2 else 0
  name = hostname.split(".")[0] if hostname else "local-host"

  return [
    ServerItem(
      id=name,
      name=name,
      hostname=hostname or libvirt_uri,
      status="online",
      cpu_cores=cpu_cores,
      memory_total=memory_total,
      cluster="local",
    )
  ]


@router.get("/servers/{server_id}", response_model=ServerItem)
async def get_server(server_id: str) -> ServerItem:
  servers = await list_servers()
  for server in servers:
    if server.id == server_id:
      return server
  raise HTTPException(status_code=404, detail=f"Сервер '{server_id}' не найден")
