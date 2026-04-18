import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, ShieldCheck, Map as MapIcon, AlertTriangle, Zap, X, Copy, Phone, UserCheck } from 'lucide-react';
import api from '../../api/client';

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

export default function StrategicDashboard() {
  const [data, setData] = useState<StrategicItem[]>([]);
  const [stats, setStats] = useState({ vacuums: 0, potential: 0, consolidated: 0 });
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<ActionPlanResult | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

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

  const executePlan = async (bairro: string) => {
    setExecuting(bairro);
    try {
      const response = await api.post('/intelligence/action/execute', { bairro });
      setActivePlan(response.data);
    } catch (error) {
      alert('Erro ao ativar plano de expansão.');
    } finally {
      setExecuting(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Carregando inteligência estratégica...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Target className="text-blue-600" size={32} />
          Estratégia Territorial
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Cruzamento de Votos (TSE) vs Engajamento (CRM)</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-red-100 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-600 text-[10px] font-black uppercase tracking-widest">Vácuos Críticos</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.vacuums} Bairros</h3>
            </div>
            <div className="bg-red-50 p-2 rounded-xl">
              <AlertTriangle className="text-red-500" size={20} />
            </div>
          </div>
          <p className="mt-2 text-slate-500 text-xs font-bold">Alto volume de votos, baixo CRM.</p>
        </div>

        <div className="bg-white border border-blue-100 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">Potencial</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.potential} Bairros</h3>
            </div>
            <div className="bg-blue-50 p-2 rounded-xl">
              <TrendingUp className="text-blue-500" size={20} />
            </div>
          </div>
          <p className="mt-2 text-slate-500 text-xs font-bold">Crescimento moderado detectado.</p>
        </div>

        <div className="bg-white border border-green-100 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-600 text-[10px] font-black uppercase tracking-widest">Consolidados</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.consolidated} Bairros</h3>
            </div>
            <div className="bg-green-50 p-2 rounded-xl">
              <ShieldCheck className="text-green-500" size={20} />
            </div>
          </div>
          <p className="mt-2 text-slate-500 text-xs font-bold">Base sólida de apoiadores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <MapIcon size={14} /> Ranking de Prioridade Territorial
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
                <tr>
                  <th className="p-5">Bairro</th>
                  <th className="p-5 text-center">Votos (TSE)</th>
                  <th className="p-5 text-center">Contatos (CRM)</th>
                  <th className="p-5 text-center">Conversão</th>
                  <th className="p-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold text-sm">
                      Nenhum dado estratégico disponível.
                    </td>
                  </tr>
                ) : data.map((item) => (
                  <tr key={item.bairro} className={`group hover:bg-slate-50/50 transition-all ${item.category === 'VACUO' ? 'bg-red-50/20' : ''}`}>
                    <td className="p-5">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.bairro}</div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${
                        item.category === 'VACUO' ? 'bg-red-100 text-red-700' :
                        item.category === 'POTENCIAL' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="p-5 text-center font-bold text-slate-600 text-sm">{item.total_votos.toLocaleString()}</td>
                    <td className="p-5 text-center font-bold text-slate-600 text-sm">{item.total_contatos.toLocaleString()}</td>
                    <td className="p-5 text-center">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-[80px] mx-auto overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-1000 ${item.conversion_rate < 0.1 ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min(item.conversion_rate * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400">{(item.conversion_rate * 100).toFixed(1)}%</span>
                    </td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => executePlan(item.bairro)}
                        disabled={!!executing}
                        className={`p-2.5 rounded-xl transition-all shadow-lg ${
                          executing === item.bairro 
                            ? 'bg-slate-200 text-slate-400 animate-pulse' 
                            : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200 hover:shadow-blue-200'
                        }`}
                      >
                        <Zap size={16} className={executing === item.bairro ? 'animate-bounce' : ''} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6 text-slate-400 text-xs font-bold uppercase tracking-widest leading-loose">
          Escolha um bairro e clique no raio para que a Inteligência gere um plano de ação completo com roteiros de IA e aliados estratégicos.
        </div>
      </div>

      {/* Modal de Plano de Ação Ativo */}
      {activePlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-300">
            <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Plano de Expansão: {activePlan.bairro}</h2>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Estratégia gerada com sucesso</p>
              </div>
              <button onClick={() => setActivePlan(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna 1: IA Content */}
              <div className="space-y-6">
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                  <Zap size={18} className="text-blue-600" />
                  Roteiros de IA
                </h3>
                
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Roteiro Reels/TikTok</span>
                    <button onClick={() => copyToClipboard(activePlan.aiSuggestion.reels)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed italic">"{activePlan.aiSuggestion.reels}"</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Post WhatsApp/Instagram</span>
                    <button onClick={() => copyToClipboard(activePlan.aiSuggestion.post)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">"{activePlan.aiSuggestion.post}"</p>
                </div>
              </div>

              {/* Coluna 2: Aliados */}
              <div className="space-y-6">
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                  <UserCheck size={18} className="text-green-600" />
                  Aliados Influentes ({activePlan.aliados.length})
                </h3>
                <div className="space-y-3">
                  {activePlan.aliados.length === 0 ? (
                    <div className="text-center p-10 text-slate-400 font-bold text-xs uppercase">Nenhuma liderança mapeada ainda.</div>
                  ) : activePlan.aliados.map(aliado => (
                    <div key={aliado.phone} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-green-200 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{aliado.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{aliado.phone}</p>
                      </div>
                      <a 
                        href={`https://wa.me/${aliado.phone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Phone size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">
                O card de visita foi criado no seu Kanban em "Estratégia Territorial"
              </p>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
