
import os
from typing import List, Literal, TypedDict
from typing_extensions import TypedDict

import libvirt

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# Модели и router должны быть определены до всех endpoint-ов!
class VMItem(BaseModel):
    id: str
    name: str
    status: str
    cpu_cores: int | None = None
    memory_mb: int | None = None
    disk_gb: int | None = None
    cluster_id: int | None = None

router = APIRouter()

# Pydantic-схема для создания ВМ
class VMCreate(BaseModel):
    name: str
    cpu_cores: int
    memory_mb: int
    disk_gb: int
    # Можно добавить другие поля по необходимости

# Endpoint для создания ВМ через libvirt
@router.post("/vms", response_model=VMItem)
async def create_vm(vm: VMCreate):
    """Создать новую ВМ через libvirt."""
    conn = _get_libvirt_conn()
    # Минимальный XML для ВМ (qemu/kvm)
    vm_xml = f'''
    <domain type='kvm'>
      <name>{vm.name}</name>
      <memory unit='MiB'>{vm.memory_mb}</memory>
      <vcpu>{vm.cpu_cores}</vcpu>
      <os>
        <type arch='x86_64'>hvm</type>
      </os>
      <devices>
        <emulator>/usr/bin/qemu-system-x86_64</emulator>
        <disk type='file' device='disk'>
          <driver name='qemu' type='qcow2'/>
          <source file='/var/lib/libvirt/images/{vm.name}.qcow2'/>
          <target dev='vda' bus='virtio'/>
        </disk>
        <interface type='network'>
          <source network='default'/>
        </interface>
        <graphics type='vnc' port='-1'/>
      </devices>
    </domain>
    '''
    try:
        # Создать диск для ВМ (qcow2)
        disk_path = f"/var/lib/libvirt/images/{vm.name}.qcow2"
        if not os.path.exists(disk_path):
            os.system(f"qemu-img create -f qcow2 {disk_path} {vm.disk_gb}G")
        # Создать ВМ
        dom = conn.defineXML(vm_xml)
        if dom is None:
            raise HTTPException(status_code=500, detail="Не удалось создать ВМ через libvirt")
        return VMItem(
            id=vm.name,
            name=vm.name,
            status=_vm_status_from_domain(dom),
            cpu_cores=vm.cpu_cores,
            memory_mb=vm.memory_mb,
            disk_gb=vm.disk_gb,
            cluster_id=None,
        )
    except libvirt.libvirtError as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка libvirt: {exc}")





def _get_libvirt_conn() -> libvirt.virConnect:  # type: ignore[name-defined]
    uri = os.getenv("LIBVIRT_URI", "qemu:///system")
    try:
        conn = libvirt.open(uri)  # type: ignore[no-untyped-call]
        if conn is None:
            raise HTTPException(status_code=500, detail="Не удалось подключиться к libvirt")
        return conn
    except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=f"Ошибка подключения к libvirt: {exc}")


def _vm_status_from_domain(dom: libvirt.virDomain) -> str:  # type: ignore[name-defined]
    try:
        # isActive() возвращает 1 если домен запущен
        return "running" if dom.isActive() == 1 else "stopped"  # type: ignore[no-untyped-call]
    except libvirt.libvirtError:  # type: ignore[attr-defined]
        return "unknown"


@router.get("/vms", response_model=list[VMItem])
async def list_vms() -> List[VMItem]:
    """Вернуть список ВМ из libvirt.

    Для простоты используем имя ВМ как её идентификатор (id).
    """
    conn = _get_libvirt_conn()

    try:
        domains = conn.listAllDomains()  # type: ignore[no-untyped-call]
    except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка ВМ: {exc}")

    items: List[VMItem] = []
    vm_names = []

    import xml.etree.ElementTree as ET
    for dom in domains:
        try:
            name = dom.name()  # type: ignore[no-untyped-call]
        except libvirt.libvirtError:
            continue

        vm_names.append(name)
        status = _vm_status_from_domain(dom)
        # Попробуем получить ресурсы из XML
        try:
            xml = dom.XMLDesc()  # type: ignore[no-untyped-call]
            root = ET.fromstring(xml)
            cpu_cores = int(root.findtext('./vcpu') or 0) or None
            memory_kib = int(root.findtext('./memory') or 0) or None
            memory_mb = int(memory_kib / 1024) if memory_kib else None
            disk_gb = None
            disk = root.find("./devices/disk/source")
            if disk is not None:
                # Здесь можно добавить анализ размера файла, если нужно
                pass
        except Exception:
            cpu_cores = None
            memory_mb = None
            disk_gb = None

        items.append(
            VMItem(
                id=name,
                name=name,
                status=status,
                cpu_cores=cpu_cores,
                memory_mb=memory_mb,
                disk_gb=disk_gb,
                cluster_id=None,
            )
        )

    print(f"[DEBUG] VM list from libvirt: {vm_names}")
    return items


@router.post("/vms/{vm_id}/start")
async def start_vm(vm_id: str) -> dict:
    conn = _get_libvirt_conn()
    try:
        dom = conn.lookupByName(vm_id)  # type: ignore[no-untyped-call]
    except libvirt.libvirtError:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"ВМ '{vm_id}' не найдена")

    if _vm_status_from_domain(dom) == "running":
        raise HTTPException(status_code=400, detail="ВМ уже запущена")

    try:
        dom.create()  # type: ignore[no-untyped-call]
    except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=f"Ошибка запуска ВМ: {exc}")

    return {"status": "ok"}


@router.post("/vms/{vm_id}/stop")
async def stop_vm(vm_id: str) -> dict:
    conn = _get_libvirt_conn()
    try:
        dom = conn.lookupByName(vm_id)  # type: ignore[no-untyped-call]
    except libvirt.libvirtError:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"ВМ '{vm_id}' не найдена")

    if _vm_status_from_domain(dom) == "stopped":
        raise HTTPException(status_code=400, detail="ВМ уже остановлена")

    try:
        dom.shutdown()  # type: ignore[no-untyped-call]
    except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=f"Ошибка остановки ВМ: {exc}")

    return {"status": "ok"}


@router.post("/vms/{vm_id}/restart")
async def restart_vm(vm_id: str) -> dict:
    conn = _get_libvirt_conn()
    try:
        dom = conn.lookupByName(vm_id)  # type: ignore[no-untyped-call]
    except libvirt.libvirtError:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"ВМ '{vm_id}' не найдена")

    try:
        # Попробуем мягкий рестарт, при ошибке можно будет использовать reset
        dom.reboot(0)  # type: ignore[no-untyped-call]
    except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=500, detail=f"Ошибка перезапуска ВМ: {exc}")

    return {"status": "ok"}
