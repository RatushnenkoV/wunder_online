from accounts.services import create_user_with_temp_password, parse_import_file
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
