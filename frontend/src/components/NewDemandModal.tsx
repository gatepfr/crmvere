import React, { useState } from 'react';
import api from '../api/client';
import { X, Save, User, Phone, MapPin, Tag, AlertTriangle, AlignLeft } from 'lucide-react';

interface NewDemandModalProps {
  onClose: () => void;
  onUpdate: () => void;
}

export default function NewDemandModal({ onClose, onUpdate }: NewDemandModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    municipeName: '',
    municipePhone: '',
    municipeBairro: '',
    categoria: 'outro',
    prioridade: 'media',
    resumoIa: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        {/* Header */}
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-black">Nova Demanda Manual</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Registro Interno do Gabinete</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Dados do Munícipe */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-blue-500" />
              Informações do Munícipe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="Nome do cidadão"
                  value={formData.municipeName}
                  onChange={e => setFormData({...formData, municipeName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="Ex: 5543999999999"
                  value={formData.municipePhone}
                  onChange={e => setFormData({...formData, municipePhone: e.target.value})}
                />
              </div>
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
                  onChange={e => setFormData({...formData, municipeBairro: e.target.value})}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Dados da Demanda */}
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
                  <option value="saude">Saúde</option>
                  <option value="infraestrutura">Infraestrutura</option>
                  <option value="seguranca">Segurança</option>
                  <option value="educacao">Educação</option>
                  <option value="outro">Outro</option>
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
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Resumo do Atendimento</label>
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

          {/* Botões */}
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
