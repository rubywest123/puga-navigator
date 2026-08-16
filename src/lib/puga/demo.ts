import type { Camera, QuarantineItem, Sighting, Tiger } from "./types";

/** Deterministic PRNG so the demo dataset is identical on server and client. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CENTER = { lat: 21.702, lng: 79.283 }; // Pench Tiger Reserve (Turia / Karmajhiri)

const STATION_SEEDS: Array<[string, string, number, number, Camera["zone"], string]> = [
  ["PTR-C01", "Karmajhiri Nala", 0.02, -0.03, "core", "2021-03-04"],
  ["PTR-C02", "Alikatta Meadow", 0.045, 0.012, "core", "2021-03-04"],
  ["PTR-C03", "Chhindimatta Road", -0.018, 0.038, "core", "2021-03-06"],
  ["PTR-C04", "Bodhanala Ridge", 0.062, -0.055, "core", "2021-03-06"],
  ["PTR-C05", "Piyorthadi Waterhole", -0.048, -0.02, "core", "2021-03-08"],
  ["PTR-C06", "Junewani Crossing", 0.005, 0.072, "core", "2021-03-08"],
  ["PTR-C07", "Sitaghat Bank", -0.072, 0.052, "core", "2021-03-10"],
  ["PTR-C08", "Raiyakassa Plateau", 0.088, 0.041, "core", "2021-03-10"],
  ["PTR-C09", "Bagholi Camp", -0.035, -0.078, "core", "2022-01-12"],
  ["PTR-C10", "Kalapahad Slope", 0.03, -0.095, "core", "2022-01-12"],
  ["PTR-C11", "Doob Nala", 0.101, -0.008, "core", "2024-11-20"],
  ["PTR-C12", "Gadmau Track", -0.096, 0.005, "core", "2021-03-12"],
  ["PTR-B01", "Rukhad Buffer East", 0.135, 0.098, "buffer", "2021-04-02"],
  ["PTR-B02", "Khawasa Buffer", -0.128, 0.112, "buffer", "2021-04-02"],
  ["PTR-B03", "Kurai Buffer North", 0.152, -0.066, "buffer", "2021-04-05"],
  ["PTR-B04", "Teliya Buffer", -0.145, -0.09, "buffer", "2021-04-05"],
  ["PTR-B05", "Sillari Buffer", 0.09, 0.155, "buffer", "2023-02-18"],
  ["PTR-B06", "Ghatkohka Buffer", -0.07, -0.148, "buffer", "2021-04-08"],
  ["PTR-V01", "Turia Village Edge", 0.181, 0.132, "village-adjacent", "2021-05-01"],
  ["PTR-V02", "Sarrahiri Village Edge", -0.176, 0.148, "village-adjacent", "2021-05-01"],
  ["PTR-V03", "Pipariya Cattle Camp", 0.168, -0.152, "village-adjacent", "2022-06-14"],
  ["PTR-V04", "Awarghani Fields", -0.162, -0.166, "village-adjacent", "2021-05-03"],
];

export const CAMERAS: Camera[] = STATION_SEEDS.map(
  ([camera_id, name, dLat, dLng, zone, installed_at]) => ({
    camera_id,
    name,
    latitude: +(CENTER.lat + dLat).toFixed(5),
    longitude: +(CENTER.lng + dLng).toFixed(5),
    location_name: name,
    zone,
    installed_at,
  }),
);

const TIGER_SEEDS: Array<{
  id: string;
  name: string;
  home: string[];
  current: string[];
  behaviour: "stable" | "shifting" | "dispersing" | "absent";
}> = [
  {
    id: "PTR-T001",
    name: "Collarwali II",
    home: ["PTR-C01", "PTR-C02", "PTR-C05", "PTR-C12"],
    current: ["PTR-C01", "PTR-C02", "PTR-C05"],
    behaviour: "stable",
  },
  {
    id: "PTR-T002",
    name: "Baghin Nala",
    home: ["PTR-C03", "PTR-C06", "PTR-C08"],
    current: ["PTR-C06", "PTR-C08", "PTR-B01", "PTR-B05"],
    behaviour: "shifting",
  },
  {
    id: "PTR-T003",
    name: "Chhota Matka",
    home: ["PTR-C04", "PTR-C10", "PTR-C09"],
    current: ["PTR-C04", "PTR-C10", "PTR-C11"],
    behaviour: "stable",
  },
  {
    id: "PTR-T004",
    name: "Langdi",
    home: ["PTR-C07", "PTR-C12", "PTR-B06"],
    current: ["PTR-B06", "PTR-B04", "PTR-V04"],
    behaviour: "dispersing",
  },
  {
    id: "PTR-T005",
    name: "Patdev Male",
    home: ["PTR-C02", "PTR-C06", "PTR-C08", "PTR-B01"],
    current: ["PTR-C02", "PTR-C08", "PTR-B01"],
    behaviour: "stable",
  },
  {
    id: "PTR-T006",
    name: null as unknown as string,
    home: ["PTR-C09", "PTR-C10", "PTR-B03"],
    current: [],
    behaviour: "absent",
  },
  {
    id: "PTR-T007",
    name: "Rukhad Sub-adult",
    home: ["PTR-B01", "PTR-B03"],
    current: ["PTR-B03", "PTR-V01", "PTR-V03"],
    behaviour: "dispersing",
  },
  {
    id: "PTR-T008",
    name: "Sitaghat Tigress",
    home: ["PTR-C07", "PTR-C03", "PTR-B02"],
    current: ["PTR-C07", "PTR-C03", "PTR-B02"],
    behaviour: "stable",
  },
];

const cameraById = new Map(CAMERAS.map((c) => [c.camera_id, c]));

/** Cycle windows: three historical cycles + the current run. */
const CYCLES = [
  { label: "2025-C1", start: "2025-01-08" },
  { label: "2025-C2", start: "2025-05-12" },
  { label: "2025-C3", start: "2025-11-10" },
  { label: "2026-C1", start: "2026-07-20" }, // current run
];

function buildSightings() {
  const rand = rng(20260816);
  const sightings: Sighting[] = [];
  let n = 0;

  for (const t of TIGER_SEEDS) {
    CYCLES.forEach((cycle, ci) => {
      const isCurrent = ci === CYCLES.length - 1;
      const stations = isCurrent ? t.current : t.home;
      if (stations.length === 0) return;
      const base = new Date(cycle.start).getTime();

      stations.forEach((stationId, si) => {
        const cam = cameraById.get(stationId);
        if (!cam) return;
        const captures = 2 + Math.floor(rand() * 3);
        for (let k = 0; k < captures; k++) {
          const ts = new Date(
            base + (si * 2 + k) * 86400000 + Math.floor(rand() * 20) * 3600000,
          );
          const sim = 0.72 + rand() * 0.27;
          n += 1;
          sightings.push({
            sighting_id: `SGT-${String(n).padStart(5, "0")}`,
            tiger_id: t.id,
            camera_id: cam.camera_id,
            timestamp: ts.toISOString(),
            latitude: +(cam.latitude + (rand() - 0.5) * 0.004).toFixed(5),
            longitude: +(cam.longitude + (rand() - 0.5) * 0.004).toFixed(5),
            location_name: cam.location_name,
            similarity_score: +sim.toFixed(3),
            confidence: +(0.8 + rand() * 0.19).toFixed(3),
            review_status: sim < 0.78 ? "needs-review" : "auto",
            image_path: `raw/${cycle.label}/${cam.camera_id}/IMG_${1000 + n}.JPG`,
            crop_path: `crops/${t.id}/CROP_${1000 + n}.JPG`,
          });
        }
      });
    });
  }
  return sightings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export const SIGHTINGS: Sighting[] = buildSightings();

export const TIGERS: Tiger[] = TIGER_SEEDS.map((t) => {
  const own = SIGHTINGS.filter((s) => s.tiger_id === t.id);
  return {
    tiger_id: t.id,
    name: t.name ?? null,
    status: t.behaviour === "absent" ? "unknown" : "active",
    first_seen: own[0]?.timestamp ?? null,
    last_seen: own[own.length - 1]?.timestamp ?? null,
    total_sightings: own.length,
  };
});

export const QUARANTINE: QuarantineItem[] = Array.from({ length: 14 }).map((_, i) => {
  const rand = rng(900 + i);
  const privacy = i % 7 === 3;
  const conf = +(rand() * 0.19).toFixed(3);
  return {
    id: i + 1,
    batch_id: "BATCH-2026-C1-01",
    filename: `IMG_${2300 + i * 7}.JPG`,
    original_path: `/media/sdcard/PTR-C0${(i % 9) + 1}/DCIM/IMG_${2300 + i * 7}.JPG`,
    quarantine_path: `quarantine/BATCH-2026-C1-01/IMG_${2300 + i * 7}.JPG`,
    status: "quarantined",
    reason: privacy
      ? "Human detected — withheld under privacy policy"
      : ["Empty frame (grass movement)", "Heat shimmer", "Rain streaks", "Light shift"][i % 4],
    confidence: conf,
    capture_timestamp: new Date(Date.UTC(2026, 6, 21, 3 + i, 12)).toISOString(),
    quarantined_at: new Date(Date.UTC(2026, 6, 22, 9, 30)).toISOString(),
    privacy_hold: privacy,
  };
});

export const LAST_BATCH = {
  batch_id: "BATCH-2026-C1-01",
  status: "completed" as const,
  source_folder: "/media/sdcard/PENCH_CYCLE_2026_C1",
  total_images: 41280,
  processed: 41280,
  animal_detected: 5124,
  quarantined: 35218,
  duplicates: 812,
  failed: 126,
  restored: 4,
  processing_time_seconds: 9432,
  storage: {
    original_storage_bytes: 178_500_000_000,
    quarantine_storage_bytes: 151_800_000_000,
    reclaimable_storage_bytes: 151_800_000_000,
  },
  warnings: [
    "Camera clock drift detected on PTR-C09 (+3h 12m) — timestamps normalised, flagged for review.",
    "Folder 'NEW FOLDER (2)' had no station code — mapped to PTR-B03 by SD-card serial.",
    "126 unreadable/corrupt files retained in /failed for manual inspection.",
  ],
  created_at: new Date(Date.UTC(2026, 6, 22, 6, 0)).toISOString(),
};
