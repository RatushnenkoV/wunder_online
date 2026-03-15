# WunderOnline — Модели данных

> Полный список всех Django-моделей по приложениям.
> После изменения модели: `python manage.py makemigrations && python manage.py migrate`

---

## accounts

### User (кастомная модель)
Файл: `backend/accounts/models.py`

| Поле | Тип | Описание |
|------|-----|---------|
| `username` | CharField unique | Автогенерируется: `first_name.last_name` |
| `first_name` | CharField | Имя (используется для входа) |
| `last_name` | CharField | Фамилия (используется для входа) |
| `email` | EmailField | Email (необязательный) |
| `phone` | CharField | Телефон |
| `birth_date` | DateField | Дата рождения |
| `is_admin` | BooleanField | Роль администратора |
| `is_teacher` | BooleanField | Роль учителя |
| `is_parent` | BooleanField | Роль родителя |
| `is_student` | BooleanField | Роль ученика (несовместима с остальными) |
| `is_spps` | BooleanField | Доп. роль СППС (teacher + spps) |
| `avatar` | ImageField | Аватар пользователя (upload_to='avatars/', nullable) |
| `must_change_password` | BooleanField | Принудительная смена при первом входе |
| `temp_password` | CharField | Временный пароль (показывается при создании) |

**Бизнес-правила:**
- `is_student=True` → автоматически снимаются все другие роли (в `User.save()`)
- СППС = `is_teacher=True` + `is_spps=True`
- Авторизация по first_name + last_name + password (не по username)

---

## school

Файл: `backend/school/models.py`

### GradeLevel
| Поле | Тип |
|------|-----|
| `number` | IntegerField unique |

### SchoolClass
| Поле | Тип |
|------|-----|
| `grade_level` | FK → GradeLevel |
| `letter` | CharField |
| `curator` | FK → User (nullable, учитель-куратор) |

### Subject
| Поле | Тип |
|------|-----|
| `name` | CharField unique |

### GradeLevelSubject
| Поле | Тип |
|------|-----|
| `grade_level` | FK → GradeLevel |
| `subject` | FK → Subject |
Unique together: (grade_level, subject)

### StudentProfile
| Поле | Тип |
|------|-----|
| `user` | OneToOneField → User |
| `school_class` | FK → SchoolClass |

### ParentProfile
| Поле | Тип |
|------|-----|
| `user` | OneToOneField → User |
| `children` | ManyToMany → StudentProfile |
| `telegram` | CharField nullable |

### TeacherProfile
| Поле | Тип |
|------|-----|
| `user` | OneToOneField → User |

### ClassGroup (подгруппы в классе)
| Поле | Тип |
|------|-----|
| `school_class` | FK → SchoolClass |
| `name` | CharField |
| `students` | ManyToMany → StudentProfile |

### ClassSubject (предметы конкретного класса)
| Поле | Тип |
|------|-----|
| `school_class` | FK → SchoolClass |
| `name` | CharField |
Unique together: (school_class, name)

### Room (кабинет)
| Поле | Тип |
|------|-----|
| `name` | CharField unique |

### ScheduleLesson
| Поле | Тип |
|------|-----|
| `school_class` | FK → SchoolClass |
| `weekday` | IntegerField (0=Пн … 5=Сб) |
| `lesson_number` | IntegerField (1-9) |
| `subject` | FK → Subject |
| `teacher` | FK → User |
| `room` | FK → Room |
| `group` | FK → ClassGroup nullable |

### Substitution (замена)
| Поле | Тип |
|------|-----|
| `date` | DateField |
| `lesson_number` | IntegerField |
| `school_class` | FK → SchoolClass |
| `subject` | FK → Subject |
| `teacher` | FK → User |
| `room` | FK → Room nullable |
| `original_lesson` | FK → ScheduleLesson nullable |
| `group` | FK → ClassGroup nullable |

### LessonTimeSlot (время урока)
| Поле | Тип |
|------|-----|
| `lesson_number` | PositiveSmallIntegerField (unique) |
| `time_start` | CharField (e.g. "8:15") |
| `time_end` | CharField (e.g. "9:00") |

Начальные данные: уроки 1–7 (миграция 0013).

### AhoRequest (АХО-заявка)
| Поле | Тип |
|------|-----|
| `name` | CharField |
| `description` | TextField |
| `location` | CharField |
| `phone` | CharField |
| `work_type` | CharField |
| `urgency` | CharField |
| `importance` | CharField |
| `submitted_by` | FK → User |
| `created_at` | DateTimeField auto |

---

## ktp

Файл: `backend/ktp/models.py`

### CTP (Календарно-тематический план)
| Поле | Тип |
|------|-----|
| `teacher` | FK → User |
| `school_class` | FK → SchoolClass |
| `subject` | FK → Subject |
| `is_public` | BooleanField |
| `created_at`, `updated_at` | DateTimeField |

### Topic
| Поле | Тип |
|------|-----|
| `ctp` | FK → CTP |
| `order` | IntegerField |
| `title` | CharField |
| `date` | DateField nullable |
| `homework` | TextField |
| `resources` | JSONField (список ресурсов) |
| `lesson` | FK → Lesson nullable |
| `comments` | TextField (Комментарии) |
| `self_study_links` | JSONField `[{title, url}]` (Ссылки на самообучение) |
| `additional_resources` | JSONField `[{title, url}]` (Дополнительные ресурсы) |
| `individual_folder` | JSONField `[{title, url}]` (Индивид. папка ученика) |
| `ksp` | TextField (КСП) |
| `presentation_link` | TextField (Ссылка на презентацию) |
| `created_at` | DateTimeField |

### TopicFile
| Поле | Тип |
|------|-----|
| `topic` | FK → Topic |
| `file` | FileField |
| `original_name` | CharField |
| `uploaded_at` | DateTimeField |

### Holiday
| Поле | Тип |
|------|-----|
| `date` | DateField unique |
| `description` | CharField |

### SchoolBreak
Периоды каникул (диапазоны дат). Пропускаются при распределении дат КТП.
| Поле | Тип |
|------|-----|
| `name` | CharField — например "Осенние каникулы" |
| `start_date` | DateField |
| `end_date` | DateField |

---

## tasks

Файл: `backend/tasks/models.py`

### TaskGroup
| Поле | Тип |
|------|-----|
| `name` | CharField |
| `description` | TextField |
| `created_by` | FK → User |
| `members` | ManyToMany → User |
| `created_at` | DateTimeField |

### Task
| Поле | Тип | Описание |
|------|-----|---------|
| `title` | CharField | |
| `description` | TextField | |
| `created_by` | FK → User | |
| `assigned_to` | FK → User nullable | Конкретный исполнитель |
| `assigned_group` | FK → TaskGroup nullable | Группа исполнителей |
| `taken_by` | FK → User nullable | Кто взял задачу |
| `status` | CharField | new / in_progress / review / done |
| `due_date` | DateField nullable | |
| `completed_at` | DateTimeField nullable | |
| `review_comment` | TextField | |
| `created_at`, `updated_at` | DateTimeField | |

### TaskFile
| Поле | Тип |
|------|-----|
| `task` | FK → Task |
| `file` | FileField |
| `original_name` | CharField |
| `uploaded_by` | FK → User |
| `uploaded_at` | DateTimeField |

---

## lessons

Файл: `backend/lessons/models.py`

### LessonFolder
| Поле | Тип |
|------|-----|
| `name` | CharField |
| `owner` | FK → User |
| `parent` | FK → self (nullable, вложенность) |
| `created_at` | DateTimeField |

### Lesson
| Поле | Тип |
|------|-----|
| `title` | CharField |
| `description` | TextField |
| `owner` | FK → User |
| `folder` | FK → LessonFolder nullable |
| `is_public` | BooleanField |
| `cover_color` | CharField (hex-цвет) |
| `created_at`, `updated_at` | DateTimeField |

### Slide
| Поле | Тип | Описание |
|------|-----|---------|
| `lesson` | FK → Lesson | |
| `order` | IntegerField | |
| `slide_type` | CharField | content / form / quiz / video / discussion / vocab / textbook / selfpaced / annotation / matching |
| `title` | CharField | |
| `content` | JSONField | Структура зависит от типа слайда |
| `image` | ImageField nullable | |
| `created_at`, `updated_at` | DateTimeField | |

### LessonSession (активная сессия урока)
| Поле | Тип |
|------|-----|
| `lesson` | FK → Lesson |
| `teacher` | FK → User |
| `school_class` | FK → SchoolClass nullable |
| `current_slide` | FK → Slide nullable |
| `is_active` | BooleanField |
| `started_at` | DateTimeField |
| `ended_at` | DateTimeField nullable |
| `discussion_data` | JSONField | Данные досок обсуждений per-slide: `{str(slide_id): board_data}` |

### FormAnswer (ответ студента на форму/тест)
| Поле | Тип | Описание |
|------|-----|---------|
| `session` | FK → LessonSession | |
| `slide` | FK → Slide | |
| `student` | FK → User | |
| `answers` | JSONField | `[{option_index, elapsed_ms, points}]` |
| `submitted_at` | DateTimeField | |

### Textbook (учебник PDF)
| Поле | Тип |
|------|-----|
| `title` | CharField |
| `file` | FileField |
| `original_name` | CharField |
| `file_size` | BigIntegerField |
| `subject` | FK → Subject nullable |
| `grade_levels` | ManyToMany → GradeLevel |
| `uploaded_by` | FK → User |
| `created_at` | DateTimeField |

### VocabProgress (прогресс слов)
| Поле | Тип |
|------|-----|
| `session` | FK → LessonSession |
| `slide` | FK → Slide |
| `student` | FK → User |
| `word_id` | CharField |
| `attempts` | IntegerField |
| `correct` | IntegerField |
| `learned` | BooleanField |
| `updated_at` | DateTimeField |

### TextbookAnnotation (аннотации на учебнике)
| Поле | Тип |
|------|-----|
| `session` | FK → LessonSession |
| `slide` | FK → Slide |
| `student` | FK → User |
| `page_number` | IntegerField |
| `strokes` | JSONField |
| `updated_at` | DateTimeField |

### LessonAssignment (назначение урока)
| Поле | Тип |
|------|-----|
| `lesson` | FK → Lesson |
| `school_class` | FK → SchoolClass nullable |
| `student` | FK → User nullable |
| `assigned_by` | FK → User |
| `due_date` | DateField nullable |
| `created_at` | DateTimeField |

---

## groups

Файл: `backend/groups/models.py`

### ChatRoom
| Поле | Тип | Описание |
|------|-----|---------|
| `room_type` | CharField | direct / class / group / task |
| `name` | CharField nullable | |
| `created_by` | FK → User | |
| `is_archived` | BooleanField | |
| `created_at` | DateTimeField | |

### ChatMember
| Поле | Тип |
|------|-----|
| `room` | FK → ChatRoom |
| `user` | FK → User |
| `role` | CharField (admin/member) |
| `last_read_at` | DateTimeField nullable |
| `joined_at` | DateTimeField |

### ChatMessage
| Поле | Тип |
|------|-----|
| `room` | FK → ChatRoom |
| `sender` | FK → User |
| `text` | TextField |
| `reply_to` | FK → self nullable |
| `task` | FK → Task nullable |
| `created_at`, `updated_at` | DateTimeField |
| `is_deleted` | BooleanField |

### MessageAttachment
| Поле | Тип |
|------|-----|
| `message` | FK → ChatMessage |
| `file` | FileField |
| `original_name` | CharField |
| `file_size` | BigIntegerField |
| `mime_type` | CharField |

### ChatPoll (опрос в чате)
| Поле | Тип |
|------|-----|
| `message` | OneToOneField → ChatMessage |
| `question` | CharField |
| `is_multiple` | BooleanField |
| `created_at` | DateTimeField |

### ChatPollOption
| Поле | Тип |
|------|-----|
| `poll` | FK → ChatPoll |
| `text` | CharField |
| `order` | IntegerField |

### ChatPollVote
| Поле | Тип |
|------|-----|
| `option` | FK → ChatPollOption |
| `user` | FK → User |
Unique together: (option, user)

### StudentChatRestriction (ограничения ученика в чате)
| Поле | Тип |
|------|-----|
| `student` | OneToOneField → User (is_student) |
| `set_by` | FK → User nullable |
| `message_cooldown` | PositiveIntegerField (сек, 0=нет) |
| `muted_until` | DateTimeField nullable |
| `no_links` | BooleanField |
| `no_files` | BooleanField |
| `no_polls` | BooleanField |
| `updated_at` | DateTimeField auto |

Управляется любым взрослым (is_admin/is_teacher/is_parent). Применяется глобально ко всем чатам.

### ChatTaskTake (взятие задачи через чат)
| Поле | Тип |
|------|-----|
| `message` | FK → ChatMessage |
| `user` | FK → User |
| `task` | FK → Task |
| `taken_at` | DateTimeField |
Unique together: (message, user, task)

### ChatAllowedEmoji (разрешённые эмодзи-реакции)
| Поле | Тип |
|------|-----|
| `emoji` | CharField |
| `order` | PositiveSmallIntegerField |
Defaults: `['👍', '❤️', '😂', '😮', '😢', '👏']` (заданы в коде при пустом списке)

### ChatReaction (реакции на сообщения)
| Поле | Тип |
|------|-----|
| `message` | FK → ChatMessage |
| `user` | FK → User |
| `emoji` | CharField |
Unique together: (message, user, emoji)

---

## projects

Файл: `backend/projects/models.py`

### Project
| Поле | Тип |
|------|-----|
| `name` | CharField |
| `description` | TextField |
| `cover_color` | CharField |
| `created_by` | FK → User |
| `created_at`, `updated_at` | DateTimeField |

### ProjectMember
| Поле | Тип |
|------|-----|
| `project` | FK → Project |
| `user` | FK → User |
| `role` | CharField (owner/teacher/student) |
| `joined_at` | DateTimeField |
Unique together: (project, user)

### ProjectPost
| Поле | Тип |
|------|-----|
| `project` | FK → Project |
| `author` | FK → User |
| `text` | TextField |
| `is_deleted` | BooleanField |
| `created_at`, `updated_at` | DateTimeField |

### PostAttachment
| Поле | Тип |
|------|-----|
| `post` | FK → ProjectPost |
| `file` | FileField |
| `original_name` | CharField |
| `file_size` | BigIntegerField |
| `mime_type` | CharField |

### ProjectAssignment
| Поле | Тип |
|------|-----|
| `project` | FK → Project |
| `title` | CharField |
| `description` | TextField |
| `due_date` | DateField nullable |
| `lesson` | FK → Lesson nullable |
| `created_by` | FK → User |
| `created_at`, `updated_at` | DateTimeField |

### AssignmentAttachment
| Поле | Тип |
|------|-----|
| `assignment` | FK → ProjectAssignment |
| `file` | FileField |
| `original_name`, `file_size`, `mime_type` | CharField / BigInt |

### AssignmentSubmission
| Поле | Тип |
|------|-----|
| `assignment` | FK → ProjectAssignment |
| `student` | FK → User |
| `task` | FK → Task nullable |
| `text` | TextField |
| `submitted_at` | DateTimeField nullable |
| `events` | JSONField (история действий) |
| `grade` | CharField nullable |
| `graded_by` | FK → User nullable |
| `graded_at` | DateTimeField nullable |
Unique together: (assignment, student)

### SubmissionFile
| Поле | Тип |
|------|-----|
| `submission` | FK → AssignmentSubmission |
| `file` | FileField |
| `original_name`, `file_size`, `mime_type` | CharField / BigInt |

---

## curator

Файл: `backend/curator/models.py`

### CuratorSection
| Поле | Тип |
|------|-----|
| `name` | CharField |
| `order` | IntegerField |

### CuratorField
| Поле | Тип |
|------|-----|
| `section` | FK → CuratorSection |
| `name` | CharField |
| `order` | IntegerField |

### CuratorHint
| Поле | Тип |
|------|-----|
| `field` | FK → CuratorField |
| `text` | CharField |

### CuratorReport
| Поле | Тип |
|------|-----|
| `student` | FK → User |
| `academic_year` | CharField |
| `created_by` | FK → User |
| `updated_at` | DateTimeField |
Unique together: (student, academic_year)

### CuratorReportValue
| Поле | Тип |
|------|-----|
| `report` | FK → CuratorReport |
| `field` | FK → CuratorField |
| `value` | TextField |
Unique together: (report, field)

---

## yellow_list

Файл: `backend/yellow_list/models.py`

### YellowListEntry
| Поле | Тип |
|------|-----|
| `date` | DateField |
| `student` | FK → User |
| `fact` | TextField (описание инцидента) |
| `lesson` | CharField (предмет/урок) |
| `submitted_by` | FK → User |
| `created_at` | DateTimeField |
| `is_read_by_spps` | BooleanField |

### YellowListComment
| Поле | Тип |
|------|-----|
| `entry` | FK → YellowListEntry |
| `text` | TextField |
| `created_by` | FK → User |
| `created_at` | DateTimeField |

---

## news

Файл: `backend/news/models.py`

### NewsPost
| Поле | Тип | Описание |
|------|-----|---------|
| `title` | CharField | |
| `content` | TextField (HTML/JSON Tiptap) | |
| `author` | FK → User | |
| `created_at`, `updated_at` | DateTimeField | |
| `is_published` | BooleanField | |
| `for_staff` | BooleanField | Видно сотрудникам |
| `for_parents` | BooleanField | Видно ученикам и родителям |

**Видимость:**
- admin → все посты
- teacher/spps → `for_staff=True`
- parent/student → `for_parents=True`

### NewsImage
| Поле | Тип |
|------|-----|
| `image` | ImageField |
| `uploaded_by` | FK → User |
| `uploaded_at` | DateTimeField |

### NewsRead (трекинг прочтений)
| Поле | Тип |
|------|-----|
| `post` | FK → NewsPost |
| `user` | FK → User |
| `read_at` | DateTimeField |
Unique together: (post, user)

### NewsReaction (реакции на новости)
| Поле | Тип |
|------|-----|
| `post` | FK → NewsPost |
| `user` | FK → User |
| `emoji` | CharField (одна из: 👍❤️😂😮😢👏) |
| `created_at` | DateTimeField |
Unique together: (post, user) — одна реакция на пользователя на пост.

---

## Итоговая статистика

| Метрика | Значение |
|---------|---------|
| Django-приложений | 10 |
| Моделей | ~60 |
| Файловых полей (FileField/ImageField) | ~15 |
| WebSocket-консьюмеров | 3 |
| JSONField-полей | ~8 |

---

## events

Файл: `backend/events/models.py`

### SchoolEvent
| Поле | Тип | Описание |
|------|-----|---------|
| `date_start` | DateField (db_index) | Дата начала мероприятия |
| `date_end` | DateField (null/blank, db_index) | Дата окончания (для многодневных) |
| `time_note` | CharField(100) | Время: "09:00", "Весь день", "19.00" |
| `target_classes` | CharField(300) | Классы: "Вся школа", "3А, 5Б" |
| `organizers` | CharField(300) | Организаторы (текст) |
| `description` | TextField | Название/описание мероприятия |
| `responsible` | CharField(200) | Ответственный |
| `helper` | CharField(300) | Помощники |
| `event_type` | CharField(50, choices) | Тип: holiday/teambuilding/cross_subject/subject/training/other |
| `approved` | CharField(30, choices) | Согласование: yes/no/rescheduled/pending |
| `cost` | CharField(200) | Стоимость (текст) |
| `status` | CharField(200) | Статус: "Отменено", "Проведено", "Перенесено" |
| `created_by` | FK → User (SET_NULL) | Автор |
