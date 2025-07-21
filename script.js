// --- Supabase Initialization ---
// IMPORTANT: For Vercel deployment, these should come from environment variables
// via a Vercel Serverless Function (as explained previously in Step 9).
const SUPABASE_URL = 'https://mddepayikxvuwqmozrmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZGVwYXlpa3h2dXdxbW96cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNzA0NTQsImV4cCI6MjA2ODY0NjQ1NH0.zwqPs2OxV3yBf1SiwvqXXB02WWV7gzqeKWIUBemQX7E';

let supabase; // Declare supabase here

// Function to initialize Supabase client securely based on deployment environment
async function initializeSupabase() {
    if (supabase) return; // Prevent re-initialization

    let finalSupabaseUrl = SUPABASE_URL;
    let finalSupabaseAnonKey = SUPABASE_ANON_KEY;

    // Check if running on a deployed Vercel environment (not localhost)
    // This assumes your Vercel deployment will serve the /api/config endpoint
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                finalSupabaseUrl = config.supabaseUrl;
                finalSupabaseAnonKey = config.supabaseAnonKey;
            } else {
                console.warn('Failed to fetch config from /api/config. Using hardcoded keys.');
                // Fallback to hardcoded keys if API endpoint not available or fails
            }
        } catch (error) {
            console.warn('Error fetching config from /api/config:', error);
            // Fallback to hardcoded keys if fetch fails
        }
    }

    supabase = Supabase.createClient(finalSupabaseUrl, finalSupabaseAnonKey);
    console.log('Supabase client initialized.');
}


// --- Existing Constants (keep these for theme) ---
const THEME_STORAGE_KEY = 'english_stuffs_theme';

// --- Theme Toggling (Keep as is) ---
function applyThemeFromLocalStorage() {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('theme-toggle').checked = false;
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem(THEME_STORAGE_KEY, 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem(THEME_STORAGE_KEY, 'light');
            }
        });
    }
}

// --- Data Management (Supabase) ---
async function getDocumentsFromDB() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return [];
    }
    const { data, error } = await supabase
        .from('documents')
        .select('id, title, category, url')
        .order('created_at', { ascending: true }); // Order by creation time

    if (error) {
        console.error('Error fetching documents:', error.message);
        return [];
    }
    return data;
}

async function getCategoriesFromDB() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return [];
    }
    const { data, error } = await supabase
        .from('categories')
        .select('name'); // Select only the name column

    if (error) {
        console.error('Error fetching categories:', error.message);
        return [];
    }
    const dbCategories = data.map(item => item.name);

    // Combine default categories with those from the database
    const defaultCategories = ['Lesson Plan', 'Scores', 'Daily Test'];
    const allCategories = [...new Set([...defaultCategories, ...dbCategories])];
    return allCategories;
}

// --- Document Listing and Table Population (UPDATED) ---
async function loadDocuments(showDeleteOption) {
    let documents = await getDocumentsFromDB();
    const tableBody = document.querySelector('#document-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear existing rows

    const filterTitle = document.getElementById('document-filter')?.value.toLowerCase() || '';
    const filterCategory = document.getElementById('category-filter')?.value.toLowerCase() || '';

    let filteredDocuments = documents.filter(doc => {
        const matchesTitle = doc.title.toLowerCase().includes(filterTitle);
        const matchesCategory = filterCategory === '' || doc.category.toLowerCase() === filterCategory;
        return matchesTitle && matchesCategory;
    });

    // Apply sorting based on currentSortColumn and currentSortDirection
    if (currentSortColumn) {
        filteredDocuments.sort((a, b) => {
            let valA, valB;
            if (currentSortColumn === 'title') {
                valA = a.title.toLowerCase();
                valB = b.title.toLowerCase();
            } else if (currentSortColumn === 'category') {
                valA = a.category.toLowerCase();
                valB = b.category.toLowerCase();
            }

            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    filteredDocuments.forEach((doc, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = index + 1; // Automatic numbering
        row.insertCell(1).textContent = doc.title;
        row.insertCell(2).textContent = doc.category;

        const viewCell = row.insertCell(3);
        const viewLink = document.createElement('a');
        viewLink.href = '#';
        viewLink.textContent = 'Click';
        viewLink.onclick = (event) => {
            event.preventDefault();
            showDocumentPopup(doc.url);
        };
        viewCell.appendChild(viewLink);

        if (showDeleteOption) {
            const deleteLink = document.createElement('span');
            deleteLink.textContent = ' | ';
            viewCell.appendChild(deleteLink);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = async () => {
                if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                    await deleteDocument(doc.id);
                }
            };
            viewCell.appendChild(deleteBtn);
        }
    });
}

async function deleteDocument(idToDelete) {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', idToDelete); // Delete where id matches

    if (error) {
        console.error('Error deleting document:', error.message);
        alert('Failed to delete document. Please try again.');
    } else {
        alert('Document deleted successfully!');
        await loadDocuments(true); // Reload the table
    }
}

// --- Document Saving (Input Page - UPDATED) ---
async function saveDocument() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }

    const titleInput = document.getElementById('document-title');
    const categorySelect = document.getElementById('document-category');
    const urlInput = document.getElementById('document-url');

    const title = titleInput.value.trim();
    const category = categorySelect.value;
    const url = urlInput.value.trim();

    if (!title || !category || !url) {
        alert('Please fill in all fields.');
        return;
    }
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., starting with http:// or https://).');
        return;
    }
    if (!url.includes('drive.google.com')) {
        alert('Please enter a Google Drive URL.');
        return;
    }

    const { data, error } = await supabase
        .from('documents')
        .insert([
            { title, category, url }
        ]);

    if (error) {
        console.error('Error saving document:', error.message);
        alert('Failed to save document. Please try again.');
    } else {
        alert('Document saved successfully!');
        titleInput.value = '';
        urlInput.value = '';
        categorySelect.value = '';
        window.location.href = 'document.html'; // Redirect
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (e) {
        return false;
    }
}

// --- Category Management (Input Page - UPDATED) ---
async function loadCategoriesForInput() {
    const categorySelect = document.getElementById('document-category');
    if (!categorySelect) return;

    const categories = await getCategoriesFromDB(); // Fetch from DB
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

async function addNewCategory() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }
    const newCategory = prompt('Enter new category name:');
    if (newCategory && newCategory.trim() !== '') {
        const trimmedCategory = newCategory.trim();
        const categories = await getCategoriesFromDB(); // Fetch current categories

        if (!categories.includes(trimmedCategory)) {
            const { error } = await supabase
                .from('categories')
                .insert([
                    { name: trimmedCategory }
                ]);

            if (error) {
                console.error('Error adding category:', error.message);
                alert('Failed to add category. Please try again.');
            } else {
                alert(`Category "${trimmedCategory}" added.`);
                await loadCategoriesForInput(); // Reload categories
            }
        } else {
            alert(`Category "${trimmedCategory}" already exists.`);
        }
    }
}

// --- Category Filter (Index & Document Pages - UPDATED) ---
async function loadCategoriesForFilter(selectId) {
    const categoryFilterSelect = document.getElementById(selectId);
    if (!categoryFilterSelect) return;

    const categories = await getCategoriesFromDB(); // Fetch from DB
    categoryFilterSelect.innerHTML = '<option value="">Filter by Category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.toLowerCase();
        option.textContent = cat;
        categoryFilterSelect.appendChild(option);
    });

    categoryFilterSelect.addEventListener('change', async () => {
        const isDocumentPage = window.location.pathname.includes('document.html');
        await loadDocuments(isDocumentPage);
    });
}

// --- Popup for Google Drive Viewer (Keep as is) ---
function setupPopup() {
    const popupOverlay = document.getElementById('popup-overlay');
    const closeButton = document.querySelector('.popup-content .close-button');

    if (popupOverlay && closeButton) {
        closeButton.addEventListener('click', () => {
            popupOverlay.style.display = 'none';
            document.getElementById('document-viewer').src = ''; // Clear iframe src
        });

        popupOverlay.addEventListener('click', (event) => {
            if (event.target === popupOverlay) { // Close if clicked outside content
                popupOverlay.style.display = 'none';
                document.getElementById('document-viewer').src = '';
            }
        });
    }
}

function showDocumentPopup(url) {
    const popupOverlay = document.getElementById('popup-overlay');
    const documentViewer = document.getElementById('document-viewer');

    if (popupOverlay && documentViewer) {
        let embedUrl = url;
        if (url.includes('drive.google.com/file/d/')) {
            embedUrl = url.replace('/view', '/preview');
            if (!embedUrl.includes('/preview')) {
                const parts = embedUrl.split('/');
                const fileId = parts[parts.indexOf('d') + 1];
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        documentViewer.src = embedUrl;
        popupOverlay.style.display = 'flex';
    }
}

// --- Filtering and Sorting ---
let currentSortColumn = null;
let currentSortDirection = 'asc';

function setupFilterAndSort(tableId) {
    const documentFilter = document.getElementById('document-filter');
    const categoryFilter = document.getElementById('category-filter');

    if (documentFilter) {
        documentFilter.addEventListener('keyup', async () => {
            const isDocumentPage = window.location.pathname.includes('document.html');
            await loadDocuments(isDocumentPage);
        });
    }

    // Category filter listener is set in loadCategoriesForFilter
}

async function sortDocuments(column) {
    const isDocumentPage = window.location.pathname.includes('document.html');

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    await loadDocuments(isDocumentPage);
}


// --- Authentication (Supabase Auth - REPLACED) ---
async function login() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('login-error-message');

    const email = usernameInput.value.trim(); // Supabase Auth uses email for sign-in
    const password = passwordInput.value.trim();

    errorMessage.textContent = ''; // Clear previous errors

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Login error:', error.message);
        errorMessage.textContent = `Login failed: ${error.message}`;
        errorMessage.style.display = 'block';
    } else if (data.user) {
        console.log('User logged in:', data.user);
        window.location.href = 'document.html'; // Redirect to dashboard
    } else {
        errorMessage.textContent = 'Login failed. Please check your credentials.';
        errorMessage.style.display = 'block';
    }
}

async function logout() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error('Logout error:', error.message);
        alert('Failed to logout. Please try again.');
    } else {
        alert('Logged out successfully.');
        window.location.href = 'login.html'; // Redirect to login page
    }
}

async function checkLoginStatus() {
    // Ensure supabase client is initialized before making calls
    if (!supabase) {
        console.error('Supabase client not initialized.');
        // If not initialized, try to initialize before redirecting.
        // This is a fallback and ideally initializeSupabase() should be called early via HTML.
        await initializeSupabase();
        if (!supabase) { // If still not initialized, something is wrong, redirect
             window.location.href = 'login.html';
             return;
        }
    }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting session:', error.message);
        window.location.href = 'login.html'; // Redirect on error
        return;
    }

    if (!session) {
        window.location.href = 'login.html';
    }
}

// --- Global functions for inline onclick (e.g., sortButtons) ---
// These are still needed if you call functions directly from HTML attributes
window.sortDocuments = sortDocuments;
window.showDocumentPopup = showDocumentPopup;
window.login = login;
window.logout = logout;
window.saveDocument = saveDocument;
window.addNewCategory = addNewCategory;

// Initial call to set up Supabase when the script loads
// This makes sure `supabase` is ready before other DOMContentLoaded listeners fire their functions.
// This is the most critical change from the previous iteration when using the API endpoint approach.
// Each HTML file's DOMContentLoaded listener must start with `await initializeSupabase();`
// followed by `await` for any subsequent functions that interact with Supabase.
// For example, in login.html:
/*
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeSupabase(); // THIS MUST BE AWAITED FIRST
        applyThemeFromLocalStorage();
        setupThemeToggle();
        document.getElementById('login-button').addEventListener('click', login);
        async function redirectIfLoggedIn() {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (session) {
                window.location.href = 'document.html';
            }
        }
        redirectIfLoggedIn();
    });
*/
// And similarly for index.html, document.html, input.html.
