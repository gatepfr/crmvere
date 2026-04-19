import api from '../api/client';
import { useState, useEffect } from 'react';
import { formatPhone } from '../utils/formatPhone';
import {
  X,
  User,
  Phone,
  Tag,
  MapPin as MapIcon,
  CheckCircle2,
  Loader2,
  Edit2,
  FileText
} from 'lucide-react';

interface LegislativoEditModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
}

interface Category { id: string; name: string; color: string; }

const DEFAULT_CATEGORIES = [
  { id: 'f1', name: 'SAÚDE', color: '#db2777' },
  { id: 'f2', name: 'INFRAESTRUTURA', color: '#2563eb' },
  { id: 'f3', name: 'SEGURANÇA', color: '#dc2626' },
  { id: 'f4', name: 'EDUCAÇÃO', color: '#7c3aed' },
  { id: 'f5', name: 'ESPORTE', color: '#059669' },
  { id: 'f6', name: 'OUTRO', color: '#4b5563' }
];

export default function LegislativoEditModal({ demand, onClose, onUpdate }: LegislativoEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Estados do Munícipe
  const [municipe, setMunicipe] = useState({
    id: demand.municipes.id,
    name: demand.municipes.name,
    phone: demand.municipes.phone,
    bairro: demand.municipes.bairro || ''
  });
  const [displayPhone, setDisplayPhone] = useState('');

  // Estados da Indicação (Assunto)
  const [categoria, setCategoria] = useState(demand.demandas.categoria || 'OUTRO');
  const [descricao, setDescricao] = useState(demand.demandas.descricao || '');

  useEffect(() => {
    if (demand.municipes.phone) {
      setDisplayPhone(formatPhone(demand.municipes.phone));
    }
    api.get('/demands/categories')
      .then(res => setCategories(res.data.length > 0 ? res.data : DEFAULT_CATEGORIES))
      .catch(() => setCategories(DEFAULT_CATEGORIES));
  }, [demand]);


  const applyPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setDisplayPhone(masked);
    const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
    setMunicipe(prev => ({ ...prev, phone: dbNumber }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Atualiza Munícipe no BD
      await api.patch(`/demands/municipe/${municipe.id}`, {
        name: municipe.name,
        phone: municipe.phone,
        bairro: municipe.bairro
      });

      // 2. Atualiza a Indicação (Assunto/Categoria/Descrição)
      await api.patch(`/demands/${demand.demandas.id}/status`, {
        categoria,
        resumoIa: descricao // O backend mapeia resumoIa para descricao no updateDemand
      });

      onUpdate();
      alert('Alterações salvas com sucesso!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as alterações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 size={18} className="text-blue-600" />
              Editar Indicação
            </h3>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
              Ajuste os detalhes técnicos da propositura
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          {/* SEÇÃO CIDADÃO */}
          <div className="space-y-4 p-5 bg-blue-50/30 rounded-2xl border border-blue-100">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <User size={14} /> Dados do Cidadão (Atualiza no BD)
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input 
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={municipe.name}
                    onChange={e => setMunicipe({...municipe, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={displayPhone}
                      onChange={e => applyPhoneMask(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                  <div className="relative">
                    <MapIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={municipe.bairro}
                      onChange={e => setMunicipe({...municipe, bairro: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO ASSUNTO */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} /> Detalhes do Assunto
            </h4>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria / Assunto Geral</label>
                <div className="relative">
                  <Tag size={14} className="absolute left-3 top-3.5 text-slate-400" />
                  <select 
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Detalhada da Indicação</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all min-h-[120px]"
                  placeholder="Descreva aqui o assunto da indicação..."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            disabled={loading}
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
