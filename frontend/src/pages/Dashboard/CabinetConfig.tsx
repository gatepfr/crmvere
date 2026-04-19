import { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  Building2,
  Save,
  Loader2,
  Image as ImageIcon,
  MessageSquare,
  MapPin,
  Flag,
  Calendar,
  User,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const DEFAULT_BIRTHDAY = "Olá {nome}, parabéns pelo seu aniversário! Desejamos muita saúde, paz e realizações. Conte sempre conosco! 🎂🎈";
const DEFAULT_LEGISLATIVE = "Olá {nome}! Gostaria de informar que sua solicitação sobre *{assunto}* virou a Indicação oficial nº *{numero}*. Você pode acompanhar por aqui: {link}";
const DEFAULT_FOLLOWUP = "Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!";

const formatPhoneBR = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 2) return d.length ? `+${d}` : '';
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`;
  if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
  if (d.length <= 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
};

export default function CabinetConfig() {
  const [config, setConfig] = useState({
    name: '',
    municipio: '',
    uf: '',
    partido: '',
    mandato: '',
    fotoUrl: '',
    calendarUrl: '',
    birthdayMessage: '',
    birthdayAutomated: false,
    legislativeMessage: '',
    whatsappVereadorNumber: '',
    followUpEnabled: false,
    followUpDays: 5,
    followUpMessage: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    api.get('/config/me')
      .then(res => {
        setConfig({
          name: res.data.name || '',
          municipio: res.data.municipio || '',
          uf: res.data.uf || '',
          partido: res.data.partido || '',
          mandato: res.data.mandato || '',
          fotoUrl: res.data.fotoUrl || '',
          calendarUrl: res.data.calendarUrl || '',
          birthdayMessage: res.data.birthdayMessage || DEFAULT_BIRTHDAY,
          birthdayAutomated: res.data.birthdayAutomated || false,
          legislativeMessage: res.data.legislativeMessage || DEFAULT_LEGISLATIVE,
          whatsappVereadorNumber: formatPhoneBR(res.data.whatsappVereadorNumber || ''),
          followUpEnabled: res.data.followUpEnabled || false,
          followUpDays: res.data.followUpDays || 5,
          followUpMessage: res.data.followUpMessage || DEFAULT_FOLLOWUP,
        });
      })
      .catch(err => console.error('Erro ao carregar dados do gabinete:', err))
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus('idle');
    try {
      await api.patch('/config/update', {
        ...config,
        whatsappVereadorNumber: config.whatsappVereadorNumber,
        followUpEnabled: config.followUpEnabled,
        followUpDays: config.followUpDays,
        followUpMessage: config.followUpMessage,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-[10px]">Sincronizando Gabinete...</p>
    </div>
  );

  return (
    <div className="max-w-6xl space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Building2 className="text-blue-600" size={36} />
            Dados do Gabinete
          </h2>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-xs ml-1">Configuração de Identidade e Automação</p>
        </div>

        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-2xl border border-green-100 animate-in slide-in-from-right duration-300">
            <CheckCircle2 size={16} />
            <span className="text-xs font-black uppercase">Alterações Salvas!</span>
          </div>
        )}
      </header>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl">
                <User className="text-white" size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Perfil Político</h3>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Parlamentar</label>
                <input
                  type="text"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                  value={config.name}
                  onChange={e => setConfig({...config, name: e.target.value})}
                  placeholder="Ex: Vereador João Silva"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <MapPin size={12} /> Município
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                    value={config.municipio}
                    onChange={e => setConfig({...config, municipio: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Flag size={12} /> Estado (UF)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 uppercase"
                    value={config.uf}
                    onChange={e => setConfig({...config, uf: e.target.value.toUpperCase()})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Sparkles size={12} /> Partido
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                    value={config.partido}
                    onChange={e => setConfig({...config, partido: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar size={12} /> Mandato
                  </label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                    value={config.mandato}
                    onChange={e => setConfig({...config, mandato: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
              <div className="bg-pink-600 p-2 rounded-xl">
                <Smartphone className="text-white" size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Automações de WhatsApp</h3>
            </div>

            <div className="p-10 space-y-10">
              <div className="bg-pink-50/50 rounded-[2rem] p-8 border border-pink-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
                  <Sparkles size={100} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <h4 className="font-black text-pink-700 uppercase tracking-widest text-sm">🎈 Aniversariantes</h4>
                    <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.birthdayAutomated}
                        onChange={e => setConfig({...config, birthdayAutomated: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-pink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                      <span className="ms-3 text-[10px] font-black text-pink-700 uppercase">
                        {config.birthdayAutomated ? 'Auto Ativado' : 'Manual'}
                      </span>
                    </label>
                  </div>
                  <span className="text-[9px] font-black text-pink-400 bg-white px-3 py-1 rounded-full border border-pink-100 uppercase tracking-widest">Variável: {'{nome}'}</span>
                </div>

                <textarea
                  className="w-full px-6 py-5 bg-white/80 border-2 border-pink-100 focus:border-pink-500 rounded-[1.5rem] outline-none transition-all font-bold text-slate-700 text-sm min-h-[120px] relative z-10"
                  value={config.birthdayMessage}
                  onChange={e => setConfig({...config, birthdayMessage: e.target.value})}
                  placeholder="Escreva a mensagem de parabéns..."
                />
              </div>

              <div className="bg-blue-50/50 rounded-[2rem] p-8 border border-blue-100 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-blue-700 uppercase tracking-widest text-sm flex items-center gap-2">
                    <MessageSquare size={16} /> 📋 Retorno Legislativo
                  </h4>
                  <div className="flex gap-1">
                    {['{nome}', '{assunto}', '{numero}'].map(v => (
                      <span key={v} className="text-[8px] font-black text-blue-400 bg-white px-2 py-0.5 rounded-full border border-blue-100">{v}</span>
                    ))}
                  </div>
                </div>
                <textarea
                  className="w-full px-6 py-5 bg-white/80 border-2 border-blue-100 focus:border-blue-500 rounded-[1.5rem] outline-none transition-all font-bold text-slate-700 text-sm min-h-[120px]"
                  value={config.legislativeMessage}
                  onChange={e => setConfig({...config, legislativeMessage: e.target.value})}
                  placeholder="Mensagem para quando uma demanda virar indicação..."
                />
              </div>

              {/* Número do Vereador */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-50 p-2 rounded-xl"><Smartphone className="text-green-600" size={20} /></div>
                  <div>
                    <h3 className="font-black text-slate-900">Número do Vereador</h3>
                    <p className="text-xs text-slate-400">Recebe o relatório semanal pessoalmente</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp do Vereador</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5511999999999"
                    value={config.whatsappVereadorNumber}
                    onChange={e => setConfig({ ...config, whatsappVereadorNumber: formatPhoneBR(e.target.value) })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Ex: +55 (43) 99999-9999</p>
                </div>
              </div>

              {/* Follow-up Automático */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-50 p-2 rounded-xl"><MessageSquare className="text-blue-600" size={20} /></div>
                  <div>
                    <h3 className="font-black text-slate-900">Follow-up Automático</h3>
                    <p className="text-xs text-slate-400">Lembra o cidadão que a solicitação está sendo tratada</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">Ativar Follow-up Automático</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.followUpEnabled}
                      onChange={e => setConfig({ ...config, followUpEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                {config.followUpEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Dias sem resposta para disparar</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={config.followUpDays}
                        onChange={e => setConfig({ ...config, followUpDays: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mensagem de follow-up</label>
                      <textarea
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        value={config.followUpMessage}
                        onChange={e => setConfig({ ...config, followUpMessage: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Use <strong>{'{nome}'}</strong> para inserir o nome do cidadão</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Relatório Semanal */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-indigo-50 p-2 rounded-xl"><Sparkles className="text-indigo-600" size={20} /></div>
                  <div>
                    <h3 className="font-black text-slate-900">Relatório Semanal</h3>
                    <p className="text-xs text-slate-400">Enviado automaticamente toda segunda-feira às 08h</p>
                  </div>
                </div>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-xs text-indigo-800 font-bold">
                    O relatório inclui: atendimentos da semana, indicações realizadas, aniversariantes nos próximos 7 dias e bairro mais ativo.
                    É enviado para o número da equipe e para o número do vereador cadastrados acima.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8 lg:sticky lg:top-8">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-600 opacity-20 blur-3xl -translate-y-20"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-[2.5rem] bg-white/10 border-2 border-white/20 p-1 mb-6 group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                {config.fotoUrl ? (
                  <img src={config.fotoUrl} alt="Parlamentar" className="w-full h-full object-cover rounded-[2rem]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-[2rem]">
                    <User size={48} className="text-white/20" />
                  </div>
                )}
              </div>
              <h4 className="text-3xl font-black tracking-tighter drop-shadow-md" style={{ color: '#a3e635' }}>
                {config.name || 'Seu Nome Aqui'}
              </h4>
              <p className="text-blue-300 text-[11px] font-black uppercase tracking-[0.2em] mt-2">{config.partido || 'Seu Partido'}</p>
              <div className="w-full h-px bg-white/10 my-6"></div>
              <div className="grid grid-cols-2 w-full gap-4">
                <div className="text-left">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Cidade</p>
                  <p className="text-xs font-bold truncate">{config.municipio || '---'}</p>
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Mandato</p>
                  <p className="text-xs font-bold">{config.mandato || '---'}</p>
                </div>
              </div>
            </div>
          </div>

          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <ImageIcon size={12} /> URL da Foto Oficial
              </label>
              <input
                type="url"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all font-bold text-slate-700 text-xs"
                value={config.fotoUrl}
                onChange={e => setConfig({...config, fotoUrl: e.target.value})}
                placeholder="https://link-da-sua-foto.jpg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Calendar size={12} /> Agenda (Google Embed)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all font-bold text-slate-700 text-xs"
                value={config.calendarUrl}
                onChange={e => setConfig({...config, calendarUrl: e.target.value})}
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Save size={20} />
                ATUALIZAR GABINETE
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
