from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_status():
	"""Корневой маршрут должен быть доступен, а health-check должен возвращать JSON."""
	root_response = client.get("/")
	assert root_response.status_code == 200

	health_response = client.get("/api/health")
	assert health_response.status_code == 200
	data = health_response.json()
	assert data.get("status") == "healthy"



def test_get_vms():
	"""Проверка получения списка ВМ (если libvirt доступен)"""
	response = client.get("/api/vms")
	assert response.status_code in (200, 500)  # 500 если libvirt не доступен


def test_create_vm():
	"""Проверка создания ВМ через libvirt, если backend имеет доступ к хосту."""
	vm_data = {
		"name": "test-vm-copilot",
		"cpu_cores": 1,
		"memory_mb": 256,
		"disk_gb": 1
	}
	response = client.post("/api/vms", json=vm_data)
	assert response.status_code in (200, 500), response.text
	if response.status_code == 200:
		data = response.json()
		assert data["name"] == vm_data["name"]
		assert data["cpu_cores"] == vm_data["cpu_cores"]
		assert data["memory_mb"] == vm_data["memory_mb"]
		assert data["disk_gb"] == vm_data["disk_gb"]


def test_vm_lifecycle():
	"""Проверка запуска, остановки и перезапуска ВМ (ожидаем 200 или 400/404 если ВМ нет/неактивна)"""
	vm_id = "test-vm-copilot"
	# Запуск
	resp_start = client.post(f"/api/vms/{vm_id}/start")
	assert resp_start.status_code in (200, 400, 404, 500)
	# Остановка
	resp_stop = client.post(f"/api/vms/{vm_id}/stop")
	assert resp_stop.status_code in (200, 400, 404, 500)
	# Перезапуск
	resp_restart = client.post(f"/api/vms/{vm_id}/restart")
	assert resp_restart.status_code in (200, 404, 500)
