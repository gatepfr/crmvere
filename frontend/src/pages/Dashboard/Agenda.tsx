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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

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

type CalView = 'month' | 'week' | 'day';
type DayDetail = { date: Date; events: CalEvent[] } | null;

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/* ── Month View ── */
function MonthCalendar({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  onShowMore,
}: {
  currentDate: Date;
  events: CalEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalEvent) => void;
  onShowMore: (date: Date, dayEvents: CalEvent[]) => void;
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

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_NAMES.map(name => (
          <div key={name} className="py-2 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, today);
          const dayEvents = events.filter(e => isSameDay(e.start, d));

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
              <div className={[
                'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 select-none',
                isToday ? 'bg-primary text-primary-foreground'
                  : isCurrentMonth ? 'text-foreground'
                  : 'text-muted-foreground/50',
              ].join(' ')}>
                {format(d, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event); }}
                    title={event.title}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary truncate cursor-pointer hover:bg-primary/30 transition-colors"
                  >
                    {!event.allDay && <span className="opacity-60 mr-1">{format(event.start, 'HH:mm')}</span>}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div
                    onClick={e => { e.stopPropagation(); onShowMore(d, dayEvents); }}
                    className="text-[10px] text-primary font-bold px-1.5 cursor-pointer hover:underline"
                  >
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

/* ── Week View ── */
function WeekView({
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
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekDays.map(d => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toString()} className="py-3 text-center border-r border-border last:border-0">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {format(d, 'EEE', { locale: ptBR })}
              </div>
              <div className={[
                'w-8 h-8 mx-auto mt-1 flex items-center justify-center rounded-full text-sm font-bold',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
              ].join(' ')}>
                {format(d, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {weekDays.map((d, i) => {
          const dayEvents = events
            .filter(e => isSameDay(e.start, d))
            .sort((a, b) => a.start.getTime() - b.start.getTime());

          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className="border-r border-border last:border-0 p-2 cursor-pointer hover:bg-accent/20 transition-colors min-h-[200px]"
            >
              <div className="space-y-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event); }}
                    title={event.title}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-primary/15 text-primary cursor-pointer hover:bg-primary/25 transition-colors"
                  >
                    {!event.allDay && (
                      <div className="text-[10px] opacity-70 mb-0.5">{format(event.start, 'HH:mm')}</div>
                    )}
                    <div className="truncate">{event.title}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Day View ── */
function DayView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalEvent[];
  onEventClick: (event: CalEvent) => void;
}) {
  const dayEvents = events
    .filter(e => isSameDay(e.start, currentDate))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const isToday = isSameDay(currentDate, new Date());

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-muted/30 px-6 py-5 text-center">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest capitalize">
          {format(currentDate, 'EEEE', { locale: ptBR })}
        </div>
        <div className={`text-4xl font-black mt-1 ${isToday ? 'text-primary' : 'text-foreground'}`}>
          {format(currentDate, 'd')}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <p className="text-sm font-medium">Nenhum compromisso neste dia</p>
            <p className="text-xs">Clique em "Novo Compromisso" para adicionar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="flex gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
              >
                <div className="text-sm font-black text-primary shrink-0 w-16 text-right">
                  {event.allDay ? 'Dia todo' : format(event.start, 'HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground">{event.title}</div>
                  {!event.allDay && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      até {format(event.end, 'HH:mm')}
                    </div>
                  )}
                  {event.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Agenda ── */
export default function Agenda() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalView>('month');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [dayDetail, setDayDetail] = useState<DayDetail>(null);

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

  function navigate(direction: 1 | -1) {
    setCurrentDate(d => {
      if (view === 'month') return direction === 1 ? addMonths(d, 1) : subMonths(d, 1);
      if (view === 'week') return addDays(d, direction * 7);
      return addDays(d, direction);
    });
  }

  function getLabel() {
    if (view === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (view === 'week') {
      const wStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const wEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (wStart.getMonth() === wEnd.getMonth())
        return `${format(wStart, 'd')} – ${format(wEnd, 'd')} de ${format(wStart, 'MMMM yyyy', { locale: ptBR })}`;
      return `${format(wStart, 'd MMM', { locale: ptBR })} – ${format(wEnd, 'd MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "d 'de' MMMM yyyy", { locale: ptBR });
  }

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

  async function handleSave(data: { title: string; description: string; start: string; end: string; allDay: boolean }) {
    if (modal.mode === 'create') await api.post('/calendar/events', data);
    else if (modal.mode === 'edit') await api.put(`/calendar/events/${modal.event.id}`, data);
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

  const VIEW_OPTIONS: { value: CalView; label: string }[] = [
    { value: 'day', label: 'Dia' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
  ];

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
            onClick={() => setModal({ mode: 'create', start: new Date(), end: new Date(Date.now() + 3600000) })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus size={18} />
            Novo Compromisso
          </button>
        </div>
      </header>

      {/* Toolbar: nav + view switcher */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-2.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
            <ChevronRight size={18} />
          </Button>
        </div>

        <h3 className="text-sm font-bold text-foreground capitalize">{getLabel()}</h3>

        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={[
                'px-3 py-1.5 text-xs font-bold transition-colors border-r border-border last:border-0',
                view === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {view === 'month' && (
          <MonthCalendar
            currentDate={currentDate}
            events={events}
            onDayClick={d => setModal({ mode: 'create', start: d, end: new Date(d.getTime() + 3600000) })}
            onEventClick={event => setModal({ mode: 'edit', event })}
            onShowMore={(date, dayEvents) => setDayDetail({ date, events: dayEvents })}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onDayClick={d => setModal({ mode: 'create', start: d, end: new Date(d.getTime() + 3600000) })}
            onEventClick={event => setModal({ mode: 'edit', event })}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            onEventClick={event => setModal({ mode: 'edit', event })}
          />
        )}
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

      <Dialog open={!!dayDetail} onOpenChange={open => { if (!open) setDayDetail(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dayDetail && format(dayDetail.date, "d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {dayDetail?.events.map(event => (
              <button
                key={event.id}
                onClick={() => { setDayDetail(null); setModal({ mode: 'edit', event }); }}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <span className="text-[10px] font-bold text-primary/70 mr-2">
                  {event.allDay ? 'Dia inteiro' : format(event.start, 'HH:mm')}
                </span>
                <span className="text-sm font-bold text-foreground">{event.title}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
