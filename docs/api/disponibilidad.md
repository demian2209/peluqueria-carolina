# API de Disponibilidad — Peluquería Carolina

Endpoints para calcular horarios libres de estilistas en función del servicio y la fecha.

Base URL: `/api/v1/disponibilidad`

---

## Endpoints

### 1. Slots disponibles para un estilista específico

- **Método**: `GET`
- **Ruta**: `/api/v1/disponibilidad`

#### Query Parameters

| Parámetro     | Tipo   | Requerido | Descripción |
|---------------|--------|-----------|-------------|
| `estilista_id`| string | ✅        | ID del estilista |
| `fecha`       | string | ✅        | Fecha en formato `YYYY-MM-DD` |
| `servicio_id` | string | ✅*       | ID del servicio (para resolver la duración) |
| `duracion_min`| number | ✅*       | Duración directa en minutos (alternativa a `servicio_id`) |
| `intervalo_min`| number | ❌       | Granularidad de slots en minutos (default: `30`) |

> \* Se debe proporcionar `servicio_id` **o** `duracion_min`.

#### Respuesta `200 OK`

```json
{
  "status": "success",
  "source": "mock",
  "data": {
    "estilista_id": "e1-marc-laurent",
    "fecha": "2026-09-01",
    "duracion_min": 45,
    "trabaja_ese_dia": true,
    "slots_disponibles": ["11:00", "11:30", "12:00", "12:30", "13:00", "15:30", "16:00", "16:30", "17:00"],
    "total_slots": 9
  }
}
```

#### Si el estilista no trabaja ese día

```json
{
  "status": "success",
  "data": {
    "trabaja_ese_dia": false,
    "slots_disponibles": [],
    "total_slots": 0
  }
}
```

---

### 2. Slots disponibles para todos los estilistas

- **Método**: `GET`
- **Ruta**: `/api/v1/disponibilidad/todos`

#### Query Parameters

| Parámetro    | Tipo   | Requerido | Descripción |
|--------------|--------|-----------|-------------|
| `fecha`      | string | ✅        | Fecha en formato `YYYY-MM-DD` |
| `servicio_id`| string | ✅        | ID del servicio (filtra automáticamente los estilistas que lo realizan) |

#### Respuesta `200 OK`

```json
{
  "status": "success",
  "data": {
    "fecha": "2026-09-01",
    "servicio_id": "s2-corte-autor",
    "duracion_min": 45,
    "estilistas": [
      {
        "estilista_id": "e1-marc-laurent",
        "nombre_completo": "Marc Laurent",
        "especialidad": "Especialista en Color",
        "nivel": "master",
        "trabaja_ese_dia": true,
        "slots_disponibles": ["11:00", "11:30", "13:00"],
        "total_slots": 3
      }
    ]
  }
}
```

---

## Algoritmo de Disponibilidad

```
1. Obtener horario semanal del estilista para el día de la semana de `fecha`
2. Si no trabaja ese día → retornar slots vacíos
3. Generar candidatos cada `intervalo_min` dentro del horario laboral
   (solo candidatos donde candidato.fin <= fin_jornada)
4. Obtener reservas confirmadas/pendientes del estilista en esa fecha
5. Eliminar candidatos que colisionen con alguna reserva
   (colisión: candidato.inicio < reserva.fin AND candidato.fin > reserva.inicio)
6. Retornar los slots resultantes en formato "HH:MM"
```

---

## Errores comunes

| Código | Motivo |
|--------|--------|
| `400`  | Falta `estilista_id`, `fecha`, o la fuente de duración |
| `400`  | Formato de fecha inválido |
| `400`  | Fecha en el pasado |
| `404`  | Estilista o servicio no encontrado |
