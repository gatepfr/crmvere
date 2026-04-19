import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Layout as KanbanIcon,
  Loader2,
  ChevronRight,
  Trash2,
  MessageSquare,
  ArrowRight,
  History,
  X
} from 'lucide-react';
import { formatPhone } from '../../utils/formatPhone';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  columnId: string;
}

interface Column {
  id: string;
  name: string;
  order: number;
}

interface Campaign {
  id: string;
  name: string;
}

interface PendingDemand {
  id: string;
  resumoIa: string;
  categoria: string;
  municipe: {
    id: string;
    name: string;
    phone: string;
  }
}


function SortableLeadCard({ lead, onDelete }: { lead: Lead, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: lead.id, 
    data: { 
      type: 'Lead', 
      lead 
    } 
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing mb-3 group relative"
    >
      <div {...attributes} {...listeners}>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-slate-900 leading-tight pr-6">{lead.name}</h4>
        </div>
        <div className="space-y-1">
          {lead.phone && (
            <div className="flex items-center text-xs text-slate-500">
              <Phone size={12} className="mr-1.5 text-slate-400" />
              {formatPhone(lead.phone)}
            </div>
          )}
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
        className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function KanbanColumn({ col, leads, onDelete, onDeleteLead }: { col: Column, leads: Lead[], onDelete: (id: string) => void, onDeleteLead: (id: string) => void }) {
  const { setNodeRef } = useDroppable({
    id: col.id,
    data: {
      type: 'Column',
      col
    }
  });

  return (
    <div className="flex-shrink-0 w-80 flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">{col.name}</h3>
          <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        <button 
          onClick={() => onDelete(col.id)}
          className="text-slate-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 bg-slate-100/50 rounded-2xl p-3 border border-slate-200/50 overflow-y-auto min-h-[500px]"
      >
        <SortableContext
          id={col.id}
          items={leads.map(l => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onDelete={onDeleteLead} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanLeads() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pendingDemands, setPendingDemands] = useState<PendingDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [activeColumnTab, setActiveColumnTab] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/kanban/campaigns');
      setCampaigns(res.data);
      if (res.data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    }
  }, [selectedCampaignId]);

  const fetchPendingDemands = useCallback(async () => {
    try {
      const res = await api.get('/kanban/pending-demands');
      setPendingDemands(res.data);
    } catch (err) {
      console.error('Failed to fetch pending demands', err);
    }
  }, []);

  const fetchBoard = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    try {
      const res = await api.get(`/kanban/boards/${selectedCampaignId}`);
      setColumns(res.data.columns);
      setLeads(res.data.leads);
      if (res.data.columns.length > 0 && !activeColumnTab) {
        setActiveColumnTab(res.data.columns[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch board', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId, activeColumnTab]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => { fetchPendingDemands(); }, [fetchPendingDemands]);

  const handleImportDemand = async (demand: PendingDemand) => {
    if (!selectedCampaignId) return;
    try {
      await api.post(`/kanban/campaigns/${selectedCampaignId}/leads`, {
        name: demand.municipe.name,
        phone: demand.municipe.phone,
        notes: demand.resumoIa,
        municipeId: demand.municipe.id
      });
      fetchBoard();
      fetchPendingDemands();
    } catch (err) {
      alert('Falha ao importar lead');
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    if (!isActiveALead) return;

    const isOverALead = over.data.current?.type === 'Lead';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (isOverALead) {
      const overLead = over.data.current.lead;
      if (active.data.current.lead.columnId !== overLead.columnId) {
        setLeads(prev => {
          const activeIndex = prev.findIndex(l => l.id === activeId);
          const updated = [...prev];
          updated[activeIndex] = { ...prev[activeIndex], columnId: overLead.columnId };
          return updated;
        });
      }
    }

    if (isOverAColumn) {
      setLeads(prev => {
        const activeIndex = prev.findIndex(l => l.id === activeId);
        if (prev[activeIndex].columnId === overId) return prev;
        const updated = [...prev];
        updated[activeIndex] = { ...prev[activeIndex], columnId: overId };
        return updated;
      });
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    const leadId = active.id;
    const activeLead = leads.find(l => l.id === leadId);
    
    if (activeLead) {
      try {
        await api.patch(`/kanban/leads/${leadId}/move`, { columnId: activeLead.columnId });
      } catch (err) {
        console.error('Failed to save move', err);
        fetchBoard();
      }
    }
    
    setActiveId(null);
  };

  const handleCreateCampaign = async () => {
    const name = prompt('Nome da Campanha:');
    if (!name) return;
    try {
      const res = await api.post('/kanban/campaigns', { name });
      setCampaigns([...campaigns, res.data]);
      setSelectedCampaignId(res.data.id);
    } catch (err) {
      alert('Falha ao criar campanha');
    }
  };

  const handleAddLead = async () => {
    const name = prompt('Nome do Lead:');
    if (!name) return;
    try {
      await api.post(`/kanban/campaigns/${selectedCampaignId}/leads`, { name });
      fetchBoard();
    } catch (err) {
      alert('Falha ao adicionar lead');
    }
  };

  const handleAddColumn = async () => {
    const name = prompt('Nome da Coluna:');
    if (!name) return;
    try {
      await api.post(`/kanban/campaigns/${selectedCampaignId}/columns`, { name });
      fetchBoard();
    } catch (err) {
      alert('Falha ao adicionar coluna');
    }
  };

  const handleDeleteColumn = async (id: string) => {
    if (!confirm('Deseja excluir esta coluna?')) return;
    try {
      await api.delete(`/kanban/columns/${id}`);
      fetchBoard();
    } catch (err) {
      alert('Falha ao excluir coluna');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Deseja excluir este lead?')) return;
    try {
      await api.delete(`/kanban/leads/${id}`);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      alert('Falha ao excluir lead');
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaignId) return;
    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) return;

    if (!confirm(`Deseja excluir permanentemente o quadro "${campaign.name}" e todas as suas colunas e leads?`)) return;

    try {
      await api.delete(`/kanban/campaigns/${selectedCampaignId}`);
      const remainingCampaigns = campaigns.filter(c => c.id !== selectedCampaignId);
      setCampaigns(remainingCampaigns);
      if (remainingCampaigns.length > 0) {
        setSelectedCampaignId(remainingCampaigns[0].id);
      } else {
        setSelectedCampaignId('');
      }
      alert('Quadro excluído com sucesso');
    } catch (err) {
      alert('Falha ao excluir quadro');
    }
  };

  if (loading && campaigns.length > 0) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <KanbanIcon className="mr-3 h-8 w-8 text-blue-600" />
            Funil de Leads
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Gerencie seu funil eleitoral e parcerias políticas.</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowImport(!showImport)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${
              showImport ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <MessageSquare size={18} />
            WhatsApp {pendingDemands.length > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pendingDemands.length}</span>}
          </button>
          
          <select 
            className="flex-1 md:flex-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedCampaignId && (
            <button 
              onClick={handleDeleteCampaign}
              className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"
              title="Excluir Quadro"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button 
            onClick={handleCreateCampaign}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm"
          >
            <Plus size={20} />
          </button>
          <button 
            onClick={handleAddLead}
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-500/20"
          >
            + Novo Lead
          </button>
        </div>
      </header>

      {/* Mobile Column Tabs */}
      {columns.length > 0 && (
        <div className="flex md:hidden overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar">
          {columns.map(col => (
            <button
              key={col.id}
              onClick={() => setActiveColumnTab(col.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-black transition-all border ${
                activeColumnTab === col.id 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {col.name.toUpperCase()} ({leads.filter(l => l.columnId === col.id).length})
            </button>
          ))}
          <button 
            onClick={handleAddColumn}
            className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-black bg-slate-100 border border-slate-200 text-slate-400"
          >
            + COLUNA
          </button>
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0 relative">
        {/* Kanban Board */}
        <div className="flex-1 flex gap-6 overflow-x-auto pb-6 custom-scrollbar h-full">
          {campaigns.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <div className="text-center p-8">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                  <KanbanIcon size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhuma campanha criada</h3>
                <button onClick={handleCreateCampaign} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all">Criar Primeira Campanha</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 h-full w-full">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                {columns.map((col) => (
                  <div key={col.id} className={`${activeColumnTab === col.id ? 'flex' : 'hidden'} md:flex h-full`}>
                    <KanbanColumn 
                      col={col} 
                      leads={leads.filter(l => l.columnId === col.id)} 
                      onDelete={handleDeleteColumn}
                      onDeleteLead={handleDeleteLead}
                    />
                  </div>
                ))}
                
                <DragOverlay dropAnimation={{
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: { active: { opacity: '0.5' } },
                  }),
                }}>
                  {activeId ? (
                    <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-blue-500 w-80 rotate-3 cursor-grabbing scale-105 transition-transform">
                      <h4 className="font-bold text-slate-900">{leads.find(l => l.id === activeId)?.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{formatPhone(leads.find(l => l.id === activeId)?.phone || '')}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              <button 
                onClick={handleAddColumn}
                className="hidden md:flex flex-shrink-0 w-80 h-full border-2 border-dashed border-slate-200 rounded-2xl flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all font-bold group min-h-[500px]"
              >
                <div className="p-3 bg-slate-100 rounded-full mb-3 group-hover:bg-blue-100 transition-colors">
                  <Plus size={24} />
                </div>
                Adicionar Nova Coluna
              </button>
            </div>
          )}
        </div>

        {/* Import Sidebar - Drawer Overlay Style */}
        {showImport && (
          <>
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-20 rounded-2xl transition-all"
              onClick={() => setShowImport(false)}
            />
            <aside className="absolute right-0 top-0 bottom-6 w-80 bg-white shadow-2xl border-l border-slate-200 z-30 flex flex-col animate-in slide-in-from-right duration-300 rounded-r-2xl">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-blue-600" />
                  Importar Demandas
                </h3>
                <button onClick={() => setShowImport(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                {pendingDemands.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <MessageSquare size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">Nenhuma demanda pendente para importação.</p>
                  </div>
                ) : (
                  pendingDemands.map((demand) => (
                    <div 
                      key={demand.id} 
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-900 text-sm pr-8">{demand.municipe.name}</h4>
                        <button 
                          onClick={() => handleImportDemand(demand)}
                          className="absolute top-3 right-3 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                          title="Importar como Lead"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-3 italic mb-3 leading-relaxed">"{demand.resumoIa}"</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">{demand.categoria}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{formatPhone(demand.municipe.phone)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
