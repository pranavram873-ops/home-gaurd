'use client';

import React, { type ReactNode } from 'react';
import { APIProvider, APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { AlertTriangle, Loader2, MapPin } from 'lucide-react';
import { getGoogleMapsApiKey } from '@/lib/maps/config';

interface MapShellProps {
  /** What the map is about, shown on the offline panel too. */
  label: string;
  /** Coordinates and perimeter, so a screen never loses its numbers. */
  summary: string;
  /** Tailwind height class for the map box. */
  heightClass?: string;
  children: ReactNode;
}

/**
 * The single door through which every map tile in the application is drawn.
 *
 * A missing or refused key is a property of the deployment, not of a duty
 * record, so it is reported as such: the panel below still states the post's
 * coordinates and perimeter, because an empty grey box would read as "this post
 * has no location" and send an operator to fix the wrong thing.
 */
export function MapShell({ label, summary, heightClass = 'h-96', children }: MapShellProps) {
  const apiKey = getGoogleMapsApiKey();

  return (
    <div className={`relative w-full overflow-hidden bg-slate-100 ${heightClass}`}>
      {!apiKey ? (
        <MapNotice
          tone="muted"
          label={label}
          summary={summary}
          title="Map tiles are not configured"
          body="This post has coordinates, but the deployment has no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, so the perimeter cannot be drawn on a map."
        />
      ) : (
        <APIProvider apiKey={apiKey}>
          <MapGate label={label} summary={summary}>
            {children}
          </MapGate>
        </APIProvider>
      )}
    </div>
  );
}

/**
 * The map components need the JavaScript API to be live before they mount, so
 * children are held back until the loader reports it. Each non-loaded state has
 * a different cause and therefore a different remedy, which is the part an
 * operator acting on the screen needs to see.
 */
function MapGate({ label, summary, children }: Omit<MapShellProps, 'heightClass'>) {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.LOADED) return <>{children}</>;

  if (status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <MapNotice
        tone="warn"
        label={label}
        summary={summary}
        title="Google refused this map key"
        body="The key is present but not authorized for this origin: check that the Maps JavaScript API is enabled, that billing is active, that the HTTP-referrer restriction covers this domain, and that a Map ID is supplied for projects created since March 2025."
      />
    );
  }

  if (status === APILoadingStatus.FAILED) {
    return (
      <MapNotice
        tone="warn"
        label={label}
        summary={summary}
        title="The map could not be loaded"
        body="maps.googleapis.com did not respond. Check the network connection to Google, then reload this screen."
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="font-semibold">Loading map…</span>
    </div>
  );
}

function MapNotice({
  tone,
  label,
  summary,
  title,
  body,
}: {
  tone: 'muted' | 'warn';
  label: string;
  summary: string;
  title: string;
  body: string;
}) {
  const Icon = tone === 'warn' ? AlertTriangle : MapPin;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />

      <div className="relative z-10 max-w-md w-full text-center px-6 py-6 bg-white/95 border border-slate-200 rounded-xl shadow-xs">
        <Icon
          className={`w-6 h-6 mx-auto mb-2.5 ${tone === 'warn' ? 'text-amber-600' : 'text-slate-400'}`}
        />
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-600 leading-relaxed mt-1.5">{body}</p>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1">
          <span className="text-[11px] font-bold text-slate-800">{label}</span>
          <span className="text-[10px] font-mono text-slate-500">{summary}</span>
        </div>
      </div>
    </div>
  );
}
