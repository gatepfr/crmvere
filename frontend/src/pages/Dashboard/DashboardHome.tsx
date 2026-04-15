import { useEffect, useState } from 'react';
import api from '../../api/client';
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
  ArrowUpRight
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
import { useNavigate } from 'react-router-dom';

interface DashboardData {
  summary: {
    total: number;
    pending: number;
    needsAttention: number;
    municipesTotal: number;
    birthdaysToday: number;
    uniqueBairros: number;
  };
  categoryStats: { name: string; value: number }[];
  dailyStats: { date: string; count: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function DashboardHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/metrics/dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Carregando inteligência...</p>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
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
        <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Sincronizado</span>
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
            <h3 className="text-3xl font-black text-slate-900">{data.summary.municipesTotal}</h3>
            <span className="text-[10px] font-bold text-blue-500 flex items-center gap-0.5">
              Base Geral <ArrowUpRight size={10} />
            </span>
          </div>
        </div>

        {/* Card: Aniversariantes */}
        <div 
          onClick={() => navigate('/dashboard/municipes')}
          className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer relative overflow-hidden ${data.summary.birthdaysToday > 0 ? 'border-pink-100 ring-4 ring-pink-50/50' : ''}`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-pink-600">
            <CalendarDays size={80} />
          </div>
          <div className={`${data.summary.birthdaysToday > 0 ? 'bg-pink-100 text-pink-600 animate-bounce' : 'bg-slate-50 text-slate-400'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
            <CalendarDays size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aniversariantes Hoje</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-black ${data.summary.birthdaysToday > 0 ? 'text-pink-600' : 'text-slate-900'}`}>{data.summary.birthdaysToday}</h3>
            {data.summary.birthdaysToday > 0 && (
              <span className="text-[10px] font-black text-pink-500 uppercase">Mandar Parabéns!</span>
            )}
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
          <div className={`${data.summary.needsAttention > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
            <AlertCircle size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atenção da Equipe</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{data.summary.needsAttention}</h3>
            <span className="text-[10px] font-bold text-red-500 uppercase">Aguardando</span>
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
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bairros Atendidos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{data.summary.uniqueBairros}</h3>
            <span className="text-[10px] font-bold text-indigo-500 uppercase">Diferentes</span>
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
              <LineChart data={data.dailyStats}>
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
                  data={data.categoryStats}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {data.categoryStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.categoryStats.slice(0, 4).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-black text-slate-500 uppercase truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
