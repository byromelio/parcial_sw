from pydantic import BaseModel


class XmiImportSummary(BaseModel):
    classes_created: list[str] = []
    classes_skipped: list[str] = []
    attributes_created: int = 0
    attributes_skipped: int = 0
    relations_created: int = 0
    relations_skipped: int = 0
    # Problemas recuperables durante el import (tipo de elemento no
    # soportado, multiplicidad ausente, etc.): el import sigue adelante y
    # el frontend los muestra al usuario sin bloquear el resultado.
    warnings: list[str] = []
