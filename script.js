"use strict";

const $ = (id) => document.getElementById(id);
const FAV_KEY = "wx_favs_v1";
const UNIT_KEY = "wx_unit_v1";
const LAST_KEY = "wx_last_v1";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = "https://api.open-meteo.com/v1/forecast";
const AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const WMO = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "❄️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Severe thunderstorm", "⛈️"],
};
const wmo = (c) => WMO[c] || ["Unknown", "❓"];

/* ---------- State ---------- */
let unit = read(UNIT_KEY, "C");
let favs = read(FAV_KEY, []);
let current = null; // { place, wx, aqi }

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

/* ---------- Helpers ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n[k] = v;
  }
  for (const c of kids) n.append(c);
  return n; // always text nodes, never parsed HTML
}

const temp = (c) => (unit === "F" ? Math.round((c * 9) / 5 + 32) + "°F" : Math.round(c) + "°C");
const wind = (kmh) => (unit === "F" ? Math.round(kmh * 0.621) + " mph" : Math.round(kmh) + " km/h");

function setStatus(msg, isError = false) {
  const s = $("status");
  s.textContent = msg;
  s.className = "status" + (isError ? " error" : "");
  s.hidden = !msg;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error (" + res.status + ")");
  return res.json();
}

function themeFor(code, isDay) {
  if (!isDay) return "theme-night";
  if (code >= 95) return "theme-storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "theme-snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "theme-rain";
  if (code >= 2) return "theme-cloud";
  return "theme-clear";
}

/* ---------- Travel score ---------- */
// day = { pop (0-100), tmax, tmin, code, wind (km/h), uv, aqi? }
function scoreDay(d) {
  let s = 100;
  s -= Math.min(35, (d.pop || 0) * 0.35);
  if (d.code >= 95) s -= 35;
  else if (d.code >= 71 && d.code <= 77) s -= 20;
  else if (d.code === 45 || d.code === 48) s -= 10;
  const hot = d.tmax - 32;
  if (hot > 0) s -= Math.min(25, hot * 4);
  if (d.tmin < 5) s -= Math.min(25, (5 - d.tmin) * 2.5);
  if (d.wind > 30) s -= Math.min(20, (d.wind - 30) * 0.6);
  if ((d.uv || 0) > 8) s -= 5;
  if (d.aqi && d.aqi > 100) s -= Math.min(20, (d.aqi - 100) * 0.15);
  return Math.max(0, Math.round(s));
}
const scoreClass = (s) => (s >= 75 ? "good" : s >= 50 ? "mid" : "bad");
const scoreText = (s) =>
  s >= 85 ? "Excellent for travel" : s >= 75 ? "Good for travel" :
  s >= 50 ? "Fair, plan carefully" : "Poor, consider delaying";

function aqiLabel(a) {
  if (a == null) return "n/a";
  if (a <= 50) return a + " · Good";
  if (a <= 100) return a + " · Moderate";
  if (a <= 150) return a + " · Sensitive groups";
  if (a <= 200) return a + " · Unhealthy";
  return a + " · Very unhealthy";
}

function dayFromDaily(w, i, aqi) {
  const d = w.daily;
  return {
    pop: d.precipitation_probability_max[i],
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    code: d.weather_code[i],
    wind: d.wind_speed_10m_max[i],
    uv: d.uv_index_max[i],
    aqi: i === 0 ? aqi : null,
  };
}

/* ---------- Data loading ---------- */
async function fetchWeather(p) {
  const q = new URLSearchParams({
    latitude: p.lat, longitude: p.lon, timezone: "auto", forecast_days: 7,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset",
  });
  return getJSON(WX_URL + "?" + q);
}

async function fetchAQI(p) {
  try {
    const q = new URLSearchParams({ latitude: p.lat, longitude: p.lon, current: "us_aqi", timezone: "auto" });
    const j = await getJSON(AQ_URL + "?" + q);
    return j.current ? j.current.us_aqi : null;
  } catch { return null; }
}

async function loadPlace(p) {
  $("suggestions").hidden = true;
  setStatus("Loading weather for " + p.name + "…");
  try {
    const [wx, aqi] = await Promise.all([fetchWeather(p), fetchAQI(p)]);
    current = { place: p, wx, aqi };
    write(LAST_KEY, p);
    setStatus("");
    render();
  } catch (err) {
    setStatus("Could not load weather: " + err.message, true);
  }
}

/* ---------- Search ---------- */
async function search(name) {
  setStatus("Searching…");
  $("suggestions").hidden = true;
  try {
    const q = new URLSearchParams({ name, count: 5, language: "en", format: "json" });
    const j = await getJSON(GEO_URL + "?" + q);
    const results = j.results || [];
    if (!results.length) return setStatus("No city found for “" + name + "”.", true);

    const places = results.map((r) => ({
      name: r.name, country: r.country || "", admin: r.admin1 || "", lat: r.latitude, lon: r.longitude,
    }));
    if (places.length === 1) return loadPlace(places[0]);

    const list = $("suggestions");
    list.replaceChildren();
    places.forEach((p) => {
      list.append(el("li", {},
        el("button", { type: "button", onclick: () => loadPlace(p) },
          p.name + " ",
          el("small", { textContent: [p.admin, p.country].filter(Boolean).join(", ") }))));
    });
    list.hidden = false;
    setStatus("Choose a location:");
  } catch (err) {
    setStatus("Search failed: " + err.message, true);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) return setStatus("Geolocation is not supported here.", true);
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadPlace({ name: "My location", country: "", admin: "", lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => setStatus("Location permission denied. Search for a city instead.", true),
    { timeout: 10000 }
  );
}

/* ---------- Render ---------- */
function render() {
  const { place, wx, aqi } = current;
  const c = wx.current, d = wx.daily;
  const [label, icon] = wmo(c.weather_code);

  document.body.className = themeFor(c.weather_code, c.is_day);
  $("dash").hidden = false;

  $("place").textContent = place.name + (place.country ? ", " + place.country : "");
  $("localTime").textContent = new Date(c.time).toLocaleString("en-IN", {
    weekday: "long", hour: "numeric", minute: "2-digit", day: "numeric", month: "short",
  }) + " (local time)";
  $("icon").textContent = icon;
  $("temp").textContent = temp(c.temperature_2m);
  $("desc").textContent = label + " · feels like " + temp(c.apparent_temperature);
  $("saveBtn").textContent = isFav(place) ? "★ Saved" : "☆ Save";

  const items = [
    ["Humidity", c.relative_humidity_2m + "%"],
    ["Wind", wind(c.wind_speed_10m)],
    ["Rain now", c.precipitation + " mm"],
    ["UV index (max)", d.uv_index_max[0] != null ? d.uv_index_max[0].toFixed(1) : "n/a"],
    ["Air quality", aqiLabel(aqi)],
    ["Sunrise", d.sunrise[0].slice(11, 16)],
    ["Sunset", d.sunset[0].slice(11, 16)],
    ["High / Low", temp(d.temperature_2m_max[0]) + " / " + temp(d.temperature_2m_min[0])],
  ];
  const det = $("details");
  det.replaceChildren();
  items.forEach(([k, v]) =>
    det.append(el("div", { class: "detail" }, el("span", { textContent: k }), el("strong", { textContent: v }))));

  renderScores();
  renderHourly();
  renderDaily();
  renderPackingAndAdvice();
  renderFavs();
}

function allScores() {
  const { wx, aqi } = current;
  return wx.daily.time.map((_, i) => scoreDay(dayFromDaily(wx, i, aqi)));
}

function renderScores() {
  const scores = allScores();
  const s = scores[0];
  const ring = $("ring");
  ring.style.setProperty("--pct", s);
  ring.style.setProperty("--col", `var(--${scoreClass(s)})`);
  $("scoreNum").textContent = s;
  $("scoreLabel").textContent = scoreText(s);

  const best = scores.indexOf(Math.max(...scores));
  const dayName = dayLabel(current.wx.daily.time[best], best);
  $("bestDay").textContent = "Best day this week: " + dayName + " (score " + scores[best] + ")";
}

function dayLabel(dateStr, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return new Date(dateStr + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function renderHourly() {
  const h = current.wx.hourly;
  const nowKey = current.wx.current.time.slice(0, 13) + ":00";
  let start = h.time.findIndex((t) => t >= nowKey);
  if (start < 0) start = 0;

  const box = $("hourly");
  box.replaceChildren();
  for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
    box.append(el("div", { class: "hour" },
      el("div", { textContent: i === start ? "Now" : h.time[i].slice(11, 13) + ":00" }),
      el("div", { class: "i", textContent: wmo(h.weather_code[i])[1] }),
      el("b", { textContent: temp(h.temperature_2m[i]) }),
      el("small", { textContent: "💧" + (h.precipitation_probability[i] ?? 0) + "%" })));
  }
}

function renderDaily() {
  const { wx } = current;
  const d = wx.daily;
  const scores = allScores();
  const best = scores.indexOf(Math.max(...scores));
  const box = $("daily");
  box.replaceChildren();

  d.time.forEach((t, i) => {
    const [label, icon] = wmo(d.weather_code[i]);
    box.append(el("div", { class: "day" + (i === best ? " best" : "") },
      el("strong", { textContent: dayLabel(t, i) }),
      el("span", { class: "i", textContent: icon, title: label }),
      el("span", { textContent: temp(d.temperature_2m_max[i]) + " / " + temp(d.temperature_2m_min[i]) }),
      el("span", { class: "rain", textContent: "💧 " + (d.precipitation_probability_max[i] ?? 0) + "% · " + wind(d.wind_speed_10m_max[i]) }),
      el("span", { class: "pill " + scoreClass(scores[i]), textContent: scores[i] })));
  });
}

function renderPackingAndAdvice() {
  const { wx, aqi } = current;
  const d = wx.daily;
  const days = d.time.map((_, i) => dayFromDaily(wx, i, aqi));
  const maxPop = Math.max(...days.map((x) => x.pop || 0));
  const tmax = Math.max(...days.map((x) => x.tmax));
  const tmin = Math.min(...days.map((x) => x.tmin));
  const maxWind = Math.max(...days.map((x) => x.wind || 0));
  const maxUV = Math.max(...days.map((x) => x.uv || 0));
  const storm = days.some((x) => x.code >= 95);
  const snow = days.some((x) => (x.code >= 71 && x.code <= 77) || x.code === 85 || x.code === 86);

  const pack = ["Phone charger & power bank", "ID / tickets / documents"];
  const tips = [];

  if (maxPop >= 40) { pack.push("Umbrella or raincoat", "Waterproof bag cover"); tips.push(["warn", "Rain likely (up to " + maxPop + "%). Keep indoor backup plans."]); }
  if (tmax >= 30) { pack.push("Light cotton clothes", "Water bottle", "Cap or hat"); tips.push(["warn", "Hot days ahead (up to " + temp(tmax) + "). Travel early morning or evening."]); }
  if (maxUV >= 6) { pack.push("Sunscreen", "Sunglasses"); tips.push(["warn", "High UV (" + maxUV.toFixed(0) + "). Reapply sunscreen every 2 hours."]); }
  if (tmin <= 12) { pack.push("Warm jacket"); }
  if (tmin <= 2) { pack.push("Thermal wear", "Gloves & beanie"); tips.push(["warn", "Near-freezing nights (" + temp(tmin) + "). Dress in layers."]); }
  if (maxWind >= 35) { pack.push("Windbreaker"); tips.push(["warn", "Strong winds up to " + wind(maxWind) + ". Check flight and ferry updates."]); }
  if (aqi != null && aqi > 100) { pack.push("N95 mask"); tips.push(["bad", "Air quality is poor (AQI " + aqi + "). Limit outdoor exertion."]); }
  if (storm) tips.push(["bad", "Thunderstorms forecast. Avoid open areas and check transport delays."]);
  if (snow) { pack.push("Waterproof boots"); tips.push(["warn", "Snow possible. Roads may be slow or closed."]); }
  if (!tips.length) tips.push(["ok", "Conditions look comfortable all week. Enjoy your trip!"]);

  const s = allScores();
  const best = s.indexOf(Math.max(...s));
  if (best > 0) tips.push(["ok", "If your dates are flexible, " + dayLabel(d.time[best], best) + " has the best conditions."]);

  const pl = $("packing");
  pl.replaceChildren();
  pack.forEach((item) =>
    pl.append(el("li", {}, el("label", {}, el("input", { type: "checkbox" }), el("span", { textContent: item })))));

  const al = $("advice");
  al.replaceChildren();
  tips.forEach(([cls, text]) => al.append(el("li", { class: cls, textContent: text })));
}

/* ---------- Favourites ---------- */
const sameSpot = (a, b) => Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
const isFav = (p) => favs.some((f) => sameSpot(f, p));

function toggleFav() {
  if (!current) return;
  const p = current.place;
  if (isFav(p)) favs = favs.filter((f) => !sameSpot(f, p));
  else {
    if (favs.length >= 8) return setStatus("You can save up to 8 places.", true);
    favs.push(p);
  }
  write(FAV_KEY, favs);
  $("saveBtn").textContent = isFav(p) ? "★ Saved" : "☆ Save";
  renderFavs();
}

async function renderFavs() {
  const box = $("favs");
  $("favEmpty").hidden = favs.length > 0;
  box.replaceChildren();

  const cards = await Promise.all(favs.map(async (p) => {
    try {
      const w = await fetchWeather(p);
      const sc = scoreDay(dayFromDaily(w, 0, null));
      const [label, icon] = wmo(w.current.weather_code);
      return { p, text: icon + " " + temp(w.current.temperature_2m), label, sc };
    } catch {
      return { p, text: "–", label: "Unavailable", sc: null };
    }
  }));

  box.replaceChildren();
  cards.forEach(({ p, text, label, sc }) => {
    box.append(el("div", { class: "fav", onclick: () => loadPlace(p) },
      el("button", {
        class: "x", type: "button", title: "Remove", textContent: "×",
        onclick: (e) => {
          e.stopPropagation();
          favs = favs.filter((f) => !sameSpot(f, p));
          write(FAV_KEY, favs);
          renderFavs();
          if (current) $("saveBtn").textContent = isFav(current.place) ? "★ Saved" : "☆ Save";
        },
      }),
      el("b", { textContent: p.name }),
      el("div", { class: "t", textContent: text }),
      el("div", { class: "muted", textContent: label }),
      sc != null ? el("span", { class: "pill " + scoreClass(sc), textContent: "Travel " + sc }) : ""));
  });
}

/* ---------- Wiring ---------- */
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("q").value.trim();
  if (v) search(v);
});
$("locBtn").addEventListener("click", useMyLocation);
$("saveBtn").addEventListener("click", toggleFav);
$("unitBtn").addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  write(UNIT_KEY, unit);
  $("unitBtn").textContent = "°" + unit;
  if (current) render();
  else renderFavs();
});

$("unitBtn").textContent = "°" + unit;
renderFavs();

const last = read(LAST_KEY, null);
if (last) loadPlace(last);