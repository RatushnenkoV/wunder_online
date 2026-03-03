import datetime

from accounts.services import create_user_with_temp_password, generate_password, parse_import_file
from accounts.models import User
from .models import GradeLevel, SchoolClass, StudentProfile, ParentProfile


def import_classes(file):
    """
    Import classes with students and parents from CSV/XLSX.
    Expected columns:
    параллель, буква, фамилия_ученика, имя_ученика, email_ученика, телефон_ученика,
    фамилия_родителя1, имя_родителя1, email_родителя1, телефон_родителя1,
    фамилия_родителя2, имя_родителя2, email_родителя2, телефон_родителя2
    """
    rows = parse_import_file(file)
    created_students = []
    created_parents = []
    errors = []

    for i, row in enumerate(rows, start=2):
        try:
            grade_num = int(row.get('параллель', 0))
            letter = row.get('буква', '').strip().upper()
            student_last = row.get('фамилия_ученика', '').strip()
            student_first = row.get('имя_ученика', '').strip()

            if not grade_num or not letter or not student_last or not student_first:
                errors.append(f'Строка {i}: параллель, буква, фамилия и имя ученика обязательны')
                continue

            grade, _ = GradeLevel.objects.get_or_create(number=grade_num)
            school_class, _ = SchoolClass.objects.get_or_create(grade_level=grade, letter=letter)

            student_user = create_user_with_temp_password(
                student_first, student_last, ['student'],
                row.get('email_ученика', '').strip(),
                row.get('телефон_ученика', '').strip(),
            )
            student_profile = StudentProfile.objects.create(user=student_user, school_class=school_class)
            created_students.append(student_user)

            for suffix in ['1', '2']:
                p_last = row.get(f'фамилия_родителя{suffix}', '').strip()
                p_first = row.get(f'имя_родителя{suffix}', '').strip()
                if p_last and p_first:
                    parent_user = create_user_with_temp_password(
                        p_first, p_last, ['parent'],
                        row.get(f'email_родителя{suffix}', '').strip(),
                        row.get(f'телефон_родителя{suffix}', '').strip(),
                    )
                    parent_profile, _ = ParentProfile.objects.get_or_create(user=parent_user)
                    parent_profile.children.add(student_profile)
                    created_parents.append(parent_user)

        except Exception as e:
            errors.append(f'Строка {i}: {str(e)}')

    return {
        'students': created_students,
        'parents': created_parents,
        'errors': errors,
    }


def _parse_class_str(class_str):
    """Parse '1 а', '2 б', '9 а' → (grade_num, letter). Normalises Latin 'a' → Cyrillic 'а'."""
    parts = class_str.strip().split()
    if len(parts) < 2:
        raise ValueError(f'Не удалось распознать класс: "{class_str}"')
    grade_num = int(parts[0])
    letter = parts[1]
    # Normalize Latin lookalikes to Cyrillic
    letter = letter.replace('a', 'а').replace('A', 'А').replace('e', 'е').replace('E', 'Е')
    return grade_num, letter


def import_students_from_excel(file):
    """
    Import students from the school's Excel file ("Ученики по классам").
    Each sheet represents one class. Expected columns (positional):
      0: № | 1: Класс | 2: ФИО | 3: Дата рождения | 4: Номер Л/Д

    Logic:
      - If a student with the same personal_file_number exists → update.
      - Else if a student with the same last_name+first_name exists in the same class → update.
      - Otherwise → create new student.
    """
    from openpyxl import load_workbook

    wb = load_workbook(file)
    created_count = 0
    updated_count = 0
    errors = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if len(all_rows) <= 1:
            continue

        for row_idx, row in enumerate(all_rows[1:], start=2):
            fio_raw = row[2]
            if not fio_raw:
                continue
            fio = str(fio_raw).strip()
            if not fio:
                continue

            class_raw = row[1]
            if not class_raw:
                errors.append(f'Лист «{sheet_name}», строка {row_idx}: пустое поле «Класс»')
                continue

            birth_date_raw = row[3]
            personal_file_number = str(row[4]).strip() if row[4] is not None else ''

            # Parse class
            try:
                grade_num, letter = _parse_class_str(str(class_raw))
            except ValueError as exc:
                errors.append(f'Лист «{sheet_name}», строка {row_idx}: {exc}')
                continue

            # Parse FIO: first word = last_name, rest = first_name
            parts = fio.split()
            if len(parts) < 2:
                errors.append(f'Лист «{sheet_name}», строка {row_idx}: ФИО должно содержать как минимум фамилию и имя — «{fio}»')
                continue
            last_name = parts[0]
            first_name = ' '.join(parts[1:])

            # Parse birth_date
            birth_date = None
            if isinstance(birth_date_raw, datetime.datetime):
                birth_date = birth_date_raw.date()
            elif isinstance(birth_date_raw, datetime.date):
                birth_date = birth_date_raw

            try:
                grade, _ = GradeLevel.objects.get_or_create(number=grade_num)
                school_class, _ = SchoolClass.objects.get_or_create(grade_level=grade, letter=letter)

                # Try to find by personal_file_number first
                existing_profile = None
                if personal_file_number:
                    existing_profile = StudentProfile.objects.filter(
                        personal_file_number=personal_file_number
                    ).select_related('user').first()

                if existing_profile:
                    user = existing_profile.user
                    user.last_name = last_name
                    user.first_name = first_name
                    user.birth_date = birth_date
                    user.save()
                    existing_profile.school_class = school_class
                    existing_profile.save()
                    updated_count += 1
                else:
                    # Try to find by name within the same class
                    existing_user = User.objects.filter(
                        last_name=last_name, first_name=first_name, is_student=True
                    ).select_related('student_profile').first()

                    if existing_user and hasattr(existing_user, 'student_profile'):
                        existing_user.birth_date = birth_date
                        existing_user.save()
                        existing_user.student_profile.school_class = school_class
                        if personal_file_number:
                            existing_user.student_profile.personal_file_number = personal_file_number
                        existing_user.student_profile.save()
                        updated_count += 1
                    else:
                        password = generate_password()
                        user = User(
                            first_name=first_name,
                            last_name=last_name,
                            birth_date=birth_date,
                            is_student=True,
                            must_change_password=True,
                            temp_password=password,
                        )
                        user.set_password(password)
                        user.save()
                        StudentProfile.objects.create(
                            user=user,
                            school_class=school_class,
                            personal_file_number=personal_file_number,
                        )
                        created_count += 1

            except Exception as exc:
                errors.append(f'Лист «{sheet_name}», строка {row_idx} ({fio}): {exc}')

    return {
        'created': created_count,
        'updated': updated_count,
        'errors': errors,
    }
