"""Вспомогательные функции для lessons."""


def _has_correct(q):
    q_type = q.get('type', 'single')
    if q_type in ('single', 'multiple'):
        return q.get('correct_options') is not None
    if q_type == 'text':
        return q.get('correct_text') is not None
    if q_type == 'scale':
        return q.get('correct_scale') is not None
    return False


def _check_answer(q, val):
    """Возвращает True/False или None если правильный ответ не задан."""
    if not _has_correct(q):
        return None
    q_type = q.get('type', 'single')
    if q_type == 'single':
        correct = q.get('correct_options', [])
        return isinstance(val, int) and val in correct
    if q_type == 'multiple':
        correct = set(map(int, q.get('correct_options', [])))
        given = set(map(int, val)) if isinstance(val, list) else set()
        return given == correct
    if q_type == 'text':
        return str(val).strip().lower() == str(q.get('correct_text', '')).strip().lower()
    if q_type == 'scale':
        return val == q.get('correct_scale')
    return None


def compute_form_results(slide, form_answers_qs):
    """
    Вычисляет сводку и детальные результаты по форме.

    :param slide: Slide instance
    :param form_answers_qs: queryset FormAnswer.select_related('student')
    :returns: dict {summary, details}
    """
    content = slide.content or {}
    questions = content.get('questions', [])
    answers_list = list(form_answers_qs)

    # ── Per-question stats ──────────────────────────────────────────────────────
    total_correct = 0
    total_with_correct = 0
    per_question = []

    for q in questions:
        q_id = q.get('id')
        q_type = q.get('type', 'single')
        has_correct = _has_correct(q)

        stat = {
            'question_id': q_id,
            'type': q_type,
            'text': q.get('text', ''),
            'answer_count': 0,
            'has_correct': has_correct,
        }

        if q_type in ('single', 'multiple'):
            options = q.get('options', [])
            option_counts = [0] * len(options)
            correct_count = 0

            for fa in answers_list:
                for ans in fa.answers:
                    if ans.get('question_id') != q_id:
                        continue
                    val = ans.get('value')
                    if val is None:
                        continue
                    stat['answer_count'] += 1
                    if q_type == 'single' and isinstance(val, int):
                        if 0 <= val < len(option_counts):
                            option_counts[val] += 1
                        if has_correct and val in (q.get('correct_options') or []):
                            correct_count += 1
                    elif q_type == 'multiple' and isinstance(val, list):
                        for v in val:
                            if isinstance(v, int) and 0 <= v < len(option_counts):
                                option_counts[v] += 1
                        correct = set(map(int, q.get('correct_options') or []))
                        if has_correct and set(map(int, val)) == correct:
                            correct_count += 1

            stat['options'] = options
            stat['option_counts'] = option_counts
            if has_correct:
                stat['correct_count'] = correct_count
                total_correct += correct_count
                total_with_correct += stat['answer_count']

        elif q_type == 'text':
            text_answers = []
            correct_count = 0

            for fa in answers_list:
                for ans in fa.answers:
                    if ans.get('question_id') != q_id:
                        continue
                    val = ans.get('value')
                    if val is None:
                        continue
                    stat['answer_count'] += 1
                    val_str = str(val)
                    is_correct = None
                    if has_correct:
                        is_correct = val_str.strip().lower() == str(q.get('correct_text', '')).strip().lower()
                        if is_correct:
                            correct_count += 1
                    text_answers.append({
                        'student_id': fa.student_id,
                        'student_name': f'{fa.student.first_name} {fa.student.last_name}'.strip(),
                        'value': val_str,
                        'is_correct': is_correct,
                    })

            stat['text_answers'] = text_answers
            if has_correct:
                stat['correct_count'] = correct_count
                total_correct += correct_count
                total_with_correct += stat['answer_count']

        elif q_type == 'scale':
            values = []
            correct_count = 0

            for fa in answers_list:
                for ans in fa.answers:
                    if ans.get('question_id') != q_id:
                        continue
                    val = ans.get('value')
                    if val is None:
                        continue
                    stat['answer_count'] += 1
                    if isinstance(val, (int, float)):
                        values.append(val)
                        if has_correct and val == q.get('correct_scale'):
                            correct_count += 1

            stat['avg'] = round(sum(values) / len(values), 1) if values else None
            vc: dict = {}
            for v in values:
                k = str(int(v)) if isinstance(v, int) else str(v)
                vc[k] = vc.get(k, 0) + 1
            stat['value_counts'] = vc
            if has_correct:
                stat['correct_count'] = correct_count
                total_correct += correct_count
                total_with_correct += stat['answer_count']

        per_question.append(stat)

    # ── Per-student detail ──────────────────────────────────────────────────────
    details = []
    for fa in answers_list:
        ans_map = {a.get('question_id'): a.get('value') for a in fa.answers}
        student_correct = 0
        student_total = 0
        q_results = []

        for q in questions:
            q_id = q.get('id')
            val = ans_map.get(q_id)
            is_correct = _check_answer(q, val) if val is not None else None
            if is_correct is not None:
                student_total += 1
                if is_correct:
                    student_correct += 1
            q_results.append({
                'question_id': q_id,
                'value': val,
                'is_correct': is_correct,
            })

        details.append({
            'student_id': fa.student_id,
            'student_name': f'{fa.student.first_name} {fa.student.last_name}'.strip(),
            'answers': q_results,
            'correct_count': student_correct,
            'total_with_correct': student_total,
        })

    return {
        'summary': {
            'answered_count': len(answers_list),
            'total_questions': len(questions),
            'total_correct': total_correct,
            'total_with_correct': total_with_correct,
            'per_question': per_question,
        },
        'details': details,
    }
