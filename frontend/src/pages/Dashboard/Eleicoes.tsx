import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { 
  Zap, 
  BarChart3, 
  MapPin, 
  Users, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  School,
  Map as MapIcon,
  PieChart as PieIcon,
  Activity
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';

const COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#4b5563'];

// Componente para ajustar o zoom do mapa quando os dados carregarem
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface ElectionConfig {
  ano: string;
  uf: string;
  municipio: string;
  nrCandidato: string;
}

export default function Eleicoes() {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, step: '' });
  const [data, setData] = useState<any>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [config, setConfig] = useState<ElectionConfig>({
    ano: '2024',
    uf: 'PR',
    municipio: '',
    nrCandidato: ''
  });

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      // Busca dados do gabinete para pre-preencher o formulário
      const configRes = await api.get('/config/me');
      if (configRes.data) {
        setConfig(prev => ({
          ...prev,
          uf: configRes.data.uf || prev.uf,
          municipio: configRes.data.municipio || prev.municipio
        }));
      }

      const res = await api.get('/eleicoes/resumo');
      if (res.data.setup_required) {
        setSetupMode(true);
      } else {
        setData(res.data);
        setSetupMode(false);
      }
    } catch (err) {
      console.error('Erro ao carregar resumo das eleições:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkImportStatus = useCallback(async () => {
    try {
      const res = await api.get('/eleicoes/status');
      setProgress(res.data);
      if (res.data.percent === 100) {
        setImporting(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Erro ao checar status:', err);
    }
  }, [fetchSummary]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    let interval: any;
    if (importing) {
      interval = setInterval(checkImportStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [importing, checkImportStatus]);

  const handleStartImport = async () => {
    if (!config.municipio || !config.nrCandidato) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    setImporting(true);
    try {
      await api.post('/eleicoes/importar', config);
    } catch (err) {
      alert('Falha ao iniciar importação.');
      setImporting(false);
    }
  };

  if (loading && !importing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-bold animate-pulse">Carregando Inteligência Eleitoral...</p>
      </div>
    );
  }

  if (importing) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-10 bg-white rounded-3xl shadow-xl border border-blue-50 text-center space-y-8">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 animate-bounce">
          <Zap size={48} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Processando Dados TSE</h2>
          <p className="text-slate-500 font-medium">Isso pode levar alguns minutos. Estamos minerando milhões de votos para você.</p>
        </div>
        
        <div className="space-y-4">
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-sm"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">{progress.step}</span>
            <span className="text-lg font-black text-slate-900">{progress.percent}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="text-center">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Módulo de Eleições</h1>
          <p className="text-slate-500 mt-2 font-medium">Configure seu registro oficial para começar a análise.</p>
        </header>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ano da Eleição</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                  value={config.ano}
                  onChange={e => setConfig({...config, ano: e.target.value})}
                >
                  <option value="2024">2024</option>
                  <option value="2020">2020</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">UF</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                  placeholder="Ex: PR"
                  maxLength={2}
                  value={config.uf}
                  onChange={e => setConfig({...config, uf: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Município (Exatamente como no TSE)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                placeholder="Ex: APUCARANA"
                value={config.municipio}
                onChange={e => setConfig({...config, municipio: e.target.value.toUpperCase()})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Seu Número de Candidato</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                placeholder="Ex: 55123"
                value={config.nrCandidato}
                onChange={e => setConfig({...config, nrCandidato: e.target.value})}
              />
            </div>

            <button 
              onClick={handleStartImport}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <TrendingUp size={20} />
              GERAR INTELIGÊNCIA ELEITORAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Zap className="text-blue-600" />
            Inteligência Eleitoral
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Análise territorial de votos e perfil</p>
        </div>
        <button onClick={() => setSetupMode(true)} className="px-4 py-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase flex items-center gap-2 transition-colors">
          <RefreshCw size={14} />
          Refazer Configuração
        </button>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <BarChart3 size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Total de Votos</p>
          <h4 className="text-3xl font-black text-slate-900">{data?.candidato?.qtVotosTotal || '---'}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <MapPin size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Principal Bairro</p>
          <h4 className="text-xl font-black text-slate-900 truncate">{data?.bairros?.[0]?.nm_bairro || '---'}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
            <Users size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Situação TSE</p>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{data?.candidato?.dsSituacao || 'PENDENTE'}</h4>
        </div>
      </div>

      {/* Mapa de Redutos */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
            <MapIcon size={16} className="text-blue-600" />
            Mapa de Redutos (Calor)
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            Intensidade por Votos
          </span>
        </div>
        <div className="h-[400px] w-full relative">
          {data?.mapa?.length > 0 ? (
            <MapContainer 
              center={[parseFloat(data.mapa[0].latitude), parseFloat(data.mapa[0].longitude)]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <ChangeView 
                center={[parseFloat(data.mapa[0].latitude), parseFloat(data.mapa[0].longitude)]} 
                zoom={13} 
              />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {data.mapa.map((ponto: any, idx: number) => {
                const lat = parseFloat(ponto.latitude);
                const lng = parseFloat(ponto.longitude);
                if (isNaN(lat) || isNaN(lng)) return null;

                // Calcula o raio com base nos votos (mínimo 5, máximo 30)
                const radius = Math.min(Math.max((ponto.total_votos / data.candidato.qtVotosTotal) * 300, 8), 40);

                return (
                  <CircleMarker
                    key={idx}
                    center={[lat, lng]}
                    radius={radius}
                    pathOptions={{
                      fillColor: '#2563eb',
                      color: '#1d4ed8',
                      weight: 1,
                      opacity: 0.8,
                      fillOpacity: 0.4
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <p className="text-xs font-black text-slate-900 uppercase">{ponto.nm_local_votacao}</p>
                        <p className="text-lg font-black text-blue-600">{ponto.total_votos} votos</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 gap-3">
              <MapPin size={32} className="text-slate-300" />
              <p className="text-slate-400 font-bold text-sm">Aguardando coordenadas para gerar mapa...</p>
            </div>
          )}
        </div>
      </div>

      {/* Listagem por Bairro */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
            <School size={16} className="text-blue-600" />
            Desempenho por Bairro
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Bairro</th>
                <th className="px-8 py-4 text-center">Votos</th>
                <th className="px-8 py-4 text-right">Penetração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.bairros?.map((b: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-4 font-bold text-slate-700 group-hover:text-blue-600">{b.nm_bairro}</td>
                  <td className="px-8 py-4 text-center font-black text-slate-900">{b.total_votos}</td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${Math.min((b.total_votos / (data?.candidato?.qtVotosTotal || 1)) * 100 * 5, 100)}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 italic">Reduto</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perfil Demográfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gênero e Escolaridade */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2 mb-6">
              <PieIcon size={16} className="text-pink-500" />
              Distribuição por Gênero
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.perfil?.genero}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="label"
                    label
                  >
                    {data?.perfil?.genero?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2 mb-6">
              <Activity size={16} className="text-emerald-500" />
              Nível de Escolaridade
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.perfil?.escolaridade?.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Faixa Etária */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-blue-600" />
            Perfil por Faixa Etária
          </h3>
          <div className="h-[600px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.perfil?.idade} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
