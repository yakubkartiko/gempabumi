// Initialize map
const map = L.map('map').setView([-2.5, 118], 5);

// Base layers
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});

let currentLayer = osmLayer;
currentLayer.addTo(map);

let currentMarker = null;
let isLoadingData = false;
let lastGempaData = null;

// Toggle satellite view
function toggleSatellite() {
    if (currentLayer === osmLayer) {
        map.removeLayer(osmLayer);
        satelliteLayer.addTo(map);
        currentLayer = satelliteLayer;
    } else {
        map.removeLayer(satelliteLayer);
        osmLayer.addTo(map);
        currentLayer = osmLayer;
    }
}

// Center map to Indonesia
function centerMap() {
    map.setView([-2.5, 118], 5);
}

// Parse coordinates from BMKG format
function parseCoordinates(lintang, bujur) {
    const lat = parseFloat(lintang.replace(/[^\d.-]/g, '')) * (lintang.includes('LS') ? -1 : 1);
    const lon = parseFloat(bujur.replace(/[^\d.-]/g, '')) * (bujur.includes('BB') ? -1 : 1);
    return [lat, lon];
}

// Get magnitude color
function getMagnitudeColor(magnitude) {
    const mag = parseFloat(magnitude);
    if (mag >= 7) return '#8B0000'; // Dark red
    if (mag >= 6) return '#FF0000'; // Red
    if (mag >= 5) return '#FF4500'; // Orange red
    if (mag >= 4) return '#FFA500'; // Orange
    if (mag >= 3) return '#FFD700'; // Gold
    return '#90EE90'; // Light green
}

// Create custom marker
function createGempaMarker(lat, lon, magnitude) {
    const color = getMagnitudeColor(magnitude);
    const size = Math.max(15, Math.min(40, parseFloat(magnitude) * 6));
    
    return L.circleMarker([lat, lon], {
        radius: size,
        fillColor: color,
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
    });
}

// Format date time
function formatDateTime() {
    return new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Fetch earthquake data
async function fetchGempaData() {
    if (isLoadingData) return;
    
    isLoadingData = true;
    const loadingEl = document.getElementById('loading');
    const gempaInfoEl = document.getElementById('gempa-info');
    
    try {
        loadingEl.style.display = 'block';
        gempaInfoEl.style.display = 'none';

        const response = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const gempa = data.Infogempa.gempa;
        
        // Check if this is new data
        const isNewData = !lastGempaData || 
            lastGempaData.DateTime !== gempa.DateTime ||
            lastGempaData.Wilayah !== gempa.Wilayah;
        
        if (isNewData) {
            lastGempaData = gempa;
            updateGempaDisplay(gempa);
            updateMap(gempa);
        }
        
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Gagal memuat data. Mencoba kembali...');
    } finally {
        isLoadingData = false;
        loadingEl.style.display = 'none';
    }
}

// Update earthquake display
function updateGempaDisplay(gempa) {
    const gempaInfoEl = document.getElementById('gempa-info');
    
    const shakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;
    
    gempaInfoEl.innerHTML = `
        <div class="gempa-card">
            <h3>
                <i class="fas fa-exclamation-triangle"></i>
                Gempabumi Terbaru
            </h3>
            
            <div class="magnitude" style="background: ${getMagnitudeColor(gempa.Magnitude)}">
                M ${gempa.Magnitude}
            </div>
            
            <div class="info-row">
                <span class="info-label">Lokasi:</span>
                <span class="info-value">${gempa.Wilayah}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Kedalaman:</span>
                <span class="info-value">${gempa.Kedalaman}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Tanggal:</span>
                <span class="info-value">${gempa.Tanggal}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Waktu:</span>
                <span class="info-value">${gempa.Jam}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Koordinat:</span>
                <span class="info-value">${gempa.Lintang}, ${gempa.Bujur}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Potensi:</span>
                <span class="info-value">${gempa.Potensi}</span>
            </div>
            
            ${gempa.Dirasakan ? `
                <div class="info-row">
                    <span class="info-label">Dirasakan:</span>
                    <span class="info-value">${gempa.Dirasakan}</span>
                </div>
            ` : ''}
            
            <div class="shakemap-container">
                <h4 style="margin-bottom: 10px;">
                    <i class="fas fa-map"></i> Peta Guncangan (Shakemap)
                </h4>
                <img src="${shakemapUrl}" alt="Shakemap Gempabumi" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Shakemap tidak tersedia
                </div>
            </div>
        </div>
    `;
    
    gempaInfoEl.style.display = 'block';
}

// Update map with earthquake location
function updateMap(gempa) {
    const [lat, lon] = parseCoordinates(gempa.Lintang, gempa.Bujur);
    
    // Remove previous marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    
    // Create new marker
    currentMarker = createGempaMarker(lat, lon, gempa.Magnitude);
    
    // Add popup
    currentMarker.bindPopup(`
        <div style="text-align: center; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; color: #fff;">
                <i class="fas fa-exclamation-triangle"></i>
                Gempa M${gempa.Magnitude}
            </h3>
            <p style="margin: 5px 0; font-weight: bold;">${gempa.Wilayah}</p>
            <p style="margin: 5px 0;">Kedalaman: ${gempa.Kedalaman}</p>
            <p style="margin: 5px 0;">${gempa.Tanggal} ${gempa.Jam}</p>
            <p style="margin: 5px 0; font-size: 12px; opacity: 0.9;">${gempa.Potensi}</p>
        </div>
    `).addTo(map);
    
    // Center map on earthquake location with animation
    map.flyTo([lat, lon], 8, {
        animate: true,
        duration: 2
    });
    
    // Open popup after animation
    setTimeout(() => {
        currentMarker.openPopup();
    }, 2000);
}

// Update last update time
function updateLastUpdateTime() {
    document.getElementById('last-update').textContent = 
        `Terakhir diperbarui: ${formatDateTime()} WIB`;
}

// Show error message
function showError(message) {
    const gempaInfoEl = document.getElementById('gempa-info');
    gempaInfoEl.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
    gempaInfoEl.style.display = 'block';
}

// Refresh data manually
function refreshData() {
    const refreshBtn = document.querySelector('.control-btn i.fa-sync-alt');
    refreshBtn.style.animation = 'spin 1s linear infinite';
    
    fetchGempaData().finally(() => {
        setTimeout(() => {
            refreshBtn.style.animation = '';
        }, 1000);
    });
}

// Initialize app
function initApp() {
    // Fetch data immediately
    fetchGempaData();
    
    // Set up periodic updates (every 30 seconds)
    setInterval(fetchGempaData, 30000);
}

// Start the application
initApp();