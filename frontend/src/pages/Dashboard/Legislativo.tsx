import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { 
  ClipboardList, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  Loader2, 
  Filter,
  ArrowUpDown,
  MapPin,
  Phone,
  Tag
} from 'lucide-react';

interface Demand {
  id: string;
  resumoIa: string;
  categoria: string;
  status: string;
  isLegislativo: boolean;
  numeroIndicacao: string | null;
  documentUrl: string | null;
  municipes: {
    name: string;
    phone: string;
    bairro: string | null;
  };
}

export default function Legislativo() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyLegislative, setOnlyLegislative] = useState(false);

  const loadDemands = useCallback(async () => {
    setLoading(true);
    try {
      // Usamos a mesma rota de demandas, mas com filtros específicos se necessário
      const res = await api.get('/demands?limit=100');
      // No frontend, filtramos ou mostramos todos conforme a nova lógica
      setDemands(res.data.data.map((d: any) => ({
        id: d.demandas.id,
        resumoIa: d.demandas.resumoIa,
        categoria: d.demandas.categoria,
        status: d.demandas.status,
        isLegislativo: d.demandas.isLegislativo,
        numeroIndicacao: d.demandas.numeroIndicacao,
        documentUrl: d.demandas.documentUrl,
        municipes: d.municipes
      })));
    } catch (err) {
      console.error('Erro ao carregar dados legislativos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  const toggleLegislativo = async (id: string, current: boolean) => {
    try {
      const num = current ? null : prompt('Digite o número da Indicação (ex: 123/2026):');
      if (current === false && num === null) return;

      await api.patch(`/demands/${id}/status`, { 
        isLegislativo: !current,
        numeroIndicacao: num 
      });
      loadDemands();
    } catch (err) {
      alert('Erro ao atualizar status legislativo');
    }
  };

  const updateDocUrl = async (id: string) => {
    const url = prompt('Cole o link do PDF ou da Indicação no site da Câmara:');
    if (url === null) return;
    try {
      await api.patch(`/demands/${id}/status`, { documentUrl: url });
      loadDemands();
    } catch (err) {
      alert('Erro ao atualizar link');
    }
  };

  const sendToWhatsApp = async (d: Demand) => {
    if (!d.documentUrl) {
      alert('Adicione o link da indicação primeiro!');
      return;
    }
    const msg = `Olá ${d.municipes.name}! Gostaria de informar que sua solicitação sobre *${d.categoria.toUpperCase()}* virou a Indicação oficial nº *${d.numeroIndicacao}*. Você pode acompanhar por aqui: ${d.documentUrl}`;
    
    try {
      await api.post('/whatsapp/send-direct', {
        phone: d.municipes.phone,
        message: msg
      });
      alert('Link enviado com sucesso para o munícipe!');
    } catch (err) {
      alert('Erro ao enviar WhatsApp. Verifique a conexão.');
    }
  };

  const filteredDemands = demands.filter(d => {
    const matchSearch = d.municipes.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       d.municipes.bairro?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLegislative = onlyLegislative ? d.isLegislativo : true;
    return matchSearch && matchLegislative;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <ClipboardList className="text-blue-600" size={32} />
          Demandas & Indicações
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Legislativa e Retorno ao Munícipe</p>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Buscar por nome ou bairro..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setOnlyLegislative(!onlyLegislative)}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border w-full md:w-auto ${
            onlyLegislative ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 border-transparent text-slate-500'
          }`}
        >
          Ver Apenas Indicações
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Munícipe / Bairro</th>
                <th className="px-6 py-4">Assunto</th>
                <th className="px-6 py-4 text-center">Indicação?</th>
                <th className="px-6 py-4 text-center">Número</th>
                <th className="px-6 py-4 text-right">Ações de Retorno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredDemands.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{d.municipes.name}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                        <MapPin size={10} /> {d.municipes.bairro || 'Não informado'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase w-fit mb-1">{d.categoria}</span>
                      <span className="text-xs text-slate-500 line-clamp-1">{d.resumoIa}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleLegislativo(d.id, d.isLegislativo)}>
                      {d.isLegislativo ? (
                        <CheckCircle2 className="text-emerald-500 mx-auto" size={24} />
                      ) : (
                        <Circle className="text-slate-200 mx-auto hover:text-blue-400 transition-colors" size={24} />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.isLegislativo ? (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100">
                        {d.numeroIndicacao || 'S/N'}
                      </span>
                    ) : (
                      <span className="text-slate-300">---</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => updateDocUrl(d.id)}
                        className={`p-2 rounded-lg border transition-all ${d.documentUrl ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}
                        title="Anexar Link/PDF"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button 
                        onClick={() => sendToWhatsApp(d)}
                        disabled={!d.isLegislativo}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-30"
                        title="Enviar para o Munícipe"
                      >
                        <MessageSquare size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
