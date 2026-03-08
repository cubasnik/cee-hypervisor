import os
import ipaddress
import xml.etree.ElementTree as ET

import libvirt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter()


class NetworkItem(BaseModel):
  id: str
  name: str
  type: str
  subnet: str
  connected_vms: int
  status: str
  dhcp_enabled: bool


class NetworkCreate(BaseModel):
  name: str
  subnet: str
  mode: str = "isolated"
  dhcp_enabled: bool = True


def _get_libvirt_conn() -> libvirt.virConnect:  # type: ignore[name-defined]
  uri = os.getenv("LIBVIRT_URI", "qemu:///system")
  try:
    conn = libvirt.open(uri)  # type: ignore[no-untyped-call]
    if conn is None:
      raise HTTPException(status_code=500, detail="Не удалось подключиться к libvirt")
    return conn
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка подключения к libvirt: {exc}")


def _extract_subnet(root: ET.Element) -> str:
  ip_node = root.find("./ip")
  if ip_node is None:
    return "-"

  address = ip_node.get("address")
  prefix = ip_node.get("prefix")
  netmask = ip_node.get("netmask")

  try:
    if address and prefix:
      network = ipaddress.ip_network(f"{address}/{prefix}", strict=False)
      return str(network)
    if address and netmask:
      network = ipaddress.ip_network(f"{address}/{netmask}", strict=False)
      return str(network)
  except ValueError:
    return address or "-"

  return address or "-"


def _count_connected_vms(conn: libvirt.virConnect, network_name: str) -> int:  # type: ignore[name-defined]
  try:
    domains = conn.listAllDomains()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError:
    return 0

  count = 0
  for dom in domains:
    try:
      xml_desc = dom.XMLDesc()  # type: ignore[no-untyped-call]
      root = ET.fromstring(xml_desc)
      interfaces = root.findall("./devices/interface/source[@network]")
      if any(interface.get("network") == network_name for interface in interfaces):
        count += 1
    except Exception:
      continue
  return count


@router.get("/networks", response_model=list[NetworkItem])
async def list_networks() -> list[NetworkItem]:
  conn = _get_libvirt_conn()

  try:
    networks = conn.listAllNetworks()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка получения списка сетей: {exc}")

  items: list[NetworkItem] = []
  for network in networks:
    try:
      xml_desc = network.XMLDesc()  # type: ignore[no-untyped-call]
      root = ET.fromstring(xml_desc)
      name = network.name()  # type: ignore[no-untyped-call]
      forward = root.find("./forward")
      dhcp_range = root.find("./ip/dhcp/range")

      items.append(
        NetworkItem(
          id=name,
          name=name,
          type=forward.get("mode") if forward is not None and forward.get("mode") else "isolated",
          subnet=_extract_subnet(root),
          connected_vms=_count_connected_vms(conn, name),
          status="online" if network.isActive() == 1 else "offline",  # type: ignore[no-untyped-call]
          dhcp_enabled=dhcp_range is not None,
        )
      )
    except Exception:
      continue

  return items


@router.post("/networks", response_model=NetworkItem)
async def create_network(payload: NetworkCreate) -> NetworkItem:
  conn = _get_libvirt_conn()

  try:
    network_cidr = ipaddress.ip_network(payload.subnet, strict=False)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=f"Некорректная подсеть: {exc}")

  if network_cidr.version != 4:
    raise HTTPException(status_code=400, detail="Поддерживаются только IPv4-сети")

  try:
    existing = conn.networkLookupByName(payload.name)  # type: ignore[no-untyped-call]
    if existing is not None:
      raise HTTPException(status_code=400, detail=f"Сеть '{payload.name}' уже существует")
  except libvirt.libvirtError:
    pass

  hosts = list(network_cidr.hosts())
  gateway = str(hosts[0]) if hosts else str(network_cidr.network_address)
  prefix = network_cidr.prefixlen

  dhcp_xml = ""
  if payload.dhcp_enabled and len(hosts) >= 20:
    dhcp_start = str(hosts[9])
    dhcp_end = str(hosts[min(len(hosts) - 1, 99)])
    dhcp_xml = f"<dhcp><range start='{dhcp_start}' end='{dhcp_end}'/></dhcp>"

  forward_xml = ""
  if payload.mode == "nat":
    forward_xml = "<forward mode='nat'/>"
  elif payload.mode == "route":
    forward_xml = "<forward mode='route'/>"
  elif payload.mode == "bridge":
    raise HTTPException(status_code=400, detail="Создание bridge-сетей через UI пока не поддерживается")

  network_xml = f"""
  <network>
    <name>{payload.name}</name>
    {forward_xml}
    <ip address='{gateway}' prefix='{prefix}'>
      {dhcp_xml}
    </ip>
  </network>
  """.strip()

  try:
    network = conn.networkDefineXML(network_xml)  # type: ignore[no-untyped-call]
    if network is None:
      raise HTTPException(status_code=500, detail="Не удалось определить сеть")
    network.setAutostart(1)  # type: ignore[no-untyped-call]
    network.create()  # type: ignore[no-untyped-call]
  except libvirt.libvirtError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=500, detail=f"Ошибка создания сети: {exc}")

  return NetworkItem(
    id=payload.name,
    name=payload.name,
    type=payload.mode,
    subnet=str(network_cidr),
    connected_vms=0,
    status="online",
    dhcp_enabled=payload.dhcp_enabled,
  )
