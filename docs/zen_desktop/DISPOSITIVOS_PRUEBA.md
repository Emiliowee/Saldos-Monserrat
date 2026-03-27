# Probar impresoras y lector sin hardware físico (Windows)

Guía para **impresoras virtuales** y el **lector de código de barras** (como en caja: escanear etiqueta → el código entra al campo → el sistema busca el producto). La ventana **Configuración** (hardware de caja, `python main.py`, enlace en Inicio o en la página Configuración) tiene **Impresoras** y **Lector en caja**; mensajes breves abajo y diálogos para diagnóstico.

## Impresoras virtuales incluidas en Windows

Suele bastar con lo que ya trae el sistema:

| Impresora | Uso |
|-----------|-----|
| **Microsoft Print to PDF** | Zen genera un **PDF temporal** y lo **abre** en el visor predeterminado; desde ahí podés **guardar** como quieras. |
| **Microsoft XPS Document Writer** | Similar: guarda un archivo XPS (menos habitual que PDF, pero sirve de prueba). |
| **Fax** | A veces aparece instalada; puede servir como cola de prueba, aunque no es lo más cómodo. |

### Cómo “instalarlas” si no las ves

1. **Configuración de Windows** → **Bluetooth y dispositivos** → **Impresoras y escáneres**.
2. **Agregar dispositivo** → si aparece **Microsoft Print to PDF**, agregala.
3. Si hace falta, en **Funciones opcionales** (Buscar en el menú Inicio) podés activar componentes relacionados con impresión; en la mayoría de las instalaciones **PDF ya está**.

### Cómo probarlas en Zen

1. Ejecutá `python main.py`.
2. Abrí **Impresoras y dispositivos** (enlace bajo el texto de bienvenida en Inicio) o andá a **Configuración** y pulsá el enlace **Abrir impresoras y dispositivos…**.
3. En el panel izquierdo elegí **Impresoras**, pulsá **Actualizar lista de impresoras** y seleccioná **Microsoft Print to PDF** en **Etiquetas** o **Tickets**.
4. **Probar etiquetas** o **Probar tickets**: con PDF virtual se abre el archivo en el visor; los fallos se muestran en un **mensaje** de error. **Diagnóstico…** abre un cuadro de solo lectura con la lista del sistema.

### Impresoras virtuales “de etiquetas” (opcional)

Si más adelante querés simular el tamaño de una etiqueta (p. ej. Zebra, TSC) sin comprar hardware:

- Algunos fabricantes ofrecen **drivers virtuales** o **utilidades de diseño** que instalan una impresora lógica.
- Otras opciones son **drivers genéricos** “Generic / Text Only” o PDF + recortar en vista previa; depende del flujo real del ERP.

Eso ya es específico del modelo; cuando tengas la impresora, el proveedor suele dar el driver y el tamaño de etiqueta en mm.

---

## Lector de códigos de barras (sin lector físico)

Los lectores USB más comunes funcionan como **teclado HID**: **envían caracteres** al campo activo y muchos mandan **Enter** al final.

### ¿Hay un lector «virtual» para descargar, como el PDF?

**No.** Windows no trae un “Microsoft Barcode Scanner virtual” instalable. Una pistola real solo hace de **teclado muy rápido**; para probar la app hace falta que esos mismos caracteres lleguen al campo, sea **a mano** o con otra herramienta.

### Prueba con código de barras en pantalla (con pistola)

En **Configuración → Lector en caja**: la app **genera un número al azar**, muestra el **Code 128** y el valor en grande. El **recuadro** recibe la lectura (se ven **puntos**, no el número en claro) y **compara sola** cuando el lector manda **Enter** o, si no manda Enter, un instante después de que entró la última tecla y ya hay tantos caracteres como el código generado. **✓ / ✗** aparece **al lado de la imagen del código de barras**. **Generar otro código de prueba** cambia número y barras y reinicia el estado de la prueba.

### Cómo probar sin pistola

1. **Teclado**  
   Mirá el número generado, foco en el recuadro, escribí **exactamente** ese número; al llegar a la misma cantidad de dígitos se comprueba solo, o pulsá **Enter**.

2. **AutoHotkey (automatizar texto + Enter)**  
   - En el repo: carpeta **`scripts/autohotkey/`** — leé **`README.md`** ahí.  
   - Incluye scripts listos: **v1** y **v2** (según la versión que instalaste). Lo más cómodo: **`simular_con_F8_*.ahk`** (doble clic para dejarlo corriendo, foco en el campo y pulsás **F8**).  
   - Cambiá `7501234567890` en el archivo por el código que quieras.

3. **Teléfono como teclado Bluetooth**  
   Algunas apps leen códigos y pueden enviarlos al PC como si fueran teclado; depende del modelo y de emparejar Bluetooth. No hay un estándar único: probá apps tipo “barcode keyboard” / “scanner to PC” en la tienda de tu móvil y revisá que emulen **teclado HID**.

4. **Lector USB real (barato)**  
   Un lector genérico USB en modo teclado suele ser la forma más fiable de probar cable, drivers y Enter al final.

### Lector en serie (COM)

Si algún día usás **puerto serie** en lugar de modo teclado, haría falta otra configuración en el programa (puerto, baudios); no es lo que cubre hoy la pantalla de **Lector en caja**.

---

## Si algo falla

- **Cola de impresión**: en Windows, buscá **Ver dispositivos e impresoras** → clic derecho en la impresora → **Ver lo que se está imprimiendo** y mirá si el trabajo quedó en **Error** o **Pausado**.
- **Permisos**: en entornos restringidos, a veces hace falta permiso para escribir en la carpeta temporal del spooler.
- **PDF pide guardar cada vez**: es el comportamiento normal de **Print to PDF**; una impresora física no preguntará por archivo.

---

## Resumen

1. Usá **Microsoft Print to PDF** como primera prueba en Zen → **Probar etiquetas** / **Probar tickets**.
2. **Lector en caja**: mismo uso que pistola en tienda —foco en el recuadro de captura, escanear; el resultado se ve con **✓ / ✗** junto al **código de barras** en pantalla.
3. Cuando compres hardware, instalá el **driver del fabricante**, volvé a **Actualizar lista** en Zen y asigná esa impresora a **Etiquetas** o **Tickets**.

Las preferencias de impresora se guardan en `QSettings` (`SaldosMonserrat` / `BazarMonserratZenShell`): `devices/printer_labels_name` y `devices/printer_tickets_name`. La clave `devices/scanner_pnp_instance_id` queda reservada para un uso futuro.
