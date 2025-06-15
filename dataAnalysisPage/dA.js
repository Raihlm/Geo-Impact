document.addEventListener('DOMContentLoaded', function() {
        // Initialize global variables
    let earthquakeData = [];
    const loadingIndicator = document.getElementById('loading-indicator');
        
        // Set up magnitude filter display value
    const magnitudeFilter = document.getElementById('magnitude-filter');
    const magnitudeValue = document.getElementById('magnitude-value');
    magnitudeValue.textContent = magnitudeFilter.value;
        
    let currentPage = 1;
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');


        // Set default date range (7 days ago to today)
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Format dates correctly for the input
    startDateInput.valueAsDate = sevenDaysAgo;
    endDateInput.valueAsDate = today;

    // Add event listeners for date filtering
    startDateInput.addEventListener('change', function() {
        currentPage = 1; // Reset to first page when filter changes
        filterAndDisplayData();
    });

    endDateInput.addEventListener('change', function() {
        currentPage = 1; // Reset to first page when filter changes
        filterAndDisplayData();
    });

    // Setup pagination event handlers - add inside DOMContentLoaded
    document.getElementById('prev-page').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            filterAndDisplayData();
        }
    });

    document.getElementById('next-page').addEventListener('click', function() {
        const pageSize = parseInt(document.getElementById('page-size').value);
        const filteredData = getFilteredData();
        const maxPage = Math.ceil(filteredData.length / pageSize);
        
        if (currentPage < maxPage) {
            currentPage++;
            filterAndDisplayData();
        }
    });

    document.getElementById('page-size').addEventListener('change', function() {
        currentPage = 1; // Reset to first page when changing page size
        filterAndDisplayData();
    });

    // Add this helper function for filter logic
    function getFilteredData() {
        const minMagnitude = parseFloat(document.getElementById('magnitude-filter').value);
        const locationSearch = document.getElementById('location-search').value.toLowerCase();
        const startDate = document.getElementById('start-date').valueAsDate;
        const endDate = document.getElementById('end-date').valueAsDate;
        
        // Add one day to end date to make it inclusive
        let adjustedEndDate = null;
        if (endDate) {
            adjustedEndDate = new Date(endDate);
            adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        }
        
        return earthquakeData.filter(quake => {
            // Magnitude filter
            const passedMagnitude = quake.magnitude !== null && quake.magnitude >= minMagnitude;
            
            // Date range filter
            let passedDateRange = true;
            if (startDate && quake.time < startDate) passedDateRange = false;
            if (adjustedEndDate && quake.time > adjustedEndDate) passedDateRange = false;
            
            // Location search filter
            const passedLocationSearch = !locationSearch || 
                (quake.place && quake.place.toLowerCase().includes(locationSearch));
                
            return passedMagnitude && passedDateRange && passedLocationSearch;
        });
    }

        magnitudeFilter.addEventListener('input', function() {
            magnitudeValue.textContent = this.value;
            filterAndDisplayData();
        });
        
        // Set up time range change handler
        document.getElementById('time-range').addEventListener('change', function() {
            fetchEarthquakeData();
        });
        
        // Refresh button handler
        document.getElementById('btn-refresh-data').addEventListener('click', function() {
            fetchEarthquakeData();
        });
        
        // Export CSV handler
        document.getElementById('export-csv').addEventListener('click', function() {
            exportToCSV();
        });
        
        // Initial data fetch
        fetchEarthquakeData();
        
        /**
         * Fetches earthquake data from the API based on the selected time range
         */
        function fetchEarthquakeData() {
            showLoading();
            
            const timeRange = document.getElementById('time-range').value;
            let apiUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';
            
            switch(timeRange) {
                case 'day':
                    apiUrl += 'all_day.geojson';
                    break;
                case 'month':
                    apiUrl += 'all_month.geojson';
                    break;
                default: // week
                    apiUrl += 'all_week.geojson';
                    break;
            }
            
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    earthquakeData = data.features.map(feature => {
                        return {
                            id: feature.id,
                            time: new Date(feature.properties.time),
                            magnitude: feature.properties.mag,
                            depth: feature.geometry.coordinates[2],
                            place: feature.properties.place,
                            longitude: feature.geometry.coordinates[0],
                            latitude: feature.geometry.coordinates[1],
                            url: feature.properties.url,
                            felt: feature.properties.felt,
                            tsunami: feature.properties.tsunami,
                            region: extractRegion(feature.properties.place)
                        };
                    });
                    
                    // Filter and display the data
                    filterAndDisplayData();
                    hideLoading();
                })
                .catch(error => {
                    console.error('Error fetching earthquake data:', error);
                    hideLoading();
                    alert('Failed to fetch earthquake data. Please try again later.');
                });
        }
        
    function filterAndDisplayData() {
        const filteredData = getFilteredData();
        
        // Update summary statistics
        updateSummaryStats(filteredData);
        
        // Update charts
        updateMagnitudeChart(filteredData);
        updateDepthMagnitudeChart(filteredData);
        updateTimeChart(filteredData);
        updateRegionChart(filteredData);
        
        // Update table with pagination
        updateEventsTable(filteredData);
    }
        /**
         * Updates the summary statistics
         */
        function updateSummaryStats(data) {
            document.getElementById('event-count').querySelector('.summary-value').textContent = data.length;
            
            if (data.length > 0) {
                const maxMag = Math.max(...data.map(quake => quake.magnitude || 0));
                document.getElementById('max-magnitude').querySelector('.summary-value').textContent = 
                    maxMag.toFixed(1);
                
                const validDepths = data.filter(quake => quake.depth !== null).map(quake => quake.depth);
                if (validDepths.length > 0) {
                    const avgDepth = validDepths.reduce((sum, depth) => sum + depth, 0) / validDepths.length;
                    document.getElementById('avg-depth').querySelector('.summary-value').textContent = 
                        avgDepth.toFixed(1);
                } else {
                    document.getElementById('avg-depth').querySelector('.summary-value').textContent = 'N/A';
                }
                
                // Count unique countries/regions
                const uniqueRegions = new Set(data.map(quake => quake.region));
                document.getElementById('affected-countries').querySelector('.summary-value').textContent = 
                    uniqueRegions.size;
                
                // Count tsunami warnings in the past 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const tsunamiWarnings = data
                    .filter(quake => quake.time >= thirtyDaysAgo && quake.tsunami === 1)
                    .length;
                
                const tsunamiElement = document.getElementById('tsunami-warnings').querySelector('.summary-value');
                tsunamiElement.textContent = tsunamiWarnings;
                
                // Update visual indicator for tsunami warnings
                if (tsunamiWarnings > 0) {
                    tsunamiElement.classList.add('bg-danger');
                    tsunamiElement.classList.remove('bg-secondary');
                } else {
                    tsunamiElement.classList.remove('bg-danger');
                    tsunamiElement.classList.add('bg-secondary');
                }
            } else {
                document.getElementById('max-magnitude').querySelector('.summary-value').textContent = 'N/A';
                document.getElementById('avg-depth').querySelector('.summary-value').textContent = 'N/A';
                document.getElementById('affected-countries').querySelector('.summary-value').textContent = 'N/A';
                document.getElementById('tsunami-warnings').querySelector('.summary-value').textContent = '0';
            }
        }
        
        /**
         * Updates the magnitude distribution chart
         */
        function updateMagnitudeChart(data) {
            const ctx = document.getElementById('magnitude-chart').getContext('2d');
            
            // Create magnitude bins
            const bins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
            const counts = Array(bins.length - 1).fill(0);
            
            data.forEach(quake => {
                if (quake.magnitude !== null) {
                    const binIndex = Math.min(Math.floor(quake.magnitude), bins.length - 2);
                    counts[binIndex]++;
                }
            });
            
            // Labels for the chart
            const labels = [];
            for (let i = 0; i < bins.length - 1; i++) {
                labels.push(`${bins[i]}-${bins[i+1]}`);
            }
            
            // Destroy previous chart if it exists
            if (window.magnitudeChart) {
                window.magnitudeChart.destroy();
            }
            
            // Create new chart
            window.magnitudeChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Earthquakes',
                        data: counts,
                        backgroundColor: 'rgba(77, 171, 247, 0.6)',
                        borderColor: '#4dabf7',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#adb5bd'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#adb5bd'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)'
                        }
                    }
                }
            });
        }
        
        /**
         * Updates the depth vs. magnitude scatter chart
         */
        function updateDepthMagnitudeChart(data) {
            const ctx = document.getElementById('depth-mag-chart').getContext('2d');
            
            // Prepare data for scatter plot
            const chartData = data.filter(quake => quake.depth !== null && quake.magnitude !== null)
                .map(quake => {
                    return {
                        x: quake.depth,
                        y: quake.magnitude
                    };
                });
            
            // Destroy previous chart if it exists
            if (window.depthMagChart) {
                window.depthMagChart.destroy();
            }
            
            // Create new chart
            window.depthMagChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Earthquakes',
                        data: chartData,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: '#ff6384',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Magnitude',
                                color: '#adb5bd'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#adb5bd'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Depth (km)',
                                color: '#adb5bd'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#adb5bd'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            callbacks: {
                                label: function(context) {
                                    return `Depth: ${context.parsed.x.toFixed(1)} km, Magnitude: ${context.parsed.y.toFixed(1)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        /**
         * Updates the events over time chart
         */
        function updateTimeChart(data) {
            const ctx = document.getElementById('time-chart').getContext('2d');
            
            // Group events by day
            const eventsByDay = {};
            
            data.forEach(quake => {
                const date = quake.time.toISOString().split('T')[0];
                if (!eventsByDay[date]) {
                    eventsByDay[date] = 0;
                }
                eventsByDay[date]++;
            });
            
            // Sort dates and prepare data for chart
            const sortedDates = Object.keys(eventsByDay).sort();
            const counts = sortedDates.map(date => eventsByDay[date]);
            
            // Format dates for display
            const formattedDates = sortedDates.map(date => {
                const d = new Date(date);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            });
            
            // Destroy previous chart if it exists
            if (window.timeChart) {
                window.timeChart.destroy();
            }
            
            // Create new chart
            window.timeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: formattedDates,
                    datasets: [{
                        label: 'Number of Events',
                        data: counts,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: '#4bc0c0',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#adb5bd'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#adb5bd',
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)'
                        }
                    }
                }
            });
        }
        
        /**
         * Updates the events by region chart
         */
        function updateRegionChart(data) {
            const ctx = document.getElementById('region-chart').getContext('2d');
            
            // Count events by region
            const regionCounts = {};
            
            data.forEach(quake => {
                if (!regionCounts[quake.region]) {
                    regionCounts[quake.region] = 0;
                }
                regionCounts[quake.region]++;
            });
            
            // Sort regions by count and take top 10
            const sortedRegions = Object.keys(regionCounts)
                .sort((a, b) => regionCounts[b] - regionCounts[a])
                .slice(0, 10);
            
            const regionLabels = sortedRegions;
            const regionData = sortedRegions.map(region => regionCounts[region]);
            
            // Random colors for regions
            const backgroundColors = [
                '#4dabf7', '#ff6384', '#ffcd56', '#4bc0c0', '#36a2eb',
                '#9966ff', '#ff9f40', '#c9cbcf', '#7950f2', '#fa5252'
            ];
            
            // Destroy previous chart if it exists
            if (window.regionChart) {
                window.regionChart.destroy();
            }
            
            // Create new chart
            window.regionChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: regionLabels,
                    datasets: [{
                        data: regionData,
                        backgroundColor: backgroundColors,
                        borderColor: '#2c3034',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#adb5bd',
                                boxWidth: 15,
                                padding: 10
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)'
                        }
                    }
                }
            });
        }
        
        function updateEventsTable(data) {
        const tableBody = document.getElementById('events-table');
        tableBody.innerHTML = '';
        
        // Sort by time, most recent first
        const sortedData = [...data].sort((a, b) => b.time - a.time);
        
        // Calculate pagination
        const pageSize = parseInt(document.getElementById('page-size').value);
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, sortedData.length);
        
        // Get current page of data
        const displayData = sortedData.slice(startIdx, endIdx);
        
        // Update page indicator
        const maxPage = Math.max(1, Math.ceil(sortedData.length / pageSize));
        document.getElementById('page-indicator').textContent = `${currentPage} / ${maxPage}`;
        
        // Update button states
        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= maxPage;
        
        if (displayData.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'text-center py-4';
            cell.textContent = 'No earthquake data matches your current filters';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        
        displayData.forEach(quake => {
            // Create table row for each earthquake (keeping your existing code)
            const row = document.createElement('tr');
            
            // Format the time
            const timeCell = document.createElement('td');
            timeCell.textContent = formatDate(quake.time);
            row.appendChild(timeCell);
            
            // Location
            const locationCell = document.createElement('td');
            locationCell.textContent = quake.place || 'Unknown';
            row.appendChild(locationCell);
            
            // Magnitude with color coding
            const magCell = document.createElement('td');
            const magSpan = document.createElement('span');
            magSpan.textContent = quake.magnitude ? quake.magnitude.toFixed(1) : 'N/A';
            magSpan.className = getMagnitudeClass(quake.magnitude);
            magCell.appendChild(magSpan);
            row.appendChild(magCell);
            
            // Depth
            const depthCell = document.createElement('td');
            depthCell.textContent = quake.depth ? `${quake.depth.toFixed(1)}` : 'N/A';
            row.appendChild(depthCell);
            
            // Details link
            const detailsCell = document.createElement('td');
            const detailsLink = document.createElement('a');
            detailsLink.href = quake.url;
            detailsLink.target = '_blank';
            detailsLink.textContent = 'View';
            detailsLink.className = 'btn btn-sm btn-outline-info';
            detailsCell.appendChild(detailsLink);
            row.appendChild(detailsCell);
            
            tableBody.appendChild(row);

            if (quake.tsunami === 1) {
                const tsunamiIcon = document.createElement('span');
                tsunamiIcon.innerHTML = ' <i class="bi bi-tsunami text-danger" title="Tsunami warning issued"></i>';
                magCell.appendChild(tsunamiIcon);

                row.classList.add('tsunami-warning-row');
            }
        });
    }
        
        /**
         * Exports filtered earthquake data to CSV
         */
        function exportToCSV() {
            const minMagnitude = parseFloat(document.getElementById('magnitude-filter').value);
            
            // Filter data based on magnitude
            const filteredData = earthquakeData.filter(quake => {
                return quake.magnitude !== null && quake.magnitude >= minMagnitude;
            });
            
            if (filteredData.length === 0) {
                alert('No data to export.');
                return;
            }
            
            // Create CSV content
            let csvContent = 'data:text/csv;charset=utf-8,';
            csvContent += 'Time (UTC),Place,Magnitude,Depth (km),Latitude,Longitude,Tsunami,URL\n';
            
            filteredData.forEach(quake => {
                const row = [
                    quake.time.toISOString(),
                    `"${quake.place || 'Unknown'}"`,
                    quake.magnitude ? quake.magnitude.toFixed(1) : 'N/A',
                    quake.depth ? quake.depth.toFixed(1) : 'N/A',
                    quake.latitude ? quake.latitude.toFixed(4) : 'N/A',
                    quake.longitude ? quake.longitude.toFixed(4) : 'N/A',
                    quake.tsunami ? 'Yes' : 'No',
                    quake.url
                ];
                csvContent += row.join(',') + '\n';
            });
            
            // Create download link
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `earthquake_data_${formatDateFilename(new Date())}.csv`);
            document.body.appendChild(link);
            
            // Trigger download and clean up
            link.click();
            document.body.removeChild(link);
        }
        
        /**
         * Extracts region from place description
         */
        function extractRegion(place) {
            if (!place) return 'Unknown';
            
            // Check if place contains a comma
            if (place.includes(',')) {
                // Take the part after the comma, which is usually the region/country
                return place.split(',')[1].trim();
            }
            
            // If no comma, look for common separators
            const separators = [' of ', ' near '];
            for (const separator of separators) {
                if (place.includes(separator)) {
                    return place.split(separator)[1].trim();
                }
            }
            
            // Default to the full place if no pattern matches
            return place;
        }
        
        /**
         * Returns a CSS class based on magnitude
         */
        function getMagnitudeClass(magnitude) {
            if (!magnitude) return '';
            if (magnitude >= 6) return 'badge bg-danger';
            if (magnitude >= 5) return 'badge bg-warning text-dark';
            if (magnitude >= 3) return 'badge bg-info text-dark';
            return 'badge bg-secondary';
        }
        
        /**
         * Formats a date for display
         */
        function formatDate(date) {
            return date.toISOString().replace('T', ' ').substr(0, 19);
        }
        
        /**
         * Formats a date for use in filenames
         */
        function formatDateFilename(date) {
            return date.toISOString().split('T')[0];
        }
        
        /**
         * Shows the loading indicator
         */
        function showLoading() {
            loadingIndicator.style.display = 'flex';
        }
        
        /**
         * Hides the loading indicator
         */
        function hideLoading() {
            loadingIndicator.style.display = 'none';
        }

        const tsunamiFilterBtn = document.getElementById('tsunami-filter');
tsunamiFilterBtn.addEventListener('click', function() {
    // Toggle active state
    const isActive = tsunamiFilterBtn.getAttribute('data-active') === 'true';
    tsunamiFilterBtn.setAttribute('data-active', !isActive);
    
    // Update button appearance
    if (!isActive) {
        tsunamiFilterBtn.classList.remove('btn-outline-danger');
        tsunamiFilterBtn.classList.add('btn-danger');
    } else {
        tsunamiFilterBtn.classList.add('btn-outline-danger');
        tsunamiFilterBtn.classList.remove('btn-danger');
    }
    
    // Reset to first page when filter changes
    currentPage = 1;
    
    // Apply filter and refresh data display
    filterAndDisplayData();
});

// Update the getFilteredData function to include tsunami filter
function getFilteredData() {
    const minMagnitude = parseFloat(document.getElementById('magnitude-filter').value);
    const locationSearch = document.getElementById('location-search').value.toLowerCase();
    const startDate = document.getElementById('start-date').valueAsDate;
    const endDate = document.getElementById('end-date').valueAsDate;
    const tsunamiFilterActive = document.getElementById('tsunami-filter').getAttribute('data-active') === 'true';
    
    // Add one day to end date to make it inclusive
    let adjustedEndDate = null;
    if (endDate) {
        adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
    }
    
    return earthquakeData.filter(quake => {
        // Magnitude filter
        const passedMagnitude = quake.magnitude !== null && quake.magnitude >= minMagnitude;
        
        // Date range filter
        let passedDateRange = true;
        if (startDate && quake.time < startDate) passedDateRange = false;
        if (adjustedEndDate && quake.time > adjustedEndDate) passedDateRange = false;
        
        // Location search filter
        const passedLocationSearch = !locationSearch || 
            (quake.place && quake.place.toLowerCase().includes(locationSearch));
            
        // Tsunami filter
        const passedTsunamiFilter = !tsunamiFilterActive || quake.tsunami === 1;
            
        return passedMagnitude && passedDateRange && passedLocationSearch && passedTsunamiFilter;
    });
}
});

document.querySelectorAll('.chart-container').forEach(container => {
    // Add class to region chart container
    if (container.querySelector('#region-chart')) {
        container.classList.add('region-chart-container');
    }
});

// Update chart options for better fitting
function getChartConfig() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 5,
                right: 15,
                bottom: 15,
                left: 15
            }
        }
    };
}