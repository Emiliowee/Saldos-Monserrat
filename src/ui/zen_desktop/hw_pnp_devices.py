"""
Dispositivos de entrada vistos por Windows (PnP), para elegir «qué teclado/HID» asociás al lector.

Los lectores USB tipo teclado aparecen normalmente como clase Keyboard u HID.
Solo Windows (PowerShell Get-PnpDevice); en otros SO la lista queda vacía.
"""
from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class PnpInputDevice:
    instance_id: str
    friendly_name: str
    device_class: str
    status: str


def _run_ps_json(script: str, timeout: float = 30.0) -> object | None:
    if sys.platform != "win32":
        return None
    try:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        r = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=creationflags,
        )
        if r.returncode != 0 or not (r.stdout or "").strip():
            return None
        return json.loads(r.stdout.strip())
    except Exception:
        return None


def list_keyboard_hid_devices() -> list[PnpInputDevice]:
    """
    Teclados y dispositivos HID de entrada presentes y OK (típico para lectores en USB).
    Excluye entradas genéricas muy ruidosas cuando es posible.
    """
    if sys.platform != "win32":
        return []

    # Keyboard: suele listar el lector USB como teclado HID.
    # HIDClass: solo nombres que sugieren teclado / lector / entrada.
    ps = r"""
$ok = Get-PnpDevice -PresentOnly | Where-Object { $_.Status -eq 'OK' }
$kb = @($ok | Where-Object { $_.Class -eq 'Keyboard' })
$hid = @($ok | Where-Object {
  $_.Class -eq 'HIDClass' -and (
    $_.FriendlyName -match '(?i)(keyboard|teclado|barcode|scanner|lector|wedge|input.*hid|hid.*keyboard|usb input)'
  )
})
@($kb) + @($hid) | Sort-Object -Property InstanceId -Unique |
  Select-Object InstanceId, FriendlyName, Class, Status |
  ConvertTo-Json -Depth 3 -Compress
"""
    raw = _run_ps_json(ps)
    if raw is None:
        return []

    rows: list[dict]
    if isinstance(raw, dict):
        rows = [raw]
    elif isinstance(raw, list):
        rows = [x for x in raw if isinstance(x, dict)]
    else:
        return []

    out: list[PnpInputDevice] = []
    seen: set[str] = set()
    for row in rows:
        iid = str(row.get("InstanceId") or "").strip()
        name = str(row.get("FriendlyName") or "").strip() or "(sin nombre)"
        cls = str(row.get("Class") or "").strip()
        st = str(row.get("Status") or "").strip()
        if not iid or iid in seen:
            continue
        seen.add(iid)
        out.append(PnpInputDevice(instance_id=iid, friendly_name=name, device_class=cls, status=st))

    out.sort(key=lambda d: d.friendly_name.lower())
    return out
