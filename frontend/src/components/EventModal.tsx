import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

interface EventModalProps {
  event?: {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    allDay: boolean;
  };
  defaultStart?: Date;
  defaultEnd?: Date;
  onSave: (data: { title: string; description: string; start: string; end: string; allDay: boolean }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalDateValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function EventModal({ event, defaultStart, defaultEnd, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(() => {
    const d = event?.start ?? defaultStart ?? new Date();
    return allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d);
  });
  const [end, setEnd] = useState(() => {
    const d = event?.end ?? defaultEnd ?? new Date(Date.now() + 3600000);
    return allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d);
  });

  useEffect(() => {
    const d = event?.start ?? defaultStart ?? new Date();
    setStart(allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d));
    const e = event?.end ?? defaultEnd ?? new Date(Date.now() + 3600000);
    setEnd(allDay ? toLocalDateValue(e) : toLocalDateTimeValue(e));
  }, [allDay]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      start: allDay ? start : new Date(start).toISOString(),
      end: allDay ? end : new Date(end).toISOString(),
      allDay,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{event ? 'Editar Compromisso' : 'Novo Compromisso'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Reunião com associação de bairro"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes adicionais..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-slate-700">Dia inteiro</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Início</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fim</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {event ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
