const API_BASE_URL = 'http://localhost:8000/api';
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// Check if user is logged in and is an 'admin'
if (!currentUser || currentUser.role !== 'admin') {
    // If not an admin, clear the local storage and redirect to the login page
    localStorage.clear();
    window.location.href = 'index.html'; // Or whatever your login page is named
}

const districtSelect = document.getElementById('district-select');
const constituencySelect = document.getElementById('constituency-select');
const wardSelect = document.getElementById('ward-select');
const electionTypeSelect = document.getElementById('election-type-select');
const resultsTableContainer = document.getElementById('results-table-container');
const pieChartCanvas = document.getElementById('presidential-pie-chart');
const chartNoDataMsg = document.getElementById('chart-no-data');
const refreshBtn = document.getElementById('refresh-btn');

let presidentialChart;
Chart.register(ChartDataLabels);

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

function displayResultsTable(results) {
    resultsTableContainer.innerHTML = '';
    if (results.length === 0) {
        resultsTableContainer.innerHTML = '<p class="no-data">No results found for the selected filters.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = table.createTHead();
    const tbody = table.createTBody();

    const headerRow = thead.insertRow();
    ['Candidate', 'Party', 'Total Votes'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    results.forEach(result => {
        const row = tbody.insertRow();
        row.insertCell().textContent = result.candidate_name;
        row.insertCell().textContent = result.party;
        row.insertCell().textContent = result.total_votes.toLocaleString();
    });

    resultsTableContainer.appendChild(table);
}

async function fetchPresidentialPieChartData() {
    const presidentialResults = await fetchData('presidential-results');
    if (presidentialResults.length === 0) {
        pieChartCanvas.style.display = 'none';
        chartNoDataMsg.style.display = 'block';
        if (presidentialChart) presidentialChart.destroy();
        return;
    }

    pieChartCanvas.style.display = 'block';
    chartNoDataMsg.style.display = 'none';

    const labels = presidentialResults.map(r => `${r.candidate_name} (${r.party})`);
    const data = presidentialResults.map(r => r.total_votes);
    const partyColors = { 'DPP':'#2563eb','UTM':'#ef4444','UDF':'#facc15','PP':'#f97316','MCP':'#16a34a' };
    const fallbackColors = ['#8b5cf6','#0ea5e9','#14b8a6','#84cc16','#ec4899','#10b981'];
    const backgroundColors = presidentialResults.map((r,i) => partyColors[r.party] || fallbackColors[i % fallbackColors.length]);

    if (presidentialChart) presidentialChart.destroy();

    presidentialChart = new Chart(pieChartCanvas, {
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: backgroundColors, 
                hoverOffset: 6,
                borderWidth: 1,
                borderColor: '#fff'
            }] 
        },
        options: {
            responsive: true,
            animation: {
                animateRotate: true,
                animateScale: true
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 8
                        },
                        padding: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset.data;
                            const total = dataset.reduce((sum, val) => sum + Number(val), 0);
                            const value = Number(context.parsed);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                            return `${context.label}: ${value.toLocaleString()} votes (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            cutout: '30%'
        }
    });
}

async function fetchResults() {
    const districtId = districtSelect.value;
    const constituencyId = constituencySelect.value;
    const wardId = wardSelect.value;
    const electionType = electionTypeSelect.value;

    let url = `results?election_type=${electionType}`;
    if (districtId !== 'all') url += `&district_id=${districtId}`;
    if (constituencyId !== 'all') url += `&constituency_id=${constituencyId}`;
    if (wardId !== 'all') url += `&ward_id=${wardId}`;

    const results = await fetchData(url);
    displayResultsTable(results);
}

// Central function to handle all data refreshing
async function refreshDashboard() {
    await fetchResults();
    await fetchPresidentialPieChartData();
}

// Initial population of filters and data
async function populateFilters() {
    const districts = await fetchData('districts');
    constituencySelect.innerHTML = '<option value="all">Select Constituency</option>';
    wardSelect.innerHTML = '<option value="all">Select Ward</option>';
    districtSelect.innerHTML = '<option value="all">All Districts</option>';
    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district.district_id;
        option.textContent = district.district_name;
        districtSelect.appendChild(option);
    });

    // Initial load of all data
    await refreshDashboard();
}

// Event listeners
districtSelect.addEventListener('change', refreshDashboard);
constituencySelect.addEventListener('change', refreshDashboard);
wardSelect.addEventListener('change', refreshDashboard);
electionTypeSelect.addEventListener('change', refreshDashboard);
refreshBtn.addEventListener('click', refreshDashboard);

// Run the initial setup
populateFilters();


