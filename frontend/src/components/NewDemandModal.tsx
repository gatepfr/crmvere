import React, { useState } from 'react';
import api from '../api/client';
import { X, Save, User, Phone, MapPin, Tag, AlertTriangle, Search, Loader2 } from 'lucide-react';

interface NewDemandModalProps {
  onClose: () => void;
  onUpdate: () => void;
  prefilledMunicipe?: any;
}

export default function NewDemandModal({ onClose, onUpdate, prefilledMunicipe }: NewDemandModalProps) {
  const [loading, setLoading] = useState(false);
  const [displayPhone, setDisplayPhone] = useState('');
  const [searchMunicipe, setSearchMunicipe] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    api.get('/demands/categories')
      .then(res => {
        const sorted = [...res.data].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));
        setCategories(sorted);
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    municipeId: '',
    municipeName: '',
    municipePhone: '',
    municipeCep: '',
    municipeBairro: '',
    categoria: '',
    prioridade: 'media',
    resumoIa: ''
  });

  // Preenchimento automático se vier do atendimento
  React.useEffect(() => {
    if (prefilledMunicipe) {
      selectMunicipe(prefilledMunicipe);
    }
  }, [prefilledMunicipe]);

  const handleSearch = async (term: string) => {
    setSearchMunicipe(term);
    if (term.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(`/demands/municipes/list?search=${term}&limit=5`);
      setSearchResults(res.data.data || []);
    } catch (err) {
      console.error('Erro na busca');
    } finally {
      setIsSearching(false);
    }
  };

  const selectMunicipe = (m: any) => {
    setFormData({
      ...formData,
      municipeId: m.id,
      municipeName: m.name,
      municipePhone: m.phone,
      municipeBairro: m.bairro || '',
      municipeCep: m.cep || ''
    });
    
    // Formata o telefone para exibição
    const raw = m.phone.replace(/\D/g, '');
    const truncated = raw.startsWith('55') ? raw.slice(2) : raw;
    let masked = truncated;
    if (truncated.length > 2) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    if (truncated.length > 7) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
    setDisplayPhone(masked);

    setSearchResults([]);
    setSearchMunicipe(m.name);
  };

  const handleCepChange = async (value: string) => {
    const cep = value.replace(/\D/g, '').substring(0, 8);
    setFormData(prev => ({ ...prev, municipeCep: cep }));

    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro && data.bairro) {
          setFormData(prev => ({ ...prev, municipeBairro: data.bairro.toUpperCase() }));
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  const handlePhoneChange = (value: string) => {
    const raw = value.replace(/\D/g, '');
    const truncated = raw.slice(0, 11);
    let masked = truncated;
    if (truncated.length > 2) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    if (truncated.length > 7) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
    setDisplayPhone(masked);
    if (truncated.length > 0) {
      setFormData({ ...formData, municipePhone: `55${truncated}` });
    } else {
      setFormData({ ...formData, municipePhone: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.municipePhone.length < 12) {
      alert('Por favor, insira um telefone válido com DDD.');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/demands', formData);
      alert('Demanda registrada com sucesso!');
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Erro ao criar demanda:', err);
      alert('Falha ao registrar demanda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-black">Nova Demanda Oficial</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Protocolo Manual do Gabinete</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-blue-500" />
              Informações do Munícipe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Buscar ou Nome Completo</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="Pesquise por nome..."
                    value={searchMunicipe}
                    onChange={e => {
                      handleSearch(e.target.value);
                      setFormData({...formData, municipeName: e.target.value, municipeId: ''});
                    }}
                  />
                  {isSearching && <Loader2 className="absolute right-4 top-3.5 animate-spin text-blue-500" size={16} />}
                  
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                      {searchResults.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectMunicipe(m)}
                          className="w-full px-5 py-3 text-left hover:bg-blue-50 flex flex-col border-b border-slate-50 last:border-0"
                        >
                          <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{m.phone} - {m.bairro || 'Sem bairro'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">WhatsApp (DDD + Número)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="(43) 99999-9999"
                  value={displayPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">CEP (Opcional)</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="00000-000"
                  value={formData.municipeCep}
                  onChange={e => handleCepChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Bairro</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="Bairro do atendimento"
                    value={formData.municipeBairro}
                    onChange={e => setFormData({...formData, municipeBairro: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Tag size={14} className="text-purple-500" />
              Detalhes da Solicitação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Categoria</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm appearance-none"
                  value={formData.categoria}
                  onChange={e => setFormData({...formData, categoria: e.target.value})}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Prioridade</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm appearance-none"
                  value={formData.prioridade}
                  onChange={e => setFormData({...formData, prioridade: e.target.value})}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assunto / Descrição</label>
              <textarea
                required
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium text-sm"
                placeholder="Descreva o que o munícipe solicitou..."
                value={formData.resumoIa}
                onChange={e => setFormData({...formData, resumoIa: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : (
                <>
                  <Save size={20} />
                  Salvar Demanda
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
