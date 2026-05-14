// frontend/src/pages/Public/PublicDemandPage.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../api/client';
import {
  Tag, Briefcase, Hammer, Heart, Shield, Star, Zap, Globe, Users, Map,
  TreePine, Building2, BookOpen, Car, Trash2, Droplets, Flame, Wind,
  Volume2, AlertTriangle, Wrench, Scissors, Leaf, ShoppingBag, Home,
  Lightbulb, Stethoscope, GraduationCap, Bike, Bus, Dog, Fish,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';

const ICON_MAP: Record<string, FC<LucideProps>> = {
  Tag, Briefcase, Hammer, Heart, Shield, Star, Zap, Globe, Users, Map,
  TreePine, Building2, BookOpen, Car, Trash2, Droplets, Flame, Wind,
  Volume2, AlertTriangle, Wrench, Scissors, Leaf, ShoppingBag, Home,
  Lightbulb, Stethoscope, GraduationCap, Bike, Bus, Dog, Fish,
};

function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const VIRTUAL_CATEGORIES = [
  { displayName: 'Buraco / Rua',        dbName: 'Zeladoria Pública', icon: 'Hammer'      },
  { displayName: 'Mato Alto / Limpeza', dbName: 'Zeladoria Pública', icon: 'Scissors'    },
  { displayName: 'Iluminação Pública',  dbName: 'Zeladoria Pública', icon: 'Lightbulb'   },
  { displayName: 'Saúde / UBS',         dbName: 'Saúde',             icon: 'Stethoscope' },
  { displayName: 'Segurança',           dbName: 'Segurança',         icon: 'Shield'      },
];

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface TenantInfo {
  name: string;
  municipio: string | null;
  uf: string | null;
  partido: string | null;
  fotoUrl: string | null;
  categories: Category[];
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PublicDemandPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [categoriaId, setCategoriaId] = useState('');
  const [categoriaDisplay, setCategoriaDisplay] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/tenant/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setTenant)
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    return () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); };
  }, [fotoPreview]);

  const handleGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await r.json();
          const addr = data.address;
          const parts = [addr.road, addr.house_number, addr.suburb || addr.neighbourhood, addr.city || addr.town].filter(Boolean);
          setLocalizacao(parts.join(', '));
        } catch {
          setLocalizacao(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        } finally {
          setGpsLoading(false);
        }
      },
      () => { setGpsLoading(false); setError('Não foi possível obter sua localização.'); }
    );
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!categoriaId) { setError('Selecione o tipo de demanda.'); return; }
    if (descricao.length < 10) { setError('Descreva o problema com ao menos 10 caracteres.'); return; }
    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    if (telefone.replace(/\D/g, '').length < 10) { setError('Informe um telefone válido com DDD.'); return; }

    setSubmitting(true);
    const form = new FormData();
    form.append('categoriaId', categoriaId);
    if (categoriaDisplay) form.append('categoriaDisplay', categoriaDisplay);
    form.append('descricao', descricao);
    form.append('nome', nome);
    form.append('telefone', telefone.replace(/\D/g, ''));
    if (localizacao) form.append('localizacao', localizacao);
    if (foto) form.append('foto', foto);

    try {
      const r = await fetch(`${API_BASE_URL}/public/demanda/${slug}`, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Erro ao enviar.'); return; }
      setProtocolo(data.protocolo);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow">
          <p className="text-4xl mb-4">🏛️</p>
          <h1 className="text-lg font-bold text-slate-800">Gabinete não encontrado</h1>
          <p className="text-sm text-slate-500 mt-2">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (protocolo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a3b] to-[#2d1b69] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm shadow-2xl w-full">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-extrabold text-slate-800 mb-2">Demanda enviada!</h1>
          <p className="text-sm text-slate-500 mb-4">Seu protocolo é</p>
          <div className="bg-purple-50 border border-purple-200 rounded-xl py-3 px-6 inline-block mb-4">
            <span className="font-mono font-bold text-purple-700 text-lg">#{protocolo}</span>
          </div>
          <p className="text-sm text-slate-500">
            Você receberá a confirmação pelo <span className="text-green-600 font-semibold">WhatsApp</span>.
            O vereador vai dar andamento em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a0a3b] to-[#2d1b69] px-4 py-6 text-center text-white">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden border-2 border-[#39FF14] shadow-[0_0_12px_#39FF14,0_0_24px_#39FF14] bg-[#1a0a3b] flex items-center justify-center">
          {tenant.fotoUrl
            ? <img src={tenant.fotoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            : <img src="/icone_foguete.png" alt="CRM do Verê" className="w-10 h-10 object-contain" />
          }
        </div>
        <h1 className="font-extrabold text-base leading-tight text-white">{tenant.name}</h1>
        <p className="text-xs opacity-75 mt-1">
          {[tenant.municipio, tenant.uf, tenant.partido].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-5 pb-10">

        {/* Categories */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tipo de demanda *</p>
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const fallback = tenant.categories[0];
              const displayCategories = VIRTUAL_CATEGORIES
                .map(v => {
                  const match = tenant.categories.find(c => normalizeStr(c.name) === normalizeStr(v.dbName));
                  const resolved = match || fallback;
                  return resolved ? { id: resolved.id, displayName: v.displayName, icon: v.icon } : null;
                })
                .filter((c): c is { id: string; displayName: string; icon: string } => c !== null);

              const list = (displayCategories.length > 0 ? displayCategories : tenant.categories.map(c => ({
                id: c.id, displayName: c.name, icon: c.icon ?? 'Tag',
              }))).sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));

              return list.map(cat => {
                const isSelected = categoriaId === cat.id && categoriaDisplay === cat.displayName;
                const IconComp = ICON_MAP[cat.icon];
                return (
                  <button
                    key={cat.displayName}
                    type="button"
                    onClick={() => { setCategoriaId(cat.id); setCategoriaDisplay(cat.displayName); }}
                    className={`rounded-xl p-2 text-center border-2 transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {IconComp
                      ? <IconComp size={22} className="mx-auto mb-1" />
                      : <span className="block text-xl mb-1">📌</span>}
                    <span className="text-[10px] font-semibold leading-tight block">{cat.displayName}</span>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Localização</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={localizacao}
              onChange={e => setLocalizacao(e.target.value)}
              placeholder="Endereço ou bairro..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleGps}
              disabled={gpsLoading}
              className="bg-purple-600 text-white rounded-xl px-3 py-2.5 text-lg shrink-0 disabled:opacity-50"
              title="Usar minha localização"
            >
              {gpsLoading ? '⏳' : '📍'}
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Descrição *</p>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o problema com detalhes..."
            rows={3}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Foto (opcional)</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFoto} />
          {fotoPreview
            ? (
              <div className="relative">
                <img src={fotoPreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
                <button type="button" onClick={() => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); setFoto(null); setFotoPreview(null); }}
                  className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 text-xs shadow flex items-center justify-center">✕</button>
              </div>
            )
            : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 text-center text-sm text-slate-400 bg-white">
                <span className="block text-2xl mb-1">📷</span>
                Toque para adicionar foto
              </button>
            )
          }
        </div>

        {/* Personal data */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Seus dados</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
            <input
              type="tel"
              value={telefone}
              onChange={handlePhone}
              placeholder="(43) 99999-9999"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-700 to-[#2d1b69] text-white font-extrabold rounded-2xl py-4 text-sm disabled:opacity-60"
        >
          {submitting ? 'Enviando...' : '📤 Enviar Demanda'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Você receberá confirmação pelo <span className="text-green-600 font-semibold">WhatsApp</span>
        </p>
      </form>
    </div>
  );
}
