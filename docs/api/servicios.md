# API de Servicios y Estilistas — Peluquería Carolina

Documentación de endpoints de consulta para el catálogo de servicios y la nómina de estilistas.

Base URL: `/api/v1`

---

## 1. Servicios

### 1.1 Listar todos los servicios
- **Método**: `GET`
- **Ruta**: `/api/v1/servicios`
- **Filtros por Query Parameters**:
  - `categoria` (opcional): `coloracion`, `corte`, `tratamiento`, `barberia`, `styling`.

**Respuesta Ejemplo (`200 OK`)**:
```json
{
  "status": "success",
  "count": 5,
  "data": [
    {
      "id": "s1-coloracion-couture",
      "nombre": "Coloración Couture",
      "descripcion": "Pigmentación inteligente adaptada a su tono de piel mediante análisis IA.",
      "duracion_min": 120,
      "precio": 120.00,
      "categoria": "coloracion",
      "activo": true
    }
  ]
}
```

### 1.2 Obtener detalle de servicio
- **Método**: `GET`
- **Ruta**: `/api/v1/servicios/:id`

**Respuesta Ejemplo (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "id": "s1-coloracion-couture",
    "nombre": "Coloración Couture",
    "descripcion": "Pigmentación inteligente...",
    "duracion_min": 120,
    "precio": 120.00,
    "categoria": "coloracion"
  }
}
```

---

## 2. Estilistas

### 2.1 Listar todos los estilistas
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas`
- **Filtros por Query Parameters**:
  - `nivel` (opcional): `artisan`, `senior`, `master`.

### 2.2 Obtener detalle de estilista
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas/:id`

### 2.3 Obtener servicios por estilista
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas/:id/servicios`

**Respuesta Ejemplo (`200 OK`)**:
```json
{
  "status": "success",
  "count": 3,
  "data": [
    {
      "id": "s1-coloracion-couture",
      "nombre": "Coloración Couture",
      "duracion_min": 120,
      "precio": 120.00
    }
  ]
}
```
