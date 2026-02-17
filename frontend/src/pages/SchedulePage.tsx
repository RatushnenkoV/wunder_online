import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { SchoolClass, TeacherOption, Room, ScheduleLesson, ClassSubject } from '../types';
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
  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [editing, setEditing] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(isMobile ? 'day' : 'week');
  const [selectedDay, setSelectedDay] = useState(getCurrentWeekday());

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);

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

  // Load class subjects when a class is selected
  useEffect(() => {
    if (viewMode === 'class' && selectedId) {
      api.get(`/school/classes/${selectedId}/subjects/`).then(res => setClassSubjects(res.data));
    } else {
      setClassSubjects([]);
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

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const currentOptions = viewMode === 'class' ? classes.map(c => ({ id: c.id, label: c.display_name }))
    : viewMode === 'teacher' ? teachers.map(t => ({ id: t.id, label: `${t.last_name} ${t.first_name}` }))
    : rooms.map(r => ({ id: r.id, label: r.name }));

  const handleCellClick = async (weekday: number, lessonNumber: number) => {
    if (!editing || viewMode !== 'class') return;
    const existing = lessons.find(l => l.weekday === weekday && l.lesson_number === lessonNumber);
    setEditLesson(existing || null);
    setEditCell({ weekday, lessonNumber });

    // Load all lessons for this slot to determine availability
    const res = await api.get('/school/schedule/', { params: { weekday, lesson_number: lessonNumber } });
    setSlotLessons(res.data);
  };

  const handleSave = async (data: { subject_name: string; teacher: number | null; room: number | null }) => {
    if (!editCell || !selectedId) return;

    if (editLesson) {
      await api.put(`/school/schedule/${editLesson.id}/`, data);
    } else {
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
  };

  const handleDelete = async () => {
    if (!editLesson) return;
    await api.delete(`/school/schedule/${editLesson.id}/`);
    setEditCell(null);
    setEditLesson(null);
    setSlotLessons([]);
    loadLessons();
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
          {user?.is_admin && viewMode === 'class' && selectedId && (
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
          viewMode={viewMode}
          editing={editing}
          onCellClick={handleCellClick}
          displayMode={displayMode}
          selectedDay={selectedDay}
        />
      )}

      {editCell && (
        <LessonEditor
          weekday={editCell.weekday}
          lessonNumber={editCell.lessonNumber}
          lesson={editLesson}
          classSubjects={classSubjects}
          teachers={teachers}
          rooms={rooms}
          slotLessons={slotLessons}
          currentClassId={selectedId}
          onSave={handleSave}
          onDelete={editLesson ? handleDelete : undefined}
          onClose={() => { setEditCell(null); setEditLesson(null); setSlotLessons([]); }}
        />
      )}
    </div>
  );
}
