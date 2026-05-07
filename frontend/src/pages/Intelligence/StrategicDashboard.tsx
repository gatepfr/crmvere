import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Target, TrendingUp, ShieldCheck, Map as MapIcon, AlertTriangle, Zap, X, Copy, Phone, UserCheck, CheckSquare, Square, MessageCircle, ArrowUpDown } from 'lucide-react';
import api from '../../api/client';
import { formatPhone } from '../../utils/formatPhone';

interface StrategicItem {
  bairro: string;
  total_votos: number;
  total_contatos: number;
  conversion_rate: number;
  category: 'VACUO' | 'POTENCIAL' | 'CONSOLIDADO';
  priority: 'URGENTE' | 'ALTA' | 'NORMAL';
}

interface ActionPlanResult {
  bairro: string;
  aliados: { name: string; phone: string; score: number }[];
  aiSuggestion: { reels: string; post: string };
}

type SortField = 'bairro' | 'total_votos' | 'total_contatos' | 'conversion_rate';

export default function StrategicDashboard() {
  const [data, setData] = useState<StrategicItem[]>([]);
  const [stats, setStats] = useState({ vacuums: 0, potential: 0, consolidated: 0 });
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<ActionPlanResult | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [selectedAliados, setSelectedAliados] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('total_votos');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/intelligence/summary');
      setData(response.data.strategy || []);
      setStats(response.data.stats || { vacuums: 0, potential: 0, consolidated: 0 });
    } catch (error) {
      console.error('Error fetching intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (a[sortField] < b[sortField]) return -1 * modifier;
      if (a[sortField] > b[sortField]) return 1 * modifier;
      return 0;
    });
  }, [data, sortField, sortDirection]);

  const maxConversion = useMemo(() => {
    return Math.max(...data.map(d => d.conversion_rate), 0.01);
  }, [data]);

  const executePlan = async (bairro: string) => {
    setExecuting(bairro);
    try {
      const response = await api.post('/intelligence/action/execute', { bairro });
      setActivePlan(response.data);
      setSelectedAliados([]);
    } catch (error) {
      toast.error('Erro ao ativar plano de expansão.');
    } finally {
      setExecuting(null);
    }
  };


  const toggleAliado = (phone: string) => {
    setSelectedAliados(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const selectAllAliados = () => {
    if (!activePlan) return;
    if (selectedAliados.length === activePlan.aliados.length) {
      setSelectedAliados([]);
    } else {
      setSelectedAliados(activePlan.aliados.map(a => a.phone));
    }
  };

  const sendBulkWhatsApp = () => {
    if (selectedAliados.length === 0) return;
    const message = encodeURIComponent(activePlan?.aiSuggestion.post || "");
    selectedAliados.forEach((phone, index) => {
      const cleanPhone = phone.replace(/\D/g, '');
      setTimeout(() => {
        window.open(`https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55'+cleanPhone}?text=${message}`, '_blank');
      }, index * 500);
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  if (loading) return <div className="p-10 font-bold text-muted-foreground animate-pulse uppercase tracking-widest text-xs">Carregando inteligência estratégica...</div>;

  return (
    <div className="p-6 max-w-7xl animate-in fade-in duration-700">
      <div className="mb-8 text-left">
        <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-2xl shadow-lg shadow-blue-200">
            <Target className="text-white" size={32} />
          </div>
          Estratégia Territorial
        </h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2 ml-1">Inteligência de Expansão de Mandato</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-card border-2 border-red-100 dark:border-red-900/30 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <AlertTriangle size={80} />
          </div>
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-1">Vácuos Críticos</p>
          <h3 className="text-4xl font-black text-foreground">{stats.vacuums}</h3>
          <p className="mt-2 text-muted-foreground text-xs font-bold uppercase tracking-tight">Menos de 10% dos eleitores no CRM</p>
        </div>

        <div className="bg-card border-2 border-blue-100 dark:border-blue-900/30 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp size={80} />
          </div>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1">Potencial</p>
          <h3 className="text-4xl font-black text-foreground">{stats.potential}</h3>
          <p className="mt-2 text-muted-foreground text-xs font-bold uppercase tracking-tight">Entre 10% e 30% dos eleitores no CRM</p>
        </div>

        <div className="bg-card border-2 border-green-100 dark:border-green-900/30 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <ShieldCheck size={80} />
          </div>
          <p className="text-green-600 text-[10px] font-black uppercase tracking-widest mb-1">Consolidados</p>
          <h3 className="text-4xl font-black text-foreground">{stats.consolidated}</h3>
          <p className="mt-2 text-muted-foreground text-xs font-bold uppercase tracking-tight">Mais de 30% dos eleitores no CRM</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card border border-border rounded-[2rem] overflow-hidden shadow-xl shadow-slate-100/50 dark:shadow-none">
          <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
            <div className="font-black text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <MapIcon size={14} className="text-blue-500" /> Ranking de Prioridade Territorial
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-6 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('bairro')}>
                    <div className="flex items-center gap-2">Território <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="p-6 text-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('total_votos')}>
                    <div className="flex items-center justify-center gap-2">Votos Urna <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="p-6 text-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('total_contatos')}>
                    <div className="flex items-center justify-center gap-2">Contatos CRM <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="p-6 text-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('conversion_rate')}>
                    <div className="flex items-center justify-center gap-2">Conversão <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="p-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <AlertTriangle size={32} className="text-muted-foreground/20" />
                        <p className="text-muted-foreground/50 font-black text-xs uppercase tracking-widest">Nenhum dado territorial encontrado</p>
                        <a href="/dashboard/eleicoes" className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                          <Zap size={14} />
                          Importar dados na Inteligência Eleitoral
                        </a>
                      </div>
                    </td>
                  </tr>
                ) : sortedData.map((item) => (
                  <tr key={item.bairro} className={`group hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-all ${item.category === 'VACUO' ? 'bg-red-50/20 dark:bg-red-950/10' : ''}`}>
                    <td className="p-6">
                      <div className="font-black text-foreground text-base">{item.bairro}</div>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${
                          item.category === 'VACUO' ? 'bg-red-100 text-red-700' :
                          item.category === 'POTENCIAL' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.category}
                        </span>
                        {item.priority === 'URGENTE' && (
                          <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-red-600 text-white animate-pulse">URGENTE</span>
                        )}
                        {item.priority === 'ALTA' && (
                          <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-orange-100 text-orange-700">ALTA</span>
                        )}
                      </div>
                    </td>
                    <td className="p-6 text-center font-black text-muted-foreground">{item.total_votos.toLocaleString()}</td>
                    <td className="p-6 text-center font-black text-muted-foreground">{item.total_contatos.toLocaleString()}</td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              item.conversion_rate < 0.1 ? 'bg-red-500' :
                              item.conversion_rate < 0.3 ? 'bg-amber-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((item.conversion_rate / maxConversion) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground">{(item.conversion_rate * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => executePlan(item.bairro)}
                        disabled={!!executing}
                        className={`p-4 rounded-2xl transition-all shadow-lg ${
                          executing === item.bairro 
                            ? 'bg-muted text-muted-foreground/40'
                            : 'bg-foreground text-background hover:bg-blue-600 hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Zap size={20} fill={executing === item.bairro ? 'transparent' : 'currentColor'} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lateral: Explicação Combo D */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Zap size={100} />
            </div>
            
            <h4 className="font-black text-xl mb-4 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-yellow-400">
              O que é o <br/>Combo D?
            </h4>
            
            <p className="text-blue-100 text-sm mb-6 font-bold leading-relaxed relative z-10">
              Uma orquestração automática que prepara o terreno no bairro:
            </p>
            
            <ul className="text-xs space-y-5 relative z-10">
              <li className="flex gap-4">
                <span className="bg-lime-400 text-blue-900 w-8 h-8 flex items-center justify-center rounded-xl font-black shrink-0 shadow-lg">1</span>
                <span className="leading-tight font-bold"><strong>Mailing VIP:</strong> Seleciona as lideranças para contato imediato via WhatsApp.</span>
              </li>
              <li className="flex gap-4">
                <span className="bg-yellow-400 text-blue-900 w-8 h-8 flex items-center justify-center rounded-xl font-black shrink-0 shadow-lg">2</span>
                <span className="leading-tight font-bold"><strong>Equipe:</strong> Cria tarefa de visita territorial no Kanban para os assessores.</span>
              </li>
              <li className="flex gap-4">
                <span className="bg-lime-400 text-blue-900 w-8 h-8 flex items-center justify-center rounded-xl font-black shrink-0 shadow-lg">3</span>
                <span className="leading-tight font-bold"><strong>IA Criativa:</strong> Gera roteiros de conteúdo específicos para o bairro.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de Plano de Ação Ativo */}
      {activePlan && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-card rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500">
            <header className="p-8 border-b border-border flex justify-between items-center bg-muted/50">
              <div>
                <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Inteligência v3</span>
                <h2 className="text-3xl font-black text-foreground mt-2">Plano Territorial: {activePlan.bairro}</h2>
              </div>
              <button onClick={() => setActivePlan(null)} className="p-3 bg-muted hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                  <Zap size={18} className="text-blue-600" />
                  Sugestões da IA para {activePlan.bairro}
                </h3>

                <div className="space-y-4">
                  <div className="bg-muted rounded-3xl p-6 border border-border group relative">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Roteiro para Vídeo</span>
                      <button onClick={() => copyToClipboard(activePlan.aiSuggestion.reels)} className="p-2 bg-background shadow-sm rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-foreground font-bold leading-relaxed italic">"{activePlan.aiSuggestion.reels}"</p>
                  </div>

                  <div className="bg-muted rounded-3xl p-6 border border-border group relative">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Legenda para Post</span>
                      <button onClick={() => copyToClipboard(activePlan.aiSuggestion.post)} className="p-2 bg-background shadow-sm rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-foreground font-bold leading-relaxed">"{activePlan.aiSuggestion.post}"</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={18} className="text-green-600" />
                    Lideranças Locais ({activePlan.aliados.length})
                  </h3>
                  <button 
                    onClick={selectAllAliados}
                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                  >
                    {selectedAliados.length === activePlan.aliados.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {activePlan.aliados.map(aliado => (
                    <div 
                      key={aliado.phone} 
                      onClick={() => toggleAliado(aliado.phone)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedAliados.includes(aliado.phone) ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20' : 'border-border bg-card hover:border-border/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-blue-600">
                          {selectedAliados.includes(aliado.phone) ? <CheckSquare size={20} /> : <Square size={20} className="text-muted-foreground/20" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">{aliado.name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground font-mono tracking-tighter">{formatPhone(aliado.phone)}</p>
                        </div>
                      </div>
                      <a 
                        href={`https://wa.me/${aliado.phone.replace(/\D/g, '').startsWith('55') ? aliado.phone.replace(/\D/g, '') : '55'+aliado.phone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 shadow-md shadow-green-100"
                      >
                        <Phone size={14} />
                      </a>
                    </div>
                  ))}
                </div>

                {selectedAliados.length > 0 && (
                  <button 
                    onClick={sendBulkWhatsApp}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-[1.02] transition-all"
                  >
                    <MessageCircle size={18} />
                    Enviar para {selectedAliados.length} selecionados
                  </button>
                )}
              </div>
            </div>

            <footer className="p-8 bg-slate-900 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-600 opacity-10 blur-3xl translate-y-10"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">
                Mandato Digital: Ação territorial em andamento
              </p>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
