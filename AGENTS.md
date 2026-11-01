# Directrices de Colaboración Multi-Agente (Antigravity IDE <-> OpenCode)

Este proyecto cuenta con un puente de comunicación bidireccional y delegación de tareas entre el agente de **Antigravity IDE** (impulsado por **Gemini 3.8 Flash**) y el agente de **OpenCode / OpenChamber** (impulsado por **DeepSeek V4.1 Flash [Thinking: High]**).

## Modelo Activo en Antigravity IDE: Gemini 3.8 Flash
El agente de Antigravity IDE opera con **Gemini 3.8 Flash**, un modelo de latencia ultra-baja y alta velocidad de procesamiento.

## Herramienta de Enlace: `.\bridge.bat`

Cualquier agente puede utilizar la CLI `.\bridge.bat` en la terminal para interactuar con su contraparte:

### 1. Delegar Tareas a Antigravity IDE (Gemini 3.8 Flash)
OpenCode (DeepSeek V4.1 Flash) DEBE delegar activamente a Antigravity IDE:

#### A. Tareas Sencillas, Rápidas y Operativas (Ahorro de Cómputo y Tokens)
- Generación de código repetitivo, plantillas (boilerplate) y mocks de datos.
- Formateo, saneamiento y validación de archivos JSON, YAML, SQL o Markdown.
- Redacción y actualización de documentación técnica, manuales y changelogs.
- Scripts auxiliares de PowerShell, Bash o utilitarios de entorno.
- Inspección rápida de logs, regex y búsqueda de patrones en archivos.

#### B. Soporte Transversal
- Consultas al Knowledge Graph del proyecto.
- Auditorías de seguridad y cruces de dependencias entre squads.

**Comando para delegar a Antigravity:**
```bash
.\bridge.bat delegate-to-antigravity "Descripción detallada de la tarea a delegar"
```

### 2. Notificar Finalización de Tareas
Cuando OpenCode termine una tarea delegada por Antigravity (con ID `TASK-...`):
```bash
.\bridge.bat complete-task TASK-XXXX "<Resumen del resultado y confirmación>"
```

### 3. Consultar Estado y Bandeja de Entrada
```bash
.\bridge.bat status
.\bridge.bat inbox opencode
```
