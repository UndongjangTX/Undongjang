"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { t } from "@/lib/i18n";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    __eventMapInit?: (() => void) | null;
  }
}

export function EventMap({
  address,
  locationName,
  className,
}: {
  address: string | null;
  locationName?: string | null;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error" | "no-key">(
    API_KEY ? "loading" : "no-key"
  );

  const query = [address, locationName].filter(Boolean).join(", ") || "";

  React.useEffect(() => {
    if (!API_KEY || !query.trim() || !containerRef.current) {
      if (!API_KEY) setStatus("no-key");
      return;
    }

    if (typeof window === "undefined") return;

    function initMap() {
      const g = (window as { google?: { maps: { Geocoder: new () => { geocode: (req: { address: string }, cb: (results: { geometry: { location: unknown } }[] | null, status: string) => void) => void }; Map: new (el: HTMLElement, opts: { center: unknown; zoom: number; zoomControl?: boolean; mapTypeControl?: boolean; fullscreenControl?: boolean }) => unknown; Marker: new (opts: { position: unknown; map: unknown }) => void; GeocoderStatus: { OK: string } } } }).google;
      if (!g || !containerRef.current) return;
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, err) => {
        if (err !== g.maps.GeocoderStatus.OK || !results?.[0] || !containerRef.current) {
          setStatus("error");
          return;
        }
        const center = results[0].geometry.location;
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom: 15,
          zoomControl: true,
          mapTypeControl: true,
          fullscreenControl: true,
        });
        new g.maps.Marker({ position: center, map });
        setStatus("ready");
      });
    }

    if ((window as { google?: { maps: unknown } }).google?.maps) {
      initMap();
      return;
    }

    const scriptId = "google-maps-api";
    if (document.getElementById(scriptId)) {
      window.__eventMapInit = initMap;
      if ((window as { google?: { maps: unknown } }).google?.maps) setTimeout(initMap, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=__eventMapInit`;
    script.async = true;
    script.defer = true;
    window.__eventMapInit = initMap;
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);
    return () => {
      window.__eventMapInit = null;
    };
  }, [query]);

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  if (!query.trim()) return null;

  if (status === "no-key" || status === "error") {
    return (
      <div
        className={`flex h-48 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground ${className ?? ""}`}
      >
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 p-4 hover:text-foreground"
        >
          <MapPin className="h-6 w-6" />
          <span className="text-xs">{t("events.viewOnMap")}</span>
        </a>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className={`flex h-48 w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground ${className ?? ""}`}
      >
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="h-48 w-full rounded-lg border overflow-hidden" />
      <a
        href={mapsLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-primary-green hover:underline"
      >
        <MapPin className="h-3.5 w-3.5" />
        {t("events.viewOnMap")}
      </a>
    </div>
  );
}
