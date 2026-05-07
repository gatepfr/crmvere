import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { Megaphone, Loader2, Plus, Trash2 } from 'lucide-react';
import BroadcastModal from '../../components/BroadcastModal';
import BroadcastDetail from '../../components/BroadcastDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Broadcast {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string | null;
  segmentType: 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda' | 'todos' | 'indicacao' | 'custom';
  segmentValue?: string | null;
  status: 'rascunho' | 'enfileirado' | 'enviando' | 'concluido' | 'cancelado';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledFor?: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho:    { label: 'Rascunho',    className: 'bg-muted text-muted-foreground border-border' },
  enfileirado: { label: 'Enfileirado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  enviando:    { label: 'Enviando',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
  concluido:   { label: 'Concluído',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelado:   { label: 'Cancelado',   className: 'bg-red-50 text-red-700 border-red-200' },
};

const segmentLabel: Record<string, string> = {
  todos:             'Todos',
  bairro:            'Bairro',
  lideranca:         'Lideranças',
  aniversariantes:   'Aniversariantes',
  categoria_demanda: 'Categoria',
  indicacao:         'Indicação',
  custom:            'Personalizado',
};

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/broadcasts');
      setBroadcasts(res.data as Broadcast[]);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasActive = broadcasts.some(b => b.status === 'enviando' || b.status === 'enfileirado');
    if (!hasActive) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [broadcasts, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este disparo?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/broadcasts/${id}`);
      setBroadcasts(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Erro ao excluir disparo.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Megaphone className="text-blue-600" size={32} />
            Disparo em Massa
          </h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Envio de mensagens para munícipes
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus size={16} />
          Novo Disparo
        </Button>
      </header>

      <Card className="overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}

        {!loading && broadcasts.length === 0 ? (
          <div className="py-20 text-center">
            <Megaphone size={40} className="text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-black text-xs uppercase tracking-widest">
              Nenhum disparo encontrado
            </p>
            <p className="text-muted-foreground/50 text-sm mt-1">
              Crie seu primeiro disparo em massa
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Nome</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="w-[180px]">Progresso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map(b => {
                const pct = b.totalRecipients > 0
                  ? Math.round((b.sentCount / b.totalRecipients) * 100)
                  : 0;
                const seg = b.segmentValue
                  ? `${segmentLabel[b.segmentType] ?? b.segmentType} — ${b.segmentValue}`
                  : (segmentLabel[b.segmentType] ?? b.segmentType);
                const cfg = statusConfig[b.status] ?? statusConfig.rascunho;
                const isActive = b.status === 'enviando' || b.status === 'enfileirado';

                return (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(b.id)}
                  >
                    <TableCell className="pl-5">
                      <p className="font-semibold text-foreground truncate max-w-[200px]">{b.name}</p>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-sm">
                      {seg}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 w-[160px]">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              b.status === 'concluido' ? 'bg-emerald-500' : 'bg-blue-500'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
                          {b.sentCount}/{b.totalRecipients}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('gap-1.5 text-[10px] font-semibold uppercase', cfg.className)}
                      >
                        {b.status === 'enviando' && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {cfg.label}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>

                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === b.id || isActive}
                        title={isActive ? 'Cancele antes de excluir' : 'Excluir disparo'}
                        onClick={e => handleDelete(b.id, e)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                      >
                        {deletingId === b.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

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
