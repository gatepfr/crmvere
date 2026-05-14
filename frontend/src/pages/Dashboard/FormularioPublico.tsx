import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { formatPhone } from '../../utils/formatPhone';
import {
  Search, Loader2, X, MapPin, Phone, MessageCircle, Globe, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PublicDemanda {
  demandas: {
    id: string;
    categoria: string;
    descricao: string;
    status: string;
    origem: string | null;
    localizacao: string | null;
    fotoUrl: string | null;
    protocolo: string | null;
    numeroIndicacao: string | null;
    createdAt: string;
    updatedAt: string;
  };
  municipes: {
    id: string;
    name: string;
    phone: string;
    bairro: string | null;
  };
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Category { id: string; name: string; color: string; icon: string; }
interface Stats { nova: number; em_andamento: number; concluida: number; }

const STATUS_LABELS: Record<string, string> = {
  nova: 'Nova',
  em_andamento: 'Em andamento',
  concluida: 'Resolvida',
  cancelada: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  nova: 'bg-blue-50 text-blue-600 border-blue-100',
  em_andamento: 'bg-amber-50 text-amber-600 border-amber-100',
  concluida: 'bg-green-50 text-green-600 border-green-100',
  cancelada: 'bg-slate-50 text-slate-500 border-slate-100',
};

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function getCategoryColor(name: string, categories: Category[]): string {
  return categories.find(c => c.name === name)?.color ?? '#2563eb';
}

export default function FormularioPublico() {
  const [demandas, setDemandas] = useState<PublicDemanda[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>({ nova: 0, em_andamento: 0, concluida: 0 });
  const [selected, setSelected] = useState<PublicDemanda | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  const fetchDemandas = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams({
      origem: 'formulario_publico',
      page: String(pagination.page),
      limit: String(pagination.limit),
    });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    api.get(`/demands?${params}`)
      .then(res => {
        setDemandas(res.data.data || []);
        setPagination(p => ({ ...p, ...res.data.pagination }));
      })
      .catch(() => toast.error('Erro ao carregar demandas'))
      .finally(() => { if (!isBackground) setLoading(false); });
  }, [pagination.page, pagination.limit, search, statusFilter, categoryFilter, dateFrom, dateTo]);

  const fetchStats = useCallback(() => {
    Promise.all([
      api.get('/demands?origem=formulario_publico&status=nova&limit=1').then(r => r.data.pagination?.total ?? 0),
      api.get('/demands?origem=formulario_publico&status=em_andamento&limit=1').then(r => r.data.pagination?.total ?? 0),
      api.get('/demands?origem=formulario_publico&status=concluida&limit=1').then(r => r.data.pagination?.total ?? 0),
    ]).then(([nova, em_andamento, concluida]) => setStats({ nova, em_andamento, concluida })).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/demands/categories').then(res => setCategories(res.data || [])).catch(() => {});
    fetchStats();
  }, [fetchStats]);

  useEffect(() => { fetchDemandas(); }, [fetchDemandas]);

  const handleStatClick = (status: string) => {
    setStatusFilter(prev => prev === status ? '' : status);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const openModal = (d: PublicDemanda) => {
    setSelected(d);
    setEditStatus(d.demandas.status);
  };

  const closeModal = () => { setSelected(null); setEditStatus(''); };

  const handleSaveStatus = async () => {
    if (!selected || !editStatus || editStatus === selected.demandas.status) return;
    setSavingStatus(true);
    try {
      await api.patch(`/demands/${selected.demandas.id}/status`, { status: editStatus });
      toast.success('Status atualizado');
      closeModal();
      fetchDemandas(true);
      fetchStats();
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!selected) return;
    const message = `Olá ${selected.municipes.name}, sobre sua solicitação protocolo ${selected.demandas.protocolo ?? ''}, estamos trabalhando para atendê-la. Em breve entraremos em contato.`;
    setSendingWa(true);
    try {
      await api.post('/whatsapp/send', { demandId: selected.demandas.id, message });
      toast.success('Mensagem enviada pelo WhatsApp!');
    } catch {
      toast.error('Falha ao enviar mensagem pelo WhatsApp.');
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Formulário Público</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pagination.total} demanda{pagination.total !== 1 ? 's' : ''} recebida{pagination.total !== 1 ? 's' : ''} via formulário
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'nova', label: 'Novas', count: stats.nova, bg: 'border-blue-200 bg-blue-50', num: 'text-blue-600' },
          { key: 'em_andamento', label: 'Em andamento', count: stats.em_andamento, bg: 'border-amber-200 bg-amber-50', num: 'text-amber-600' },
          { key: 'concluida', label: 'Resolvidas', count: stats.concluida, bg: 'border-green-200 bg-green-50', num: 'text-green-600' },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => handleStatClick(s.key)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all hover:shadow-sm',
              s.bg,
              statusFilter === s.key && 'ring-2 ring-offset-1 ring-primary'
            )}
          >
            <div className={cn('text-2xl font-bold', s.num)}>{s.count}</div>
            <div className="text-xs font-medium text-muted-foreground mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Buscar por nome, protocolo, descrição..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              />
            </div>
            <select
              className="px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            >
              <option value="">Todos os status</option>
              <option value="nova">Nova</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Resolvida</option>
            </select>
            <select
              className="px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            >
              <option value="">Todas as categorias</option>
              {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input
              type="date"
              title="Data inicial"
              className="px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            />
            <input
              type="date"
              title="Data final"
              className="px-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            />
            {(search || statusFilter || categoryFilter || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(''); setStatusFilter(''); setCategoryFilter('');
                setDateFrom(''); setDateTo('');
                setPagination(p => ({ ...p, page: 1 }));
              }}>
                <X size={14} className="mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : demandas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Globe size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma demanda encontrada</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {demandas.map(d => (
                <button
                  key={d.demandas.id}
                  onClick={() => openModal(d)}
                  className="w-full text-left px-5 py-4 hover:bg-muted/40 transition-colors flex gap-3 items-start"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {d.municipes.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{d.municipes.name}</span>
                      <span className="text-xs text-muted-foreground">{formatPhone(d.municipes.phone)}</span>
                    </div>
                    {d.municipes.bairro && (
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">{d.municipes.bairro}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {d.demandas.protocolo && (
                        <span className="text-xs font-semibold text-muted-foreground">#{d.demandas.protocolo}</span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] font-semibold uppercase"
                        style={{
                          borderColor: `${getCategoryColor(d.demandas.categoria, categories)}40`,
                          color: getCategoryColor(d.demandas.categoria, categories),
                          backgroundColor: `${getCategoryColor(d.demandas.categoria, categories)}10`,
                        }}
                      >
                        {d.demandas.categoria}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[9px] font-semibold uppercase', STATUS_COLORS[d.demandas.status])}>
                        {STATUS_LABELS[d.demandas.status] || d.demandas.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mt-1">{d.demandas.descricao}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                      {d.demandas.localizacao && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {d.demandas.localizacao}
                        </span>
                      )}
                      <span>{timeAgo(d.demandas.createdAt)}</span>
                      {d.demandas.numeroIndicacao && (
                        <span className="text-green-600 font-semibold">Ind. nº {d.demandas.numeroIndicacao}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="px-5 py-3 bg-muted/30 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {pagination.total} demanda{pagination.total !== 1 ? 's' : ''} · pág. {pagination.page}/{pagination.totalPages || 1}
              </p>
              <select
                className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                value={pagination.limit}
                onChange={e => setPagination(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
              >
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} / pág.</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-8 w-8"
                disabled={pagination.page === 1 || loading}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                variant="outline" size="icon" className="h-8 w-8"
                disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border">
            <div
              className="px-6 py-4 flex justify-between items-start"
              style={{ background: 'linear-gradient(135deg, #1a0a3b, #2d1b69)' }}
            >
              <div>
                <div className="text-white font-bold text-base">
                  {selected.demandas.protocolo ? `#${selected.demandas.protocolo} — ` : ''}
                  {selected.demandas.categoria}
                </div>
                <div className="text-white/70 text-xs mt-0.5 flex items-center gap-1.5">
                  <Phone size={10} />
                  {selected.municipes.name} · {selected.municipes.phone} · {timeAgo(selected.demandas.createdAt)}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Categoria</div>
                  <div className="text-sm font-semibold text-foreground">{selected.demandas.categoria}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Status</div>
                  <select
                    className="w-full text-sm bg-background border border-border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    <option value="nova">Nova</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Resolvida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Foto</div>
                {selected.demandas.fotoUrl ? (
                  <a href={`${BACKEND_URL}${selected.demandas.fotoUrl}`} target="_blank" rel="noreferrer">
                    <img
                      src={`${BACKEND_URL}${selected.demandas.fotoUrl}`}
                      alt="Foto da demanda"
                      className="w-full h-40 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                ) : (
                  <div className="w-full h-20 bg-muted rounded-lg flex items-center justify-center text-muted-foreground/40 text-sm">
                    Sem foto
                  </div>
                )}
              </div>

              <div>
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Descrição</div>
                <div className="text-sm bg-muted rounded-lg p-3 leading-relaxed text-foreground">
                  {selected.demandas.descricao}
                </div>
              </div>

              {selected.demandas.localizacao && (
                <div>
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Localização</div>
                  <div className="text-sm bg-muted rounded-lg p-3 flex items-center gap-2 text-foreground">
                    <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
                    {selected.demandas.localizacao}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-[#25d366] text-[#25d366] hover:bg-[#25d366]/10"
                onClick={handleWhatsApp}
                disabled={sendingWa}
              >
                {sendingWa ? <Loader2 size={16} className="mr-2 animate-spin" /> : <MessageCircle size={16} className="mr-2" />}
                WhatsApp
              </Button>
              <Button
                className="flex-1"
                disabled={savingStatus || editStatus === selected.demandas.status}
                onClick={handleSaveStatus}
              >
                {savingStatus && <Loader2 size={16} className="animate-spin mr-2" />}
                Salvar status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
