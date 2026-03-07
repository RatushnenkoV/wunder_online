import type { TaskStatus } from '../../types';

export const COLUMNS: {
  status: TaskStatus;
  label: string;
  colorBg: string;
  colorBorder: string;
  colorDrag: string;
}[] = [
  { status: 'new',         label: 'Поставленные', colorBg: 'bg-blue-50',   colorBorder: 'border-blue-200',   colorDrag: 'ring-2 ring-blue-400 bg-blue-100' },
  { status: 'in_progress', label: 'В работе',      colorBg: 'bg-amber-50',  colorBorder: 'border-amber-200',  colorDrag: 'ring-2 ring-amber-400 bg-amber-100' },
  { status: 'review',      label: 'На проверке',   colorBg: 'bg-purple-50', colorBorder: 'border-purple-200', colorDrag: 'ring-2 ring-purple-400 bg-purple-100' },
];

export const DONE_COL = {
  status: 'done' as TaskStatus,
  label: 'Выполнено',
  colorBg: 'bg-green-50',
  colorBorder: 'border-green-200',
  colorDrag: '',
};
