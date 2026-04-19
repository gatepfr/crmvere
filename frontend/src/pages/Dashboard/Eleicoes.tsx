import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import {
  Zap,
  BarChart3,
  MapPin,
  Loader2,
  RefreshCw,
  TrendingUp,
  School,
  Users,
  GraduationCap,
  Calendar
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

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
          uf: (configRes.data.uf || prev.uf).toUpperCase(),
          municipio: (configRes.data.municipio || prev.municipio).toUpperCase()
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
      if (res.data) {
        setProgress(res.data);
        if (res.data.percent === 100) {
          setImporting(false);
          fetchSummary();
        }
        if (res.data.step?.toLowerCase().includes('erro')) {
           // Se o passo contém a palavra erro, paramos a importação para o usuário ver o erro
           setImporting(false);
           alert(res.data.step);
        }
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Perfil Demográfico do Eleitorado */}
      {data?.perfil && (
        <>
          <header className="pt-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="text-purple-600" size={22} />
              Perfil Demográfico do Eleitorado
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              Perfil completo do eleitorado do município
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico: Gênero */}
            {data.perfil.genero?.length > 0 && (() => {
              const total = data.perfil.genero.reduce((s: number, g: any) => s + Number(g.value), 0);
              const generoData = data.perfil.genero.map((g: any) => ({
                name: g.label,
                value: total > 0 ? Math.round((Number(g.value) / total) * 100) : 0
              })).filter((d: any) => d.value > 0);
              return (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600">
                    <Users size={16} />
                  </div>
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Gênero</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={generoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }: any) => `${name} ${value}%`}
                    >
                      {generoData.map((_: any, i: number) => (
                        <Cell key={i} fill={['#6366f1', '#ec4899', '#94a3b8'][i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              );
            })()}

            {/* Gráfico: Faixa Etária */}
            {data.perfil.idade?.length > 0 && (() => {
              const total = data.perfil.idade.reduce((s: number, d: any) => s + Number(d.value), 0);
              const idadeData = data.perfil.idade.map((d: any) => ({
                name: d.label,
                value: total > 0 ? Math.round((Number(d.value) / total) * 100) : 0
              })).filter((d: any) => d.value > 0);
              return (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                    <Calendar size={16} />
                  </div>
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Faixa Etária</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={idadeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} interval={0} angle={-25} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              );
            })()}

            {/* Gráfico: Escolaridade */}
            {data.perfil.escolaridade?.length > 0 && (() => {
              const total = data.perfil.escolaridade.reduce((s: number, d: any) => s + Number(d.value), 0);
              const escData = data.perfil.escolaridade.map((d: any) => ({
                name: d.label,
                value: total > 0 ? Math.round((Number(d.value) / total) * 100) : 0
              })).filter((d: any) => d.value > 0);
              return (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                    <GraduationCap size={16} />
                  </div>
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Escolaridade</h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart layout="vertical" data={escData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} width={110} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
