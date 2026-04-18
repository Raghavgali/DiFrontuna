import { useEffect, useMemo, useRef, useState } from "react";
import type { Severity, Ticket } from "@/lib/triage";
import { getTomTomKey } from "@/lib/tomtom.functions";

interface BostonMapProps {
  tickets: Ticket[];
  selectedId: string | null;
  onSelect: (t: Ticket) => void;
  focusTicket?: Ticket | null;
  /** When true, pans/zooms to focusTicket (e.g. full-screen detail). Dashboard should leave false so pin clicks only open the side panel. */
  flyToOnFocus?: boolean;
  className?: string;
}

const BOSTON_CENTER: [number, number] = [42.3601, -71.0589];
const DEFAULT_ZOOM = 13;
const FOCUS_ZOOM = 16;

const sevColor: Record<Severity, string> = {
  emergency: "#FF453A",
  urgent: "#FF9F0A",
  standard: "#295CFF",
};

type LeafletMod = typeof import("leaflet");

function makePinIcon(
  L: LeafletMod,
  severity: Severity,
  selected: boolean,
) {
  const color = sevColor[severity];
  const isEmergency = severity === "emergency";
  const ringSize = selected ? 44 : 36;
  const dotSize = selected ? 18 : 14;

  return L.divIcon({
    className: "difrontuna-pin",
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
      html: `
        <div style="position:relative; width:${ringSize}px; height:${ringSize}px; display:flex; align-items:center; justify-content:center;">
          ${
            isEmergency
              ? `<span style="pointer-events:none; position:absolute; inset:0; border-radius:9999px; background:${color}; opacity:.25; animation: ct-pulse 1.8s ease-out infinite;"></span>`
              : ""
          }
          ${
            selected
              ? `<span style="pointer-events:none; position:absolute; inset:-6px; border-radius:9999px; background:${color}; opacity:.18;"></span>`
              : ""
          }
          <span style="
            width:${dotSize}px;
            height:${dotSize}px;
            border-radius:9999px;
            background:${color};
            box-shadow: 0 0 0 4px white, 0 6px 14px -4px rgba(0,0,0,.35);
            display:block;
          "></span>
        </div>
      `,
  });
}

/**
 * Imperative Leaflet only — one L.map() per effect, always paired with map.remove().
 * Avoids react-leaflet + React double-mount "Map container is already initialized".
 */
function BostonMapClient({
  tickets,
  selectedId,
  onSelect,
  focusTicket,
  flyToOnFocus = false,
  className,
}: BostonMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [L, setL] = useState<LeafletMod | null>(null);
  const [tomtomKey, setTomtomKey] = useState<string | null>(null);
  /** Bumps when a new L.Map instance is ready so marker sync re-runs. */
  const [mapEpoch, setMapEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leafletMod = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!cancelled) setL(leafletMod.default ?? leafletMod);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTomTomKey()
      .then((res) => {
        if (!cancelled) setTomtomKey(res.key);
      })
      .catch(() => {
        if (!cancelled) setTomtomKey("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      tickets.filter(
        (t) => typeof t.latitude === "number" && typeof t.longitude === "number",
      ),
    [tickets],
  );

  const tileUrl = tomtomKey
    ? `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey}`
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const tileAttribution = tomtomKey
    ? '&copy; <a href="https://www.tomtom.com/">TomTom</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  useEffect(() => {
    if (!L || tomtomKey === null || !containerRef.current) return;

    const el = containerRef.current;
    const map = L.map(el, {
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 22 }).addTo(map);
    map.setView(BOSTON_CENTER, DEFAULT_ZOOM);

    const markers = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = markers;
    setMapEpoch((e) => e + 1);

    const invalidate = () => map.invalidateSize();
    const t = window.setTimeout(invalidate, 50);
    window.addEventListener("resize", invalidate);

    return () => {
      window.removeEventListener("resize", invalidate);
      window.clearTimeout(t);
      markers.clearLayers();
      markersLayerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [L, tomtomKey, tileUrl, tileAttribution]);

  useEffect(() => {
    if (!L || !mapRef.current || !markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();
    for (const t of visible) {
      const icon = makePinIcon(L, t.severity, t.id === selectedId);
      const m = L.marker([t.latitude as number, t.longitude as number], {
        icon,
        bubblingMouseEvents: false,
      });
      m.on("click", (e) => {
        e.originalEvent?.stopPropagation();
        onSelectRef.current(t);
      });
      m.addTo(layer);
    }
  }, [L, visible, selectedId, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!flyToOnFocus || !map || !focusTicket) return;
    if (focusTicket.latitude == null || focusTicket.longitude == null) return;
    map.flyTo([focusTicket.latitude, focusTicket.longitude], FOCUS_ZOOM, {
      duration: 1.1,
    });
  }, [flyToOnFocus, focusTicket, mapEpoch]);

  if (!L || tomtomKey === null) {
    return (
      <div className={`relative h-full w-full bg-muted/40 ${className ?? ""}`} />
    );
  }

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ background: "oklch(0.95 0.008 85)" }}
      />
      <style>{`
        @keyframes ct-pulse {
          0% { transform: scale(0.6); opacity: .55; }
          80% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .leaflet-container { font-family: inherit; }
        .leaflet-control-attribution {
          background: rgba(255,255,255,.75) !important;
          border-radius: 8px;
          margin: 8px !important;
          font-size: 10px !important;
          padding: 2px 8px 2px 8px !important;
        }
      `}</style>
    </div>
  );
}

export function BostonMap(props: BostonMapProps) {
  return <BostonMapClient {...props} />;
}
