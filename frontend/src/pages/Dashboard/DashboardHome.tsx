import { useEffect, useState } from 'react';
import api from '../../api/client';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { FileText, Clock, TrendingUp, BarChart2, Zap, AlertTriangle, ShieldAlert } from 'lucide-react';

interface MetricsData {
  summary: {
    total: number;
    pending: number;
  };
  categoryStats: {
    name: string | null;
    value: number;
  }[];
  dailyStats: {
    date: string;
    count: number;
  }[];
}

interface AIQuota {
  usage: number;
  limit: number;
  isBlocked: boolean;
}

export default function DashboardHome() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [quota, setAIQuota] = useState<AIQuota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/metrics'),
      api.get('/config/me')
    ])
    .then(([metricsRes, configRes]) => {
      setMetrics(metricsRes.data);
      setAIQuota(configRes.data.aiQuota);
    })
    .catch(err => console.error('Erro ao buscar dados do dashboard:', err))
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-slate-600">Carregando métricas...</span>
      </div>
    );
  }

  if (!metrics) return <div className="p-8">Falha ao carregar métricas.</div>;

  const usagePercent = quota ? (quota.usage / quota.limit) * 100 : 0;
  const isNearLimit = usagePercent >= 80;

  const COLORS = ['#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777'];

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard de Gestão</h1>
          <p className="text-slate-500">Métricas reais extraídas do banco de dados.</p>
        </div>

        {quota && (
          <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
            quota.isBlocked ? 'bg-red-50 border-red-100' : 
            isNearLimit ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'
          }`}>
            <div className={`p-2 rounded-lg ${
              quota.isBlocked ? 'bg-red-100 text-red-600' :
              isNearLimit ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {quota.isBlocked ? <ShieldAlert size={20} /> : <Zap size={20} />}
            </div>
            <div className="min-w-[150px]">
              <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-1">
                <span className="text-slate-500">Consumo IA Diário</span>
                <span className={quota.isBlocked ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-blue-600'}>
                  {quota.isBlocked ? 'BLOQUEADO' : `${Math.round(usagePercent)}%`}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    quota.isBlocked ? 'bg-red-500' :
                    isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-bold">
                {quota.usage.toLocaleString()} / {quota.limit.toLocaleString()} TOKENS
              </p>
            </div>
          </div>
        )}
      </header>

      {quota?.isBlocked && (
        <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-red-200 animate-pulse">
          <ShieldAlert size={24} />
          <div>
            <p className="font-black text-sm uppercase tracking-tight">IA Temporariamente Bloqueada</p>
            <p className="text-xs opacity-90 font-medium">Seu acesso à inteligência artificial foi suspenso pela administração central.</p>
          </div>
        </div>
      )}

      {isNearLimit && !quota?.isBlocked && (
        <div className="bg-amber-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-amber-200">
          <AlertTriangle size={24} />
          <div>
            <p className="font-black text-sm uppercase tracking-tight">Limite de Tokens Próximo</p>
            <p className="text-xs opacity-90 font-medium">Você atingiu {Math.round(usagePercent)}% da sua quota diária. Após 100%, a IA será pausada até amanhã.</p>
          </div>
        </div>
      )}
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total de Demandas</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.summary.total}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4 transition-all hover:shadow-md">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock size={24} /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Demandas Novas</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.summary.pending}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4 transition-all hover:shadow-md">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp size={24} /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Últimos 7 Dias</p>
            <p className="text-2xl font-bold text-slate-900">
              {metrics.dailyStats.reduce((acc, curr) => acc + curr.count, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Activity Line Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Atividade Diária</h3>
            <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><BarChart2 size={18} /></div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.dailyStats}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold mb-6 text-slate-800">Principais Categorias</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={metrics.categoryStats} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={80} 
                  innerRadius={60}
                  stroke="none"
                  paddingAngle={5}
                >
                  {metrics.categoryStats.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 space-y-3">
            {metrics.categoryStats.slice(0, 5).map((c, index) => (
              <div key={c.name || 'unnamed'} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">
                    {c.name || 'Sem Categoria'}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

