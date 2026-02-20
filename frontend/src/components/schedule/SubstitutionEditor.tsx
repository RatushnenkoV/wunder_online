import { useState } from 'react';
import type { ScheduleLesson, Substitution, TeacherOption, Room, SchoolClass, ClassSubject, ClassGroup } from '../../types';

interface Props {
  date: string; // YYYY-MM-DD
  lessonNumber: number;
  originalLesson: ScheduleLesson | null;
  existingSub: Substitution | null;
  teachers: TeacherOption[];
  rooms: Room[];
  classes: SchoolClass[];
  classSubjects: ClassSubject[];
  classGroups: ClassGroup[];
  allLessons: ScheduleLesson[];
  allSubstitutions: Substitution[];
  currentClassId: number | null;
  onSave: (data: {
    school_class: number;
    subject_name: string;
    teacher: number | null;
    room: number | null;
    group: number | null;
    original_lesson: number | null;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function SubstitutionEditor({
  date, lessonNumber, originalLesson, existingSub,
  teachers, rooms, classes, classSubjects, classGroups,
  allLessons, allSubstitutions, currentClassId,
  onSave, onDelete, onClose,
}: Props) {
  const [classId, setClassId] = useState<number>(
    existingSub?.school_class ?? currentClassId ?? (classes[0]?.id ?? 0),
  );
  const [subjectName, setSubjectName] = useState(
    existingSub?.subject_name ?? originalLesson?.subject_name ?? '',
  );
  const [teacherId, setTeacherId] = useState<number | ''>(
    existingSub?.teacher ?? originalLesson?.teacher ?? '',
  );
  const [roomId, setRoomId] = useState<number | ''>(
    existingSub?.room ?? originalLesson?.room ?? '',
  );
  const [groupId, setGroupId] = useState<number | ''>(
    existingSub?.group ?? originalLesson?.group ?? '',
  );
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);

  const weekday = new Date(date + 'T00:00:00').getDay();

  // Compute busy teachers/rooms: regular schedule + other subs on this date+period
  const regularBusyTeachers = new Set(
    allLessons
      .filter(l => l.weekday === weekday && l.lesson_number === lessonNumber && l.teacher)
      .map(l => l.teacher!),
  );
  const subBusyTeachers = new Set(
    allSubstitutions
      .filter(s => s.date === date && s.lesson_number === lessonNumber && s.id !== existingSub?.id && s.teacher)
      .map(s => s.teacher!),
  );
  const classesWithSubs = new Set(
    allSubstitutions
      .filter(s => s.date === date && s.lesson_number === lessonNumber && s.id !== existingSub?.id)
      .map(s => s.school_class),
  );
  const freedTeachers = new Set(
    allLessons
      .filter(l => l.weekday === weekday && l.lesson_number === lessonNumber && classesWithSubs.has(l.school_class) && l.teacher)
      .map(l => l.teacher!),
  );
  const busyTeacherIds = new Set([
    ...[...regularBusyTeachers].filter(id => !freedTeachers.has(id)),
    ...subBusyTeachers,
  ]);

  const regularBusyRooms = new Set(
    allLessons
      .filter(l => l.weekday === weekday && l.lesson_number === lessonNumber && l.room)
      .map(l => l.room!),
  );
  const subBusyRooms = new Set(
    allSubstitutions
      .filter(s => s.date === date && s.lesson_number === lessonNumber && s.id !== existingSub?.id && s.room)
      .map(s => s.room!),
  );
  const freedRooms = new Set(
    allLessons
      .filter(l => l.weekday === weekday && l.lesson_number === lessonNumber && classesWithSubs.has(l.school_class) && l.room)
      .map(l => l.room!),
  );
  const busyRoomIds = new Set([
    ...[...regularBusyRooms].filter(id => !freedRooms.has(id)),
    ...subBusyRooms,
  ]);

  const freeTeachers = teachers.filter(t => !busyTeacherIds.has(t.id));
  const freeRooms = rooms.filter(r => !busyRoomIds.has(r.id));
  const displayedTeachers = showAllTeachers ? teachers : freeTeachers;
  const displayedRooms = showAllRooms ? rooms : freeRooms;

  const getTeacherBusyInfo = (id: number) => {
    const fromSub = allSubstitutions.find(s =>
      s.date === date && s.lesson_number === lessonNumber && s.teacher === id && s.id !== existingSub?.id,
    );
    if (fromSub) return `замена: ${fromSub.subject_name}, ${fromSub.class_name}`;
    const fromReg = allLessons.find(l => l.weekday === weekday && l.lesson_number === lessonNumber && l.teacher === id);
    if (fromReg) return `${fromReg.subject_name}, ${fromReg.class_name}`;
    return '';
  };

  const getRoomBusyInfo = (id: number) => {
    const fromSub = allSubstitutions.find(s =>
      s.date === date && s.lesson_number === lessonNumber && s.room === id && s.id !== existingSub?.id,
    );
    if (fromSub) return `замена: ${fromSub.subject_name}, ${fromSub.class_name}`;
    const fromReg = allLessons.find(l => l.weekday === weekday && l.lesson_number === lessonNumber && l.room === id);
    if (fromReg) return `${fromReg.subject_name}, ${fromReg.class_name}`;
    return '';
  };

  const subjectOptions = [...new Set(classSubjects.map(cs => cs.name))].sort();
  const showGroupSelector = classGroups.length >= 2;

  const handleSubmit = () => {
    if (!subjectName || !classId) return;
    onSave({
      school_class: classId,
      subject_name: subjectName,
      teacher: teacherId ? (teacherId as number) : null,
      room: roomId ? (roomId as number) : null,
      group: groupId ? (groupId as number) : null,
      original_lesson: originalLesson?.id ?? null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">
          {existingSub ? 'Редактировать замену' : 'Добавить замену'}
        </h3>
        <p className="text-sm text-gray-500 mb-4 capitalize">
          {formatDate(date)}, урок {lessonNumber}
        </p>

        {originalLesson && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">По расписанию</div>
            {originalLesson.group_name && (
              <div className="text-xs text-blue-500 font-medium">{originalLesson.group_name}</div>
            )}
            <div className="font-medium text-gray-700">{originalLesson.subject_name}</div>
            {originalLesson.teacher_name && <div className="text-gray-500">{originalLesson.teacher_name}</div>}
            {originalLesson.room_name && <div className="text-gray-400">каб. {originalLesson.room_name}</div>}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Класс *</label>
            <select
              value={classId}
              onChange={e => setClassId(Number(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>

          {showGroupSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Группа</label>
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Весь класс</option>
                {classGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Предмет *</label>
            {subjectOptions.length > 0 ? (
              <select
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">-- Выберите предмет --</option>
                {subjectOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                placeholder="Введите название предмета"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Учитель</label>
              <button
                type="button"
                onClick={() => setShowAllTeachers(!showAllTeachers)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showAllTeachers ? 'Только свободные' : `Показать всех (${teachers.length})`}
              </button>
            </div>
            <select
              value={teacherId}
              onChange={e => setTeacherId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- Не указан --</option>
              {displayedTeachers.map(t => {
                const busy = busyTeacherIds.has(t.id);
                const info = busy ? ` [${getTeacherBusyInfo(t.id)}]` : '';
                return (
                  <option key={t.id} value={t.id} className={busy ? 'text-red-600' : ''}>
                    {t.last_name} {t.first_name}{info}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Кабинет</label>
              <button
                type="button"
                onClick={() => setShowAllRooms(!showAllRooms)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showAllRooms ? 'Только свободные' : `Показать все (${rooms.length})`}
              </button>
            </div>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- Не указан --</option>
              {displayedRooms.map(r => {
                const busy = busyRoomIds.has(r.id);
                const info = busy ? ` [${getRoomBusyInfo(r.id)}]` : '';
                return (
                  <option key={r.id} value={r.id} className={busy ? 'text-red-600' : ''}>
                    {r.name}{info}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <div>
            {onDelete && (
              <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-sm">
                Удалить замену
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!subjectName || !classId}
              className="px-4 py-2 bg-amber-500 text-white rounded text-sm hover:bg-amber-600 disabled:opacity-50"
            >
              Сохранить замену
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
