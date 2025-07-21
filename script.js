// Temporarily hardcode for local testing.
// IMPORTANT: For Vercel deployment, these should come from environment variables
// via a Vercel Serverless Function (as explained in Step 5).
const SUPABASE_URL = 'https://mddepayikxvuwqmozrmp.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZGVwYXlpa3h2dXdxbW96cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNzA0NTQsImV4cCI6MjA2ODY0NjQ1NH0.zwqPs2OxV3yBf1SiwvqXXB02WWV7gzqeKWIUBemQX7E'; 
    
const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Existing Constants (keep these) ---
const DOCUMENTS_STORAGE_KEY = 'english_stuffs_documents'; // This will be deprecated for Supabase
const CATEGORIES_STORAGE_KEY = 'english_stuffs_categories'; // We'll manage this via Supabase
const THEME_STORAGE_KEY = 'english_stuffs_theme';

// --- Theme Toggling ---
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

// --- Data Management (localStorage) ---
function getDocuments() {
    return JSON.parse(localStorage.getItem(DOCUMENTS_STORAGE_KEY)) || [];
}

function saveDocuments(documents) {
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
}

function getCategories() {
    const defaultCategories = ['Lesson Plan', 'Scores', 'Daily Test'];
    const storedCategories = JSON.parse(localStorage.getItem(CATEGORIES_STORAGE_KEY)) || [];
    // Combine default and stored categories, remove duplicates
    const allCategories = [...new Set([...defaultCategories, ...storedCategories])];
    return allCategories;
}

function saveCategories(categories) {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

// --- Document Listing and Table Population ---
function loadDocuments(showDeleteOption) {
    const documents = getDocuments();
    const tableBody = document.querySelector('#document-table tbody');
    if (!tableBody) return; // Exit if table body not found (e.g., on login/input page)

    tableBody.innerHTML = ''; // Clear existing rows

    const filterTitle = document.getElementById('document-filter')?.value.toLowerCase() || '';
    const filterCategory = document.getElementById('category-filter')?.value.toLowerCase() || '';

    let filteredDocuments = documents.filter(doc => {
        const matchesTitle = doc.title.toLowerCase().includes(filterTitle);
        const matchesCategory = filterCategory === '' || doc.category.toLowerCase() === filterCategory;
        return matchesTitle && matchesCategory;
    });

    // Default sort by order of input (implicit from getDocuments)
    // We can add more sophisticated sorting here later if needed

    filteredDocuments.forEach((doc, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = index + 1; // Automatic numbering
        row.insertCell(1).textContent = doc.title;
        row.insertCell(2).textContent = doc.category;

        const viewCell = row.insertCell(3);
        const viewLink = document.createElement('a');
        viewLink.href = '#'; // Prevent actual navigation
        viewLink.textContent = 'Click';
        viewLink.onclick = (event) => {
            event.preventDefault();
            showDocumentPopup(doc.url);
        };
        viewCell.appendChild(viewLink);

        if (showDeleteOption) {
            const deleteLink = document.createElement('span');
            deleteLink.textContent = ' | '; // Separator
            viewCell.appendChild(deleteLink);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => {
                if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                    deleteDocument(doc.id);
                }
            };
            viewCell.appendChild(deleteBtn);
        }
    });
}

function deleteDocument(idToDelete) {
    let documents = getDocuments();
    documents = documents.filter(doc => doc.id !== idToDelete);
    saveDocuments(documents);
    loadDocuments(true); // Reload the table with delete option
}

// --- Document Saving (Input Page) ---
function saveDocument() {
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

    // Basic Google Drive URL check (can be more robust)
    if (!url.includes('drive.google.com')) {
        alert('Please enter a Google Drive URL.');
        return;
    }

    let documents = getDocuments();
    const newDocument = {
        id: Date.now(), // Simple unique ID
        title,
        category,
        url
    };
    documents.push(newDocument);
    saveDocuments(documents);

    alert('Document saved successfully!');
    titleInput.value = '';
    urlInput.value = '';
    categorySelect.value = ''; // Reset category to empty or default

    // Optionally redirect to document.html after saving
    window.location.href = 'document.html';
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (e) {
        return false;
    }
}

// --- Category Management (Input Page) ---
function loadCategoriesForInput() {
    const categorySelect = document.getElementById('document-category');
    if (!categorySelect) return;

    const categories = getCategories();
    categorySelect.innerHTML = '<option value="">Select Category</option>'; // Default option
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

function addNewCategory() {
    const newCategory = prompt('Enter new category name:');
    if (newCategory && newCategory.trim() !== '') {
        let categories = getCategories();
        const trimmedCategory = newCategory.trim();
        if (!categories.includes(trimmedCategory)) {
            categories.push(trimmedCategory);
            saveCategories(categories);
            loadCategoriesForInput(); // Reload categories in the dropdown
            alert(`Category "${trimmedCategory}" added.`);
        } else {
            alert(`Category "${trimmedCategory}" already exists.`);
        }
    }
}

// --- Category Filter (Index & Document Pages) ---
function loadCategoriesForFilter(selectId) {
    const categoryFilterSelect = document.getElementById(selectId);
    if (!categoryFilterSelect) return;

    const categories = getCategories();
    categoryFilterSelect.innerHTML = '<option value="">Filter by Category</option>'; // Default option
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.toLowerCase(); // Use lowercase for filtering comparison
        option.textContent = cat;
        categoryFilterSelect.appendChild(option);
    });

    categoryFilterSelect.addEventListener('change', () => {
        const isDocumentPage = window.location.pathname.includes('document.html');
        loadDocuments(isDocumentPage);
    });
}

// --- Popup for Google Drive Viewer ---
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
        // Transform Google Drive URL for embedding
        // Example: https://drive.google.com/file/d/FILE_ID/view
        // Becomes: https://drive.google.com/file/d/FILE_ID/preview
        let embedUrl = url;
        if (url.includes('drive.google.com/file/d/')) {
            embedUrl = url.replace('/view', '/preview');
            if (!embedUrl.includes('/preview')) { // If it's just /file/d/FILE_ID, add /preview
                const parts = embedUrl.split('/');
                const fileId = parts[parts.indexOf('d') + 1];
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        // For Google Docs/Sheets/Slides, generally adding /preview works
        // Or using google.com/viewer?url=ENCODED_URL might be more robust for various types

        documentViewer.src = embedUrl;
        popupOverlay.style.display = 'flex';
    }
}

// --- Filtering and Sorting ---
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'

function setupFilterAndSort(tableId) {
    const documentFilter = document.getElementById('document-filter');
    const categoryFilter = document.getElementById('category-filter');

    if (documentFilter) {
        documentFilter.addEventListener('keyup', () => {
            const isDocumentPage = window.location.pathname.includes('document.html');
            loadDocuments(isDocumentPage);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            const isDocumentPage = window.location.pathname.includes('document.html');
            loadDocuments(isDocumentPage);
        });
    }

    // Sort buttons are handled by inline onclick, but we can also attach listeners here
}

function sortDocuments(column) {
    let documents = getDocuments();
    const isDocumentPage = window.location.pathname.includes('document.html');

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    documents.sort((a, b) => {
        let valA, valB;
        if (column === 'title') {
            valA = a.title.toLowerCase();
            valB = b.title.toLowerCase();
        } else if (column === 'category') {
            valA = a.category.toLowerCase();
            valB = b.category.toLowerCase();
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    saveDocuments(documents); // Save sorted order
    loadDocuments(isDocumentPage); // Re-render table with sorted data
}


// --- Authentication ---
const DEFAULT_USERNAME = 'mrshin';
const DEFAULT_PASSWORD = 'lapangan9a';

function login() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('login-error-message');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
        localStorage.setItem(LOGGED_IN_STORAGE_KEY, 'true');
        window.location.href = 'document.html'; // Redirect to dashboard
    } else {
        errorMessage.textContent = 'Invalid username or password.';
        errorMessage.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem(LOGGED_IN_STORAGE_KEY);
    alert('Logged out successfully.');
    window.location.href = 'login.html'; // Redirect to login page
}

function checkLoginStatus() {
    if (localStorage.getItem(LOGGED_IN_STORAGE_KEY) !== 'true') {
        window.location.href = 'login.html'; // Redirect to login if not logged in
    }
}

// Global functions for inline onclick (e.g., sortButtons)
window.sortDocuments = sortDocuments;
window.showDocumentPopup = showDocumentPopup;
