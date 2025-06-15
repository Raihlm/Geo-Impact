
mapboxgl.accessToken = 'pk.eyJ1IjoiZmF5YXoxMjMiLCJhIjoiY203bXlzM3A4MHR1ODJrb2h4aHlodW8xbCJ9.owJ0pmjzxEYRPivGXpv2kA';



let currentStyle = 'mapbox://styles/mapbox/dark-v11';
let activeHazardLayer = 'earthquake';
let activeAlertSound = null;

// Initialize visibility state
window.heatmapVisible = true; // Default is visible

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-120, 50],
    zoom: 2,
    minZoom: 1.5,  // Set minimum zoom level for global view
    maxZoom: 18    // Set maximum zoom level
});


// Create a geocoder (search) control with collapsed mode by default
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false,
    placeholder: 'Search location',
    zoom: 8,
    flyTo: { duration: 2000 },
    collapsed: true,
    clearOnBlur: false

    
});

// Pastikan hanya satu geocoder ditambahkan ke peta
if (!map.hasControl(geocoder)) {
    map.addControl(geocoder);
}

// Fix for geocoder collapse issue
geocoder.on('result', (e) => {
    // Reset geocoder input after search
    geocoder.clear();
});

geocoder.on('clear', () => {
    // Ensure geocoder remains functional after clearing
    geocoder.setPlaceholder('Search location');
});







//document.getElementById('map').appendChild(geocoder.onAdd(map));

// Pantau input user
geocoder.on('result', function(e) {
    const placeName = e.result.place_name;
    if (isArea51(placeName)) {
        triggerUFOAnimation();
    }
    if (isSkynetKeyword(placeName)) {
        setTimeout(() => triggerSkynetMode(), 300);
    }
});

// Add the geocoder to the map
//map.addControl(geocoder, 'top-right');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // Get the geocoder container
        const geocoderContainer = document.querySelector('.mapboxgl-ctrl-geocoder');
        if (geocoderContainer) {
            // Improved click handler for collapsed geocoder
            geocoderContainer.addEventListener('click', function(e) {
                if (this.classList.contains('mapboxgl-ctrl-geocoder--collapsed')) {
                    // Reset any inline styles that might be causing conflicts
                    this.style.removeProperty('width');
                    this.style.removeProperty('transition');
                    
                    // Force reflow before removing collapsed class to ensure clean transition
                    void this.offsetHeight;
                    
                    // Remove collapsed class
                    this.classList.remove('mapboxgl-ctrl-geocoder--collapsed');
                    
                    // Make input visible and focus it
                    const input = this.querySelector('input');
                    if (input) {
                        input.style.display = 'block';
                        
                        // Small delay to ensure styles are applied before focusing
                        setTimeout(() => input.focus(), 50);
                    }
                    
                    // Prevent event bubbling
                    e.stopPropagation();
                }
            });
            
            // Handle clicks outside to collapse the geocoder
            document.addEventListener('click', function(e) {
                if (!geocoderContainer.contains(e.target) && 
                    !geocoderContainer.classList.contains('mapboxgl-ctrl-geocoder--collapsed')) {
                    geocoderContainer.classList.add('mapboxgl-ctrl-geocoder--collapsed');
                    
                    // Hide the input but use opacity instead of display:none to avoid transition issues
                    const input = geocoderContainer.querySelector('input');
                    if (input) {
                        input.style.opacity = '0';
                        // Only hide completely after transition finishes
                        setTimeout(() => {
                            if (geocoderContainer.classList.contains('mapboxgl-ctrl-geocoder--collapsed')) {
                                input.style.display = 'none';
                            }
                        }, 300);
                    }
                }
            });
        }
    }, 500);
});


// Update the geocoder result handler to clear the input and collapse after search

//geocoder.on('result', (event) => {
//    const result = event.result;
//    console.log('Selected location:', result.place_name);
//    
//    // Remove any existing highlight border if it exists
//    if (map.getLayer('search-result-area')) {
//        map.removeLayer('search-result-area');
//    }
//    if (map.getSource('search-result-source')) {
//        map.removeSource('search-result-source');
//    }
//    
//    // Clear search input after a short delay to allow the map to fly to location first
//    setTimeout(() => {
//        // Reset the geocoder input
//        geocoder.clear();
//        
//        // Force the geocoder to collapse after clearing with proper cleanup
//        const geocoderEl = document.querySelector('.mapboxgl-ctrl-geocoder');
//        if (geocoderEl) {
//            // Reset any inline styles first
//            geocoderEl.style.removeProperty('width');
//            geocoderEl.style.removeProperty('transition');
//            
//            // Add the collapsed class
//            geocoderEl.classList.add('mapboxgl-ctrl-geocoder--collapsed');
//            
//            // Fade out input first for smoother transition
//            const inputEl = geocoderEl.querySelector('input');
//            if (inputEl) {
//                inputEl.style.opacity = '0';
//                setTimeout(() => {
//                    inputEl.style.display = 'none';
//                    inputEl.value = '';
//                }, 300);
//            }
//        }
//    },500); // Wait 1.5 seconds so the user can see where the map is flying to
//});

document.getElementById('creditsModal').addEventListener('show.bs.modal', function() {
    // Close the offcanvas when the modal is shown
    const offcanvasElement = document.getElementById('offcanvasExample');
    const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
    if (offcanvas) {
        offcanvas.hide();
    }
});

function addEarthquakeLayers() {
    if (!map.getSource('earthquakes')) {
        map.addSource('earthquakes', {
            'type': 'geojson',
            'data': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'
        });
    }

    if (!map.getLayer('earthquakes-heat')) {
        map.addLayer({
            'id': 'earthquakes-heat',
            'type': 'heatmap',
            'source': 'earthquakes',
            'maxzoom': 9,
            'paint': {
                'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'mag'],
                    0,
                    0,
                    6,
                    1
                ],
                'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0,
                    1,
                    9,
                    3
                ],
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0,
                    'rgba(33,102,172,0)',
                    0.2,
                    'rgb(103,169,207)',
                    0.4,
                    'rgb(209,229,240)',
                    0.6,
                    'rgb(253,219,199)',
                    0.8,
                    'rgb(239,138,98)',
                    1,
                    'rgb(178,24,43)'
                ],
                'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0,
                    2,
                    9,
                    20
                ],
                'heatmap-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    7,
                    1,
                    9,
                    0
                ]
            }
        });
    }

    if (!map.getLayer('earthquakes-point')) {
        map.addLayer({
            'id': 'earthquakes-point',
            'type': 'circle',
            'source': 'earthquakes',
            'minzoom': 7,
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    7,
                    ['interpolate', ['linear'], ['get', 'mag'], 1, 1, 6, 4],
                    16,
                    ['interpolate', ['linear'], ['get', 'mag'], 1, 5, 6, 50]
                ],
                'circle-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'mag'],
                    1,
                    'rgba(33,102,172,0)',
                    2,
                    'rgb(103,169,207)',
                    3,
                    'rgb(209,229,240)',
                    4,
                    'rgb(253,219,199)',
                    5,
                    'rgb(239,138,98)',
                    6,
                    'rgb(178,24,43)'
                ],
                'circle-stroke-color': 'white',
                'circle-stroke-width': 1,
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    7,
                    0,
                    8,
                    1
                ]
            }
        });

        // Add click event after creating the layer
        map.on('click', 'earthquakes-point', handleEarthquakeClick);
    }
}

map.on('load', () => {
    addEarthquakeLayers();
});

// Track if we're in space view mode
let spaceViewMode = false;

// Create a transition overlay to prevent flashing
const transitionOverlay = document.createElement('div');
transitionOverlay.className = 'map-transition-overlay';
document.getElementById('map').appendChild(transitionOverlay);

map.on('zoomend', function() {
    // Check if we need to change the view mode
    const shouldBeSpaceView = map.getZoom() <= 2;
    
    // Only make changes if the mode needs to change
    if (shouldBeSpaceView !== spaceViewMode) {
        spaceViewMode = shouldBeSpaceView;
        
        // Show the transition overlay briefly
        transitionOverlay.style.opacity = '0.7';
        
        setTimeout(() => {
            // Instead of changing the entire style, just adjust layers
            if (spaceViewMode) {
                // Space view - change the background color and add atmosphere effect
                map.setPaintProperty('background', 'background-color', '#000');
                
                // Add cosmic background if it doesn't exist
                if (!map.getLayer('stars-layer')) {
                    map.addLayer({
                        id: 'stars-layer',
                        type: 'sky',
                        paint: {
                            'sky-type': 'atmosphere',
                            'sky-atmosphere-sun': [0.0, 90.0],
                            'sky-atmosphere-sun-intensity': 15,
                            'sky-atmosphere-color': 'rgba(37, 45, 66, 1)',
                            'sky-opacity': 1
                        }
                    }, 'earthquakes-heat'); // Add below data layers
                } else {
                    map.setLayoutProperty('stars-layer', 'visibility', 'visible');
                }
            } else {
                // Normal view
                map.setPaintProperty('background', 'background-color', '#2b3846');
                
                // Hide stars if they exist
                if (map.getLayer('stars-layer')) {
                    map.setLayoutProperty('stars-layer', 'visibility', 'none');
                }
            }
            
            // Fade out the transition overlay
            setTimeout(() => {
                transitionOverlay.style.opacity = '0';
            }, 100);
        }, 50);
    }
});

// Updated styledata handler (still needed for other changes)
map.on('styledata', () => {
    // Re-add earthquake layers
    addEarthquakeLayers();
    
    // Re-add active ML layer if exists
    if (activeMLLayer) {
        // Delay to ensure the map is ready
        setTimeout(() => {
            switch (activeMLLayer) {
                case 'location-prediction':
                    loadLocationPredictions();
                    break;
                case 'anomaly-detection':
                    loadAnomalyDetection();
                    break;
                case 'risk-map':
                    loadRiskMap();
                    break;
                case 'hotspots':
                    loadHotspots();
                    break;
            }
            
            // Re-apply active class to button
            if (activeMLButton) {
                activeMLButton.classList.add('ml-layer-active');
            }
        }, 200);
    }
});


function showEmergencyAlert(magnitude, place) {
    if (magnitude >= 6.0) {
        // Create a region object for the notification
        const region = {
            name: place,
            mag: magnitude,
            lat: map.getCenter().lat,  // Use current map center as approximate location
            lon: map.getCenter().lng,
            tsunami: magnitude >= 7.5   // Assume tsunami risk for very large quakes
        };
        
        // Use the custom notification instead of alert()
        showEmergencyNotification(region, 'earthquake');
    }
}

// Handle earthquake clicks - defined as a separate function
function handleEarthquakeClick(e) {
    // Check if features exist
    if (!e.features || !e.features.length) return;
    
    // Get earthquake data
    const feature = e.features[0];
    const magnitude = feature.properties.mag;
    const place = feature.properties.place;
    const timestamp = feature.properties.time;
    
    // Format date as DD/MM/YY
    const eventDate = new Date(timestamp);
    const formattedDate = `${eventDate.getDate().toString().padStart(2, '0')}/${(eventDate.getMonth()+1).toString().padStart(2, '0')}/${eventDate.getFullYear().toString().slice(-2)}`;
    const formattedTime = eventDate.toTimeString().split(' ')[0];
    
    // Check for tsunami alert (USGS data includes tsunami property: 1 = warning, 0 = no warning)
    const tsunamiWarning = feature.properties.tsunami === 1;
    const tsunamiStatus = tsunamiWarning ? 
        '<span class="text-danger"><strong>⚠️ TSUNAMI WARNING ISSUED</strong></span>' : 
        '<span class="text-success">No tsunami alerts</span>';
    
    // Determine alert level based on magnitude
    let alertLevel, disasterType;
    if (magnitude >= 7.0) {
        alertLevel = '<span class="badge bg-danger">SEVERE</span>';
        disasterType = "Major Earthquake";
    } else if (magnitude >= 5.5) {
        alertLevel = '<span class="badge bg-warning text-dark">HIGH</span>';
        disasterType = "Strong Earthquake";
    } else if (magnitude >= 4.0) {
        alertLevel = '<span class="badge bg-info text-dark">MODERATE</span>';
        disasterType = "Moderate Earthquake";
    } else {
        alertLevel = '<span class="badge bg-success">LOW</span>';
        disasterType = "Minor Earthquake";
    }

    // Last updated time
    const lastUpdated = new Date();
    const formattedLastUpdate = `${lastUpdated.getDate().toString().padStart(2, '0')}/${(lastUpdated.getMonth()+1).toString().padStart(2, '0')}/${lastUpdated.getFullYear().toString().slice(-2)} ${lastUpdated.toTimeString().split(' ')[0]}`;

    // Remove any existing popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    if (existingPopups.length) {
        existingPopups.forEach(popup => popup.remove());
    }
    
    // Create the popup at the clicked location
    new mapboxgl.Popup({
        className: 'custom-earthquake-popover',
        closeButton: true,
        closeOnClick: true,
        maxWidth: '300px'
    })
    .setLngLat(feature.geometry.coordinates)
    .setHTML(`
        <div class="popover-header">
            <strong>${magnitude.toFixed(1)}</strong> ${disasterType}
        </div>
        <div class="popover-body">
            <div class="mb-2">${alertLevel} ${tsunamiStatus}</div>
            <p><strong>Location:</strong> ${place}</p>
            <p><strong>Date/Time:</strong> ${formattedDate} ${formattedTime}</p>
            <div class="mt-3 pt-2 border-top text-secondary">
                <small>Last updated: ${formattedLastUpdate}</small>
            </div>
        </div>
    `)
    .addTo(map);
    
    // Show emergency alert for large earthquakes
    if (magnitude >= 6.0) {
        showEmergencyAlert(magnitude, place);
    }
}

// Ensure cursor changes when hovering over earthquake points
map.on('mouseenter', 'earthquakes-point', () => {
    map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'earthquakes-point', () => {
    map.getCanvas().style.cursor = '';
});

// Zoom controls functionality
document.getElementById('zoom-in-button').addEventListener('click', function() {
    // Zoom in by 1 level with animation
    map.zoomTo(map.getZoom() + 1, {
        duration: 300
    });
});

document.getElementById('zoom-out-button').addEventListener('click', function() {
    // Get current zoom level
    const currentZoom = map.getZoom();
    // Calculate new zoom level, but don't go below minZoom
    const newZoom = Math.max(currentZoom - 1, map.getMinZoom());
    
    // Zoom out by 1 level with animation, respecting minimum zoom
    map.zoomTo(newZoom, {
        duration: 300
    });
});

// Update flight button to go to exact minimum zoom
document.getElementById('zoom-out-flight-button').addEventListener('click', function() {
    // Fly to a zoomed-out global view at minimum zoom
    map.flyTo({
        center: [0, 20],  // Center on the Atlantic for a good global view
        zoom: map.getMinZoom(),  // Use the map's minimum zoom level
        bearing: 0,       // Reset bearing to north
        pitch: 0,         // Reset pitch to flat
        duration: 2000,   // Animation time in milliseconds
        essential: true   // This animation is considered essential for the intended user experience
    });
});

// Add this code at the bottom of your file

// Machine Learning Prediction Buttons
document.getElementById('btn-location-prediction').addEventListener('click', function() {
    const clickedSameLayer = (activeMLLayer === 'location-prediction');
    toggleMLLayer(this, 'location-prediction');
    if (!clickedSameLayer) {
        loadLocationPredictions();
    }
});

document.getElementById('btn-anomaly-detection').addEventListener('click', function() {
    const clickedSameLayer = (activeMLLayer === 'anomaly-detection');
    toggleMLLayer(this, 'anomaly-detection');
    if (!clickedSameLayer) {
        loadAnomalyDetection();
    }
});

document.getElementById('btn-risk-map').addEventListener('click', function() {
    const clickedSameLayer = (activeMLLayer === 'risk-map');
    toggleMLLayer(this, 'risk-map');
    if (!clickedSameLayer) {
        loadRiskMap();
    }
});

document.getElementById('btn-earthquake-hotspots').addEventListener('click', function() {
    const clickedSameLayer = (activeMLLayer === 'hotspots');
    toggleMLLayer(this, 'hotspots');
    if (!clickedSameLayer) {
        loadHotspots();
    }
});


// Update the toggle-heatmap event handler
document.getElementById('toggle-heatmap').addEventListener('change', function() {
    window.heatmapVisible = this.checked;
    const visibility = this.checked ? 'visible' : 'none';
    
    console.log(`Setting heatmap visibility to: ${visibility}`);
    
    // Update base earthquake heatmap
    if (map.getLayer('earthquakes-heat')) {
        map.setLayoutProperty('earthquakes-heat', 'visibility', visibility);
    }
    
    // Immediately handle ALL ML layers
    forceUpdateAllMLLayerVisibility(visibility);
    
    // Schedule another check after a short delay to catch any race conditions
    setTimeout(() => forceUpdateAllMLLayerVisibility(visibility), 100);
});

// More aggressive function to handle ALL layers
function forceUpdateAllMLLayerVisibility(visibility) {
    const mlLayers = ['ml-prediction', 'ml-anomaly', 'ml-risk', 'ml-hotspots'];
    mlLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
            console.log(`Setting ${layerId} to ${visibility}`);
            map.setLayoutProperty(layerId, 'visibility', visibility);
            
            // Double-check the visibility was actually applied
            const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
            if (currentVisibility !== visibility) {
                console.warn(`Failed to set ${layerId} visibility! Trying again...`);
                map.setLayoutProperty(layerId, 'visibility', visibility);
            }
        }
    });
}

document.getElementById('toggle-points').addEventListener('change', function() {
    const visibility = this.checked ? 'visible' : 'none';
    if (map.getLayer('earthquakes-point')) {
        map.setLayoutProperty('earthquakes-point', 'visibility', visibility);
    }
});

// Track active ML layer
let activeMLLayer = null;
let activeMLButton = null;

// Improve the toggleMLLayer function to ensure layer visibility
function toggleMLLayer(button, layerId) {
    // Remove active class from previous button
    if (activeMLButton) {
        activeMLButton.classList.remove('ml-layer-active');
    }
    
    // If clicking the same button, toggle off
    if (activeMLLayer === layerId) {
        removeMLLayers();
        activeMLLayer = null;
        activeMLButton = null;
        return;
    }
    
    // Set new active button and layer
    button.classList.add('ml-layer-active');
    activeMLButton = button;
    activeMLLayer = layerId;
    
    // Remove any existing ML layers first
    removeMLLayers();
}

// Remove all ML visualization layers
function removeMLLayers() {
    // Remove any existing ML layers
    ['ml-prediction', 'ml-anomaly', 'ml-risk', 'ml-hotspots'].forEach(layer => {
        if (map.getLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    
    // Remove sources
    ['ml-prediction-source', 'ml-anomaly-source', 'ml-risk-source', 'ml-hotspot-source'].forEach(source => {
        if (map.getSource(source)) {
            map.removeSource(source);
        }
    });
}

// Fixed loadLocationPredictions function with proper braces
function loadLocationPredictions() {
    console.log("Loading earthquake location predictions from ML model...");
    
    fetch('http://127.0.0.1:5000/api/prediction')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(predictions => {
            if (!map.getSource('ml-prediction-source')) {
                map.addSource('ml-prediction-source', {
                    'type': 'geojson',
                    'data': predictions
                });
            } else {
                map.getSource('ml-prediction-source').setData(predictions);
            }
            
            if (!map.getLayer('ml-prediction')) {
                map.addLayer({
                    'id': 'ml-prediction',
                    'type': 'circle',
                    'source': 'ml-prediction-source',
                    'layout': {
                        'visibility': window.heatmapVisible ? 'visible' : 'none'
                    },
                    'paint': {
                        'circle-radius': 8,
                        'circle-color': '#3bb2d0',
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 1,
                        'circle-opacity': 0.7
                    }
                });
                
                // Force check the visibility is correct after layer creation
                const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-prediction', 'visibility', currentVisibility);
            }
        })
        .catch(error => {
            console.error('Error loading prediction data:', error);
            generateSimulatedPredictions().then(predictions => {
                if (!map.getSource('ml-prediction-source')) {
                    map.addSource('ml-prediction-source', {
                        'type': 'geojson',
                        'data': predictions
                    });
                } else {
                    map.getSource('ml-prediction-source').setData(predictions);
                }
                
                if (!map.getLayer('ml-prediction')) {
                    map.addLayer({
                        'id': 'ml-prediction',
                        'type': 'circle',
                        'source': 'ml-prediction-source',
                        'layout': {
                            'visibility': window.heatmapVisible ? 'visible' : 'none'
                        },
                        'paint': {
                            'circle-radius': 8,
                            'circle-color': '#3bb2d0',
                            'circle-stroke-color': 'white',
                            'circle-stroke-width': 1,
                            'circle-opacity': 0.7
                        }
                    });
                    
                    // Force check the visibility is correct after layer creation
                    const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                    map.setLayoutProperty('ml-prediction', 'visibility', currentVisibility);
                }
            });
        });
}

// Load anomaly detection visualization
function loadAnomalyDetection() {
    console.log("Loading earthquake anomaly detection from ML model...");
    
    fetch('http://127.0.0.1:5000/api/anomalies')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(anomalies => {
            if (!map.getSource('ml-anomaly-source')) {
                map.addSource('ml-anomaly-source', {
                    'type': 'geojson',
                    'data': anomalies
                });
            } else {
                map.getSource('ml-anomaly-source').setData(anomalies);
            }
            
            if (!map.getLayer('ml-anomaly')) {
                map.addLayer({
                    'id': 'ml-anomaly',
                    'type': 'circle',
                    'source': 'ml-anomaly-source',
                    'layout': {
                        'visibility': window.heatmapVisible ? 'visible' : 'none'
                    },
                    'paint': {
                        'circle-radius': 10,
                        'circle-color': '#ff4d4f',
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 2,
                        'circle-opacity': 0.8
                    }
                });
                
                // Force check the visibility is correct after layer creation
                const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-anomaly', 'visibility', currentVisibility);
            }
        })
        .catch(error => {
            console.error('Error loading anomaly data:', error);
            generateSimulatedAnomalies().then(anomalies => {
                if (!map.getSource('ml-anomaly-source')) {
                    map.addSource('ml-anomaly-source', {
                        'type': 'geojson',
                        'data': anomalies
                    });
                } else {
                    map.getSource('ml-anomaly-source').setData(anomalies);
                }
                
                if (!map.getLayer('ml-anomaly')) {
                    map.addLayer({
                        'id': 'ml-anomaly',
                        'type': 'circle',
                        'source': 'ml-anomaly-source',
                        'layout': {
                            'visibility': window.heatmapVisible ? 'visible' : 'none'
                        },
                        'paint': {
                            'circle-radius': 10,
                            'circle-color': '#ff4d4f',
                            'circle-stroke-color': 'white',
                            'circle-stroke-width': 2,
                            'circle-opacity': 0.8
                        }
                    });
                    
                    // Force check the visibility is correct after layer creation
                    const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                    map.setLayoutProperty('ml-anomaly', 'visibility', currentVisibility);
                }
            });
        });
}

// Fixed loadRiskMap function
function loadRiskMap() {
    console.log("Loading earthquake risk heatmap from ML model...");
    
    fetch('http://127.0.0.1:5000/api/risk')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(riskData => {
            if (!map.getSource('ml-risk-source')) {
                map.addSource('ml-risk-source', {
                    'type': 'geojson',
                    'data': riskData
                });
            } else {
                map.getSource('ml-risk-source').setData(riskData);
            }
            
            if (!map.getLayer('ml-risk')) {
                map.addLayer({
                    'id': 'ml-risk',
                    'type': 'heatmap',
                    'source': 'ml-risk-source',
                    'layout': {
                        'visibility': window.heatmapVisible ? 'visible' : 'none'
                    },
                    'paint': {
                        'heatmap-weight': ['get', 'risk'],
                        'heatmap-intensity': 1,
                        'heatmap-color': [
                            'interpolate',
                            ['linear'],
                            ['heatmap-density'],
                            0, 'rgba(0, 0, 255, 0)',
                            0.2, 'royalblue',
                            0.4, 'cyan',
                            0.6, 'lime',
                            0.8, 'yellow',
                            1, 'red'
                        ],
                        'heatmap-radius': 30,
                        'heatmap-opacity': 0.8
                    }
                });
                
                // Force check the visibility is correct after layer creation
                const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-risk', 'visibility', currentVisibility);
            } else {
                // Double-confirm visibility setting for existing layer
                const visibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-risk', 'visibility', visibility);
            }
        })
        .catch(error => {
            console.error('Error loading risk data:', error);
            generateSimulatedRiskData().then(riskData => {
                if (!map.getSource('ml-risk-source')) {
                    map.addSource('ml-risk-source', {
                        'type': 'geojson',
                        'data': riskData
                    });
                } else {
                    map.getSource('ml-risk-source').setData(riskData);
                }
                
                if (!map.getLayer('ml-risk')) {
                    map.addLayer({
                        'id': 'ml-risk',
                        'type': 'heatmap',
                        'source': 'ml-risk-source',
                        'layout': {
                            'visibility': window.heatmapVisible ? 'visible' : 'none'
                        },
                        'paint': {
                            'heatmap-weight': ['get', 'risk'],
                            'heatmap-intensity': 1,
                            'heatmap-color': [
                                'interpolate',
                                ['linear'],
                                ['heatmap-density'],
                                0, 'rgba(0, 0, 255, 0)',
                                0.2, 'royalblue',
                                0.4, 'cyan',
                                0.6, 'lime',
                                0.8, 'yellow',
                                1, 'red'
                            ],
                            'heatmap-radius': 30,
                            'heatmap-opacity': 0.8
                        }
                    });
                    
                    // Force check the visibility is correct after layer creation
                    const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                    map.setLayoutProperty('ml-risk', 'visibility', currentVisibility);
                }
            });
        });
}
    
    
// Fixed loadHotspots function
function loadHotspots() {
    console.log("Loading earthquake hotspots from ML model...");
    
    fetch('http://127.0.0.1:5000/api/hotspots')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(hotspots => {
            if (!map.getSource('ml-hotspot-source')) {
                map.addSource('ml-hotspot-source', {
                    'type': 'geojson',
                    'data': hotspots
                });
            } else {
                map.getSource('ml-hotspot-source').setData(hotspots);
            }
            
            if (!map.getLayer('ml-hotspots')) {
                map.addLayer({
                    'id': 'ml-hotspots',
                    'type': 'circle',
                    'source': 'ml-hotspot-source',
                    'layout': {
                        'visibility': window.heatmapVisible ? 'visible' : 'none'
                    },
                    'paint': {
                        'circle-radius': ['get', 'radius'],
                        'circle-color': 'purple',
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 1,
                        'circle-opacity': 0.6
                    }
                });
                
                // Force check the visibility is correct after layer creation
                const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-hotspots', 'visibility', currentVisibility);
            } else {
                // Update existing layer's visibility
                const visibility = window.heatmapVisible ? 'visible' : 'none';
                map.setLayoutProperty('ml-hotspots', 'visibility', visibility);
            }
        })
        .catch(error => {
            console.error('Error loading hotspot data:', error);
            generateSimulatedHotspots().then(hotspots => {
                if (!map.getSource('ml-hotspot-source')) {
                    map.addSource('ml-hotspot-source', {
                        'type': 'geojson',
                        'data': hotspots
                    });
                } else {
                    map.getSource('ml-hotspot-source').setData(hotspots);
                }
                
                if (!map.getLayer('ml-hotspots')) {
                    map.addLayer({
                        'id': 'ml-hotspots',
                        'type': 'circle',
                        'source': 'ml-hotspot-source',
                        'layout': {
                            'visibility': window.heatmapVisible ? 'visible' : 'none'
                        },
                        'paint': {
                            'circle-radius': ['get', 'radius'],
                            'circle-color': 'purple',
                            'circle-stroke-color': 'white',
                            'circle-stroke-width': 1,
                            'circle-opacity': 0.6
                        }
                    });
                    
                    // Force check the visibility is correct after layer creation
                    const currentVisibility = window.heatmapVisible ? 'visible' : 'none';
                    map.setLayoutProperty('ml-hotspots', 'visibility', currentVisibility);
                }
            });
        });
}

// Helper functions to generate simulated ML data
async function generateSimulatedPredictions() {
    return {
        type: 'FeatureCollection',
        features: Array(10).fill().map(() => ({
            type: 'Feature',
            properties: {
                probability: Math.random() * 0.8 + 0.1,  // 10-90% probability
                predictedMagnitude: Math.random() * 3 + 2  // 2-5 magnitude
            },
            geometry: {
                type: 'Point',
                coordinates: [
                    Math.random() * 360 - 180,  // longitude (-180 to 180)
                    Math.random() * 170 - 85    // latitude (-85 to 85)
                ]
            }
        }))
    };
}

async function generateSimulatedAnomalies() {
    return {
        type: 'FeatureCollection',
        features: Array(5).fill().map(() => ({
            type: 'Feature',
            properties: {
                anomalyScore: Math.random() * 0.5 + 0.5,  // 50-100% anomalous
                confidence: Math.random() * 0.3 + 0.7     // 70-100% confidence
            },
            geometry: {
                type: 'Point',
                coordinates: [
                    Math.random() * 360 - 180,
                    Math.random() * 170 - 85
                ]
            }
        }))
    };
}

async function generateSimulatedRiskData() {
    // Generate risk points around the world
    const features = [];
    
    // Create a grid of risk points
    for (let lat = -80; lat <= 80; lat += 20) {
        for (let lon = -180; lon <= 180; lon += 20) {
            // Add some randomness to position and risk value
            const riskVal = Math.random();
            features.push({
                type: 'Feature',
                properties: {
                    risk: riskVal
                },
                geometry: {
                    type: 'Point',
                    coordinates: [
                        lon + (Math.random() * 10 - 5),
                        lat + (Math.random() * 10 - 5)
                    ]
                }
            });
        }
    }
    
    // Add more risk points around known seismic zones (Ring of Fire)
    // Japan
    addClusteredRiskPoints(features, 140, 38, 15, 0.7);
    // California
    addClusteredRiskPoints(features, -122, 37, 10, 0.8);
    // Indonesia
    addClusteredRiskPoints(features, 120, 0, 20, 0.9);
    // Chile
    addClusteredRiskPoints(features, -70, -30, 10, 0.75);
    
    return {
        type: 'FeatureCollection',
        features: features
    };
}

function addClusteredRiskPoints(features, centerLon, centerLat, count, baseRisk) {
    for (let i = 0; i < count; i++) {
        features.push({
            type: 'Feature',
            properties: {
                risk: baseRisk + (Math.random() * 0.2)  // Higher risk in seismic zones
            },
            geometry: {
                type: 'Point',
                coordinates: [
                    centerLon + (Math.random() * 10 - 5),
                    centerLat + (Math.random() * 10 - 5)
                ]
            }
        });
    }
}

async function generateSimulatedHotspots() {
    // Known earthquake hotspot regions
    const hotspotRegions = [
        { name: "Pacific Ring of Fire - Japan", lon: 139, lat: 35, activity: 0.95 },
        { name: "Pacific Ring of Fire - California", lon: -122, lat: 37, activity: 0.85 },
        { name: "Pacific Ring of Fire - Chile", lon: -70, lat: -33, activity: 0.8 },
        { name: "Pacific Ring of Fire - New Zealand", lon: 174, lat: -41, activity: 0.75 },
        { name: "Alpine-Himalayan Belt - Turkey", lon: 30, lat: 39, activity: 0.7 },
        { name: "Alpine-Himalayan Belt - Iran", lon: 51, lat: 35, activity: 0.65 },
        { name: "Alpine-Himalayan Belt - Nepal", lon: 84, lat: 28, activity: 0.9 },
        { name: "Mid-Atlantic Ridge - Iceland", lon: -19, lat: 64, activity: 0.6 },
        { name: "East African Rift", lon: 36, lat: 0, activity: 0.5 }
    ];
    
    return {
        type: 'FeatureCollection',
        features: hotspotRegions.map(region => ({
            type: 'Feature',
            properties: {
                name: region.name,
                activity: region.activity,
                events: Math.floor(region.activity * 100),
                radius: 10 + (region.activity * 20)  // Size based on activity
            },
            geometry: {
                type: 'Point',
                coordinates: [region.lon, region.lat]
            }
        }))
    };
}

// Add these event handlers at the bottom of your file

// Click handler for ML prediction points
map.on('click', 'ml-prediction', (e) => {
    // Check if features exist
    if (!e.features || !e.features.length) return;
    
    // Get prediction data
    const feature = e.features[0];
    const probability = feature.properties.probability;
    const predictedMagnitude = feature.properties.predictedMagnitude;
    const coordinates = feature.geometry.coordinates.slice();
    
    // Format probability as percentage
    const probabilityPercent = (probability * 100).toFixed(1) + '%';
    
    // Calculate estimated time frame (random for demo)
    const timeFrames = ["24 hours", "7 days", "30 days"];
    const timeFrame = timeFrames[Math.floor(Math.random() * timeFrames.length)];
    
    // Remove any existing popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    if (existingPopups.length) {
        existingPopups.forEach(popup => popup.remove());
    }
    
    // Create popup
    new mapboxgl.Popup({
        className: 'custom-earthquake-popover',
        closeButton: true,
        closeOnClick: true,
        maxWidth: '300px'
    })
    .setLngLat(coordinates)
    .setHTML(`
        <div class="popover-header">
            <strong>Earthquake Prediction</strong>
        </div>
        <div class="popover-body">
            <div class="mb-2">
                <span class="badge bg-primary">ML MODEL</span>
            </div>
            <p><strong>Probability:</strong> ${probabilityPercent}</p>
            <p><strong>Predicted Magnitude:</strong> ${predictedMagnitude.toFixed(1)}</p>
            <p><strong>Time Frame:</strong> Next ${timeFrame}</p>
            <div class="mt-3 pt-2 border-top text-secondary">
                <small>Based on historical seismic patterns and ML model v2.1</small>
            </div>
        </div>
    `)
    .addTo(map);
});

map.on('click', 'ml-anomaly', (e) => {
    // Check if features exist
    if (!e.features || !e.features.length) return;
    
    // Get anomaly data
    const feature = e.features[0];
    const anomalyScore = feature.properties.anomalyScore;
    const confidence = feature.properties.confidence;
    const coordinates = feature.geometry.coordinates.slice();
    
    // Format scores as percentages
    const anomalyPercent = (anomalyScore * 100).toFixed(1) + '%';
    const confidencePercent = (confidence * 100).toFixed(1) + '%';
    
    // Determine severity level
    let severityLevel, severityClass;
    if (anomalyScore > 0.8) {
        severityLevel = "CRITICAL";
        severityClass = "bg-danger";
    } else if (anomalyScore > 0.6) {
        severityLevel = "HIGH";
        severityClass = "bg-warning text-dark";
    } else {
        severityLevel = "MODERATE";
        severityClass = "bg-info text-dark";
    }
    
    // Remove any existing popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    if (existingPopups.length) {
        existingPopups.forEach(popup => popup.remove());
    }
    
    // Create popup
    new mapboxgl.Popup({
        className: 'custom-earthquake-popover',
        closeButton: true,
        closeOnClick: true,
        maxWidth: '300px'
    })
    .setLngLat(coordinates)
    .setHTML(`
        <div class="popover-header">
            <strong>Seismic Anomaly Detected</strong>
        </div>
        <div class="popover-body">
            <div class="mb-2">
                <span class="badge ${severityClass}">${severityLevel}</span>
            </div>
            <p><strong>Anomaly Score:</strong> ${anomalyPercent}</p>
            <p><strong>Confidence:</strong> ${confidencePercent}</p>
            <p><strong>Detected:</strong> Unusual seismic pattern</p>
            <div class="mt-3 pt-2 border-top text-secondary">
                <small>Anomaly detection algorithm spotted patterns that deviate from normal seismic activity</small>
            </div>
        </div>
    `)
    .addTo(map);
});

// Add hover effects for ML points
map.on('mouseenter', 'ml-prediction', () => {
    map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'ml-prediction', () => {
    map.getCanvas().style.cursor = '';
});

map.on('mouseenter', 'ml-anomaly', () => {
    map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'ml-anomaly', () => {
    map.getCanvas().style.cursor = '';
});

// Add hover effects for hotspots
map.on('mouseenter', 'ml-hotspots', () => {
    map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'ml-hotspots', () => {
    map.getCanvas().style.cursor = '';
});

// Click handler for ML hotspots
map.on('click', 'ml-hotspots', (e) => {
    // Check if features exist
    if (!e.features || !e.features.length) return;
    
    // Get hotspot data
    const feature = e.features[0];
    const name = feature.properties.name;
    const activity = feature.properties.activity;
    const events = feature.properties.events;
    const coordinates = feature.geometry.coordinates.slice();
    
    // Format activity as percentage
    const activityPercent = (activity * 100).toFixed(1) + '%';
    
    // Remove any existing popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    if (existingPopups.length) {
        existingPopups.forEach(popup => popup.remove());
    }
    
    // Create popup
    new mapboxgl.Popup({
        className: 'custom-earthquake-popover',
        closeButton: true,
        closeOnClick: true,
        maxWidth: '300px'
    })
    .setLngLat(coordinates)
    .setHTML(`
        <div class="popover-header">
            <strong>Earthquake Hotspot</strong>
        </div>
        <div class="popover-body">
            <div class="mb-2">
                <span class="badge bg-purple">ACTIVE ZONE</span>
            </div>
            <p><strong>Region:</strong> ${name}</p>
            <p><strong>Activity Level:</strong> ${activityPercent}</p>
            <p><strong>Recent Events:</strong> ${events}</p>
            <div class="mt-3 pt-2 border-top text-secondary">
                <small>Historically active seismic region with regular earthquake activity</small>
            </div>
        </div>
    `)
    .addTo(map);
});

// Force fix any visibility issues with ML layers
function forceFixMLLayerVisibility() {
    if (!window.heatmapVisible) {
        // If heatmap toggle is off, make absolutely sure all ML layers are hidden
        const mlLayers = ['ml-prediction', 'ml-anomaly', 'ml-risk', 'ml-hotspots'];
        mlLayers.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', 'none');
                console.log(`Force fixing ${layerId} visibility to none`);
            }
        });
    }
}

// Run this check whenever a layer is added/toggled
map.on('sourcedata', function(e) {
    // Only run when a source is loaded
    if (e.isSourceLoaded && e.sourceId && e.sourceId.includes('ml-')) {
        forceFixMLLayerVisibility();
    }
});

// Also add a button to force fix visibility issues
document.getElementById('toggle-heatmap').addEventListener('click', function() {
    // Give it a moment for the layout to update
    setTimeout(forceFixMLLayerVisibility, 100);
});

// Add this near the top of your file where you set initial states
// Initialize visibility state - do this BEFORE any layers are added
window.heatmapVisible = document.getElementById('toggle-heatmap').checked;
console.log(`Initial heatmap visibility state: ${window.heatmapVisible}`);

// Add this to ensure visibility consistency when layers are added
map.on('styledata', () => {
    // Force update layer visibility whenever style data changes
    setTimeout(() => {
        const visibility = window.heatmapVisible ? 'visible' : 'none';
        forceUpdateAllMLLayerVisibility(visibility);
    }, 200);
});

// Check layer visibility every time a new source is loaded
map.on('sourcedata', (e) => {
    if (e.isSourceLoaded && e.sourceId && e.sourceId.includes('ml-')) {
        setTimeout(() => {
            const visibility = window.heatmapVisible ? 'visible' : 'none';
            forceUpdateAllMLLayerVisibility(visibility);
        }, 50);
    }
});

// Add direct event handler that bypasses the Mapbox layout system
document.getElementById('toggle-heatmap').addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Use the new checked state from the event
    const visibility = this.checked ? 'visible' : 'none';
    window.heatmapVisible = this.checked;
    
    // Schedule multiple checks to ensure it takes effect
    setTimeout(() => forceUpdateAllMLLayerVisibility(visibility), 10);
    setTimeout(() => forceUpdateAllMLLayerVisibility(visibility), 100);
    setTimeout(() => forceUpdateAllMLLayerVisibility(visibility), 500);
});

// Earthquake simulation functionality
document.getElementById('btn-simulate-earthquake').addEventListener('click', function() {
    simulateEarthquake();
});

// Store any active notification element
let activeNotification = null;

// Update simulateEarthquake function to keep epicenter marker until notification closes
function simulateEarthquake() {
    // Define earthquake hotspot regions for simulation
    const simulationRegions = [
        { name: "San Francisco, California", lon: -122.4194, lat: 37.7749, mag: 7.8, tsunami: true },
        { name: "Tokyo, Japan", lon: 139.6503, lat: 35.6762, mag: 8.2, tsunami: true },
        { name: "Istanbul, Turkey", lon: 28.9784, lat: 41.0082, mag: 7.5, tsunami: false },
        { name: "Lima, Peru", lon: -77.0428, lat: -12.0464, mag: 8.0, tsunami: true },
        { name: "Kathmandu, Nepal", lon: 85.3240, lat: 27.7172, mag: 7.9, tsunami: false },
        { name: "Mexico City, Mexico", lon: -99.1332, lat: 19.4326, mag: 7.6, tsunami: false },
        { name: "Wellington, New Zealand", lon: 174.7762, lat: -41.2865, mag: 7.3, tsunami: true },
        { name: "Anchorage, Alaska", lon: -149.9003, lat: 61.2181, mag: 8.1, tsunami: true },
        { name: "Santiago, Chile", lon: -70.6693, lat: -33.4489, mag: 8.3, tsunami: true },
        { name: "Papua New Guinea", lon: 147.1893, lat: -6.3148, mag: 7.7, tsunami: true },
        { name: "Sumatra, Indonesia", lon: 100.3543, lat: -0.7893, mag: 8.4, tsunami: true },
        { name: "Honshu, Japan", lon: 142.3603, lat: 38.3215, mag: 9.0, tsunami: true },
        { name: "Los Angeles, California", lon: -118.2437, lat: 34.0522, mag: 7.4, tsunami: true },
        { name: "Tehran, Iran", lon: 51.3890, lat: 35.6892, mag: 7.3, tsunami: false },
        { name: "Islamabad, Pakistan", lon: 73.0479, lat: 33.6844, mag: 7.6, tsunami: false },
        { name: "Manila, Philippines", lon: 121.0000, lat: 14.5995, mag: 7.8, tsunami: true }
    ];

    // Pick a random region
    const region = simulationRegions[Math.floor(Math.random() * simulationRegions.length)];
    
    // Forcibly close the sidebar immediately
    const sidebarElement = document.getElementById('offcanvasExample');
    const sidebar = bootstrap.Offcanvas.getInstance(sidebarElement);
    if (sidebar) {
        sidebar.hide();
    }
    
    // Add epicenter point without using the default marker
    if (!map.getSource('quake-epicenter')) {
        map.addSource('quake-epicenter', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [region.lon, region.lat]
                }
            }
        });
    } else {
        // Update existing source
        map.getSource('quake-epicenter').setData({
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [region.lon, region.lat]
            }
        });
    }
    
    // Add the epicenter layer if it doesn't exist with pulsing effect
    if (!map.getLayer('quake-epicenter-layer')) {
        map.addLayer({
            'id': 'quake-epicenter-layer',
            'type': 'circle',
            'source': 'quake-epicenter',
            'paint': {
                'circle-radius': 10,
                'circle-color': '#ff0000',
                'circle-opacity': 0.6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.8,
                // Add a pulse effect using the circle-blur property
                'circle-blur': 0.4
            }
        });
        
        // Add a pulsing glow effect with a second larger circle
        map.addLayer({
            'id': 'quake-epicenter-glow',
            'type': 'circle',
            'source': 'quake-epicenter',
            'paint': {
                'circle-radius': ['interpolate', ['linear'], ['get', 'pulse', ['literal', {'pulse': 0}]], 0, 15, 1, 25],
                'circle-color': '#ff0000',
                'circle-opacity': 0.3,
                'circle-blur': 0.8
            }
        });
        
        // Create a pulsing effect
        let pulseSize = 0;
        const pulseInterval = setInterval(() => {
            pulseSize = (pulseSize + 0.1) % 1;
            if (map.getSource('quake-epicenter')) {
                const data = map.getSource('quake-epicenter')._data;
                if (data && data.properties) {
                    data.properties.pulse = pulseSize;
                    map.getSource('quake-epicenter').setData(data);
                }
            } else {
                clearInterval(pulseInterval);
            }
        }, 100);
    }
    
    // Fly to the earthquake location
    map.flyTo({
        center: [region.lon, region.lat],
        zoom: 6,
        duration: 3000,
        essential: true
    });
    
    // Show tsunami impact area if applicable
    if (region.tsunami) {
        showTsunamiImpact(region);
    }
    
        // Update the cleanup in simulateEarthquake function
    showEmergencyNotification(region, 'earthquake', () => {
        // Clean up the layers when notification is closed
        if (map.getLayer('quake-epicenter-glow')) {
            map.removeLayer('quake-epicenter-glow');
        }
        if (map.getLayer('quake-epicenter-layer')) {
            map.removeLayer('quake-epicenter-layer');
        }
        if (map.getSource('quake-epicenter')) {
            map.removeSource('quake-epicenter');
        }
        
        if (map.getLayer('tsunami-impact')) {
            map.removeLayer('tsunami-impact');
        }
        if (map.getSource('tsunami-impact-source')) {
            map.removeSource('tsunami-impact-source');
        }

    });
}

// Add tsunami simulation functionality
document.getElementById('btn-simulate-tsunami').addEventListener('click', function() {
    simulateTsunami();
});

// Function to simulate a tsunami without earthquake
function simulateTsunami() {
    // Define tsunami risk regions for simulation
    const tsunamiRegions = [
        { name: "Pacific Coast, Japan", lon: 140.5503, lat: 36.5762, mag: 0.0, tsunami: true },
        { name: "Indonesia Coastal Areas", lon: 120.7804, lat: -2.9082, mag: 0.0, tsunami: true },
        { name: "Hawaiian Islands", lon: -157.8583, lat: 21.3069, mag: 0.0, tsunami: true },
        { name: "Alaska Coastline", lon: -152.4072, lat: 57.7901, mag: 0.0, tsunami: true },
        { name: "Pacific Northwest, USA", lon: -124.7729, lat: 46.8523, mag: 0.0, tsunami: true },
        { name: "Chile Coastal Areas", lon: -71.6728, lat: -33.0472, mag: 0.0, tsunami: true },
        { name: "Samoa Islands", lon: -172.1046, lat: -13.7590, mag: 0.0, tsunami: true },
        { name: "Sumatra Western Coast", lon: 95.3376, lat: 5.5482, mag: 0.0, tsunami: true },
        { name: "New Zealand East Coast", lon: 178.3971, lat: -37.7833, mag: 0.0, tsunami: true },
        { name: "Aleutian Islands", lon: -175.1918, lat: 51.8806, mag: 0.0, tsunami: true },
        { name: "Kuril Islands, Russia", lon: 152.4033, lat: 46.8425, mag: 0.0, tsunami: true },
        { name: "Southern California Coast", lon: -117.5724, lat: 33.4734, mag: 0.0, tsunami: true },
        { name: "Mediterranean Sea", lon: 18.5248, lat: 37.1841, mag: 0.0, tsunami: true },
        { name: "Caribbean Basin", lon: -75.0232, lat: 17.8974, mag: 0.0, tsunami: true },
        { name: "Tonga Islands", lon: -175.1982, lat: -21.1789, mag: 0.0, tsunami: true }
    ];

    // Pick a random region
    const region = tsunamiRegions[Math.floor(Math.random() * tsunamiRegions.length)];
    
    // Forcibly close the sidebar immediately
    const sidebarElement = document.getElementById('offcanvasExample');
    const sidebar = bootstrap.Offcanvas.getInstance(sidebarElement);
    if (sidebar) {
        sidebar.hide();
    }
    
    // Fly to the tsunami location
    map.flyTo({
        center: [region.lon, region.lat],
        zoom: 6,
        duration: 3000,
        essential: true
    });
    
    // Show tsunami impact visualization
    showTsunamiImpact(region);
    
    showEmergencyNotification(region, 'tsunami', () => {
        // Clean up when notification is closed
        if (map.getLayer('tsunami-impact')) {
            map.removeLayer('tsunami-impact');
        }
        if (map.getSource('tsunami-impact-source')) {
            map.removeSource('tsunami-impact-source');
        }
    });
}


function showTsunamiImpact(region) {
    // Clean up any existing tsunami layers
    if (map.getLayer('tsunami-impact')) {
        map.removeLayer('tsunami-impact');
    }
    if (map.getSource('tsunami-impact-source')) {
        map.removeSource('tsunami-impact-source');
    }
    
    // Calculate tsunami radius based on magnitude (km)
    const tsunamiRadius = (region.mag > 0) ? (region.mag - 6.0) * 300 : 500; // Default radius for tsunami-only events
    
    try {
        // Create a circle representing tsunami impact area
        const impactCircle = {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'Polygon',
                'coordinates': [generateCircleCoordinates(region.lon, region.lat, tsunamiRadius)]
            }
        };
        
        // Add the tsunami impact as a new source
        map.addSource('tsunami-impact-source', {
            'type': 'geojson',
            'data': impactCircle
        });
        
        // Add the tsunami impact layer with RED color
        map.addLayer({
            'id': 'tsunami-impact',
            'type': 'fill',
            'source': 'tsunami-impact-source',
            'layout': {},
            'paint': {
                'fill-color': '#FF0000', // Changed to red
                'fill-opacity': 0.3,
                'fill-outline-color': '#CC0000' // Darker red for outline
            }
        });
        
    } catch (error) {
        console.error("Failed to create tsunami impact visualization:", error);
    }
}



function showEmergencyNotification(region, eventType = 'earthquake', onClose = null) {
    // Remove any existing notification
    if (activeNotification) {
        document.body.removeChild(activeNotification);
        activeNotification = null;
    }
    
    // Stop any currently playing alert sound
    if (activeAlertSound) {
        activeAlertSound.pause();
        activeAlertSound.currentTime = 0;
        activeAlertSound = null;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = eventType === 'tsunami' ? 
        'emergency-notification tsunami-notification' : 
        'emergency-notification';
    
    // Set notification content based on event type
    let title, magnitude, instructions;
    
    if (eventType === 'earthquake') {
        title = "MAJOR EARTHQUAKE ALERT";
        magnitude = `<span class="badge bg-danger">MAGNITUDE ${region.mag.toFixed(1)}</span>`;
        instructions = region.tsunami ? 
            "Move to higher ground immediately! Stay away from coastal areas." : 
            "Seek shelter under sturdy furniture or against an interior wall. Stay away from windows.";
    } else {
        title = "TSUNAMI ALERT";
        magnitude = `<span class="badge bg-primary">COASTAL THREAT</span>`;
        instructions = "Evacuate coastal areas immediately! Move to higher ground or inland.";
    }
    
    // Create notification content
    notification.innerHTML = `
        <div class="emergency-notification-header">
            <div class="emergency-notification-title">
                ${title}
            </div>
            <button class="emergency-notification-close" aria-label="Close">&times;</button>
        </div>
        <div class="emergency-notification-body">
            <div class="mb-2">
                ${magnitude}
            </div>
            <div class="emergency-notification-location">
                ${region.name}
                <div class="coordinates">
                    <small>${region.lat.toFixed(4)}°, ${region.lon.toFixed(4)}°</small>
                </div>
            </div>
            <strong>⚠️ EVACUATE NOW</strong>
            <div class="evacuation-info">
                ${instructions}
            </div>
        </div>
        <div class="emergency-actions">
            ${(region.tsunami && eventType === 'earthquake') ? 
                '<div class="tsunami-warning">TSUNAMI RISK</div>' : 
                ''}
            ${(eventType === 'tsunami') ? 
                '<div class="tsunami-warning tsunami-warning-blue">TSUNAMI WARNING</div>' : 
                ''}
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    activeNotification = notification;
    
    // Force reflow to enable transition
    notification.offsetHeight;
    
    // Show notification with animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Add close button functionality
    notification.querySelector('.emergency-notification-close').addEventListener('click', () => {
        // Stop audio when notification is closed
        if (activeAlertSound) {
            activeAlertSound.pause();
            activeAlertSound.currentTime = 0;
            activeAlertSound = null;
        }

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (activeNotification === notification) {
                activeNotification = null;
            }
            // Call the onClose callback if provided
            if (typeof onClose === 'function') {
                onClose();
            }
        }, 800); // Wait for transition to complete
    });
    
    // Play different alert sounds based on event type
    let audioSrc = 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'; // Default earthquake sound
    
    if (eventType === 'tsunami') {
        audioSrc = 'https://assets.mixkit.co/active_storage/sfx/918/918-preview.mp3';
    }
    
    try {
        const audio = new Audio(audioSrc);
        audio.volume = 0.5;
        activeAlertSound = audio; // Store reference to the current audio
        
        if (eventType === 'tsunami') {
            // Play twice for longer effect
            audio.addEventListener('ended', function() {
                if (activeAlertSound === audio) { // Only play again if still the active alert
                    this.currentTime = 0;
                    this.play();
                }
            }, { once: true });
        }
        
        audio.play();
    } catch (e) {
        console.warn('Could not play alert sound:', e);
    }
}


// Helper function to generate circle coordinates without requiring Turf.js
function generateCircleCoordinates(centerLon, centerLat, radiusKm, steps = 64) {
    const coordinates = [];
    const earthRadiusKm = 6371;
    
    for (let i = 0; i <= steps; i++) {
        const angle = (i * 360 / steps) * (Math.PI / 180);
        const dx = (radiusKm / earthRadiusKm) * Math.cos(angle);
        const dy = (radiusKm / earthRadiusKm) * Math.sin(angle);
        
        // Adjust for longitude getting narrower at higher latitudes
        const latRad = centerLat * (Math.PI / 180);
        const lonOffset = dx / Math.cos(latRad);
        
        coordinates.push([
            centerLon + lonOffset,
            centerLat + dy
        ]);
    }
    
    return coordinates;
}

// Modern Easter Egg: UFO Animation
function triggerUFOAnimation() {
    // Show warning overlay
    const warning = document.getElementById("easter-egg-warning");
    warning.classList.remove("hidden");
    warning.classList.add("show");

    const ufoSound = new Audio('assets/Classic Alien Arrival Sound Effect.mp3');
    ufoSound.play();

    // Show and animate UFO after short delay
    setTimeout(() => {
        const ufo = document.getElementById("ufo-animation");
        ufo.classList.remove("hidden");
        ufo.classList.add("show");
    }, 1000);

    // Hide everything after animation completes
    setTimeout(() => {
        warning.classList.remove("show");
        setTimeout(() => {
            warning.classList.add("hidden");
            document.getElementById("ufo-animation").classList.add("hidden");
            document.getElementById("ufo-animation").classList.remove("show");
        }, 500);
    }, 8000);
}

// Helper function to detect Area 51 queries
function isArea51(query) {
    const lower = query.toLowerCase();
    return lower.includes("area 51") || 
           lower.includes("groom lake") || 
           lower.includes("37.24") || 
           lower.includes("-115.81") ||
           lower.includes("nevada test site") ||
           lower.includes("dreamland");
}

// Auto-trigger on specific search terms (integrate this into your search function)
//function handleSearch(query) {
//    if (isArea51(query)) {
//        setTimeout(() => triggerUFOAnimation(), 500);
//    }
//    // Continue with normal search logic...
//}

// Optional: Add sound effects (uncomment if you have audio files)

function playUFOSound() {
    const audio = new Audio('assets/Classic Alien Arrival Sound Effect.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
}


let isSkynetActive = false;

// Main Skynet trigger function
function triggerSkynetMode() {
    if (isSkynetActive) return;
    
    isSkynetActive = true;
    
    // Phase 1: Show system alert
    showSystemAlert();
    

    playRogueSound(); // Play alert sound
    // Phase 2: Activate rogue mode after 1 second
    setTimeout(() => {
        activateRogueMode();
    }, 1000);
    
    // Phase 3: Show Skynet overlay after 2 seconds
    setTimeout(() => {
        showSkynetOverlay();
    }, 2000);
    
    // Phase 4: Recovery after 8 seconds total
    setTimeout(() => {
        initiateRecovery();
    }, 8000);
}

// Show system alert
function showSystemAlert() {
    const alert = document.getElementById('system-alert');
    alert.classList.add('show');
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

// Activate rogue/hacked mode
function activateRogueMode() {
    document.body.classList.add('rogue-mode');
    
    // Start matrix rain
    const matrixRain = document.getElementById('matrix-rain');
    matrixRain.classList.add('active');
    generateMatrixRain();
    
    // Start glitch overlay
    const glitchOverlay = document.getElementById('glitch-overlay');
    glitchOverlay.classList.add('active');
    
    // Optional: Play rogue sound
    // playRogueSound();
}

// Show Skynet terminal overlay
function showSkynetOverlay() {
    const overlay = document.getElementById('skynet-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');
}

// Generate matrix rain effect
function generateMatrixRain() {
    const container = document.getElementById('matrix-rain');
    const characters = '01SKYNET█▀▄▌▐░▒▓TERMINATED';
    
    for (let i = 0; i < 20; i++) {
        const column = document.createElement('div');
        column.className = 'matrix-column';
        column.style.left = Math.random() * 100 + 'vw';
        column.style.animationDuration = (Math.random() * 3 + 2) + 's';
        column.style.animationDelay = Math.random() * 2 + 's';
        
        let columnText = '';
        for (let j = 0; j < 20; j++) {
            columnText += characters[Math.floor(Math.random() * characters.length)] + '<br>';
        }
        column.innerHTML = columnText;
        
        container.appendChild(column);
    }
}

// Recovery sequence
function initiateRecovery() {
    // Flash effect
    const flash = document.getElementById('recovery-flash');
    flash.classList.add('flash');
    
    setTimeout(() => {
        flash.classList.remove('flash');
        
        // Remove all rogue effects
        document.body.classList.remove('rogue-mode');
        document.getElementById('skynet-overlay').classList.remove('active');
        document.getElementById('matrix-rain').classList.remove('active');
        document.getElementById('glitch-overlay').classList.remove('active');
        
        // Hide overlay
        setTimeout(() => {
            document.getElementById('skynet-overlay').classList.add('hidden');
            document.getElementById('matrix-rain').innerHTML = '';
            isSkynetActive = false;
        }, 500);
        
    }, 250);
}

// Handle search input
//function handleSearchInput(value) {
//
//    const lowerQuery = query.toLowerCase()
//     // Check for "skynet" input
//     if (lowerQuery.includes("skynet")) {
//        trackSkynetActivations();
//
//        // Optional: Trigger extreme rogue mode
//        extremeRogueMode();
//
//        // Display a warning or message
//        const warning = document.getElementById("easter-egg-warning");
//        warning.textContent = "🤖 Skynet has been activated!";
//        warning.classList.remove("hidden");
//        warning.classList.add("show");
//
//        // Hide warning after 8 seconds
//        setTimeout(() => {
//            warning.classList.remove("show");
//            warning.classList.add("hidden");
//        }, 8000);
//
//        return; // Exit early if "skynet" is detected
//    }
//}

// Helper function to detect skynet keywords
function isSkynetKeyword(query) {
    const keywords = ['skynet', 'terminator', 'ai uprising', 'machine learning takeover', 'artificial intelligence'];
    const lower = query.toLowerCase();
    return keywords.some(keyword => lower.includes(keyword));
}

// Integration with main search function
//function handleMainSearch(query) {
//    if (isSkynetKeyword(query)) {
//        setTimeout(() => triggerSkynetMode(), 300);
//    }
//    // Continue with normal search logic...
//}

// Optional: Add creepy sound effects

function playRogueSound() {
    const audio = new Audio('assets/ALERT WARNING SOUND EFFECT _ NO COPYRIGHT.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
}


// Optional: More aggressive takeover mode
function extremeRogueMode() {
    // Disable all buttons temporarily
    const buttons = document.querySelectorAll('button, input');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
    });
    
    // Re-enable after recovery
    setTimeout(() => {
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.cursor = 'pointer';
        });
    }, 8000);
}

// Easter egg counter (optional)
let skynetActivationCount = 0;
function trackSkynetActivations() {
    skynetActivationCount++;
    if (skynetActivationCount >= 3) {
        console.log('🤖 The machines are learning... resistance is futile!');
    }
}