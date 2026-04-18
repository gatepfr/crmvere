import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, ShieldCheck, Map as MapIcon, AlertTriangle, Zap } from 'lucide-react';
import api from '../../api/client';

interface StrategicItem {
  bairro: string;
  total_votos: number;
  total_contatos: number;
  conversion_rate: number;
  category: 'VACUO' | 'POTENCIAL' | 'CONSOLIDADO';
  priority: 'URGENTE' | 'ALTA' | 'NORMAL';
}

export default function StrategicDashboard() {
  const [data, setData] = useState<StrategicItem[]>([]);
  const [stats, setStats] = useState({ vacuums: 0, potential: 0, consolidated: 0 });
  const [loading, setLoading] = useState(true);

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
    if (!confirm(`Deseja ativar o Plano de Expansão (Combo D) para o bairro ${bairro}?`)) return;
    
    try {
      await api.post('/intelligence/action/execute', { bairro });
      alert(`Plano ativado com sucesso para ${bairro}! Tarefas criadas no Kanban.`);
    } catch (error) {
      alert('Erro ao ativar plano.');
    }
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
        {/* List of Vacuums */}
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
                      Nenhum dado estratégico disponível. <br/>
                      <span className="text-[10px] uppercase">Certifique-se de importar os dados do TSE primeiro.</span>
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
                          className={`h-1.5 rounded-full transition-all duration-1000 ${item.conversion_rate < 0.1 ? 'bg-red-500' : 'bg-blue-500'}`} 
                          style={{ width: `${Math.min(item.conversion_rate * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400">{(item.conversion_rate * 100).toFixed(1)}%</span>
                    </td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => executePlan(item.bairro)}
                        className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 hover:shadow-blue-200"
                        title="Ativar Plano de Expansão"
                      >
                        <Zap size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Zap size={100} />
            </div>
            
            <h4 className="font-black text-xl mb-4 flex items-center gap-2 relative z-10">
              O que é o <br/>Combo D?
            </h4>
            
            <p className="text-blue-100 text-sm mb-6 font-bold leading-relaxed relative z-10">
              Uma orquestração automática que prepara o terreno no bairro:
            </p>
            
            <ul className="text-xs space-y-4 relative z-10">
              <li className="flex gap-3">
                <span className="bg-white/20 w-6 h-6 flex items-center justify-center rounded-lg font-black shrink-0">1</span>
                <span><strong>Mailing VIP:</strong> Seleciona as lideranças para contato imediato via WhatsApp.</span>
              </li>
              <li className="flex gap-3">
                <span className="bg-white/20 w-6 h-6 flex items-center justify-center rounded-lg font-black shrink-0">2</span>
                <span><strong>Equipe:</strong> Cria tarefa de visita territorial no Kanban para os assessores.</span>
              </li>
              <li className="flex gap-3">
                <span className="bg-white/20 w-6 h-6 flex items-center justify-center rounded-lg font-black shrink-0">3</span>
                <span><strong>IA Criativa:</strong> Gera roteiros de conteúdo específicos para o bairro.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
