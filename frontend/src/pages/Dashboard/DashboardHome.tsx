import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertCircle,
  CalendarDays,
  MapPin,
  Loader2,
  TrendingUp,
  PieChart as PieChartIcon,
  Zap,
  Smartphone,
  WifiOff,
  X,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      // silencioso
    }
  }, []);

  useEffect(() => {
    api.get('/metrics')
      .then(res => {
        if (res.data && res.data.summary) setData(res.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchWaStatus]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 className="animate-spin text-primary" size={36} />
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
        Carregando inteligência...
      </p>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-10 gap-4">
      <AlertCircle size={44} className="text-destructive" />
      <div>
        <h3 className="text-lg font-bold text-foreground">Falha ao carregar indicadores</h3>
        <p className="text-muted-foreground text-sm mt-1">Verifique sua conexão ou tente novamente.</p>
      </div>
      <Button onClick={() => window.location.reload()}>Recarregar</Button>
    </div>
  );

  const summary = data.summary ?? {
    total: 0, pending: 0, needsAttention: 0, municipesTotal: 0,
    birthdaysToday: 0, uniqueBairros: 0, dailyTokenLimit: 0, tokenUsageTotal: 0,
  };
  const dailyStats = data.dailyStats ?? [];
  const categoryStats = data.categoryStats ?? [];

  const tokenPct = summary.dailyTokenLimit > 0
    ? Math.round((summary.tokenUsageTotal / summary.dailyTokenLimit) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Banner: reconexão WhatsApp */}
      {waStatus === 'needs_reconnect' && !alertDismissed && (
        <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
          <WifiOff size={18} className="text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">WhatsApp desconectado</p>
            <p className="text-xs text-destructive/70 mt-0.5">
              A sessão expirou. O atendimento automático está pausado.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => navigate('/dashboard/whatsapp')}
            className="shrink-0"
          >
            Reconectar
          </Button>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-destructive/50 hover:text-destructive transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-widest">
              Visão Geral
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Seu gabinete digital em tempo real.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Token usage */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card shadow-xs">
            <Zap size={13} className="text-amber-500 fill-amber-500 shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Tokens hoje</span>
              <span className="text-xs font-bold text-foreground mt-0.5">
                {(summary.tokenUsageTotal / 1000).toFixed(1)}k
                <span className="text-muted-foreground font-normal"> / {(summary.dailyTokenLimit / 1000).toFixed(0)}k</span>
                <span className="text-muted-foreground font-normal ml-1">({tokenPct}%)</span>
              </span>
            </div>
          </div>

          {/* Sync status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card shadow-xs">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sincronizado</span>
          </div>

          {/* WhatsApp status */}
          {waStatus && waStatus !== 'not_created' && (
            <button
              onClick={() => navigate('/dashboard/whatsapp')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border shadow-xs text-xs font-semibold uppercase tracking-widest transition-colors',
                waStatus === 'connected'
                  ? 'bg-green-50 border-green-200 text-green-700 hover:border-green-400'
                  : waStatus === 'connecting'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'
                  : 'bg-destructive/5 border-destructive/20 text-destructive hover:border-destructive/40'
              )}
            >
              {waStatus === 'connected'
                ? <Smartphone size={13} />
                : waStatus === 'connecting'
                ? <Loader2 size={13} className="animate-spin" />
                : <WifiOff size={13} />}
              {waStatus === 'connected' ? 'Conectado'
                : waStatus === 'connecting' ? 'Conectando...'
                : 'Reconectar'}
            </button>
          )}
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Munícipes"
          value={summary.municipesTotal}
          icon={<Users size={20} />}
          color="blue"
          onClick={() => navigate('/dashboard/municipes')}
        />
        <StatCard
          label="Aniversários hoje"
          value={summary.birthdaysToday}
          icon={<CalendarDays size={20} />}
          color={summary.birthdaysToday > 0 ? 'pink' : 'muted'}
          pulse={summary.birthdaysToday > 0}
          onClick={() => navigate('/dashboard/municipes')}
        />
        <StatCard
          label="Precisam de atenção"
          value={summary.needsAttention}
          icon={<AlertCircle size={20} />}
          color={summary.needsAttention > 0 ? 'red' : 'muted'}
          onClick={() => navigate('/dashboard/demands')}
        />
        <StatCard
          label="Bairros ativos"
          value={summary.uniqueBairros}
          icon={<MapPin size={20} />}
          color="indigo"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Linha: volume de demandas */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <CardTitle className="text-base font-semibold">Volume de Demandas</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Últimos 7 dias</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pizza: segmentação */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon size={16} className="text-primary" />
              <CardTitle className="text-base font-semibold">Segmentação</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Por categoria</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={6}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
              {categoryStats.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || '#64748b' }}
                  />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── StatCard component ── */

type StatColor = 'blue' | 'pink' | 'red' | 'indigo' | 'muted';

const colorMap: Record<StatColor, { icon: string; ghost: string; value: string }> = {
  blue:  { icon: 'bg-primary/10 text-primary',       ghost: 'text-primary',     value: 'text-foreground' },
  pink:  { icon: 'bg-pink-100 text-pink-600',         ghost: 'text-pink-400',    value: 'text-pink-600' },
  red:   { icon: 'bg-destructive/10 text-destructive', ghost: 'text-destructive', value: 'text-foreground' },
  indigo:{ icon: 'bg-indigo-50 text-indigo-600',      ghost: 'text-indigo-400',  value: 'text-foreground' },
  muted: { icon: 'bg-muted text-muted-foreground',    ghost: 'text-muted',       value: 'text-foreground' },
};

function StatCard({
  label,
  value,
  icon,
  color,
  pulse,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: StatColor;
  pulse?: boolean;
  onClick?: () => void;
}) {
  const c = colorMap[color];
  return (
    <Card
      onClick={onClick}
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        color === 'pink' && value > 0 && 'ring-2 ring-pink-100',
      )}
    >
      {/* ghost icon watermark */}
      <div className={cn('absolute top-2 right-2 opacity-[0.06]', c.ghost)}>
        <div className="scale-[3] origin-top-right">{icon}</div>
      </div>

      <CardContent className="pt-5 pb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', c.icon, pulse && 'animate-bounce')}>
          {icon}
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className={cn('text-3xl font-bold tabular-nums', c.value)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
