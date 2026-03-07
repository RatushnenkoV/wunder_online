from django.core.exceptions import ValidationError


def _detect_mime(header: bytes) -> str:
    """Определяет MIME-тип по магическим байтам файла. Без внешних зависимостей."""
    if header[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if header[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if header[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if header[:4] == b'RIFF' and header[8:12] == b'WEBP':
        return 'image/webp'
    if header[:4] == b'%PDF':
        return 'application/pdf'
    if header[:4] == b'PK\x03\x04':
        return 'application/zip'  # xlsx, docx — это zip-архивы
    if header[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':
        return 'application/vnd.ms-excel'  # старый формат .xls
    return 'application/octet-stream'


def validate_file_mime(file, allowed_mimes: list, label: str = 'файл') -> None:
    """
    Проверяет реальный MIME-тип файла по магическим байтам.
    Выбрасывает ValidationError если тип не разрешён.

    Пример:
        validate_file_mime(request.FILES['photo'], ['image/jpeg', 'image/png'])
        validate_file_mime(request.FILES['doc'], ['application/pdf'], label='учебник')
    """
    header = file.read(12)
    file.seek(0)
    detected = _detect_mime(header)
    if detected not in allowed_mimes:
        raise ValidationError(
            f'Недопустимый тип {label}: {detected}. '
            f'Разрешены: {", ".join(allowed_mimes)}'
        )


ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
ALLOWED_PDF = ['application/pdf']
ALLOWED_EXCEL = [
    'application/zip',           # .xlsx
    'application/vnd.ms-excel',  # .xls
    'application/octet-stream',  # некоторые браузеры отправляют xlsx так
]
