import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Target, TrendingUp, ShieldCheck, Map as MapIcon, AlertTriangle, Zap } from 'lucide-react';
import axios from 'axios';

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
      const response = await axios.get('/api/intelligence/summary', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setData(response.data.strategy);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const executePlan = async (bairro: string) => {
    if (!confirm(`Deseja ativar o Plano de Expansão (Combo D) para o bairro ${bairro}?`)) return;
    
    try {
      await axios.post('/api/intelligence/action/execute', { bairro }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert(`Plano ativado com sucesso para ${bairro}! Tarefas criadas no Kanban.`);
    } catch (error) {
      alert('Erro ao ativar plano.');
    }
  };

  if (loading) return <Layout><div>Carregando inteligência estratégica...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-blue-600" />
            Inteligência Estratégica Territorial
          </h1>
          <p className="text-gray-600">Cruzamento de Votos (TSE) vs Engajamento (CRM) para expansão de mandato.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-600 text-sm font-semibold uppercase tracking-wider">Vácuos Críticos</p>
                <h3 className="text-3xl font-bold text-red-900">{stats.vacuums} Bairros</h3>
              </div>
              <AlertTriangle className="text-red-500" />
            </div>
            <p className="mt-2 text-red-700 text-sm">Alto volume de votos, baixo CRM.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-600 text-sm font-semibold uppercase tracking-wider">Potencial</p>
                <h3 className="text-3xl font-bold text-blue-900">{stats.potential} Bairros</h3>
              </div>
              <TrendingUp className="text-blue-500" />
            </div>
            <p className="mt-2 text-blue-700 text-sm">Crescimento moderado detectado.</p>
          </div>

          <div className="bg-green-50 border border-green-200 p-6 rounded-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-600 text-sm font-semibold uppercase tracking-wider">Consolidados</p>
                <h3 className="text-3xl font-bold text-green-900">{stats.consolidated} Bairros</h3>
              </div>
              <ShieldCheck className="text-green-500" />
            </div>
            <p className="mt-2 text-green-700 text-sm">Base sólida de apoiadores.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of Vacuums */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-bottom bg-gray-50 font-semibold flex items-center gap-2">
              <MapIcon size={18} /> Ranking de Prioridade Territorial
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="p-4">Bairro</th>
                  <th className="p-4 text-center">Votos (TSE)</th>
                  <th className="p-4 text-center">Contatos (CRM)</th>
                  <th className="p-4 text-center">Conversão</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.bairro} className={item.category === 'VACUO' ? 'bg-red-50/30' : ''}>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.bairro}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        item.category === 'VACUO' ? 'bg-red-100 text-red-700' :
                        item.category === 'POTENCIAL' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono">{item.total_votos.toLocaleString()}</td>
                    <td className="p-4 text-center font-mono">{item.total_contatos.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[80px] mx-auto">
                        <div 
                          className={`h-1.5 rounded-full ${item.conversion_rate < 0.1 ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min(item.conversion_rate * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-gray-500">{(item.conversion_rate * 100).toFixed(1)}%</span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => executePlan(item.bairro)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
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

          {/* Side Info */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl text-white shadow-lg">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <Zap size={18} /> O que é o Plano Combo D?
              </h4>
              <p className="text-blue-100 text-sm mb-4">
                Ao ativar, a Inteligência Eleitoral realiza 3 ações simultâneas para o bairro:
              </p>
              <ul className="text-xs space-y-3">
                <li className="flex gap-2">
                  <span className="bg-white/20 p-1 rounded">1</span>
                  <span><strong>Mailing VIP:</strong> Filtra as 20 lideranças mais influentes no CRM para contato imediato.</span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-white/20 p-1 rounded">2</span>
                  <span><strong>Kanban:</strong> Cria tarefa de visita territorial para a assessoria.</span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-white/20 p-1 rounded">3</span>
                  <span><strong>IA Criativa:</strong> Gera roteiros de vídeo e posts focados nas dores do bairro.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
