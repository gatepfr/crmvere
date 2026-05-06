import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Compromisso' : 'Novo Compromisso'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Título *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Reunião com associação de bairro"
              className="w-full px-4 py-2.5 border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-ring outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes adicionais..."
              className="w-full px-4 py-2.5 border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-ring outline-none text-sm resize-none"
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
            <label htmlFor="allDay" className="text-sm font-medium text-foreground">Dia inteiro</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Início</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-ring outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Fim</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-ring outline-none text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            {onDelete && (
              <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 size={16} />
                Excluir
              </Button>
            )}
            <div className="flex gap-3 ml-auto">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit">{event ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
