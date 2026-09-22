#!/usr/bin/env node
/* FireSentry Karhutla - server-side EWS check for GitHub Actions.
 * Sources: BMKG current forecast + NASA FIRMS NRT fire detections.
 * Telegram is sent only on escalation to SEDANG/TINGGI.
 * workflow_dispatch supports a safe Telegram simulation test.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY;
const FIRESENTRY_BASE_URL = process.env.FIRESENTRY_BASE_URL || "";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";
const TEST_TELEGRAM = String(process.env.TEST_TELEGRAM || "").toLowerCase() === "true";
const BMKG_ENDPOINT = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
const FIRMS_BOX = "101.30,0.40,101.60,0.60"; // west,south,east,north - Kota Pekanbaru
const FIRMS_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"];
const FIRMS_DAY_RANGE = 1;
const FILE_STATUS = path.join(process.cwd(), "data", "status-notifikasi-terakhir.json");
const FILE_HOTSPOT = path.join(process.cwd(), "data", "hotspot-live.json");
const FILE_BATAS = path.join(process.cwd(), "assets", "js", "batas-kecamatan.js");

const KECAMATAN_ADM4 = {
  "Pekanbaru Kota": "14.71.02.1004",
  "Tenayan Raya": "14.71.10.1004",
  "Rumbai": "14.71.12.1009",
  "Rumbai Barat": "14.71.06.1003",
  "Rumbai Timur": "14.71.15.1005",
  "Kulim": "14.71.14.1001",
  "Bukit Raya": "14.71.07.1005",
  "Marpoyan Damai": "14.71.09.1003",
  "Payung Sekaki": "14.71.11.1002",
  "Tuah Madani": "14.71.13.1004",
  "Binawidya": "14.71.08.1010",
  "Sukajadi": "14.71.01.1007",
  "Sail": "14.71.03.1001",
  "Lima Puluh": "14.71.04.1001",
  "Senapelan": "14.71.05.1005",
};

const TITIK_ACUAN_KECAMATAN = {
  "Tenayan Raya": { lat: 0.5486, lng: 101.5192 },
  "Rumbai": { lat: 0.5637, lng: 101.4111 },
  "Rumbai Barat": { lat: 0.535, lng: 101.439 },
  "Binawidya": { lat: 0.4802, lng: 101.3986 },
  "Bukit Raya": { lat: 0.5083, lng: 101.4767 },
  "Marpoyan Damai": { lat: 0.5069, lng: 101.4364 },
  "Payung Sekaki": { lat: 0.5147, lng: 101.4058 },
  "Tuah Madani": { lat: 0.5215, lng: 101.398 },
  "Sukajadi": { lat: 0.5261, lng: 101.4342 },
  "Pekanbaru Kota": { lat: 0.5333, lng: 101.45 },
  "Sail": { lat: 0.528, lng: 101.46 },
  "Lima Puluh": { lat: 0.541, lng: 101.453 },
  "Senapelan": { lat: 0.5305, lng: 101.438 },
  "Kulim": { lat: 0.489, lng: 101.533 },
  "Rumbai Timur": { lat: 0.575, lng: 101.465 },
};

const KELURAHAN_ACUAN = {
  "Pekanbaru Kota": "Kota Baru",
  "Tenayan Raya": "Rejosari",
  "Rumbai": "Sri Meranti",
  "Rumbai Barat": "Rumbai Bukit",
  "Rumbai Timur": "Limbungan",
  "Kulim": "Kulim",
  "Bukit Raya": "Simpang Tiga",
  "Marpoyan Damai": "Sidomulyo Timur",
  "Payung Sekaki": "Labuh Baru Timur",
  "Tuah Madani": "Tuah Madani",
  "Binawidya": "Binawidya",
  "Sukajadi": "Sukajadi",
  "Sail": "Cinta Raja",
  "Lima Puluh": "Rintis",
  "Senapelan": "Kampung Bandar",
};

const URUTAN_RISIKO = { Rendah: 0, Sedang: 1, Tinggi: 2 };

function hitungRisiko(suhu, kelembapan, hotspot) {
  let skor = 0;
  if (suhu >= 35) skor += 2;
  else if (suhu >= 33) skor += 1;
  if (kelembapan <= 45) skor += 2;
  else if (kelembapan <= 55) skor += 1;
  if (hotspot >= 4) skor += 3;
  else if (hotspot >= 2) skor += 2;
  else if (hotspot >= 1) skor += 1;
  if (skor >= 5) return "Tinggi";
  if (skor >= 2) return "Sedang";
  return "Rendah";
}

async function ambilCuacaTerkini(adm4) {
  const res = await fetch(`${BMKG_ENDPOINT}?adm4=${encodeURIComponent(adm4)}`);
  if (!res.ok) throw new Error(`BMKG HTTP ${res.status}`);
  const json = await res.json();
  const cuaca = json?.data?.[0]?.cuaca;
  if (!cuaca) return null;
  const flat = cuaca.flat();
  const now = Date.now();
  let terdekat = null;
  let selisihMin = Infinity;
  for (const item of flat) {
    const t = new Date((item.local_datetime || "").replace(" ", "T")).getTime();
    if (Number.isNaN(t)) continue;
    const selisih = Math.abs(now - t);
    if (selisih < selisihMin) {
      selisihMin = selisih;
      terdekat = item;
    }
  }
  return terdekat ? { suhu: Number(terdekat.t), kelembapan: Number(terdekat.hu), waktuData: terdekat.local_datetime || null } : null;
}

// CSV parser sederhana yang tetap aman bila ada field ber-quote.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field); field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function ambilFirmsSource(source) {
  if (!FIRMS_MAP_KEY) return { source, rows: [], skipped: true };
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${FIRMS_BOX}/${FIRMS_DAY_RANGE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS ${source} HTTP ${res.status}`);
  const rows = parseCsv((await res.text()).trim());
  return { source, rows, skipped: false };
}

function dedupeFirms(rows) {
  // Sensor berbeda dapat mendeteksi kebakaran yang sama. Gabungkan deteksi
  // pada hari yang sama dalam radius kira-kira 550 m agar jumlah hotspot tidak
  // membengkak hanya karena tiga sensor melihat kejadian yang sama.
  const out = [];
  for (const p of rows) {
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const date = p.acq_date || "";
    const duplicate = out.find(q => q.acq_date === date && Math.hypot(Number(q.latitude) - lat, Number(q.longitude) - lng) <= 0.005);
    if (!duplicate) out.push(p);
  }
  return out;
}

async function ambilTitikFirms() {
  if (!FIRMS_MAP_KEY) {
    console.warn("[FIRMS] FIRMS_MAP_KEY kosong — hotspot tidak dapat divalidasi/diambil.");
    return [];
  }
  const hasil = await Promise.all(FIRMS_SOURCES.map(s => ambilFirmsSource(s).catch(e => ({ source: s, rows: [], error: e.message }))));
  let gabungan = [];
  for (const h of hasil) {
    if (h.error) console.warn(`[FIRMS] ${h.source}: ${h.error}`);
    else console.log(`[FIRMS] ${h.source}: ${h.rows.length} deteksi pada area ${FIRMS_BOX}, day_range=${FIRMS_DAY_RANGE}`);
    gabungan.push(...h.rows.map(r => ({ ...r, firms_source: h.source })));
  }
  const bersih = dedupeFirms(gabungan);
  console.log(`[FIRMS] Total deteksi mentah=${gabungan.length}; setelah deduplikasi=${bersih.length}`);
  if (bersih.length) {
    console.log("[FIRMS] Contoh titik:", bersih.slice(0, 5).map(p => `${p.latitude},${p.longitude} ${p.acq_date} ${p.acq_time || ""} ${p.firms_source}`).join(" | "));
  } else {
    console.log("[FIRMS] Tidak ada deteksi hotspot pada area Pekanbaru untuk rentang data NRT yang diminta.");
  }
  return bersih;
}

async function loadBatasKecamatan() {
  try {
    const src = await readFile(FILE_BATAS, "utf8");
    const m = src.match(/const BATAS_KECAMATAN_PEKANBARU\s*=\s*(\{[\s\S]*\})\s*;?/);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) {
    console.warn("[Batas] Gagal membaca batas kecamatan, fallback ke titik acuan:", e.message);
    return null;
  }
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng, lat, polygon) {
  if (!polygon?.length) return false;
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (pointInRing(lng, lat, polygon[i])) return false;
  return true;
}

function pointInMultiPolygon(lng, lat, multi) {
  return multi?.some(poly => pointInPolygon(lng, lat, poly));
}

function kecamatanTerdekat(lat, lng) {
  let terdekat = null, jarakMin = Infinity;
  for (const [kec, titik] of Object.entries(TITIK_ACUAN_KECAMATAN)) {
    const jarak = Math.hypot(lat - titik.lat, lng - titik.lng);
    if (jarak < jarakMin) { jarakMin = jarak; terdekat = kec; }
  }
  return terdekat;
}

function kecamatanDariKoordinat(lat, lng, geojson) {
  if (geojson?.features) {
    for (const f of geojson.features) {
      if (pointInMultiPolygon(lng, lat, f.geometry?.coordinates)) return f.properties?.kecamatan || null;
    }
  }
  return kecamatanTerdekat(lat, lng);
}

function kelompokkanHotspot(titikFirms, geojson) {
  const jumlah = {}, titik = {};
  for (const p of titikFirms) {
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const kec = kecamatanDariKoordinat(lat, lng, geojson);
    if (!kec || !KECAMATAN_ADM4[kec]) continue;
    jumlah[kec] = (jumlah[kec] || 0) + 1;
    (titik[kec] ||= []).push({ lat, lng, raw: p });
  }
  return { jumlah, titik };
}

function titikTerbaik(kecamatan, titikPerKecamatan) {
  const kandidat = titikPerKecamatan[kecamatan] || [];
  if (kandidat.length) {
    const acuan = TITIK_ACUAN_KECAMATAN[kecamatan];
    return kandidat.slice().sort((a, b) => Math.hypot(a.lat - acuan.lat, a.lng - acuan.lng) - Math.hypot(b.lat - acuan.lat, b.lng - acuan.lng))[0];
  }
  const acuan = TITIK_ACUAN_KECAMATAN[kecamatan];
  return { lat: acuan.lat, lng: acuan.lng, raw: null };
}

function halamanPetaUrl(lat, lng, kecamatan) {
  const base = FIRESENTRY_BASE_URL || (GITHUB_REPOSITORY ? `https://${GITHUB_REPOSITORY.split("/")[0]}.github.io/${GITHUB_REPOSITORY.split("/")[1]}` : "");
  const query = `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&kecamatan=${encodeURIComponent(kecamatan)}`;
  return base ? `${base.replace(/\/$/, "")}/peta.html${query}` : `peta.html${query}`;
}

async function ambilKelurahan(lat, lng, fallback) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&accept-language=id`;
    const res = await fetch(url, { headers: { "User-Agent": "FireSentry-Karhutla/1.1 (BPBD Pekanbaru monitoring)" } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const a = (await res.json())?.address || {};
    return a.village || a.suburb || a.neighbourhood || fallback;
  } catch (e) {
    console.warn(`[Geocode] Gagal reverse geocode ${lat},${lng}: ${e.message}`);
    return fallback;
  }
}

function formatKoordinat(n) { return Number(n).toFixed(6); }
function formatWaktu(waktu) { return new Date(waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"; }

async function kirimTelegram(pesan) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Secret token/chat id belum diset — kirim dilewati.");
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: pesan, parse_mode: "HTML", disable_web_page_preview: false }),
  });
  if (!res.ok) { console.warn("[Telegram] Gagal kirim:", res.status, await res.text()); return false; }
  console.log("[Telegram] Pesan berhasil dikirim.");
  return true;
}

function susunPesan({ kecamatan, risikoBaru, kelurahan, suhu, kelembapan, hotspot, waktu, lat, lng, petaUrl, simulasi = false }) {
  const emoji = risikoBaru === "Tinggi" ? "🔴" : "🟠";
  const prefix = simulasi ? "🧪 <b>TEST TELEGRAM FIRESENTRY</b>\n\n" : "";
  const status = simulasi ? `${risikoBaru.toUpperCase()} (SIMULASI)` : risikoBaru.toUpperCase();
  return prefix +
    `${emoji} <b>PERINGATAN DINI KARHUTLA</b>\n` +
    `Status: <b>${status}</b>\n` +
    `Kecamatan: <b>${kecamatan}</b>\n` +
    `Kelurahan: <b>${kelurahan}</b>\n` +
    `Suhu: <b>${suhu}°C</b> | Kelembapan: <b>${kelembapan}%</b>\n` +
    `Titik panas: <b>${hotspot}</b>\n` +
    `Waktu: ${formatWaktu(waktu)}\n` +
    `\nlatitude & longitude: <code>${formatKoordinat(lat)}, ${formatKoordinat(lng)}</code>\n` +
    `\n🔗 <a href="${petaUrl}">Lihat peta kejadian</a>`;
}

async function kirimAlertSistem(pesan) {
  await kirimTelegram(`⚠️ <b>PERINGATAN SISTEM FIRESENTRY</b>\n${pesan}\n\nWaktu: ${formatWaktu(new Date().toISOString())}`);
}

function risikoDariEntriLama(entri) {
  if (!entri) return "Rendah";
  if (typeof entri === "string") return entri;
  return entri.risiko || "Rendah";
}

async function bacaStatusLama() {
  try { return JSON.parse(await readFile(FILE_STATUS, "utf8")); }
  catch { return {}; }
}

async function simpanStatusBaru(status) {
  await mkdir(path.dirname(FILE_STATUS), { recursive: true });
  await writeFile(FILE_STATUS, JSON.stringify(status, null, 2) + "\n", "utf8");
}

async function simpanHotspotLive(titikFirms) {
  await mkdir(path.dirname(FILE_HOTSPOT), { recursive: true });
  await writeFile(FILE_HOTSPOT, JSON.stringify({
    diperbaruiPada: new Date().toISOString(),
    sumber: FIRMS_SOURCES,
    area: FIRMS_BOX,
    dayRange: FIRMS_DAY_RANGE,
    jumlah: titikFirms.length,
    titik: titikFirms,
  }, null, 2) + "\n", "utf8");
}

const MAKS_RIWAYAT_ESKALASI = 50;

async function main() {
  const statusLama = await bacaStatusLama();
  const statusBaru = {};
  const dinotifikasi = [];
  const riwayatEskalasi = Array.isArray(statusLama?._meta?.riwayatEskalasi) ? [...statusLama._meta.riwayatEskalasi] : [];
  const geojsonBatas = await loadBatasKecamatan();

  const titikFirms = await ambilTitikFirms().catch(e => {
    console.error("[FIRMS] Pengambilan gagal total:", e.message);
    return [];
  });
  await simpanHotspotLive(titikFirms);
  const { jumlah: hotspotPerKecamatan, titik: titikHotspotPerKecamatan } = kelompokkanHotspot(titikFirms, geojsonBatas);
  console.log("[FIRMS] Rekap per kecamatan:", JSON.stringify(hotspotPerKecamatan));

  const kecamatanGagal = [];
  const sekarangIso = new Date().toISOString();
  const cuacaSemua = {};

  for (const [kecamatan, adm4] of Object.entries(KECAMATAN_ADM4)) {
    let cuaca = null;
    try { cuaca = await ambilCuacaTerkini(adm4); }
    catch (e) { console.warn(`[BMKG] Gagal ${kecamatan}: ${e.message}`); }
    if (!cuaca) {
      kecamatanGagal.push(kecamatan);
      if (statusLama[kecamatan]) statusBaru[kecamatan] = statusLama[kecamatan];
      continue;
    }
    cuacaSemua[kecamatan] = cuaca;
    const hotspot = hotspotPerKecamatan[kecamatan] || 0;
    const risikoBaru = hitungRisiko(cuaca.suhu, cuaca.kelembapan, hotspot);
    statusBaru[kecamatan] = { risiko: risikoBaru, suhu: cuaca.suhu, kelembapan: cuaca.kelembapan, hotspot, waktuCek: sekarangIso };
    const risikoLama = risikoDariEntriLama(statusLama[kecamatan]);
    const naik = URUTAN_RISIKO[risikoBaru] > URUTAN_RISIKO[risikoLama];
    console.log(`${kecamatan}: suhu=${cuaca.suhu} kelembapan=${cuaca.kelembapan} hotspot=${hotspot} -> ${risikoBaru}`);

    if (naik && (risikoBaru === "Sedang" || risikoBaru === "Tinggi")) {
      const titik = titikTerbaik(kecamatan, titikHotspotPerKecamatan);
      const kelurahan = await ambilKelurahan(titik.lat, titik.lng, KELURAHAN_ACUAN[kecamatan] || "-");
      const petaUrl = halamanPetaUrl(titik.lat, titik.lng, kecamatan);
      const terkirim = await kirimTelegram(susunPesan({ kecamatan, risikoBaru, kelurahan, suhu: cuaca.suhu, kelembapan: cuaca.kelembapan, hotspot, waktu: sekarangIso, lat: titik.lat, lng: titik.lng, petaUrl }));
      if (terkirim) dinotifikasi.push(kecamatan);
      riwayatEskalasi.unshift({ kecamatan, dari: risikoLama, ke: risikoBaru, suhu: cuaca.suhu, kelembapan: cuaca.kelembapan, hotspot, kelurahan, latitude: titik.lat, longitude: titik.lng, petaUrl, waktu: sekarangIso, notifikasiTerkirim: terkirim });
    }
  }

  // Manual test: memakai DATA AKTUAL hasil run ini, tetapi diberi label simulasi.
  // Tidak mengubah status/riwayat dan tidak memicu alert operasional.
  if (TEST_TELEGRAM) {
    const kandidat = Object.entries(cuacaSemua).sort((a, b) => (hotspotPerKecamatan[b[0]] || 0) - (hotspotPerKecamatan[a[0]] || 0))[0];
    const kecamatan = kandidat?.[0] || "Pekanbaru Kota";
    const cuaca = kandidat?.[1] || { suhu: "-", kelembapan: "-" };
    const hotspot = hotspotPerKecamatan[kecamatan] || 0;
    const titik = titikTerbaik(kecamatan, titikHotspotPerKecamatan);
    const kelurahan = await ambilKelurahan(titik.lat, titik.lng, KELURAHAN_ACUAN[kecamatan] || "-");
    const petaUrl = halamanPetaUrl(titik.lat, titik.lng, kecamatan);
    const testMessage = susunPesan({ kecamatan, risikoBaru: "Sedang", kelurahan, suhu: cuaca.suhu, kelembapan: cuaca.kelembapan, hotspot, waktu: sekarangIso, lat: titik.lat, lng: titik.lng, petaUrl, simulasi: true });
    await kirimTelegram(testMessage);
    console.log(`[TEST] Telegram test selesai untuk ${kecamatan}. Pesan diberi label SIMULASI.`);
  }

  statusBaru._meta = {
    diperbaruiPada: sekarangIso,
    sumber: "GitHub Actions terjadwal (BMKG + NASA FIRMS NRT)",
    firmsSources: FIRMS_SOURCES,
    firmsJumlah: titikFirms.length,
    firmsDiperbaruiPada: sekarangIso,
    kecamatanGagal,
    riwayatEskalasi: riwayatEskalasi.slice(0, MAKS_RIWAYAT_ESKALASI),
  };
  await simpanStatusBaru(statusBaru);

  const totalKecamatan = Object.keys(KECAMATAN_ADM4).length;
  if (kecamatanGagal.length === totalKecamatan) {
    console.error("[ALERT] BMKG gagal untuk SEMUA kecamatan.");
    await kirimAlertSistem(`Gagal mengambil data cuaca BMKG untuk <b>SEMUA ${totalKecamatan} kecamatan</b>. Sistem tidak dapat menilai risiko saat ini.`);
  } else if (kecamatanGagal.length > 0) {
    console.warn(`[ALERT] BMKG gagal untuk ${kecamatanGagal.length} kecamatan: ${kecamatanGagal.join(", ")}`);
    await kirimAlertSistem(`Gagal mengambil data cuaca untuk ${kecamatanGagal.length} dari ${totalKecamatan} kecamatan:\n<b>${kecamatanGagal.join(", ")}</b>`);
  }

  if (dinotifikasi.length) console.log("Notifikasi operasional terkirim untuk:", dinotifikasi.join(", "));
  else if (!TEST_TELEGRAM) console.log("Tidak ada eskalasi status — tidak ada notifikasi operasional yang dikirim kali ini.");
}

main().catch(async e => {
  console.error("Pengecekan gagal total:", e);
  await kirimAlertSistem(`Script pengecekan status karhutla GAGAL TOTAL:\n<code>${String(e.message || e).slice(0, 300)}</code>`).catch(() => {});
  process.exit(1);
});
