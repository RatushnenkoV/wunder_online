import { useState } from 'react';
import type { ScheduleLesson, ClassSubject, TeacherOption, Room, ClassGroup } from '../../types';

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница',
};

interface Props {
  weekday: number;
  lessonNumber: number;
  lesson: ScheduleLesson | null;
  classSubjects: ClassSubject[];
  teachers: TeacherOption[];
  rooms: Room[];
  classGroups: ClassGroup[];
  slotLessons: ScheduleLesson[];
  currentClassId: number | null;
  onSave: (data: { subject_name: string; teacher: number | null; room: number | null; group: number | null }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function LessonEditor({
  weekday, lessonNumber, lesson, classSubjects, teachers, rooms, classGroups,
  slotLessons, currentClassId, onSave, onDelete, onClose,
}: Props) {
  const [subjectName, setSubjectName] = useState(lesson?.subject_name ?? '');
  const [teacherId, setTeacherId] = useState<number | ''>(lesson?.teacher ?? '');
  const [roomId, setRoomId] = useState<number | ''>(lesson?.room ?? '');
  const [groupId, setGroupId] = useState<number | ''>(lesson?.group ?? '');
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);

  // Determine which teachers/rooms are busy in this slot (excluding current lesson)
  const otherSlotLessons = slotLessons.filter(l => l.id !== lesson?.id);

  const busyTeacherIds = new Set(otherSlotLessons.filter(l => l.teacher).map(l => l.teacher!));
  const busyRoomIds = new Set(otherSlotLessons.filter(l => l.room).map(l => l.room!));

  const getTeacherBusyInfo = (id: number) => {
    const l = otherSlotLessons.find(sl => sl.teacher === id);
    return l ? `${l.subject_name}, ${l.class_name}` : '';
  };

  const getRoomBusyInfo = (id: number) => {
    const l = otherSlotLessons.find(sl => sl.room === id);
    return l ? `${l.subject_name}, ${l.class_name}` : '';
  };

  const freeTeachers = teachers.filter(t => !busyTeacherIds.has(t.id));
  const freeRooms = rooms.filter(r => !busyRoomIds.has(r.id));

  const displayedTeachers = showAllTeachers ? teachers : freeTeachers;
  const displayedRooms = showAllRooms ? rooms : freeRooms;

  // Unique subject names from class subjects
  const subjectOptions = [...new Set(classSubjects.map(cs => cs.name))].sort();

  const handleSubmit = () => {
    if (!subjectName) return;
    onSave({
      subject_name: subjectName,
      teacher: teacherId ? (teacherId as number) : null,
      room: roomId ? (roomId as number) : null,
      group: groupId ? (groupId as number) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">
          {lesson ? 'Редактировать урок' : 'Добавить урок'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {WEEKDAY_NAMES[weekday]}, урок {lessonNumber}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Предмет *</label>
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
            {subjectOptions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Нет предметов у класса. Добавьте предметы во вкладке класса.
              </p>
            )}
          </div>

          {classGroups.length >= 2 && (
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Учитель</label>
              <button
                type="button"
                onClick={() => setShowAllTeachers(!showAllTeachers)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showAllTeachers ? 'Только свободные' : 'Показать всех'}
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
                {showAllRooms ? 'Только свободные' : 'Показать все'}
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
                Удалить
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!subjectName}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
