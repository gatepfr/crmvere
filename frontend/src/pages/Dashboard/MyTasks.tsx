import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { ListTodo, Loader2, Clock, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface Demand {
  id: string;
  descricao: string;
  categoria: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  municipes: { id: string; name: string; phone: string; bairro: string | null };
}

const STATUS_ORDER = ['nova', 'em_andamento', 'concluida', 'cancelada'];
const STATUS_LABEL: Record<string, string> = {
  nova: 'Nova',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  nova: 'bg-blue-50 border-blue-200 text-blue-700',
  em_andamento: 'bg-amber-50 border-amber-200 text-amber-700',
  concluida: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  cancelada: 'bg-muted border-border text-muted-foreground',
};

export default function MyTasks() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/demands/my');
      setDemands(
        (res.data as any[]).map((d: any) => ({ ...d.demandas, municipes: d.municipes }))
      );
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/demands/${id}/status`, { status });
      setDemands(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    } catch { toast.error('Erro ao atualizar status.'); }
  };

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = demands.filter(d => d.status === s);
    return acc;
  }, {} as Record<string, Demand[]>);

  const total = demands.length;
  const done = demands.filter(d => d.status === 'concluida').length;
  const overdue = demands.filter(d => d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'concluida').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          <ListTodo className="text-blue-600" size={32} />
          Minhas Tarefas
        </h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
          Demandas atribuídas a você
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
          <p className="text-3xl font-black text-foreground">{total}</p>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Total</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center">
          <p className="text-3xl font-black text-emerald-600">{done}</p>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Concluídas</p>
        </div>
        <div className={`rounded-2xl p-5 border shadow-sm text-center ${overdue > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-card border-border'}`}>
          <p className={`text-3xl font-black ${overdue > 0 ? 'text-red-600' : 'text-foreground'}`}>{overdue}</p>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Vencidas</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : total === 0 ? (
        <div className="bg-card rounded-2xl p-16 text-center border border-border shadow-sm">
          <ListTodo size={48} className="text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground font-black text-sm uppercase tracking-widest">Nenhuma tarefa atribuída</p>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.filter(s => grouped[s].length > 0).map(status => (
            <div key={status}>
              <h2 className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border mb-3 ${STATUS_COLOR[status]}`}>
                {status === 'concluida' ? <CheckCircle2 size={13} /> : status === 'em_andamento' ? <Clock size={13} /> : <Circle size={13} />}
                {STATUS_LABEL[status]} ({grouped[status].length})
              </h2>
              <div className="space-y-3">
                {grouped[status].map(d => {
                  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'concluida';
                  return (
                    <div key={d.id} className={`bg-card rounded-2xl border shadow-sm p-5 flex gap-4 ${isOverdue ? 'border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/10' : 'border-border'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-foreground">{d.municipes.name}</span>
                          {isOverdue && (
                            <span className="flex items-center gap-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                              <AlertCircle size={9} /> Vencida
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{d.descricao}</p>
                        <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase">
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">{d.categoria}</span>
                          {d.dueDate && (
                            <span className={isOverdue ? 'text-red-500' : ''}>
                              <Clock size={10} className="inline mr-1" />
                              {new Date(d.dueDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {STATUS_ORDER.filter(s => s !== d.status && s !== 'cancelada').map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus(d.id, s)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all hover:shadow-sm ${STATUS_COLOR[s]}`}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
