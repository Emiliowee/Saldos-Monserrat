"""Organización y nombre de app para QSettings (un solo lugar)."""
from PySide6.QtCore import QSettings

ORGANIZATION = "SaldosMonserrat"
APPLICATION = "BazarMonserrat"


def app_qsettings() -> QSettings:
    return QSettings(ORGANIZATION, APPLICATION)
