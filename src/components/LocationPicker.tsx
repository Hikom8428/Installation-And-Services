"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LocateFixed, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons reference image paths that don't resolve
// correctly through Next.js's bundler — point them at the CDN copies instead.
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
}

// Default map center: India, roughly centered — used until the browser's
// geolocation (or the user's own tap) picks a real point.
const DEFAULT_CENTER: [number, number] = [22.9734, 78.6569];

function ClickHandler({ onChange }: { onChange: (coords: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Floating button, rendered inside the map, that re-fetches the device's
// current position, drops the pin there, and flies the view to it.
function LiveLocationButton({ onChange }: { onChange: (coords: { lat: number; lng: number }) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const handleClick = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(coords);
        map.flyTo([coords.lat, coords.lng], 16);
        setLocating(false);
      },
      (err) => {
        setError(err.message || "Could not get location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 10, marginRight: 10 }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={handleClick}
          disabled={locating}
          title="Get live location"
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium px-2.5 py-2 shadow disabled:opacity-60"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          Get Live Location
        </button>
        {error && <div className="bg-white text-red-600 text-[11px] px-2 py-1 max-w-[180px]">{error}</div>}
      </div>
    </div>
  );
}

export default function LocationPicker({ value, onChange }: Props) {
  const [center, setCenter] = useState<[number, number]>(value ? [value.lat, value.lng] : DEFAULT_CENTER);

  // As soon as the map mounts (i.e. as soon as the form is open), ask for
  // location permission and drop the pin at the live position automatically.
  useEffect(() => {
    if (value || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter([coords.lat, coords.lng]);
        onChange(coords);
      },
      () => {
        /* permission denied or unavailable — keep default center, user can still tap the map or use "Get Live Location" */
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-md overflow-hidden border border-gray-300">
      <MapContainer center={center} zoom={value ? 16 : 5} scrollWheelZoom={true} style={{ height: "260px", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        <LiveLocationButton onChange={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
      </MapContainer>
    </div>
  );
}
