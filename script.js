// --- Supabase Initialization ---
// IMPORTANT: Supabase URL and Anon Key are always fetched securely from /api/config
// Do NOT hardcode these sensitive keys directly in client-side code.

let supabase; // Declare supabase here, initialized in initializeSupabase()

// Function to initialize Supabase client securely
async function initializeSupabase() {
    if (supabase) return; // Prevent re-initialization

    let finalSupabaseUrl;
    let finalSupabaseAnonKey;

    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config from /api/config: ${response.status} ${response.statusText}`);
        }
        const config = await response.json();

        finalSupabaseUrl = config.supabaseUrl;
        finalSupabaseAnonKey = config.supabaseAnonKey;

        if (!finalSupabaseUrl || !finalSupabaseAnonKey) {
            throw new Error('Supabase URL or Anon Key is missing from /api/config response.');
        }
        console.log('Supabase config loaded from /api/config.');

    } catch (error) {
        console.error('CRITICAL ERROR: Failed to initialize Supabase client. Application might not function correctly.', error);
        alert('Application failed to load necessary configurations. Please try again later. Check console for details.');
        return;
    }

    const createClient = window.supabase.createClient;
    supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey);
    console.log('Supabase client created.');
}


// --- Theme Toggling ---
const THEME_STORAGE_KEY = 'english_stuffs_theme';

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
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return [];
    }
    const { data, error } = await supabase
        .from('documents')
        .select('id, title, category, url')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching documents:', error.message);
        return [];
    }
    return data;
}

async function getCategoriesFromDB() {
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return [];
    }
    const { data, error } = await supabase
        .from('categories')
        .select('name');

    if (error) {
        console.error('Error fetching categories:', error.message);
        return [];
    }
    const dbCategories = data.map(item => item.name);

    const defaultCategories = ['Lesson Plan', 'Scores', 'Daily Test'];
    const allCategories = [...new Set([...defaultCategories, ...dbCategories])];
    return allCategories;
}

async function loadDocuments(showDeleteOption) {
  console.log("🚀 loadDocuments called, showDeleteOption =", showDeleteOption);

  const tableBody = document.querySelector("#document-table tbody");
  if (!tableBody) {
    console.error("❗ Table body (#document-table tbody) not found");
    return;
  }

  console.log("✅ tableBody found:", tableBody);

  // Langsung ambil dari Supabase (tanpa .order dulu)
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, title, category, url");

  if (error) {
    console.error("❌ Error fetching documents:", error);
    return;
  }

  console.log("📄 Fetched documents from Supabase:", documents);

  tableBody.innerHTML = "";

  const filterTitle = document.getElementById("document-filter")?.value.toLowerCase() || "";
  const filterCategory = document.getElementById("category-filter")?.value.toLowerCase() || "";

  let filteredDocuments = documents.filter((doc) => {
    const matchesTitle = (doc.title || "").toLowerCase().includes(filterTitle);
    const docCategory = (doc.category || "").toLowerCase();
    const matchesCategory = filterCategory === "" || docCategory === filterCategory;
    return matchesTitle && matchesCategory;
  });

  // Optional: sorting logic
  if (currentSortColumn) {
    filteredDocuments.sort((a, b) => {
      let valA, valB;
      if (currentSortColumn === "title") {
        valA = (a.title || "").toLowerCase();
        valB = (b.title || "").toLowerCase();
      } else if (currentSortColumn === "category") {
        valA = (a.category || "").toLowerCase();
        valB = (b.category || "").toLowerCase();
      }

      if (valA < valB) return currentSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  filteredDocuments.forEach((doc, index) => {
    const row = tableBody.insertRow();
    row.insertCell(0).textContent = index + 1;
    row.insertCell(1).textContent = doc.title || "Untitled";
    row.insertCell(2).textContent =
      doc.category && doc.category.trim() !== "" ? doc.category : "Uncategorized";

    const viewCell = row.insertCell(3);
    const viewLink = document.createElement("a");
    viewLink.href = "#";
    viewLink.textContent = "View";
    viewLink.onclick = (event) => {
      event.preventDefault();
      showDocumentPopup(doc.url);
    };
    viewCell.appendChild(viewLink);

 

    if (showDeleteOption) {

       // Add EDIT button (safely inside the row)
        const editSeparator = document.createElement("span");
        editSeparator.textContent = " | ";
        viewCell.appendChild(editSeparator);
        
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.classList.add("edit-btn");
        editBtn.onclick = () => {
          openEditPopup(doc);
        };
        viewCell.appendChild(editBtn);
        
      const deleteLink = document.createElement("span");
      deleteLink.textContent = " | ";
      viewCell.appendChild(deleteLink);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("delete-btn");
      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
          await deleteDocument(doc.id);
        }
      };
      viewCell.appendChild(deleteBtn);
    }
  });
}

// --- Document Delete (Dodument Page) ---
async function deleteDocument(idToDelete) {
  if (!supabase) {
    console.error('Supabase client not initialized.');
    alert('Application not fully initialized. Please refresh.');
    return;
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', idToDelete);

  if (error) {
    console.error('Error deleting document:', error.message);
    alert('Failed to delete document. Please try again.');
  } else {
    alert('Document deleted successfully!');
    await loadDocuments(true);
  }
}

//Edit Logic

let currentEditId = null;

function openEditPopup(doc) {
  currentEditId = doc.id;

  // Populate form
  document.getElementById("edit-title").value = doc.title || "";
  document.getElementById("edit-url").value = doc.url || "";

  // Load categories
  getCategoriesFromDB().then((categories) => {
    const select = document.getElementById("edit-category");
    select.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      if (cat === doc.category) option.selected = true;
      select.appendChild(option);
    });
  });

  document.getElementById("edit-popup-overlay").style.display = "flex";
}

function closeEditPopup() {
  document.getElementById("edit-popup-overlay").style.display = "none";
  currentEditId = null;
}

async function saveEditedDocument() {
  if (!currentEditId) return;

  const newTitle = document.getElementById("edit-title").value.trim();
  const newUrl = document.getElementById("edit-url").value.trim();
  const newCategory = document.getElementById("edit-category").value;

  if (!newTitle || !newUrl || !newCategory) {
    alert("Please fill in all fields.");
    return;
  }

  const { error } = await supabase
    .from("documents")
    .update({ title: newTitle, url: newUrl, category: newCategory })
    .eq("id", currentEditId);

  if (error) {
    alert("Failed to update document.");
    console.error(error);
    return;
  }

  alert("Document updated.");
  closeEditPopup();
  await loadDocuments(true);
}


// --- Document Saving (Input Page) ---
async function saveDocument() {
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

    const {
         data: { user },
              error: userError
            } = await supabase.auth.getUser();
            
            if (userError || !user) {
              alert('Cannot get user info. Please re-login.');
              return;
            }
            
            const { data, error } = await supabase
              .from('documents')
              .insert([{ title, category, url, user_id: user.id }]);

    if (error) {
        console.error('Error saving document:', error.message);
        alert('Failed to save document. Please try again.');
    } else {
        alert('Document saved successfully!');
        titleInput.value = '';
        urlInput.value = '';
        categorySelect.value = '';
        window.location.href = 'document.html';
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

// --- Category Management (Input Page) ---
async function loadCategoriesForInput() {
    const categorySelect = document.getElementById('document-category');
    if (!categorySelect) return;

    const categories = await getCategoriesFromDB();
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

async function addNewCategory() {
    if (!supabase) {
        console.error('Supabase client not initialized.');
        alert('Application not fully initialized. Please refresh.');
        return;
    }
    const newCategory = prompt('Enter new category name:');
    if (newCategory && newCategory.trim() !== '') {
        const trimmedCategory = newCategory.trim();
        const categories = await getCategoriesFromDB();

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
                await loadCategoriesForInput();
            }
        } else {
            alert(`Category "${trimmedCategory}" already exists.`);
        }
    }
}

// --- Category Filter (Index & Document Pages) ---
async function loadCategoriesForFilter(selectId) {
    const categoryFilterSelect = document.getElementById(selectId);
    if (!categoryFilterSelect) return;

    const categories = await getCategoriesFromDB();
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

// --- Popup for Google Drive Viewer ---
function setupPopup() {
    const popupOverlay = document.getElementById('popup-overlay');
    const closeButton = document.querySelector('.popup-content .close-button');

    if (popupOverlay && closeButton) {
        closeButton.addEventListener('click', () => {
            popupOverlay.style.display = 'none';
            document.getElementById('document-viewer').src = '';
        });

        popupOverlay.addEventListener('click', (event) => {
            if (event.target === popupOverlay) {
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

// --- Authentication (Supabase Auth) ---

async function login() {
  await initializeSupabase();
  if (!supabase) {
    console.error('Supabase client not initialized.');
    alert('App not ready. Please refresh.');
    return;
  }

  const email = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const errorMessage = document.getElementById('login-error-message');

  if (errorMessage) errorMessage.textContent = '';

  if (!email || !password) {
    if (errorMessage) {
      errorMessage.textContent = 'Please enter both email and password.';
      errorMessage.style.display = 'block';
    }
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Login error:', error.message);
    if (errorMessage) {
      errorMessage.textContent = `Login failed: ${error.message}`;
      errorMessage.style.display = 'block';
    }
  } else if (data.user) {
    alert("Login successful!");
    closeLoginModal();
    window.location.href = 'document.html';
  }
}

async function logout() {
  if (!supabase) {
    console.error('Supabase client not initialized.');
    alert('App not ready. Please refresh.');
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error.message);
    alert('Failed to logout. Please try again.');
  } else {
    alert('Logged out successfully.');
    location.reload();
  }
}

async function checkLoginStatus() {
  await initializeSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    alert('Please log in.');
    window.location.href = 'index.html'; // fallback
  }
}

async function setupAuthAction() {
  await initializeSupabase();
  const container = document.getElementById("auth-action");
  if (!container) return;

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    container.innerHTML = `<a href="#" id="logout-link" class="page-title">SIGN OUT</a>`;
    document.getElementById("logout-link").addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
    });
  } else {
    container.innerHTML = `<a href="#" id="open-login" class="page-title">SIGN IN</a>`;
    document.getElementById("open-login").addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("login-modal").style.display = "flex";
    });
  }
}

// Show/hide password toggle
function setupPasswordToggle() {
  const toggle = document.getElementById("toggle-password");
  const input = document.getElementById("password");
  if (toggle && input) {
    toggle.addEventListener("change", () => {
      input.type = toggle.checked ? "text" : "password";
    });
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "none";
}

// Handle login form button
function setupLoginForm() {
  const loginBtn = document.getElementById("login-button");
  if (loginBtn) loginBtn.addEventListener("click", login);
  setupPasswordToggle();
}

document.addEventListener("DOMContentLoaded", async () => {
  const pathname = window.location.pathname;

  await initializeSupabase();
  await setupAuthAction(); // 👈 this is your login/signout logic

  applyThemeFromLocalStorage();
  setupThemeToggle();
  setupPopup();
  setupLoginForm(); // 👈 needed to bind login button and toggle

  if (pathname.includes("index.html") || pathname === "/") {
    await loadDocuments(false);
    await loadCategoriesForFilter("category-filter");
    setupFilterAndSort("document-table");
  }

  if (pathname.includes("document.html")) {
    await checkLoginStatus();
    await loadDocuments(true);
    await loadCategoriesForFilter("category-filter");
    setupFilterAndSort("document-table");
  }

  if (pathname.includes("input.html")) {
    await checkLoginStatus();
    await loadCategoriesForInput();
    document.getElementById("save-document-button")?.addEventListener("click", saveDocument);
    document.getElementById("add-category-button")?.addEventListener("click", addNewCategory);
    document.getElementById("logout-button")?.addEventListener("click", logout);
  }
});

