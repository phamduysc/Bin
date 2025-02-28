// Wait for DOM and Leaflet to load
document.addEventListener('DOMContentLoaded', () => {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded. Ensure the Leaflet script is added to external resources.');
        return;
    }

    // Initialize Leaflet map
    const map = L.map('map').setView([-37.8136, 144.9631], 10); // Melbourne center
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Bin Collection Logic
    const getBinColor = (week) => {
        return week === '1' ? 'green' : 'yellow';
    };

    // Load GeoJSON for bin zones
    let binLayer, initialBounds;
    const addGeoJSON = (data) => {
        if (binLayer) map.removeLayer(binLayer);
        binLayer = L.geoJSON(data, {
            style: (feature) => ({
                fillColor: getBinColor(feature.properties.Week),
                weight: 3,
                opacity: 1,
                color: getBinColor(feature.properties.Week), // Match border color to fill color
                fillOpacity: .8
            }),
            onEachFeature: (feature, layer) => {
                const week = feature.properties.Week || 'Unknown';
                const area = feature.properties.Area_No || 'Unknown';
                const day = feature.properties.Day || 'Unknown';
                layer.bindPopup(`Area: ${area}<br>Day: ${day}<br>Week: ${week}`);
            }
        }).addTo(map);
        initialBounds = binLayer.getBounds();
        map.fitBounds(initialBounds);
    };

    // Fetch bin data
    const fetchBinData = () => {
        fetch('https://data.gov.au/data/dataset/c1b391aa-2990-4f12-9b3d-31ef9f72e24e/resource/407406a6-0a65-4819-92ce-0e37917b593d/download/wastecollection.json')
            .then(response => response.json())
            .then(data => addGeoJSON(data))
            .catch(error => console.error('Fetch error:', error));
    };

    fetchBinData();
    setInterval(fetchBinData, 24 * 60 * 60 * 1000); // Daily update

    // Geocode Search Logic
    let marker = null;
    const searchInput = document.getElementById('search-input');
    const suggestionsDiv = document.getElementById('suggestions');
    const clearButton = document.getElementById('clear-button');
    const bookButton = document.getElementById('book-button');

    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    const fetchSuggestions = debounce(async (query) => {
        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            return;
        }
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=AU`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            suggestionsDiv.innerHTML = '';
            data.forEach(item => {
                const div = document.createElement('div');
                div.textContent = item.display_name;
                div.onclick = () => {
                    searchInput.value = item.display_name;
                    suggestionsDiv.innerHTML = '';
                    placeMarker(item.lat, item.lon, item.display_name);
                };
                suggestionsDiv.appendChild(div);
            });
        } catch (error) {
            console.error('Suggestion error:', error);
        }
    }, 300);

    const placeMarker = (lat, lon, address) => {
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`<b>${address}</b>`).openPopup();
        map.setView([lat, lon], 15);
    };

    const clearSearch = () => {
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        searchInput.value = '';
        suggestionsDiv.innerHTML = '';
        if (initialBounds) map.fitBounds(initialBounds);
    };

    // Hard Rubbish Booking Function
    const bookHardRubbish = () => {
        const bookingUrl = 'https://digital.wyndham.vic.gov.au/hardwaste/';
        window.open(bookingUrl, '_blank');
    };

    // Event Listeners
    searchInput.addEventListener('input', (e) => fetchSuggestions(e.target.value));
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && searchInput.value) {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput.value)}&format=json&limit=1&countrycodes=AU`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    placeMarker(lat, lon, display_name);
                    suggestionsDiv.innerHTML = '';
                }
            } catch (error) {
                console.error('Geocode error:', error);
            }
        }
    });
    clearButton.addEventListener('click', clearSearch);
    bookButton.addEventListener('click', bookHardRubbish);
});
