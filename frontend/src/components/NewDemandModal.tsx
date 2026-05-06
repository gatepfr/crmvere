import React, { useState } from 'react';
import { toast } from 'sonner';
import api from '../api/client';
import { Save, User, MapPin, Tag, Search, Loader2 } from 'lucide-react';
import { formatPhone } from '../utils/formatPhone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

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

  React.useEffect(() => {
    if (prefilledMunicipe) {
      selectMunicipe(prefilledMunicipe);
    }
  }, [prefilledMunicipe]);

  const handleSearch = async (term: string) => {
    setSearchMunicipe(term);
    if (term.length < 3) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await api.get(`/demands/municipes/list?search=${term}&limit=5`);
      setSearchResults(res.data.data || []);
    } catch { console.error('Erro na busca'); }
    finally { setIsSearching(false); }
  };

  const selectMunicipe = (m: any) => {
    setFormData({ ...formData, municipeId: m.id, municipeName: m.name, municipePhone: m.phone, municipeBairro: m.bairro || '', municipeCep: m.cep || '' });
    setDisplayPhone(formatPhone(m.phone));
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
        if (!data.erro && data.bairro) setFormData(prev => ({ ...prev, municipeBairro: data.bairro.toUpperCase() }));
      } catch { /* noop */ }
    }
  };

  const handlePhoneChange = (value: string) => {
    const raw = value.replace(/\D/g, '');
    const truncated = raw.slice(0, 11);
    let masked = truncated;
    if (truncated.length > 2) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    if (truncated.length > 7) masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
    setDisplayPhone(masked);
    setFormData({ ...formData, municipePhone: truncated.length > 0 ? `55${truncated}` : '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.municipePhone.length < 12) { toast.warning('Por favor, insira um telefone válido com DDD.'); return; }
    setLoading(true);
    try {
      await api.post('/demands', formData);
      toast.success('Demanda registrada com sucesso!');
      onUpdate();
      onClose();
    } catch {
      toast.error('Falha ao registrar demanda.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 bg-muted border border-input rounded-2xl focus:ring-2 focus:ring-ring focus:bg-background outline-none transition-all font-medium text-sm text-foreground";
  const labelCls = "block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white rounded-t-xl">
          <div>
            <DialogTitle className="text-xl font-black text-white">Nova Demanda Oficial</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Protocolo Manual do Gabinete
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-primary" />
              Informações do Munícipe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className={labelCls}>Buscar ou Nome Completo</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className={inputCls}
                    placeholder="Pesquise por nome..."
                    value={searchMunicipe}
                    onChange={e => {
                      handleSearch(e.target.value);
                      setFormData({ ...formData, municipeName: e.target.value, municipeId: '' });
                    }}
                  />
                  {isSearching && <Loader2 className="absolute right-4 top-3.5 animate-spin text-primary" size={16} />}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-2xl shadow-xl z-20 overflow-hidden">
                      {searchResults.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectMunicipe(m)}
                          className="w-full px-5 py-3 text-left hover:bg-accent flex flex-col border-b border-border last:border-0"
                        >
                          <span className="font-bold text-popover-foreground text-sm">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">{formatPhone(m.phone)} - {m.bairro || 'Sem bairro'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>WhatsApp (DDD + Número)</label>
                <input type="text" required className={inputCls} placeholder="(43) 99999-9999" value={displayPhone} onChange={e => handlePhoneChange(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>CEP (Opcional)</label>
                <input type="text" className={inputCls} placeholder="00000-000" value={formData.municipeCep} onChange={e => handleCepChange(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Bairro</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    className={`${inputCls} pl-12`}
                    placeholder="Bairro do atendimento"
                    value={formData.municipeBairro}
                    onChange={e => setFormData({ ...formData, municipeBairro: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          <div className="space-y-4">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Tag size={14} className="text-purple-500" />
              Detalhes da Solicitação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Categoria</label>
                <select className={inputCls} value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioridade</label>
                <select className={inputCls} value={formData.prioridade} onChange={e => setFormData({ ...formData, prioridade: e.target.value })}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Assunto / Descrição</label>
              <textarea
                required
                rows={4}
                className={inputCls}
                placeholder="Descreva o que o munícipe solicitou..."
                value={formData.resumoIa}
                onChange={e => setFormData({ ...formData, resumoIa: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1 py-6 text-base font-black rounded-2xl" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-[2] py-6 text-base font-black rounded-2xl">
              {loading ? <><Loader2 className="animate-spin" size={18} /> Salvando...</> : <><Save size={18} /> Salvar Demanda</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
