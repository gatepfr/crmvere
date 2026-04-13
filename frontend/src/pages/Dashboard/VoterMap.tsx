import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../api/client';
import { Map as MapIcon, Info } from 'lucide-react';

interface MapData {
  bairro: string;
  count: number;
  lat: number;
  lng: number;
}

export default function VoterMap() {
  const [data, setData] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([-23.5489, -46.6388]);

  useEffect(() => {
    api.get('/map/data')
      .then(res => {
        setData(res.data.points || []);
        if (res.data.center) {
          setCenter([res.data.center.lat, res.data.center.lng]);
        }
      })
      .catch(err => console.error('Erro ao carregar mapa:', err))
      .finally(() => setLoading(false));
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-slate-600">Carregando mapa de demandas...</span>
      </div>
    );
  }

  // Default center if no data (centered on a generic SP coordinate if first data point fails)
  const defaultCenter: [number, number] = data.length > 0 
    ? [data[0].lat, data[0].lng] 
    : [-23.5489, -46.6388];

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getMarkerColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return '#ef4444'; // Red-500
    if (ratio > 0.3) return '#f59e0b'; // Amber-500
    return '#3b82f6'; // Blue-500
  };

  const getMarkerRadius = (count: number) => {
    const minRadius = 10;
    const maxRadius = 30;
    return minRadius + (count / maxCount) * (maxRadius - minRadius);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <MapIcon className="text-blue-600" />
            Mapa de Demandas
          </h1>
          <p className="text-slate-500 mt-1">Visualização geográfica da densidade de solicitações por bairro.</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs font-medium text-slate-600">Alta Densidade</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs font-medium text-slate-600">Média Densidade</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs font-medium text-slate-600">Baixa Densidade</span>
          </div>
        </div>
      </header>

      <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative z-0" style={{ height: '600px' }}>
        <MapContainer 
          key={`${center[0]}-${center[1]}`}
          center={center} 
          zoom={13} 
          style={{ height: '100%', width: '100%', borderRadius: '1rem', zIndex: 0 }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data.map((point, index) => (
            <CircleMarker
              key={`${point.bairro}-${index}`}
              center={[point.lat, point.lng]}
              pathOptions={{
                fillColor: getMarkerColor(point.count),
                color: getMarkerColor(point.count),
                fillOpacity: 0.6,
                weight: 1
              }}
              radius={getMarkerRadius(point.count)}
            >
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-2">{point.bairro}</h3>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Total de Demandas:</span>
                    <span className="font-bold text-blue-600">{point.count}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-[10] backdrop-blur-sm">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="text-slate-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum dado geográfico</h3>
              <p className="text-slate-500">Ainda não há demandas com endereços válidos para exibir no mapa.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
