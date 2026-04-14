import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
})

function EmergencyMap({ emergencies = [] }) {
    const validEmergencies = emergencies.filter(
        (emergency) => emergency.latitude != null && emergency.longitude != null
    )

    const center = [20.5937, 78.9629]

    return (
        <div className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/90 p-4 shadow-soft">
            <h2 className="mb-4 text-xl font-semibold text-white">Emergency Map</h2>
            <MapContainer
                center={center}
                zoom={5}
                scrollWheelZoom={false}
                className="h-80 w-full rounded-[1.5rem] border border-white/10"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {validEmergencies.map((emergency) => (
                    <Marker
                        key={emergency.id}
                        position={[emergency.latitude, emergency.longitude]}
                        icon={markerIcon}
                    >
                        <Popup>
                            <div className="space-y-1 text-sm text-slate-900">
                                <p><strong>Type:</strong> {emergency.emergencyType || 'Unknown'}</p>
                                <p><strong>Status:</strong> {emergency.status || 'pending'}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}

export default EmergencyMap
