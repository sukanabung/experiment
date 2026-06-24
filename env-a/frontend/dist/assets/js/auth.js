// Simpan token dan user
function setAuthData(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Login
async function login(username, password) {
    try {
        const { response, data } = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            setAuthData(data.token, data.user);
            return { success: true, user: data.user };
        } else {
            return { success: false, message: data.error || 'Login failed' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Register
async function register(username, email, password) {
    try {
        const { response, data } = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
            return { success: true, user: data.user };
        } else {
            return { success: false, message: data.error || 'Registration failed' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Logout
async function logout() {
    const token = getToken();
    if (token) {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch (e) {}
    }
    clearAuthData();
}