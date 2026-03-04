#!/bin/bash

# Мы уже в директории backend, поэтому путь без backend/
VMS_FILE="app/api/endpoints/vms.py"

# Проверяем существует ли файл
if [ ! -f "$VMS_FILE" ]; then
    echo "❌ Файл $VMS_FILE не найден!"
    echo "Содержимое директории app/api/endpoints/:"
    ls -la app/api/endpoints/
    exit 1
fi

# Создаем бэкап
cp "$VMS_FILE" "$VMS_FILE.backup.fix.$(date +%Y%m%d_%H%M%S)"
echo "✅ Бэкап создан: $VMS_FILE.backup.fix.$(date +%Y%m%d_%H%M%S)"

# Удаляем неправильно добавленный контент (если он был добавлен)
# Создаем временный файл без строк с $content
grep -v "\$content" "$VMS_FILE" > "$VMS_FILE.tmp"
mv "$VMS_FILE.tmp" "$VMS_FILE"

# Добавляем эндпоинт для метрик в конец файла
cat >> "$VMS_FILE" << 'INNER_EOF'


# Эндпоинт для метрик ВМ
@router.get("/{vm_name}/metrics")
async def get_vm_metrics(
    vm_name: str,
    limit: int = Query(60, ge=1, le=1440),
    db: Session = Depends(get_db)
):
    """
    Получить метрики ВМ
    """
    try:
        # Проверяем существование ВМ
        vm = vm_service.get_vm(db, vm_name)
        if not vm:
            raise HTTPException(status_code=404, detail="VM not found")
            
        # Получаем метрики
        metrics = vm_service.get_vm_metrics(vm_name, limit)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
INNER_EOF

echo "✅ Эндпоинт для метрик добавлен в $VMS_FILE"

# Проверим что импорты есть в начале файла
if ! grep -q "from fastapi import.*Query" "$VMS_FILE"; then
    echo "⚠️  Возможно отсутствуют нужные импорты. Добавьте в начало файла:"
    echo "from fastapi import APIRouter, Depends, HTTPException, Query"
    echo "from sqlalchemy.orm import Session"
    echo "from app.core.deps import get_db"
    echo "from app.services import vm_service"
fi
