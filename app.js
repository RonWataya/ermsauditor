document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Check if user is logged in and is an 'auditor'
    if (!currentUser || currentUser.role !== 'auditor') {
        localStorage.clear();
        window.location.href = 'index.html';
    }

    // Define the district mapping for each auditor
    const auditorDistrictMap = {
        "AuditorNorth": [1, 2, 3, 4, 5, 6, 7, 8],
        "AuditorCentral": [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        "AuditorEast": [19, 20, 21, 22, 23, 24, 27],
        "AuditorSouth": [25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36]
    };

    // Get the district IDs for the current logged-in auditor
    const allowedDistricts = auditorDistrictMap[currentUser.username] || [];

    // Function to handle logout
    function logout() {
        localStorage.clear();
        window.location.href = 'index.html';
    }

    // Manual refresh button event listener
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Attach the logout function to the logout button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Show/hide loading overlay
    function showLoading(show = true) {
        const overlay = document.getElementById("loading-overlay");
        if (show) overlay.classList.remove("hidden");
        else overlay.classList.add("hidden");
    }

    // Show custom message box
    function showMessage(message, onOk = null) {
        const box = document.getElementById("message-box");
        const text = document.getElementById("message-text");
        text.innerText = message;
        box.classList.remove("hidden");

        document.getElementById("message-ok-btn").onclick = () => {
            box.classList.add("hidden");
            if (onOk) onOk();
        };
    }

    const submissionsList = document.getElementById("submissions-list");
    const candidatesTable = document.getElementById("candidates-table");
    const auditForm = document.getElementById("audit-form");
    const electionTabs = document.getElementById("election-tabs");
    const noSubmissionMessage = document.getElementById("no-submission-message");
    const submissionDetails = document.getElementById("submission-details");
    const verifyBtn = document.getElementById("verify-btn");
    const rejectBtn = document.getElementById("reject-btn");

    const filterDistrict = document.getElementById("filter-district");
    const filterConstituency = document.getElementById("filter-constituency");
    const filterWard = document.getElementById("filter-ward");
    const filterCenter = document.getElementById("filter-center");
    const filterStatus = document.getElementById("filter-status");

    let currentSession = null;
    let currentElection = null;

    // Helper function to fetch data from API
    async function fetchData(url) {
        showLoading(true);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Fetch error:", error);
            showMessage("An error occurred while fetching data.");
            return [];
        } finally {
            showLoading(false);
        }
    }

    // Populate filter dropdowns
   // Populate filter dropdowns
    async function populateFilters() {
        const districts = await fetchData(`http://localhost:8000/api/districts?districtIds=${allowedDistricts.join(',')}`);
        
        // Clear existing options, preserving the "All" option
        const initialOption = filterDistrict.querySelector('option[value=""]');
        filterDistrict.innerHTML = '';
        if (initialOption) filterDistrict.appendChild(initialOption);

        populateSelect(filterDistrict, districts, 'district_id', 'district_name');

        filterDistrict.addEventListener("change", async () => {
            const districtId = filterDistrict.value;
            const constituencies = districtId ? await fetchData(`http://localhost:8000/api/constituencies?districtId=${districtId}`) : [];
            populateSelect(filterConstituency, constituencies, 'constituency_id', 'constituency_name');
            populateSelect(filterWard, [], 'ward_id', 'ward_name');
            populateSelect(filterCenter, [], 'polling_center_id', 'polling_center_name');
            loadSubmissions();
        });

        filterConstituency.addEventListener("change", async () => {
            const constituencyId = filterConstituency.value;
            const wards = constituencyId ? await fetchData(`http://localhost:8000/api/wards?constituencyId=${constituencyId}`) : [];
            populateSelect(filterWard, wards, 'ward_id', 'ward_name');
            populateSelect(filterCenter, [], 'polling_center_id', 'polling_center_name');
            loadSubmissions();
        });

        filterWard.addEventListener("change", async () => {
            const wardId = filterWard.value;
            const pollingCenters = wardId ? await fetchData(`http://localhost:8000/api/polling_centers?wardId=${wardId}`) : [];
            populateSelect(filterCenter, pollingCenters, 'polling_center_id', 'polling_center_name');
            loadSubmissions();
        });

        filterCenter.addEventListener("change", loadSubmissions);
        filterStatus.addEventListener("change", loadSubmissions);
    }

    function populateSelect(selectElement, data, valueKey, textKey) {
        const initialOption = selectElement.querySelector('option[value=""]');
        selectElement.innerHTML = '';
        if (initialOption) selectElement.appendChild(initialOption);
        else {
            const allOption = document.createElement("option");
            allOption.value = "";
            allOption.innerText = `All ${textKey.replace('_id', '').replace('_', ' ')}s`;
            selectElement.appendChild(allOption);
        }
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = item[valueKey];
            option.innerText = item[textKey];
            selectElement.appendChild(option);
        });
    }

    // Load submissions based on filters and auditor's districts
    async function loadSubmissions() {
        const filters = {
            districtId: filterDistrict.value,
            constituencyId: filterConstituency.value,
            wardId: filterWard.value,
            pollingCenterId: filterCenter.value,
            status: filterStatus.value,
            allowedDistricts: allowedDistricts.join(',') // Add allowed districts to the filter
        };
        const params = new URLSearchParams(filters).toString();
        const submissions = await fetchData(`http://localhost:8000/api/submissions?${params}`);

        submissionsList.innerHTML = "";
        if (submissions.length === 0) {
            submissionsList.innerHTML = `<p class="text-center text-gray-500 p-4">No submissions found.</p>`;
        } else {
            submissions.forEach(session => {
                const div = document.createElement("div");
                const pollingCenterName = session.polling_center_name || 'N/A';
                let statusClass = '';
                let statusIcon = '';
                
                const verified = session.verified_count;
                const rejected = session.rejected_count;
                const total = session.total_elections;

                if (verified === total) {
                    statusClass = 'verified';
                    statusIcon = '<i class="fa-solid fa-circle-check text-green-500"></i>';
                } else if (rejected > 0) {
                    statusClass = 'rejected';
                    statusIcon = '<i class="fa-solid fa-circle-xmark text-red-500"></i>';
                } else {
                    statusClass = 'unverified';
                    statusIcon = '<i class="fa-solid fa-hourglass-half text-yellow-500"></i>';
                }

                div.className = `submission-item p-4 border-b last:border-b-0 flex items-center gap-4 ${statusClass}`;
                div.dataset.id = session.session_id;
                div.innerHTML = `
                    <div class="flex-grow">
                        <h6 class="text-sm font-semibold">${pollingCenterName}</h6>
                        <p class="text-xs text-gray-500">${session.district_name || 'N/A'}, ${session.constituency_name || 'N/A'}</p>
                    </div>
                    ${statusIcon}
                `;
                div.onclick = () => loadSession(session.session_id);
                submissionsList.appendChild(div);
            });
        }
    }

    // Load details for a specific submission session
    async function loadSession(sessionId) {
        showLoading(true);
        const data = await fetchData(`http://localhost:8000/api/submissions/${sessionId}`);
        showLoading(false);
        if (data.length === 0) {
            submissionDetails.classList.add("hidden");
            noSubmissionMessage.classList.remove("hidden");
            return;
        }

        currentSession = data;
        currentElection = data[0];

        const pollingCenterInfo = currentSession[0].polling_center_name || 'N/A';
        document.getElementById("polling-center-title").innerText = `Audit for ${pollingCenterInfo}`;
        
        const monitorName = currentSession[0]?.monitor_name || 'N/A';
        document.getElementById("monitor-info").innerText = `Monitor: ${monitorName}`;
        
        renderElectionTabs(data);
        loadElectionResult(currentElection);

        submissionDetails.classList.remove("hidden");
        noSubmissionMessage.classList.add("hidden");
        
        document.querySelectorAll('.submission-item').forEach(item => {
            if (item.dataset.id === sessionId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function renderElectionTabs(elections) {
        electionTabs.innerHTML = "";
        elections.forEach((election, idx) => {
            const btn = document.createElement("button");
            const isVerified = election.is_verified === 1;
            const isRejected = election.is_verified === 2;

            btn.className = `tab-button py-2 px-4 rounded-full text-sm font-medium transition-colors duration-200`;
            
            if (isVerified) btn.classList.add('btn-success');
            else if (isRejected) btn.classList.add('btn-danger');
            else btn.classList.add(idx === 0 ? 'btn-primary' : 'btn-outline-primary');

            btn.innerText = (election.election_type || "N/A").replace("_", " ").toUpperCase();
            btn.disabled = isVerified || isRejected;
            btn.onclick = async () => {
                showLoading(true);
                currentElection = election;
                await loadElectionResult(election);
                updateTabButtons(btn);
                showLoading(false);
            };
            electionTabs.appendChild(btn);
        });
    }

    function updateTabButtons(activeBtn) {
        Array.from(electionTabs.children).forEach(c => {
            if (!c.classList.contains('btn-success') && !c.classList.contains('btn-danger')) {
                c.classList.replace('btn-primary', 'btn-outline-primary');
            }
        });
        if (!activeBtn.classList.contains('btn-success') && !activeBtn.classList.contains('btn-danger')) {
            activeBtn.classList.replace('btn-outline-primary', 'btn-primary');
        }
    }

    function loadElectionResult(result) {
        currentElection = result;
        candidatesTable.innerHTML = "";
        (result.candidates || []).forEach(c => {
            const row = document.createElement("tr");
            row.innerHTML = `<td class="py-2 px-4">${c.candidate_name || 'N/A'}</td><td class="py-2 px-4">${c.party || 'N/A'}</td><td class="py-2 px-4"><input type="number" class="w-20 p-1 border border-gray-300 rounded-md text-sm text-center" value="${c.votes_count}" data-candidate="${c.candidate_id}"></td>`;
            candidatesTable.appendChild(row);
        });

        document.getElementById("total-votes").value = result.total_votes_cast;
        document.getElementById("invalid-votes").value = result.invalid_votes;
        document.getElementById("unused-ballots").value = result.unused_ballots;
        document.getElementById("total-registered").value = result.total_registered_voters;
        document.getElementById("tally-img").src = `data:image/jpeg;base64,${result.paper_result_image_base64}`;

        if (result.is_verified === 1 || result.is_verified === 2) {
            verifyBtn.disabled = true;
            rejectBtn.disabled = true;
            auditForm.querySelectorAll('input').forEach(input => input.disabled = true);
        } else {
            verifyBtn.disabled = false;
            rejectBtn.disabled = false;
            auditForm.querySelectorAll('input').forEach(input => input.disabled = false);
        }
    }

    auditForm.addEventListener("submit", async e => {
        e.preventDefault();
        if (!currentElection) return;

        showLoading(true);
        const votes = [];
        candidatesTable.querySelectorAll("input").forEach(input => 
            votes.push({ candidate_id: input.dataset.candidate, votes_count: parseInt(input.value || 0) })
        );

        const payload = {
            result_id: currentElection.result_id,
            total_votes_cast: parseInt(document.getElementById("total-votes").value),
            invalid_votes: parseInt(document.getElementById("invalid-votes").value),
            unused_ballots: parseInt(document.getElementById("unused-ballots").value),
            total_registered_voters: parseInt(document.getElementById("total-registered").value),
            votes
        };

        try {
            const res = await fetch("http://localhost:8000/api/results/verify", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });
            const data = await res.json();
            showMessage(data.message, () => {
                loadSubmissions();
                submissionDetails.classList.add("hidden");
                noSubmissionMessage.classList.remove("hidden");
            });

            const nextElection = currentSession.find(e => e.is_verified !== 1 && e.is_verified !== 2);
            if (nextElection) loadElectionResult(nextElection);
        } catch {
            showMessage("An error occurred while verifying.");
        } finally {
            showLoading(false);
        }
    });


    document.getElementById("close-btn").addEventListener("click", () => {
        submissionDetails.classList.add("hidden");
        noSubmissionMessage.classList.remove("hidden");
        currentSession = null;
        currentElection = null;
        loadSubmissions(); // Refresh the list when closing the details view
    });

    // Initial load
    populateFilters();
    loadSubmissions();

    // Automatic refresh function
    function autoRefreshSubmissions() {
        if (!currentSession) {
            loadSubmissions();
        }
    }

    // Automatically refresh submissions every 30 seconds
    setInterval(autoRefreshSubmissions, 30000);
});