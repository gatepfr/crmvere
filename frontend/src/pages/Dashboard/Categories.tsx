import { useState, useEffect } from 'react';
import api from '../../api/client';
import { 
  Tags, 
  Plus, 
  Trash2, 
  Loader2, 
  Palette, 
  Tag as TagIcon,
  X,
  AlertCircle
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const PRESET_COLORS = [
  '#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', 
  '#4b5563', '#dc2626', '#ea580c', '#65a30d', '#0891b2'
];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    color: '#2563eb',
    icon: 'Tag'
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/demands/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/demands/categories', form);
      setIsModalOpen(false);
      setForm({ name: '', color: '#2563eb', icon: 'Tag' });
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao criar categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta categoria?')) return;
    try {
      await api.delete(`/demands/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
      loadCategories();
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Tags className="text-blue-600" size={32} />
            Categorias do Gabinete
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Personalize a classificação das suas demandas</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-200"
        >
          <Plus size={20} />
          NOVA CATEGORIA
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: cat.color }}
                >
                  <TagIcon size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase text-sm">{cat.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativo no Gabinete</p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(cat.id)}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {categories.length === 0 && (
            <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
              <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-bold">Nenhuma categoria personalizada criada ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Nova Categoria</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome da Categoria</label>
                <input 
                  required 
                  type="text" 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" 
                  placeholder="Ex: OBRAS, SAÚDE, EDUCAÇÃO"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value.toUpperCase()})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({...form, color})}
                      className={`w-8 h-8 rounded-full transition-all ${form.color === color ? 'ring-4 ring-blue-100 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  CRIAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
