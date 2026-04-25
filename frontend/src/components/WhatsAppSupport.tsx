import { useState } from 'react';
import { X } from 'lucide-react';

const SUPPORT_URL =
  'https://wa.me/5543984138841?text=Ol%C3%A1%2C+preciso+de+suporte+no+CRM+do+Ver%C3%AA';

export default function WhatsAppSupport() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1">
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Suporte via WhatsApp"
        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 flex-shrink-0"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.7-.494-5.27-1.384l-.376-.22-3.904.931.997-3.794-.245-.392A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
        <span className="text-sm font-medium">Suporte</span>
      </a>
      <button
        onClick={() => setVisible(false)}
        title="Fechar"
        className="w-5 h-5 rounded-full bg-slate-600 hover:bg-slate-700 text-white flex items-center justify-center shadow transition-colors -ml-1 self-start mt-0.5"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  );
}
