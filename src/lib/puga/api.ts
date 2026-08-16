import { CAMERAS, LAST_BATCH, QUARANTINE, SIGHTINGS, TIGERS } from "./demo";
import type { BatchSummary, Camera, QuarantineItem, Sighting, Tiger } from "./types";

const KEY = "puga.apiBaseUrl";
export const DEFAULT_API_BASE = "http://localhost:8000";

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function setApiBase(url: string) {
  if (typeof window === "undefined") return;
  if (url) window.localStorage.setItem(KEY, url);
  else window.localStorage.removeItem(KEY);
}

export interface Dataset {
  source: "live" | "demo";
  baseUrl: string | null;
  error?: string | undefined;
  cameras: Camera[];
  tigers: Tiger[];
  sightings: Sighting[];
  quarantine: QuarantineItem[];
  lastBatch: BatchSummary;
}

const demoDataset = (error?: string): Dataset => ({
  source: "demo",
  baseUrl: null,
  error,
  cameras: CAMERAS,
  tigers: TIGERS,
  sightings: SIGHTINGS,
  quarantine: QUARANTINE,
  lastBatch: LAST_BATCH,
});

async function get<T>(base: string, path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${base}${path}`, signal ? { signal } : {});
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Fetches from the local PUGA FastAPI backend; falls back to the bundled demo reserve dataset. */
export async function loadDataset(base: string, signal?: AbortSignal): Promise<Dataset> {
  if (!base) return demoDataset();
  try {
    await get<{ status: string }>(base, "/api/health", signal);
    const [tigers, sightings, rawCameras, quarantine] = await Promise.all([
      get<Tiger[]>(base, "/api/tigers", signal),
      get<Sighting[]>(base, "/api/sightings", signal),
      get<Array<Omit<Camera, "zone" | "installed_at">>>(base, "/api/cameras", signal),
      get<QuarantineItem[]>(base, "/api/batch/quarantine", signal).catch(() => []),
    ]);
    const cameras: Camera[] = rawCameras.map((c) => {
      const known = CAMERAS.find((k) => k.camera_id === c.camera_id);
      return {
        ...c,
        latitude: c.latitude ?? known?.latitude ?? 0,
        longitude: c.longitude ?? known?.longitude ?? 0,
        location_name: c.location_name ?? c.name ?? c.camera_id,
        zone:
          known?.zone ??
          (c.camera_id.includes("V")
            ? "village-adjacent"
            : c.camera_id.includes("B")
              ? "buffer"
              : "core"),
        installed_at: known?.installed_at ?? "2021-01-01",
      };
    });
    return {
      source: "live",
      baseUrl: base,
      cameras,
      tigers,
      sightings,
      quarantine,
      lastBatch: LAST_BATCH,
    };
  } catch (err) {
    return demoDataset(err instanceof Error ? err.message : "Backend unreachable");
  }
}

export async function runBatch(
  base: string,
  body: { folder_path: string; camera_id?: string; detection_threshold: number; recursive: boolean },
): Promise<BatchSummary> {
  const res = await fetch(`${base}/api/batch/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Batch failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as BatchSummary;
}

export async function restoreQuarantined(base: string, id: number) {
  const res = await fetch(`${base}/api/batch/quarantine/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
  return res.json();
}
