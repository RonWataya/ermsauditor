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

    const allowedDistricts = auditorDistrictMap[currentUser.username] || [];

    function logout() {
        localStorage.clear();
        window.location.href = 'index.html';
    }

    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', () => {
        // Instead of reloading the entire page, we just refresh the data
        loadSubmissions(true);
    });

    document.getElementById('logout-btn').addEventListener('click', logout);

    function showLoading(show = true) {
        const overlay = document.getElementById("loading-overlay");
        if (show) overlay.classList.remove("hidden");
        else overlay.classList.add("hidden");
    }

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

    const filterDistrict = document.getElementById("filter-district");
    const filterConstituency = document.getElementById("filter-constituency");
    const filterWard = document.getElementById("filter-ward");
    const filterCenter = document.getElementById("filter-center");
    const filterStatus = document.getElementById("filter-status");

    let currentSession = null;
    let currentElection = null;

    async function fetchData(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP error! status: ' + res.status);
            return await res.json();
        } catch (error) {
            console.error("Fetch error:", error);
            showMessage("An error occurred while fetching data.");
            return [];
        }
    }

    async function populateFilters() {
        const districts = await fetchData('https://miwalletmw.com:8000/api/districts?districtIds=' + allowedDistricts.join(','));

        const initialOption = filterDistrict.querySelector('option[value=""]');
        filterDistrict.innerHTML = '';
        if (initialOption) filterDistrict.appendChild(initialOption);

        populateSelect(filterDistrict, districts, 'district_id', 'district_name');

        filterDistrict.addEventListener("change", async () => {
            const districtId = filterDistrict.value;
            const constituencies = districtId ? await fetchData('https://miwalletmw.com:8000/api/constituencies?districtId=' + districtId) : [];
            populateSelect(filterConstituency, constituencies, 'constituency_id', 'constituency_name');
            populateSelect(filterWard, [], 'ward_id', 'ward_name');
            populateSelect(filterCenter, [], 'polling_center_id', 'polling_center_name');
            loadSubmissions();
        });

        filterConstituency.addEventListener("change", async () => {
            const constituencyId = filterConstituency.value;
            const wards = constituencyId ? await fetchData('https://miwalletmw.com:8000/api/wards?constituencyId=' + constituencyId) : [];
            populateSelect(filterWard, wards, 'ward_id', 'ward_name');
            populateSelect(filterCenter, [], 'polling_center_id', 'polling_center_name');
            loadSubmissions();
        });

        filterWard.addEventListener("change", async () => {
            const wardId = filterWard.value;
            const pollingCenters = wardId ? await fetchData('https://miwalletmw.com:8000/api/polling_centers?wardId=' + wardId) : [];
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
            allOption.innerText = "All " + textKey.replace('_id', '').replace('_', ' ') + "s";
            selectElement.appendChild(allOption);
        }
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = item[valueKey];
            option.innerText = item[textKey];
            selectElement.appendChild(option);
        });
    }

    async function loadSubmissions(isRefresh = false) {
        showLoading(true);
        const activeSessionItem = document.querySelector('.submission-item.active');
        const activeSessionId = activeSessionItem ? activeSessionItem.dataset.id : null;

        const filters = {
            districtId: filterDistrict.value,
            constituencyId: filterConstituency.value,
            wardId: filterWard.value,
            pollingCenterId: filterCenter.value,
            status: filterStatus.value,
            allowedDistricts: allowedDistricts.join(',')
        };
        const params = new URLSearchParams(filters).toString();
        const submissions = await fetchData('https://miwalletmw.com:8000/api/submissions?' + params);

        renderSubmissionsList(submissions, activeSessionId);
        showLoading(false);
    }

    async function silentLoadSubmissions() {
        const activeSessionItem = document.querySelector('.submission-item.active');
        const activeSessionId = activeSessionItem ? activeSessionItem.dataset.id : null;

        if (activeSessionId) {
            // Do not refresh if a session is currently open to avoid disruption
            return;
        }

        const filters = {
            districtId: filterDistrict.value,
            constituencyId: filterConstituency.value,
            wardId: filterWard.value,
            pollingCenterId: filterCenter.value,
            status: filterStatus.value,
            allowedDistricts: allowedDistricts.join(',')
        };
        const params = new URLSearchParams(filters).toString();
        
        try {
            const res = await fetch('https://miwalletmw.com:8000/api/submissions?' + params);
            if (!res.ok) throw new Error('HTTP error! status: ' + res.status);
            const submissions = await res.json();
            renderSubmissionsList(submissions, activeSessionId);
        } catch (error) {
            console.error("Silent fetch error:", error);
            // Optionally add a non-intrusive notification here
        }
    }

    function renderSubmissionsList(submissions, activeSessionId) {
        submissionsList.innerHTML = "";
        if (submissions.length === 0) {
            submissionsList.innerHTML = '<p class="text-center text-gray-500 p-4">No submissions found.</p>';
            submissionDetails.classList.add("hidden");
            noSubmissionMessage.classList.remove("hidden");
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

                div.className = 'submission-item p-4 border-b last:border-b-0 flex items-center gap-4 ' + statusClass;
                div.dataset.id = session.session_id;
                div.innerHTML = '<div class="flex-grow"><h6 class="text-sm font-semibold">' + pollingCenterName + '</h6><p class="text-xs text-gray-500">' + (session.district_name || 'N/A') + ', ' + (session.constituency_name || 'N/A') + '</p></div>' + statusIcon;
                div.onclick = () => loadSession(session.session_id);
                submissionsList.appendChild(div);
            });
        }

        if (activeSessionId) {
            const newActiveItem = document.querySelector(`.submission-item[data-id="${activeSessionId}"]`);
            if (newActiveItem) {
                newActiveItem.classList.add('active');
            } else {
                submissionDetails.classList.add("hidden");
                noSubmissionMessage.classList.remove("hidden");
            }
        }
    }
    
    async function loadSession(sessionId) {
        showLoading(true);
        try {
            const data = await fetchData('https://miwalletmw.com:8000/api/submissions/' + sessionId);

            if (data.length === 0) {
                submissionDetails.classList.add("hidden");
                noSubmissionMessage.classList.remove("hidden");
                return;
            }

            currentSession = data;
            currentElection = data[0];

            const pollingCenterInfo = currentSession[0].polling_center_name || 'N/A';
            document.getElementById("polling-center-title").innerText = 'Audit for ' + pollingCenterInfo;
            const monitorName = currentSession[0].monitor_name || 'N/A';
            document.getElementById("monitor-info").innerText = 'Monitor: ' + monitorName;

            renderElectionTabs(data);
            loadElectionResult(currentElection);

            submissionDetails.classList.remove("hidden");
            noSubmissionMessage.classList.add("hidden");

            document.querySelectorAll('.submission-item').forEach(item => {
                if (item.dataset.id === sessionId) item.classList.add('active');
                else item.classList.remove('active');
            });
        } finally {
            showLoading(false);
        }
    }

    function renderElectionTabs(elections) {
        electionTabs.innerHTML = "";
        elections.forEach(election => {
            const btn = document.createElement("button");
            btn.className = 'election-tab';
            btn.innerText = (election.election_type || "N/A").replace("_", " ").toUpperCase();
            
            // Set the base color class based on the status
            if (election.is_verified === 1) {
                btn.classList.add('verified');
            } else if (election.is_verified === 2) {
                btn.classList.add('rejected');
            } else {
                btn.classList.add('unverified');
            }

            // Set the active class if it's the current election
            if (election.result_id === currentElection.result_id) {
                btn.classList.add('active');
            }

            btn.onclick = () => {
                currentElection = election;
                loadElectionResult(election);
                
                // Update active state of all tabs
                Array.from(electionTabs.children).forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
            };
            electionTabs.appendChild(btn);
        });
    }

    function loadElectionResult(result) {
        currentElection = result;
        candidatesTable.innerHTML = "";
        (result.candidates || []).forEach(c => {
            const row = document.createElement("tr");
            row.innerHTML = '<td class="py-2 px-4">' + (c.candidate_name || 'N/A') + '</td><td class="py-2 px-4">' + (c.party || 'N/A') + '</td><td class="py-2 px-4"><input type="number" class="w-20 p-1 border border-gray-300 rounded-md text-sm text-center" value="' + c.votes_count + '" data-candidate="' + c.candidate_id + '"></td>';
            candidatesTable.appendChild(row);
        });

        document.getElementById("total-votes").value = result.total_votes_cast;
        document.getElementById("invalid-votes").value = result.invalid_votes;
        document.getElementById("unused-ballots").value = result.unused_ballots;
        document.getElementById("total-registered").value = result.total_registered_voters;
        document.getElementById("tally-img").src = 'data:image/jpeg;base64,' + result.paper_result_image_base64;

        if (result.is_verified === 1 || result.is_verified === 2) {
            auditForm.classList.add('grayed-out');
            verifyBtn.disabled = true;
        } else {
            auditForm.classList.remove('grayed-out');
            verifyBtn.disabled = false;
        }
    }

    auditForm.addEventListener("submit", async e => {
        e.preventDefault();
        if (!currentElection) return;
        if (auditForm.classList.contains('grayed-out')) {
            showMessage("This submission has already been verified or rejected.");
            return;
        }

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
            votes,
            status: "verified"
        };

        try {
            const res = await fetch("https://miwalletmw.com:8000/api/results/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            showMessage(data.message, () => {
                loadSubmissions();
            });
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
        loadSubmissions();
    });

    populateFilters();
    loadSubmissions();

    function autoRefreshSubmissions() {
        if (!currentSession) {
            silentLoadSubmissions();
        }
    }

    setInterval(autoRefreshSubmissions, 30000);
});