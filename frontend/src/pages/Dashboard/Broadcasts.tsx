import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { Megaphone, Loader2, Plus } from 'lucide-react';
import BroadcastModal from '../../components/BroadcastModal';
import BroadcastDetail from '../../components/BroadcastDetail';

interface Broadcast {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string | null;
  segmentType: 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda' | 'todos';
  segmentValue?: string | null;
  status: 'rascunho' | 'enfileirado' | 'enviando' | 'concluido' | 'cancelado';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledFor?: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600 border-slate-200',
  enfileirado: 'bg-blue-50 text-blue-700 border-blue-200',
  enviando: 'bg-amber-50 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enfileirado: 'Enfileirado',
  enviando: 'Enviando',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const SEGMENT_LABEL: Record<string, string> = {
  todos: 'Todos',
  bairro: 'Bairro',
  lideranca: 'Lideranças',
  aniversariantes: 'Aniversariantes',
  categoria_demanda: 'Categoria',
};

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/broadcasts');
      setBroadcasts(res.data as Broadcast[]);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const hasActive = broadcasts.some(b => b.status === 'enviando' || b.status === 'enfileirado');
    if (!hasActive) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [broadcasts, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Megaphone className="text-blue-600" size={32} />
            Disparo em Massa
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            Envio de mensagens para munícipes
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-colors shadow-sm shadow-blue-200"
        >
          <Plus size={16} />
          Novo Disparo
        </button>
      </header>

      {broadcasts.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
          <Megaphone size={48} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Nenhum disparo encontrado</p>
          <p className="text-slate-300 text-sm mt-1">Crie seu primeiro disparo em massa</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Segmento</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {broadcasts.map(b => {
                const pct = b.totalRecipients > 0
                  ? Math.round((b.sentCount / b.totalRecipients) * 100)
                  : 0;
                const segLabel = b.segmentValue
                  ? `${SEGMENT_LABEL[b.segmentType]} — ${b.segmentValue}`
                  : SEGMENT_LABEL[b.segmentType];

                return (
                  <tr
                    key={b.id}
                    onClick={() => setDetailId(b.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-800 truncate max-w-[180px]">{b.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-600">{segLabel}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500 shrink-0">
                          {b.sentCount}/{b.totalRecipients}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${STATUS_BADGE[b.status]}`}>
                        {b.status === 'enviando' && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BroadcastModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); load(); }}
      />

      {detailId && (
        <BroadcastDetail
          broadcastId={detailId}
          onClose={() => { setDetailId(null); load(); }}
        />
      )}
    </div>
  );
}
