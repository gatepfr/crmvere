import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../../api/client';
import { Plus, Loader2, AlertCircle, Link as LinkIcon, Unlink } from 'lucide-react';
import EventModal from '../../components/EventModal';
import { toast } from 'sonner';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

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

export default function Agenda() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
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
    api.get('/calendar/status')
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

  async function handleSave(data: { title: string; description: string; start: string; end: string; allDay: boolean }) {
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

      <div className="flex-1 bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-4 rbc-dark-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          culture="pt-BR"
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          messages={{
            next: 'Próximo',
            previous: 'Anterior',
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            agenda: 'Lista',
            noEventsInRange: 'Sem compromissos neste período.',
          }}
          onSelectEvent={event => setModal({ mode: 'edit', event })}
          onSelectSlot={({ start, end }) => setModal({ mode: 'create', start, end })}
          selectable
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
