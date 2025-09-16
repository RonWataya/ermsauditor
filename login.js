// The JSON object storing user credentials and their destination pages.
const users = {
    "admin": { password: "2025erms", page: "admin.html" },
    "AuditorNorth": { password: "2025erms", page: "auditor.html" },
    "AuditorSouth": { password: "2025erms", page: "auditor.html" },
    "AuditorCentral": { password: "2025erms", page: "auditor.html" },
    "AuditorEast": { password: "2025erms", page: "auditor.html" }
};

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting normally

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('error-message');

    // Check if the user exists and the password is correct.
    if (users.hasOwnProperty(usernameInput) && users[usernameInput].password === passwordInput) {
        // Login successful.
        // Store user data in local storage for session persistence.
        localStorage.setItem('currentUser', JSON.stringify({
            username: usernameInput,
            role: (usernameInput === "admin" ? "admin" : "auditor")
        }));
        
        // Redirect to the correct page.
        window.location.href = users[usernameInput].page;
    } else {
        // Login failed.
        errorMessage.textContent = 'Invalid username or password.';
        errorMessage.classList.remove('hidden'); // Show the error message
    }
});