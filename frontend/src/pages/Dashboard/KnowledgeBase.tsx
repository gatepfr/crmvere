import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { FileText, Upload, Trash2, Loader2, FileIcon } from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await api.get('/knowledge');
      setDocuments(response.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Falha ao carregar documentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha no upload do arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
      await api.delete(`/knowledge/${id}`);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      alert('Falha ao excluir documento.');
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Base de Conhecimento</h2>
        <p className="text-slate-500 mt-2">Envie leis, decretos e documentos para que a IA use como referência.</p>
      </header>

      {/* Upload Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-500 transition-colors cursor-pointer relative group">
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,.txt,.docx"
          />
          <div className="flex flex-col items-center">
            {uploading ? (
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            ) : (
              <Upload className="h-12 w-12 text-slate-400 group-hover:text-blue-600 mb-4 transition-colors" />
            )}
            <p className="text-lg font-semibold text-slate-700">
              {uploading ? 'Processando arquivo...' : 'Clique ou arraste um arquivo para enviar'}
            </p>
            <p className="text-sm text-slate-500 mt-1">PDF, TXT ou DOCX (Max 5MB)</p>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-600" />
            Documentos na Base
          </h3>
          <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full">
            {documents.length} Arquivos
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-slate-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <FileIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-500">Nenhum documento cadastrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">Nome do Arquivo</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold text-right">Data</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-700">{doc.fileName}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 uppercase">{doc.fileType.split('/')[1] || 'DOC'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 text-right">
                      {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
