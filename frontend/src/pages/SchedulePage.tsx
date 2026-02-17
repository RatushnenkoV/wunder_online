import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { SchoolClass, TeacherOption, Room, ScheduleLesson, ClassSubject, ClassGroup } from '../types';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import LessonEditor from '../components/schedule/LessonEditor';

type ViewMode = 'class' | 'teacher' | 'room';
type DisplayMode = 'week' | 'day';

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'class', label: 'По классу' },
  { key: 'teacher', label: 'По учителю' },
  { key: 'room', label: 'По кабинету' },
];

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница',
};

function getCurrentWeekday(): number {
  const day = new Date().getDay();
  return day >= 1 && day <= 5 ? day : 1;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(user?.is_teacher ? 'teacher' : 'class');
  const [selectedId, setSelectedId] = useState<number | null>(user?.is_teacher ? user.id : null);
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [allLessons, setAllLessons] = useState<ScheduleLesson[]>([]);
  const [editing, setEditing] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(isMobile ? 'day' : 'week');
  const [selectedDay, setSelectedDay] = useState(getCurrentWeekday());

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);

  const [editCell, setEditCell] = useState<{ weekday: number; lessonNumber: number } | null>(null);
  const [editLesson, setEditLesson] = useState<ScheduleLesson | null>(null);
  const [slotLessons, setSlotLessons] = useState<ScheduleLesson[]>([]);

  useEffect(() => {
    if (isMobile && displayMode === 'week') setDisplayMode('day');
  }, [isMobile]);

  useEffect(() => {
    const loadOptions = async () => {
      const [classesRes, teachersRes, roomsRes] = await Promise.all([
        api.get('/school/classes/'),
        api.get('/school/teachers/'),
        api.get('/school/rooms/'),
      ]);
      setClasses(classesRes.data);
      setTeachers(teachersRes.data);
      setRooms(roomsRes.data);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (viewMode === 'class' && selectedId) {
      Promise.all([
        api.get(`/school/classes/${selectedId}/subjects/`),
        api.get(`/school/classes/${selectedId}/groups/`),
      ]).then(([subjectsRes, groupsRes]) => {
        setClassSubjects(subjectsRes.data);
        setClassGroups(groupsRes.data);
      });
    } else {
      setClassSubjects([]);
      setClassGroups([]);
    }
  }, [viewMode, selectedId]);

  const loadLessons = useCallback(async () => {
    if (!selectedId) { setLessons([]); return; }
    const params: Record<string, number> = {};
    if (viewMode === 'class') params.school_class = selectedId;
    else if (viewMode === 'teacher') params.teacher = selectedId;
    else if (viewMode === 'room') params.room = selectedId;

    const res = await api.get('/school/schedule/', { params });
    setLessons(res.data);
  }, [selectedId, viewMode]);

  const loadAllLessons = useCallback(async () => {
    if (!selectedId) { setAllLessons([]); return; }
    const res = await api.get('/school/schedule/all/');
    setAllLessons(res.data);
  }, [selectedId]);

  useEffect(() => { loadLessons(); loadAllLessons(); }, [loadLessons, loadAllLessons]);

  const currentOptions = viewMode === 'class' ? classes.map(c => ({ id: c.id, label: c.display_name }))
    : viewMode === 'teacher' ? teachers.map(t => ({ id: t.id, label: `${t.last_name} ${t.first_name}` }))
    : rooms.map(r => ({ id: r.id, label: r.name }));

  const loadClassData = async (classId: number) => {
    const [subjectsRes, groupsRes] = await Promise.all([
      api.get(`/school/classes/${classId}/subjects/`),
      api.get(`/school/classes/${classId}/groups/`),
    ]);
    setClassSubjects(subjectsRes.data);
    setClassGroups(groupsRes.data);
  };

  const handleCellClick = async (weekday: number, lessonNumber: number, lesson?: ScheduleLesson) => {
    if (!editing) return;
    // Can't create new lessons in teacher/room view (no class context)
    if (!lesson && viewMode !== 'class') return;

    setEditLesson(lesson || null);
    setEditCell({ weekday, lessonNumber });

    if (lesson && viewMode !== 'class') {
      await loadClassData(lesson.school_class);
    }

    const res = await api.get('/school/schedule/', { params: { weekday, lesson_number: lessonNumber } });
    setSlotLessons(res.data);
  };

  const handleSave = async (data: { subject_name: string; teacher: number | null; room: number | null; group: number | null }) => {
    if (!editCell) return;

    if (editLesson) {
      await api.put(`/school/schedule/${editLesson.id}/`, data);
    } else {
      if (!selectedId) return;
      await api.post('/school/schedule/create/', {
        school_class: selectedId,
        weekday: editCell.weekday,
        lesson_number: editCell.lessonNumber,
        ...data,
      });
    }
    setEditCell(null);
    setEditLesson(null);
    setSlotLessons([]);
    loadLessons();
    loadAllLessons();
  };

  const handleDelete = async (lesson?: ScheduleLesson) => {
    const target = lesson || editLesson;
    if (!target) return;
    await api.delete(`/school/schedule/${target.id}/`);
    setEditCell(null);
    setEditLesson(null);
    setSlotLessons([]);
    loadLessons();
    loadAllLessons();
  };

  const handleEdit = async (lesson: ScheduleLesson) => {
    setEditLesson(lesson);
    setEditCell({ weekday: lesson.weekday, lessonNumber: lesson.lesson_number });

    if (viewMode !== 'class') {
      await loadClassData(lesson.school_class);
    }

    const res = await api.get('/school/schedule/', { params: { weekday: lesson.weekday, lesson_number: lesson.lesson_number } });
    setSlotLessons(res.data);
  };

  const handleMove = async (lessonId: number, toWeekday: number, toLessonNumber: number) => {
    await api.put(`/school/schedule/${lessonId}/`, { weekday: toWeekday, lesson_number: toLessonNumber });
    loadLessons();
    loadAllLessons();
  };

  const handleDuplicate = async (lesson: ScheduleLesson, toWeekday: number, toLessonNumber: number) => {
    if (!selectedId) return;
    await api.post('/school/schedule/create/', {
      school_class: lesson.school_class,
      weekday: toWeekday,
      lesson_number: toLessonNumber,
      subject_name: lesson.subject_name,
      teacher: lesson.teacher,
      room: lesson.room,
      group: lesson.group,
    });
    loadLessons();
    loadAllLessons();
  };

  const handleSplit = async (lesson: ScheduleLesson) => {
    if (classGroups.length < 2) {
      alert('Для разделения на подгруппы нужно создать минимум 2 группы в настройках класса');
      return;
    }
    const g1 = classGroups[0];
    const g2 = classGroups[1];

    // Assign existing lesson to group 1, create copy for group 2
    await api.put(`/school/schedule/${lesson.id}/`, { group: g1.id });
    await api.post('/school/schedule/create/', {
      school_class: lesson.school_class,
      weekday: lesson.weekday,
      lesson_number: lesson.lesson_number,
      subject_name: lesson.subject_name,
      teacher: lesson.teacher,
      room: lesson.room,
      group: g2.id,
    });
    loadLessons();
    loadAllLessons();
  };

  const handleMerge = async (lesson: ScheduleLesson) => {
    // Find the other lesson in same slot with a different group
    const otherLessons = lessons.filter(l =>
      l.weekday === lesson.weekday &&
      l.lesson_number === lesson.lesson_number &&
      l.id !== lesson.id
    );
    // Delete all others
    for (const other of otherLessons) {
      await api.delete(`/school/schedule/${other.id}/`);
    }
    // Set remaining lesson group to null
    await api.put(`/school/schedule/${lesson.id}/`, { group: null });
    loadLessons();
    loadAllLessons();
  };

  const displayedLessons = displayMode === 'day'
    ? lessons.filter(l => l.weekday === selectedDay)
    : lessons;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Расписание</h1>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setDisplayMode('week')}
                className={`px-3 py-1.5 text-sm ${displayMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >Неделя</button>
              <button
                onClick={() => setDisplayMode('day')}
                className={`px-3 py-1.5 text-sm ${displayMode === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >День</button>
            </div>
          )}
          {user?.is_admin && selectedId && (
            <button
              onClick={() => setEditing(!editing)}
              className={`px-4 py-2 rounded text-sm ${
                editing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {editing ? 'Готово' : 'Редактировать'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border">
          {VIEW_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setViewMode(m.key); setSelectedId(null); setEditing(false); }}
              className={`px-4 py-2 text-sm ${
                viewMode === m.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <select
          value={selectedId ?? ''}
          onChange={e => { setSelectedId(e.target.value ? Number(e.target.value) : null); setEditing(false); }}
          className="border rounded px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">-- Выберите --</option>
          {currentOptions.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {displayMode === 'day' && selectedId && (
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded text-sm ${
                selectedDay === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {WEEKDAY_LABELS[d].slice(0, 2)}
            </button>
          ))}
        </div>
      )}

      {!selectedId ? (
        <p className="text-gray-400 text-sm">Выберите элемент для отображения расписания</p>
      ) : (
        <ScheduleGrid
          lessons={displayedLessons}
          allLessons={allLessons}
          viewMode={viewMode}
          editing={editing}
          onCellClick={handleCellClick}
          onDelete={lesson => handleDelete(lesson)}
          onEdit={handleEdit}
          onMove={handleMove}
          onDuplicate={handleDuplicate}
          onSplit={handleSplit}
          onMerge={handleMerge}
          displayMode={displayMode}
          selectedDay={selectedDay}
          classGroups={classGroups}
        />
      )}

      {selectedId && lessons.length > 0 && (viewMode === 'class' || viewMode === 'teacher') && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            {viewMode === 'class' ? 'Часы по предметам' : 'Часы по предметам'}
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Предмет</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Часов в неделю</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(
                  lessons.reduce<Record<string, number>>((acc, l) => {
                    acc[l.subject_name] = (acc[l.subject_name] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                  .map(([name, count]) => (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="px-4 py-1.5">{name}</td>
                      <td className="px-4 py-1.5 text-right text-gray-500">{count}</td>
                    </tr>
                  ))
                }
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-1.5">Итого</td>
                  <td className="px-4 py-1.5 text-right">{lessons.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editCell && (
        <LessonEditor
          weekday={editCell.weekday}
          lessonNumber={editCell.lessonNumber}
          lesson={editLesson}
          classSubjects={classSubjects}
          teachers={teachers}
          rooms={rooms}
          classGroups={classGroups}
          slotLessons={slotLessons}
          currentClassId={editLesson ? editLesson.school_class : selectedId}
          onSave={handleSave}
          onDelete={editLesson ? () => handleDelete() : undefined}
          onClose={() => { setEditCell(null); setEditLesson(null); setSlotLessons([]); }}
        />
      )}
    </div>
  );
}
