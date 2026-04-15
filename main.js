import Chart from 'chart.js/auto';

// ===== Constants =====
const GEOCODING_URL   = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL     = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const WMO_CODE_MAP = {
    0:  { text: 'Clear Sky',                 icon: '☀️'  },
    1:  { text: 'Mainly Clear',              icon: '🌤️' },
    2:  { text: 'Partly Cloudy',             icon: '⛅'  },
    3:  { text: 'Overcast',                  icon: '☁️'  },
    45: { text: 'Foggy',                     icon: '🌫️' },
    48: { text: 'Rime Fog',                  icon: '🌫️' },
    51: { text: 'Light Drizzle',             icon: '🌦️' },
    53: { text: 'Drizzle',                   icon: '🌦️' },
    55: { text: 'Dense Drizzle',             icon: '🌧️' },
    61: { text: 'Slight Rain',               icon: '🌧️' },
    63: { text: 'Moderate Rain',             icon: '🌧️' },
    65: { text: 'Heavy Rain',                icon: '🌧️' },
    71: { text: 'Slight Snow',               icon: '❄️'  },
    73: { text: 'Moderate Snow',             icon: '❄️'  },
    75: { text: 'Heavy Snow',                icon: '🌨️' },
    77: { text: 'Snow Grains',               icon: '🌨️' },
    80: { text: 'Slight Showers',            icon: '🌦️' },
    81: { text: 'Showers',                   icon: '🌧️' },
    82: { text: 'Violent Showers',           icon: '⛈️'  },
    85: { text: 'Snow Showers',              icon: '🌨️' },
    86: { text: 'Heavy Snow Showers',        icon: '🌨️' },
    95: { text: 'Thunderstorm',              icon: '⛈️'  },
    96: { text: 'Thunderstorm w/ Hail',      icon: '⛈️'  },
    99: { text: 'Severe Thunderstorm',       icon: '⛈️'  },
};

const WIND_DIRS = [
    'N','NNE','NE','ENE','E','ESE','SE','SSE',
    'S','SSW','SW','WSW','W','WNW','NW','NNW'
];

// ===== State =====
let charts        = { tempTrend: null, humidity: null, pressure: null, precip: null };
let searchTimeout = null;
let currentIndex  = -1;
let unitCelsius   = true;
let rawWeather    = null;

// ===== DOM =====
const searchInput  = document.getElementById('city-search');
const searchClear  = document.getElementById('search-clear');
const resultsDropdown = document.getElementById('search-results');
const themeToggle  = document.getElementById('theme-toggle');
const unitToggle   = document.getElementById('unit-toggle');
const unitLabel    = document.getElementById('unit-label');
const loader       = document.getElementById('loader');
const insightBar   = document.getElementById('insight-bar');

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
    window.onerror = function(msg, url, line, col, error) {
       const el = document.getElementById('current-city-name');
       if (el) el.textContent = `Error: ${msg} (${line}:${col})`;
    };
    initTheme();
    fetchAll(13.0827, 80.2707, 'Chennai, Tamil Nadu, India');

    searchInput.addEventListener('input',   onSearchInput);
    searchInput.addEventListener('keydown', onSearchKeydown);
    searchInput.addEventListener('blur',    () => setTimeout(() => resultsDropdown.classList.add('hidden'), 200));

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.classList.add('hidden');
        resultsDropdown.classList.add('hidden');
        searchInput.focus();
    });

    themeToggle.addEventListener('click', toggleTheme);
    unitToggle.addEventListener('click', toggleUnit);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) resultsDropdown.classList.add('hidden');
    });
});

// ===== Theme =====
function initTheme() {
    const saved = localStorage.getItem('aerostat-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aerostat-theme', next);
    updateThemeIcon(next);
    if (rawWeather) renderCharts(rawWeather); // re-render with theme-aware colors
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    icon.innerHTML = theme === 'light'
        ? '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
        : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
}

// ===== Unit Toggle =====
function toggleUnit() {
    unitCelsius = !unitCelsius;
    const label = unitCelsius ? '°C' : '°F';
    unitLabel.textContent = label;
    document.getElementById('temp-unit').textContent = label;
    if (rawWeather) {
        updateTemps(rawWeather);
        renderCharts(rawWeather);
        renderForecasts(rawWeather);
    }
}

const toF = (c) => (c * 9 / 5) + 32;
const fmt  = (c) => Math.round(unitCelsius ? c : toF(c));

// ===== Search =====
function onSearchInput() {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('hidden', q.length === 0);
    clearTimeout(searchTimeout);
    if (q.length < 2) { resultsDropdown.classList.add('hidden'); return; }

    searchTimeout = setTimeout(async () => {
        try {
            const r = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
            const d = await r.json();
            renderResults(d.results || []);
        } catch {
            showToast('Search unavailable. Check your connection.', 'error');
        }
    }, 280);
}

function onSearchKeydown(e) {
    const items = resultsDropdown.querySelectorAll('.search-result-item');
    if (resultsDropdown.classList.contains('hidden') || !items.length) return;

    if (e.key === 'ArrowDown')  { e.preventDefault(); currentIndex = (currentIndex + 1) % items.length; highlight(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); currentIndex = (currentIndex - 1 + items.length) % items.length; highlight(items); }
    else if (e.key === 'Enter' && currentIndex > -1) items[currentIndex].click();
    else if (e.key === 'Escape') resultsDropdown.classList.add('hidden');
}

function highlight(items) {
    items.forEach((el, i) => el.style.background = i === currentIndex ? 'var(--selection-bg)' : '');
    if (currentIndex >= 0) items[currentIndex].scrollIntoView({ block: 'nearest' });
}

function renderResults(res) {
    resultsDropdown.innerHTML = '';
    currentIndex = -1;
    if (!res.length) { resultsDropdown.classList.add('hidden'); return; }
    resultsDropdown.classList.remove('hidden');

    res.forEach(r => {
        const div  = document.createElement('div');
        div.className = 'search-result-item';
        
        const main = r.name;
        const sub  = [r.admin1, r.country].filter(Boolean).join(', ');
        const fullDisplay = sub ? `${main}, ${sub}` : main;
        
        div.innerHTML = `<span class="result-main">${main}</span><span class="result-sub">${sub}</span>`;
        div.onclick = () => {
            fetchAll(r.latitude, r.longitude, fullDisplay);
            resultsDropdown.classList.add('hidden');
            searchInput.value = '';
            searchClear.classList.add('hidden');
        };
        resultsDropdown.appendChild(div);
    });
}

// ===== Data Fetch =====
async function fetchAll(lat, lon, locationName) {
    showLoader(true, 'Gathering Global Intelligence...');
    try {
        const [wRes, aRes] = await Promise.all([fetchWeather(lat, lon), fetchAQI(lat, lon)]);
        if (!wRes.ok) throw new Error('Weather service unavailable');
        if (!aRes.ok) throw new Error('Air quality service unavailable');

        const wData = await wRes.json();
        const aData = await aRes.json();
        rawWeather = wData;

        updateUI(wData, aData, locationName);
        renderCharts(wData);
        renderForecasts(wData);
        generateInsight(wData);
    } catch (err) {
        console.error(err);
        showToast(`⚡ ${err.message || 'Failed to load weather data.'}`, 'error');
    } finally {
        showLoader(false);
    }
}

function fetchWeather(lat, lon) {
    const p = new URLSearchParams({
        latitude: lat, longitude: lon,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_gusts_10m,wind_speed_10m,wind_direction_10m,visibility',
        daily:   'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max',
        hourly:  'temperature_2m,relative_humidity_2m,precipitation_probability,surface_pressure',
        timezone: 'auto', forecast_days: 7
    });
    return fetch(`${WEATHER_URL}?${p}`);
}

function fetchAQI(lat, lon) {
    const p = new URLSearchParams({ latitude: lat, longitude: lon, current: 'us_aqi,pm10,pm2_5' });
    return fetch(`${AIR_QUALITY_URL}?${p}`);
}

// ===== UI =====
function updateUI(wData, aData, locationName) {
    const c   = wData.current;
    const d   = wData.daily;
    const aqi = aData.current?.us_aqi ?? '--';
    const wmo = WMO_CODE_MAP[c.weather_code] || { text: 'Unknown', icon: '❓' };

    document.getElementById('current-city-name').textContent = locationName.split(',')[0];
    document.getElementById('weather-icon-main').textContent = wmo.icon;
    document.getElementById('condition-text').textContent    = wmo.text;

    updateTemps(wData);

    // Mini stats
    document.getElementById('humidity-val').textContent = c.relative_humidity_2m;
    document.getElementById('gust-val').textContent     = Math.round(c.wind_gusts_10m);
    document.getElementById('vis-val').textContent      = (c.visibility / 1000).toFixed(1);

    // Wind direction
    const dirIdx = Math.round(c.wind_direction_10m / 22.5) % 16;
    document.getElementById('wind-dir-val').textContent = `${WIND_DIRS[dirIdx]} · ${Math.round(c.wind_speed_10m)} km/h`;

    // AQI badge
    const aqiBadge = document.getElementById('aqi-status');
    document.getElementById('aqi-val').textContent = aqi;
    aqiBadge.className = 'aqi-badge';
    if (typeof aqi === 'number') {
        if (aqi <= 50)  { aqiBadge.textContent = 'Good';      aqiBadge.classList.add('aqi-good'); }
        else if (aqi <= 100) { aqiBadge.textContent = 'Moderate'; aqiBadge.classList.add('aqi-moderate'); }
        else             { aqiBadge.textContent = 'Unhealthy'; aqiBadge.classList.add('aqi-unhealthy'); }
    }

    // UV Index
    const uvMax  = d.uv_index_max ? Math.round(d.uv_index_max[0]) : null;
    const uvBadge = document.getElementById('uv-label');
    document.getElementById('uv-val').textContent = uvMax ?? '--';
    uvBadge.className = 'uv-badge';
    if (uvMax !== null) {
        if (uvMax <= 2)  { uvBadge.textContent = 'Low';       uvBadge.classList.add('uv-low'); }
        else if (uvMax <= 5) { uvBadge.textContent = 'Moderate'; uvBadge.classList.add('uv-moderate'); }
        else if (uvMax <= 7) { uvBadge.textContent = 'High';     uvBadge.classList.add('uv-high'); }
        else                 { uvBadge.textContent = 'Very High';uvBadge.classList.add('uv-very-high'); }
    }

    // Sunrise / Sunset
    const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunrise-val').textContent = fmtTime(d.sunrise[0]);
    document.getElementById('sunset-val').textContent  = fmtTime(d.sunset[0]);
}

function updateTemps(wData) {
    const c = wData.current;
    const d = wData.daily;
    const unit = unitCelsius ? '°C' : '°F';
    document.getElementById('current-temp').textContent   = fmt(c.temperature_2m);
    document.getElementById('feels-like-val').textContent = fmt(c.apparent_temperature);
    document.getElementById('high-temp').textContent      = fmt(d.temperature_2m_max[0]);
    document.getElementById('low-temp').textContent       = fmt(d.temperature_2m_min[0]);
    document.getElementById('temp-unit').textContent      = unit;
}

// ===== Forecasts =====
function renderForecasts(wData) {
    const panel = document.getElementById('prediction-panel');
    panel.innerHTML = '';
    const d = wData.daily;

    const maxTemps  = d.temperature_2m_max;
    const globalMax = Math.max(...maxTemps);
    const globalMin = Math.min(...d.temperature_2m_min);
    const range     = globalMax - globalMin || 1;

    d.time.forEach((time, i) => {
        if (i === 0) return; // skip today
        const date     = new Date(time);
        const dayName  = date.toLocaleDateString('en-US', { weekday: 'short' });
        const wmo      = WMO_CODE_MAP[d.weather_code[i]] || { icon: '☁️' };
        const barPct   = ((maxTemps[i] - globalMin) / range * 100).toFixed(0);
        const precipPct = d.precipitation_probability_max?.[i];

        const card = document.createElement('div');
        card.className = 'forecast-card glass';
        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon">${wmo.icon}</div>
            <div class="forecast-temp">${fmt(d.temperature_2m_max[i])}°</div>
            <div class="forecast-range">L: ${fmt(d.temperature_2m_min[i])}°</div>
            ${precipPct != null ? `<div class="forecast-range" style="color:var(--primary-accent)">💧 ${precipPct}%</div>` : ''}
            <div class="forecast-bar-wrap"><div class="forecast-bar" style="width:${barPct}%"></div></div>
        `;
        panel.appendChild(card);
    });
}

// ===== Insight Bar =====
function generateInsight(wData) {
    const h       = wData.hourly;
    const prob24  = h.precipitation_probability.slice(0, 24);
    const maxProb = Math.max(...prob24);
    const rainH   = prob24.indexOf(maxProb);
    const maxTemp = Math.max(...h.temperature_2m.slice(0, 24));
    const minTemp = Math.min(...h.temperature_2m.slice(0, 24));

    let insight = '✅ Optimal atmospheric conditions for the next 24 hours. Clear sailing ahead.';

    if (maxProb > 70) {
        insight = `⛈️ High precipitation risk (${maxProb}%) around ${new Date(h.time[rainH]).getHours()}:00. Best to carry an umbrella!`;
    } else if (maxProb > 40) {
        insight = `🌦️ Moderate rain chance (${maxProb}%) in the forecast. Conditions may vary.`;
    } else if (maxTemp > 38) {
        insight = `🔥 Extreme heat alert — ${Math.round(maxTemp)}°C peak expected! Stay hydrated & avoid prolonged sun exposure.`;
    } else if (maxTemp > 35) {
        insight = `☀️ High thermal peak of ${Math.round(maxTemp)}°C detected. Monitor heat index carefully.`;
    } else if (minTemp < 2) {
        insight = `🧊 Near-freezing conditions (${Math.round(minTemp)}°C) expected. Watch for frost and icy surfaces.`;
    }

    document.getElementById('ai-prediction-text').textContent = insight;
    insightBar.classList.remove('hidden');
}

// ===== Charts =====
function getColors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        grid:       light ? 'rgba(0,0,0,0.06)'          : 'rgba(255,255,255,0.05)',
        tick:       light ? '#4a5670'                    : '#4a5580',
        tooltipBg:  light ? 'rgba(240,244,248,0.97)'     : 'rgba(10,15,35,0.97)',
        tooltipTxt: light ? '#0d1226'                    : '#f0f4ff',
    };
}

function renderCharts(wData) {
    const h  = wData.hourly;
    const cl = getColors();

    // Build x-axis labels (show day name at midnight, else hour)
    const labels = h.time.slice(0, 72).map(t => {
        const d = new Date(t);
        return d.getHours() === 0
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : `${d.getHours()}h`;
    });

    const baseOpts = (unit) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: cl.tooltipBg,
                titleColor: cl.tooltipTxt,
                bodyColor:  cl.tooltipTxt,
                borderColor: 'rgba(0,242,255,0.25)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 10,
                callbacks: { label: c => ` ${c.parsed.y}${unit}` }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: cl.tick, maxTicksLimit: 12, font: { size: 10 } },
                border: { display: false }
            },
            y: {
                grid: { color: cl.grid, drawBorder: false },
                ticks: { color: cl.tick, font: { size: 10 } },
                border: { display: false }
            }
        }
    });

    // Temperature — gradient fill
    const tempCtx  = document.getElementById('tempTrendChart').getContext('2d');
    const tempGrad = tempCtx.createLinearGradient(0, 0, 0, 155);
    tempGrad.addColorStop(0, 'rgba(0, 242, 255, 0.28)');
    tempGrad.addColorStop(1, 'rgba(0, 242, 255, 0.01)');

    initChart('tempTrendChart', 'tempTrend', {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: h.temperature_2m.slice(0, 72).map(v => unitCelsius ? v : +(toF(v).toFixed(1))),
                borderColor: '#00f2ff',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                backgroundColor: tempGrad,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#00f2ff',
            }]
        },
        options: baseOpts(unitCelsius ? '°C' : '°F')
    });

    // Humidity
    const hLabels = labels.filter((_, i) => i % 4 === 0);
    initChart('humidityAnalysisChart', 'humidity', {
        type: 'bar',
        data: {
            labels: hLabels,
            datasets: [{
                data: h.relative_humidity_2m.slice(0, 72).filter((_, i) => i % 4 === 0),
                backgroundColor: 'rgba(112, 0, 255, 0.5)',
                borderColor: 'rgba(140, 50, 255, 0.8)',
                borderWidth: 1,
                borderRadius: 5,
            }]
        },
        options: baseOpts('%')
    });

    // Precipitation
    initChart('precipChart', 'precip', {
        type: 'bar',
        data: {
            labels: hLabels,
            datasets: [{
                data: h.precipitation_probability.slice(0, 72).filter((_, i) => i % 4 === 0),
                backgroundColor: 'rgba(0, 150, 255, 0.45)',
                borderColor: 'rgba(0, 210, 255, 0.75)',
                borderWidth: 1,
                borderRadius: 5,
            }]
        },
        options: {
            ...baseOpts('%'),
            scales: {
                ...baseOpts('%').scales,
                y: { ...baseOpts('%').scales.y, min: 0, max: 100 }
            }
        }
    });

    // Pressure — accent orange line
    const pLabels = labels.filter((_, i) => i % 8 === 0);
    initChart('pressureChart', 'pressure', {
        type: 'line',
        data: {
            labels: pLabels,
            datasets: [{
                data: h.surface_pressure.slice(0, 72).filter((_, i) => i % 8 === 0),
                borderColor: '#ff6b35',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#ff6b35',
                pointBorderColor: 'rgba(255,107,53,0.3)',
                pointBorderWidth: 3,
                fill: false,
            }]
        },
        options: baseOpts(' hPa')
    });
}

function initChart(id, key, config) {
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(document.getElementById(id), config);
}

// ===== Helpers =====
function showLoader(on, text) {
    loader.classList.toggle('hidden', !on);
    if (text) document.getElementById('loader-text').textContent = text;
}

function showToast(msg, type = '') {
    const wrap = document.getElementById('toast-container');
    const el   = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity 0.35s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 350);
    }, 4500);
}
