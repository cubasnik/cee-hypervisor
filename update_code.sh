#!/bin/bash

# Функция для обновления файла
update_file() {
    local file_path=$1
    local content=$2
    
    echo "Обновление $file_path..."
    
    # Создаем бэкап
    if [ -f "$file_path" ]; then
        cp "$file_path" "${file_path}.backup.$(date +%Y%m%d_%H%M%S)"
        echo "  Бэкап создан: ${file_path}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Создаем директорию если нужно
    mkdir -p "$(dirname "$file_path")"
    
    # Записываем новый контент
    cat > "$file_path" << 'INNER_EOF'
$content
INNER_EOF
    
    if [ $? -eq 0 ]; then
        echo "  ✅ Успешно обновлено"
    else
        echo "  ❌ Ошибка при обновлении"
    fi
    echo ""
}

# Обновляем VmMetricsWidget.js (фронтенд)
update_file "frontend/src/components/VmMetricsWidget.js" "import React, { useState, useEffect } from 'react';

const VmMetricsWidget = ({ vmName }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    if (!vmName) return;
    
    setLoading(true);
    try {
      const encodedName = encodeURIComponent(vmName);
      console.log('Запрос метрик для:', vmName, 'закодировано:', encodedName);
      
      const response = await fetch(\`/api/vms/\${encodedName}/metrics?limit=1\`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Метрики не найдены для ВМ:', vmName);
          setMetrics(null);
          return;
        }
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      
      const data = await response.json();
      console.log('Получены метрики для', vmName, ':', data);
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error(\`Ошибка загрузки метрик для \${vmName}:\`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [vmName]);

  if (loading && !metrics) return <div>Загрузка метрик...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!metrics) return <div>Метрики не доступны</div>;

  return (
    <div className="vm-metrics p-4 border rounded">
      <h3 className="text-lg font-bold mb-2">Метрики ВМ: {vmName}</h3>
      <div className="grid grid-cols-2 gap-2">
        {metrics && Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="font-medium">{key}:</span>
            <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VmMetricsWidget;"

# Обновляем image_service.py (бэкенд)
update_file "backend/app/services/image_service.py" "import subprocess
import json
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_image_format(image_path: str) -> Optional[str]:
    \"\"\"
    Получить формат образа диска через qemu-img
    \"\"\"
    try:
        # Проверяем существование файла
        if not os.path.exists(image_path):
            logger.error(f\"Файл не существует: {image_path}\")
            return None
            
        # Проверяем права на чтение
        if not os.access(image_path, os.R_OK):
            logger.error(f\"Нет прав на чтение: {image_path}\")
            return None
            
        # Для WSL конвертируем путь если нужно
        if '/mnt/c/' in image_path:
            logger.info(f\"Обнаружен путь WSL: {image_path}\")
            
        # Выполняем qemu-img info
        result = subprocess.run(
            ['qemu-img', 'info', '--output=json', image_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.error(f\"qemu-img error (code {result.returncode}): {result.stderr}\")
            return None
            
        data = json.loads(result.stdout)
        image_format = data.get('format')
        logger.info(f\"Формат образа {image_path}: {image_format}\")
        return image_format
        
    except subprocess.TimeoutExpired:
        logger.error(f\"Таймаут при выполнении qemu-img для {image_path}\")
        return None
    except json.JSONDecodeError as e:
        logger.error(f\"Ошибка парсинга JSON: {e}\")
        return None
    except FileNotFoundError:
        logger.error(\"qemu-img не найден. Установите qemu-utils\")
        return None
    except Exception as e:
        logger.error(f\"Неожиданная ошибка: {e}\")
        return None

def check_qemu_installed() -> bool:
    \"\"\"
    Проверить установлен ли qemu-img
    \"\"\"
    try:
        result = subprocess.run(
            ['which', 'qemu-img'],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except:
        return False"

# Добавляем эндпоинт для метрик если его нет
update_file "backend/app/api/endpoints/vms.py" "# Добавьте этот эндпоинт в файл vms.py если его нет

@router.get(\"/{vm_name}/metrics\")
async def get_vm_metrics(
    vm_name: str,
    limit: int = Query(60, ge=1, le=1440),
    db: Session = Depends(get_db)
):
    \"\"\"
    Получить метрики ВМ
    \"\"\"
    try:
        # Проверяем существование ВМ
        vm = vm_service.get_vm(db, vm_name)
        if not vm:
            raise HTTPException(status_code=404, detail=\"VM not found\")
            
        # Получаем метрики
        metrics = vm_service.get_vm_metrics(vm_name, limit)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"

echo ""
echo "✅ Все обновления завершены!"
echo "📁 Бэкапы созданы в тех же директориях"
echo ""
echo "Для перезапуска сервера выполните:"
echo "  cd backend && ./start.sh"
