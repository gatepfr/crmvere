import { useState, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../api/client';
import { Plus, Loader2, AlertCircle, Link as LinkIcon, Unlink, ChevronLeft, ChevronRight } from 'lucide-react';
import EventModal from '../../components/EventModal';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; start: Date; end: Date }
  | { mode: 'edit'; event: CalEvent };

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function MonthCalendar({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const today = new Date();

  const getEventsForDay = (date: Date) =>
    events.filter(e => isSameDay(e.start, date));

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_NAMES.map(name => (
          <div
            key={name}
            className="py-2 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, today);
          const dayEvents = getEventsForDay(d);

          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={[
                'border-r border-b border-border p-1.5 cursor-pointer hover:bg-accent/40 transition-colors overflow-hidden min-h-[80px]',
                !isCurrentMonth ? 'bg-muted/20' : '',
                i % 7 === 0 ? 'border-l' : '',
              ].join(' ')}
            >
              <div
                className={[
                  'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 select-none',
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : isCurrentMonth
                    ? 'text-foreground'
                    : 'text-muted-foreground/50',
                ].join(' ')}
              >
                {format(d, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={e => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary truncate cursor-pointer hover:bg-primary/30 transition-colors"
                  >
                    {!event.allDay && (
                      <span className="opacity-60 mr-1">
                        {format(event.start, 'HH:mm')}
                      </span>
                    )}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground font-bold px-1.5">
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Agenda() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('google_error')) {
      toast.error('Erro ao conectar o Google Calendar. Tente novamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    api
      .get('/calendar/status')
      .then(res => setConnected(res.data.connected))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  const fetchEvents = useCallback(async (date: Date) => {
    const start = startOfMonth(subMonths(date, 1)).toISOString();
    const end = endOfMonth(addMonths(date, 1)).toISOString();
    try {
      const res = await api.get(`/calendar/events?start=${start}&end=${end}`);
      const mapped: CalEvent[] = (res.data as any[]).map(e => ({
        id: e.id,
        title: e.summary ?? '(sem título)',
        start: new Date(e.start?.dateTime ?? e.start?.date),
        end: new Date(e.end?.dateTime ?? e.end?.date),
        allDay: !e.start?.dateTime,
        description: e.description,
      }));
      setEvents(mapped);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    if (connected) fetchEvents(currentDate);
  }, [connected, currentDate, fetchEvents]);

  async function handleConnect() {
    const res = await api.get('/calendar/auth');
    window.location.href = res.data.url;
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o Google Calendar?')) return;
    await api.delete('/calendar/disconnect');
    setConnected(false);
    setEvents([]);
  }

  async function handleSave(data: {
    title: string;
    description: string;
    start: string;
    end: string;
    allDay: boolean;
  }) {
    if (modal.mode === 'create') {
      await api.post('/calendar/events', data);
    } else if (modal.mode === 'edit') {
      await api.put(`/calendar/events/${modal.event.id}`, data);
    }
    setModal({ mode: 'closed' });
    fetchEvents(currentDate);
  }

  async function handleDelete() {
    if (modal.mode !== 'edit') return;
    if (!confirm('Excluir este compromisso?')) return;
    await api.delete(`/calendar/events/${modal.event.id}`);
    setModal({ mode: 'closed' });
    fetchEvents(currentDate);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-card rounded-2xl border border-border shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-full mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda não conectada</h2>
        <p className="text-muted-foreground mb-8">
          Conecte sua conta Google para visualizar e gerenciar seus compromissos diretamente aqui.
        </p>
        <button
          onClick={handleConnect}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <LinkIcon size={18} />
          Conectar Google Calendar
        </button>
      </div>
    );
  }

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col space-y-4">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Agenda do Vereador</h2>
          <p className="text-muted-foreground text-sm">Compromissos sincronizados com o Google Calendar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-red-600 text-sm font-medium px-3 py-2 rounded-lg border border-border bg-background transition-colors"
          >
            <Unlink size={15} />
            Desconectar
          </button>
          <button
            onClick={() =>
              setModal({
                mode: 'create',
                start: new Date(),
                end: new Date(Date.now() + 3600000),
              })
            }
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus size={18} />
            Novo Compromisso
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-2.5">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
          <ChevronLeft size={18} />
        </Button>
        <h3 className="text-base font-bold text-foreground capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <MonthCalendar
          currentDate={currentDate}
          events={events}
          onDayClick={d =>
            setModal({ mode: 'create', start: d, end: new Date(d.getTime() + 3600000) })
          }
          onEventClick={event => setModal({ mode: 'edit', event })}
        />
      </div>

      {modal.mode !== 'closed' && (
        <EventModal
          event={modal.mode === 'edit' ? modal.event : undefined}
          defaultStart={modal.mode === 'create' ? modal.start : undefined}
          defaultEnd={modal.mode === 'create' ? modal.end : undefined}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}
    </div>
  );
}
