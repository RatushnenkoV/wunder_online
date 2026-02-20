import { useState } from 'react';
import type { ScheduleLesson, ClassGroup } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

const WEEKDAYS = [
  { num: 1, short: 'Пн', full: 'Понедельник' },
  { num: 2, short: 'Вт', full: 'Вторник' },
  { num: 3, short: 'Ср', full: 'Среда' },
  { num: 4, short: 'Чт', full: 'Четверг' },
  { num: 5, short: 'Пт', full: 'Пятница' },
];

const LESSON_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  lessons: ScheduleLesson[];
  allLessons: ScheduleLesson[];
  viewMode: 'class' | 'teacher' | 'room';
  editing: boolean;
  onCellClick: (weekday: number, lessonNumber: number, lesson?: ScheduleLesson) => void;
  onDelete: (lesson: ScheduleLesson) => void;
  onEdit: (lesson: ScheduleLesson) => void;
  onMove: (lessonId: number, toWeekday: number, toLessonNumber: number) => void;
  onDuplicate: (lesson: ScheduleLesson, toWeekday: number, toLessonNumber: number) => void;
  onSplit: (lesson: ScheduleLesson) => void;
  onMerge: (lesson: ScheduleLesson) => void;
  displayMode: 'week' | 'day';
  selectedDay: number;
  classGroups: ClassGroup[];
}

export default function ScheduleGrid({
  lessons, allLessons, viewMode, editing,
  onCellClick, onDelete, onEdit, onMove, onDuplicate, onSplit, onMerge,
  displayMode, selectedDay, classGroups,
}: Props) {
  const [ctxMenu, setCtxMenu] = useState<{ lesson: ScheduleLesson; x: number; y: number } | null>(null);
  const [dragLesson, setDragLesson] = useState<ScheduleLesson | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ weekday: number; lessonNumber: number } | null>(null);
  const [duplicating, setDuplicating] = useState<ScheduleLesson | null>(null);

  const getCellLessons = (weekday: number, lessonNumber: number) =>
    lessons.filter(l => l.weekday === weekday && l.lesson_number === lessonNumber);

  const getConflictReasons = (lesson: ScheduleLesson): string[] => {
    const reasons: string[] = [];
    const seen = new Set<string>();
    allLessons.forEach(other => {
      if (other.id === lesson.id) return;
      if (other.weekday !== lesson.weekday || other.lesson_number !== lesson.lesson_number) return;
      if (lesson.teacher && other.teacher === lesson.teacher) {
        const key = `teacher-${other.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          reasons.push(`${lesson.teacher_name} — ${other.subject_name}, ${other.class_name}${other.group_name ? ` (${other.group_name})` : ''}`);
        }
      }
      if (lesson.room && other.room === lesson.room) {
        const key = `room-${other.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          reasons.push(`каб. ${lesson.room_name} — ${other.subject_name}, ${other.class_name}${other.group_name ? ` (${other.group_name})` : ''}`);
        }
      }
    });
    return reasons;
  };

  const hasConflict = (lesson: ScheduleLesson): boolean => {
    return allLessons.some(other =>
      other.id !== lesson.id &&
      other.weekday === lesson.weekday &&
      other.lesson_number === lesson.lesson_number &&
      ((lesson.teacher && other.teacher === lesson.teacher) ||
       (lesson.room && other.room === lesson.room))
    );
  };

  const isCellEmpty = (weekday: number, lessonNumber: number) =>
    getCellLessons(weekday, lessonNumber).length === 0;

  // Can a lesson be dropped into this cell?
  const canDropInto = (weekday: number, lessonNumber: number, lesson: ScheduleLesson): boolean => {
    const cell = getCellLessons(weekday, lessonNumber);
    if (cell.length === 0) return true;
    // Allow dropping a group lesson into a cell that has exactly 1 group lesson (different group)
    if (lesson.group && cell.length === 1 && cell[0].group !== null && cell[0].group !== lesson.group) return true;
    return false;
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, lesson: ScheduleLesson) => {
    if (!editing) return;
    setDragLesson(lesson);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, weekday: number, lessonNumber: number) => {
    if (!dragLesson && !duplicating) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ weekday, lessonNumber });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, weekday: number, lessonNumber: number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!dragLesson) return;
    if (!canDropInto(weekday, lessonNumber, dragLesson)) {
      setDragLesson(null);
      return;
    }
    if (dragLesson.weekday === weekday && dragLesson.lesson_number === lessonNumber) {
      setDragLesson(null);
      return;
    }
    onMove(dragLesson.id, weekday, lessonNumber);
    setDragLesson(null);
  };

  const handleDragEnd = () => {
    setDragLesson(null);
    setDragOverCell(null);
  };

  // Click handlers
  const handleCellClick = (weekday: number, lessonNumber: number, lesson?: ScheduleLesson) => {
    if (duplicating) {
      if (isCellEmpty(weekday, lessonNumber)) {
        onDuplicate(duplicating, weekday, lessonNumber);
      }
      setDuplicating(null);
      return;
    }
    onCellClick(weekday, lessonNumber, lesson);
  };

  const handleContextMenu = (e: React.MouseEvent, lesson: ScheduleLesson) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ lesson, x: e.clientX, y: e.clientY });
  };

  const getMenuItems = (lesson: ScheduleLesson): MenuItem[] => {
    const items: MenuItem[] = [
      { label: 'Редактировать', onClick: () => onEdit(lesson) },
      { label: 'Дублировать', onClick: () => setDuplicating(lesson) },
    ];

    if (viewMode === 'class') {
      if (lesson.group === null) {
        if (classGroups.length >= 2) {
          items.push({ label: 'Разделить на подгруппы', onClick: () => onSplit(lesson) });
        }
      } else {
        items.push({ label: 'Объединить подгруппы', onClick: () => onMerge(lesson) });
      }
    }

    items.push({ label: 'Удалить', onClick: () => onDelete(lesson), danger: true });
    return items;
  };

  const visibleDays = displayMode === 'day'
    ? WEEKDAYS.filter(d => d.num === selectedDay)
    : WEEKDAYS;

  const isDragTarget = (weekday: number, lessonNumber: number) =>
    dragOverCell?.weekday === weekday && dragOverCell?.lessonNumber === lessonNumber;

  // Render a single lesson card (full or half)
  const renderLessonCard = (
    lesson: ScheduleLesson,
    isHalf: boolean,
    side?: 'left' | 'right',
  ) => {
    const conflict = hasConflict(lesson);
    const reasons = conflict ? getConflictReasons(lesson) : [];
    const isDragging = dragLesson?.id === lesson.id;

    const roundedClass = isHalf
      ? side === 'left' ? 'rounded-l-lg' : 'rounded-r-lg'
      : 'rounded-lg';

    return (
      <div
        key={lesson.id}
        draggable={editing}
        onDragStart={e => handleDragStart(e, lesson)}
        onDragEnd={handleDragEnd}
        onContextMenu={e => handleContextMenu(e, lesson)}
        onClick={e => { e.stopPropagation(); handleCellClick(lesson.weekday, lesson.lesson_number, lesson); }}
        className={`group/card relative ${roundedClass} px-2 py-1.5 h-full text-xs leading-tight transition flex-1 min-w-0 ${
          conflict
            ? 'bg-red-50 shadow-sm border border-red-200'
            : 'bg-white shadow-sm border border-gray-100'
        } ${editing ? 'cursor-grab active:cursor-grabbing' : ''} ${
          isDragging ? 'opacity-30' : ''
        } ${duplicating ? 'cursor-pointer' : ''}`}
      >
        {lesson.group_name && (
          <div className="text-[10px] font-medium text-blue-500 truncate mb-0.5">{lesson.group_name}</div>
        )}
        <div className={`font-medium truncate ${conflict ? 'text-red-700' : 'text-gray-900'}`}>{lesson.subject_name}</div>
        {viewMode !== 'class' && (
          <div className={`truncate ${conflict ? 'text-red-500' : 'text-gray-500'}`}>{lesson.class_name}</div>
        )}
        {viewMode !== 'teacher' && lesson.teacher_name && (
          <div className={`truncate ${conflict ? 'text-red-500' : 'text-gray-500'}`}>{lesson.teacher_name}</div>
        )}
        {viewMode !== 'room' && lesson.room_name && (
          <div className={`truncate ${conflict ? 'text-red-400' : 'text-gray-400'}`}>каб. {lesson.room_name}</div>
        )}
        {conflict && reasons.length > 0 && (
          <div className="hidden group-hover/card:block absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
            <div className="font-medium mb-1">Конфликт:</div>
            {reasons.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render an empty half slot
  const renderEmptyHalf = (
    weekday: number,
    lessonNumber: number,
    side: 'left' | 'right',
  ) => {
    const roundedClass = side === 'left' ? 'rounded-l-lg' : 'rounded-r-lg';
    return (
      <div
        key={`empty-${side}`}
        onClick={() => handleCellClick(weekday, lessonNumber)}
        className={`${roundedClass} px-2 py-1.5 h-full flex-1 min-w-0 flex items-center justify-center bg-gray-100 ${
          editing ? 'hover:bg-blue-50 cursor-pointer' : ''
        }`}
      >
        {editing && <span className="text-gray-300 text-xs">+</span>}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      {duplicating && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-3 text-sm flex justify-between items-center">
          <span>Кликните по свободной ячейке, чтобы вставить копию «{duplicating.subject_name}»</span>
          <button onClick={() => setDuplicating(null)} className="text-blue-400 hover:text-blue-600 ml-4">Отмена</button>
        </div>
      )}
      <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-sm font-medium text-gray-500 w-12">#</th>
            {visibleDays.map(d => (
              <th key={d.num} className="px-3 py-2 text-sm font-medium text-gray-500">
                {displayMode === 'day' ? d.full : d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LESSON_NUMBERS.map(num => (
            <tr key={num}>
              <td className="px-3 py-2 text-sm font-medium text-gray-500 text-center">
                {num}
              </td>
              {visibleDays.map(d => {
                const cellLessons = getCellLessons(d.num, num);
                // Split view only makes sense for class mode: a teacher/room only has one of the halves
                const isSplit = viewMode === 'class' && cellLessons.some(l => l.group !== null);
                const isDropTarget = isDragTarget(d.num, num);
                const canDrop = isDropTarget && dragLesson && canDropInto(d.num, num, dragLesson);

                return (
                  <td
                    key={d.num}
                    onDragOver={e => handleDragOver(e, d.num, num)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, d.num, num)}
                    className={`align-top ${displayMode === 'day' ? '' : 'min-w-[140px]'} h-[70px] p-0`}
                  >
                    {isSplit ? (
                      <div className={`flex gap-px h-full rounded-lg ${canDrop ? 'ring-2 ring-blue-400 ring-dashed' : ''}`}>
                        {cellLessons.length >= 1
                          ? renderLessonCard(cellLessons[0], true, 'left')
                          : renderEmptyHalf(d.num, num, 'left')
                        }
                        {cellLessons.length >= 2
                          ? renderLessonCard(cellLessons[1], true, 'right')
                          : renderEmptyHalf(d.num, num, 'right')
                        }
                      </div>
                    ) : cellLessons.length === 1 ? (
                      renderLessonCard(cellLessons[0], false)
                    ) : (
                      <div
                        onClick={() => handleCellClick(d.num, num)}
                        className={`rounded-lg px-3 py-2 h-full flex items-center justify-center transition ${
                          canDrop
                            ? 'bg-blue-100 border-2 border-dashed border-blue-400'
                            : duplicating
                              ? 'bg-gray-100 hover:bg-blue-50 cursor-pointer border border-dashed border-gray-200'
                              : editing
                                ? 'bg-gray-100 hover:bg-blue-50 cursor-pointer'
                                : 'bg-gray-100'
                        }`}
                      >
                        {editing && !duplicating && (
                          <span className="text-gray-300 text-xs">+</span>
                        )}
                        {duplicating && (
                          <span className="text-blue-300 text-xs">+</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getMenuItems(ctxMenu.lesson)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
