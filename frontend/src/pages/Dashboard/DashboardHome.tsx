import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  AlertCircle,
  CalendarDays,
  MapPin,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  Zap,
  Smartphone,
  WifiOff,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface DashboardData {
  summary: {
    total: number;
    pending: number;
    needsAttention: number;
    municipesTotal: number;
    birthdaysToday: number;
    uniqueBairros: number;
    dailyTokenLimit: number;
    tokenUsageTotal: number;
  };
  categoryStats: { name: string; value: number; color: string }[];
  dailyStats: { date: string; count: number }[];
}


type WaStatus = 'connected' | 'connecting' | 'disconnected' | 'needs_reconnect' | 'not_created' | 'unknown' | null;

export default function DashboardHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [waStatus, setWaStatus] = useState<WaStatus>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const navigate = useNavigate();

  const fetchWaStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/connection-health');
      setWaStatus(res.data.status as WaStatus);
      if (res.data.status !== 'needs_reconnect') setAlertDismissed(false);
    } catch {
      // silencioso — não crítico
    }
  }, []);

  useEffect(() => {
    api.get('/metrics')
      .then(res => {
        if (res.data && res.data.summary) {
          setData(res.data);
        } else {
          setError(true);
        }
      })
      .catch(err => {
        console.error(err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchWaStatus]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Carregando inteligência...</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-10">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h3 className="text-lg font-black text-slate-900">Falha ao carregar indicadores</h3>
      <p className="text-slate-500 mt-2">Verifique sua conexão ou tente novamente mais tarde.</p>
      <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Recarregar</button>
    </div>
  );

  const summary = data.summary || {
    total: 0, pending: 0, needsAttention: 0, municipesTotal: 0, birthdaysToday: 0, uniqueBairros: 0,
    dailyTokenLimit: 0, tokenUsageTotal: 0
  };

  const dailyStats = data.dailyStats || [];
  const categoryStats = data.categoryStats || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Banner: WhatsApp precisa reconectar */}
      {waStatus === 'needs_reconnect' && !alertDismissed && (
        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <WifiOff size={20} className="text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-red-700">WhatsApp desconectado — reconexão necessária</p>
            <p className="text-xs text-red-500 mt-0.5">A sessão expirou. O atendimento automático está pausado até reconectar.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/whatsapp')}
            className="px-4 py-2 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-colors flex-shrink-0"
          >
            Reconectar agora
          </button>
          <button onClick={() => setAlertDismissed(true)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header com Saudação */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Visão Geral
            </span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium italic">Seu gabinete digital em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-3">
            <Zap size={14} className="text-amber-500 fill-amber-500" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none">Uso de Tokens (Hoje)</span>
              <span className="text-xs font-black text-slate-700">
                {(summary.tokenUsageTotal / 1000).toFixed(1)}k <span className="text-slate-400">/ {(summary.dailyTokenLimit / 1000).toFixed(0)}k</span>
              </span>
            </div>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Sincronizado</span>
          </div>
          {waStatus && waStatus !== 'not_created' && (
            <button
              onClick={() => navigate('/dashboard/whatsapp')}
              className={`px-4 py-2 rounded-2xl border shadow-sm flex items-center gap-2 transition-colors ${
                waStatus === 'connected'
                  ? 'bg-green-50 border-green-100 hover:border-green-300'
                  : waStatus === 'connecting'
                  ? 'bg-amber-50 border-amber-100 hover:border-amber-300'
                  : 'bg-red-50 border-red-200 hover:border-red-400'
              }`}
            >
              {waStatus === 'connected' ? (
                <Smartphone size={13} className="text-green-500" />
              ) : waStatus === 'connecting' ? (
                <Loader2 size={13} className="text-amber-500 animate-spin" />
              ) : (
                <WifiOff size={13} className="text-red-500" />
              )}
              <span className={`text-xs font-black uppercase tracking-widest ${
                waStatus === 'connected' ? 'text-green-600'
                : waStatus === 'connecting' ? 'text-amber-600'
                : 'text-red-600'
              }`}>
                {waStatus === 'connected' ? 'WhatsApp: conectado'
                  : waStatus === 'connecting' ? 'WhatsApp: conectando...'
                  : 'WhatsApp: reconectar'}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Grid de Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card: Munícipes Totais */}

        <div 
          onClick={() => navigate('/dashboard/municipes')}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={80} />
          </div>
          <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Munícipes</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{summary.municipesTotal || 0}</h3>
          </div>
        </div>

        {/* Card: Aniversariantes */}
        <div 
          onClick={() => navigate('/dashboard/municipes')}
          className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer relative overflow-hidden ${summary.birthdaysToday > 0 ? 'border-pink-100 ring-4 ring-pink-50/50' : ''}`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-pink-600">
            <CalendarDays size={80} />
          </div>
          <div className={`${summary.birthdaysToday > 0 ? 'bg-pink-100 text-pink-600 animate-bounce' : 'bg-slate-50 text-slate-400'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
            <CalendarDays size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aniversários</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-black ${summary.birthdaysToday > 0 ? 'text-pink-600' : 'text-slate-900'}`}>{summary.birthdaysToday || 0}</h3>
          </div>
        </div>

        {/* Card: Demandas Urgentes */}
        <div 
          onClick={() => navigate('/dashboard/demands')}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-red-200 transition-all group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-red-600">
            <AlertCircle size={80} />
          </div>
          <div className={`${summary.needsAttention > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
            <AlertCircle size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atenção</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{summary.needsAttention || 0}</h3>
          </div>
        </div>

        {/* Card: Bairros */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-600">
            <MapPin size={80} />
          </div>
          <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
            <MapPin size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bairros</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{summary.uniqueBairros || 0}</h3>
          </div>
        </div>
      </div>

      {/* Gráficos e Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Atividade Recente (Gráfico de Linha) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={20} />
                Volume de Demandas
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos 7 dias</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#3b82f6', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categorias (Gráfico de Pizza) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-blue-600" size={20} />
              Segmentação
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Por Categoria</p>
          </div>
          <div className="flex-1 h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categoryStats.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#64748b' }} />
                <span className="text-[10px] font-black text-slate-500 uppercase truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
