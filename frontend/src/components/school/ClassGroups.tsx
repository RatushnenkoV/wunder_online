import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { ClassGroup, StudentProfile } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

interface Props {
  classId: number;
}

export default function ClassGroups({ classId }: Props) {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ group: ClassGroup; x: number; y: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<ClassGroup | null>(null);
  const [formName, setFormName] = useState('');
  const [formStudents, setFormStudents] = useState<number[]>([]);

  // Add student popover
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);

  // Drag and drop
  const [dragStudent, setDragStudent] = useState<{ userId: number; fromGroupId: number } | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [gRes, sRes] = await Promise.all([
      api.get(`/school/classes/${classId}/groups/`),
      api.get(`/school/classes/${classId}/students/`),
    ]);
    setGroups(gRes.data);
    setStudents(sRes.data);
  };

  useEffect(() => { load(); }, [classId]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- CRUD ---
  const openCreate = () => {
    setEditGroup(null);
    setFormName('');
    setFormStudents([]);
    setShowModal(true);
  };

  const openEdit = (group: ClassGroup) => {
    setEditGroup(group);
    setFormName(group.name);
    setFormStudents([...group.students]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (editGroup) {
      await api.put(`/school/groups/${editGroup.id}/`, { name: formName.trim(), students: formStudents });
    } else {
      await api.post(`/school/classes/${classId}/groups/`, { name: formName.trim(), students: formStudents });
    }
    setShowModal(false);
    load();
  };

  const handleDelete = async (group: ClassGroup) => {
    if (!confirm(`Удалить группу "${group.name}"?`)) return;
    await api.delete(`/school/groups/${group.id}/`);
    load();
  };

  // --- Inline add/remove students ---
  const removeStudent = async (groupId: number, userId: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newStudents = group.students.filter(id => id !== userId);
    await api.put(`/school/groups/${groupId}/`, { students: newStudents });
    load();
  };

  const addStudentToGroup = async (groupId: number, userId: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newStudents = [...group.students, userId];
    await api.put(`/school/groups/${groupId}/`, { students: newStudents });
    setAddingToGroup(null);
    load();
  };

  // --- Drag and drop ---
  const handleDragStart = (e: React.DragEvent, userId: number, fromGroupId: number) => {
    setDragStudent({ userId, fromGroupId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroup(groupId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we actually left the container (not just moved between children)
    const container = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as Node | null;
    if (!related || !container.contains(related)) {
      setDragOverGroup(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, toGroupId: number) => {
    e.preventDefault();
    setDragOverGroup(null);
    if (!dragStudent) return;

    if (dragStudent.fromGroupId === toGroupId) {
      setDragStudent(null);
      return;
    }

    const fromGroup = groups.find(g => g.id === dragStudent.fromGroupId);
    const toGroup = groups.find(g => g.id === toGroupId);
    if (!fromGroup || !toGroup) return;

    // Check if student already in target group
    if (toGroup.students.includes(dragStudent.userId)) {
      const student = toGroup.students_detail.find(s => s.id === dragStudent.userId)
        || fromGroup.students_detail.find(s => s.id === dragStudent.userId);
      const name = student ? `${student.last_name} ${student.first_name}` : 'Ученик';
      setMessage(`${name} уже в группе "${toGroup.name}"`);
      setDragStudent(null);
      return;
    }

    // Remove from source, add to target
    await Promise.all([
      api.put(`/school/groups/${fromGroup.id}/`, {
        students: fromGroup.students.filter(id => id !== dragStudent.userId),
      }),
      api.put(`/school/groups/${toGroup.id}/`, {
        students: [...toGroup.students, dragStudent.userId],
      }),
    ]);

    setDragStudent(null);
    load();
  };

  const handleDragEnd = () => {
    setDragStudent(null);
    setDragOverGroup(null);
  };

  // Students not in this group (for add dropdown)
  const availableStudents = (group: ClassGroup) =>
    students.filter(sp => !group.students.includes(sp.user.id));

  const toggleFormStudent = (userId: number) => {
    setFormStudents(s => s.includes(userId) ? s.filter(id => id !== userId) : [...s, userId]);
  };

  const toggleAll = () => {
    const allIds = students.map(sp => sp.user.id);
    setFormStudents(formStudents.length === allIds.length ? [] : allIds);
  };

  const getMenuItems = (group: ClassGroup): MenuItem[] => [
    { label: 'Переименовать', onClick: () => openEdit(group) },
    { label: 'Удалить', onClick: () => handleDelete(group), danger: true },
  ];

  return (
    <div>
      {message && (
        <div className="bg-yellow-50 text-yellow-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-yellow-400 hover:text-yellow-600 ml-4">x</button>
        </div>
      )}
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Создать группу
        </button>
      </div>

      <div className="space-y-2">
        {groups.map(group => (
          <div
            key={group.id}
            className={`bg-white rounded-lg shadow transition ${dragOverGroup === group.id ? 'ring-2 ring-blue-400' : ''}`}
            onContextMenu={e => { e.preventDefault(); setCtxMenu({ group, x: e.clientX, y: e.clientY }); }}
            onDragOver={e => handleDragOver(e, group.id)}
            onDragLeave={e => handleDragLeave(e)}
            onDrop={e => handleDrop(e, group.id)}
          >
            {/* Header - whole area clickable */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
              onClick={() => toggleExpand(group.id)}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={`transition-transform ${expandedIds.has(group.id) ? 'rotate-90' : ''}`}>&#9654;</span>
                {group.name}
                <span className="text-gray-400 font-normal">({group.students_detail.length} уч.)</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setCtxMenu({ group, x: e.clientX, y: e.clientY }); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >&#8942;</button>
            </div>

            {/* Expanded content */}
            {expandedIds.has(group.id) && (
              <div className="px-4 pb-3 border-t">
                {group.students_detail.length === 0 ? (
                  <p className="text-gray-400 text-sm py-2">Нет учеников</p>
                ) : (
                  <ul className="text-sm py-2 space-y-0.5">
                    {group.students_detail.map(s => (
                      <li
                        key={s.id}
                        draggable
                        onDragStart={e => handleDragStart(e, s.id, group.id)}
                        onDragEnd={handleDragEnd}
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 cursor-grab active:cursor-grabbing group/item"
                      >
                        <span className="text-gray-700">{s.last_name} {s.first_name}</span>
                        <button
                          onClick={() => removeStudent(group.id, s.id)}
                          className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover/item:opacity-100 transition-opacity"
                          title="Убрать из группы"
                        >&times;</button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add student */}
                <div className="mt-1">
                  {addingToGroup === group.id ? (
                    <div className="border rounded max-h-40 overflow-auto text-sm">
                      {availableStudents(group).map(sp => (
                        <button
                          key={sp.user.id}
                          onClick={() => addStudentToGroup(group.id, sp.user.id)}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700"
                        >
                          {sp.user.last_name} {sp.user.first_name}
                        </button>
                      ))}
                      {availableStudents(group).length === 0 && (
                        <p className="text-gray-400 text-center py-2 text-xs">Все ученики уже в группе</p>
                      )}
                      <button onClick={() => setAddingToGroup(null)} className="w-full text-center py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t">
                        Закрыть
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingToGroup(group.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      + Добавить ученика
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && <p className="text-gray-400 text-center py-8">Группы не созданы</p>}
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.group)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editGroup ? 'Редактирование группы' : 'Новая группа'}</h3>
            <div className="space-y-3 flex-1 overflow-auto">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Название</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Группа 1" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-600">Ученики</label>
                  <button onClick={toggleAll} className="text-xs text-blue-600 hover:text-blue-800">
                    {formStudents.length === students.length ? 'Снять все' : 'Выбрать всех'}
                  </button>
                </div>
                <div className="border rounded max-h-60 overflow-auto">
                  {students.map(sp => (
                    <label key={sp.user.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={formStudents.includes(sp.user.id)} onChange={() => toggleFormStudent(sp.user.id)} />
                      {sp.user.last_name} {sp.user.first_name}
                    </label>
                  ))}
                  {students.length === 0 && <p className="text-gray-400 text-center py-4 text-sm">Нет учеников в классе</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleSave} disabled={!formName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {editGroup ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
