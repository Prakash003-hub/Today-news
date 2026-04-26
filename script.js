const NEWS_FILE = "news.json";
const API_BASE = getLocalApiBase();

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "user") {
    initUserPage();
  }
  if (page === "admin") {
    initAdminPage();
  }
});

async function initUserPage() {
  const [searchInput, categoryFilter, sortSelect] = [
    document.getElementById("searchInput"),
    document.getElementById("categoryFilter"),
    document.getElementById("sortSelect")
  ];

  let news = [];

  try {
    news = await fetchNewsData("file");
    populateStats(news);
    populateCategories(news, categoryFilter);
    renderNews(news);
  } catch (error) {
    showMessage(error.message, "error");
    renderEmpty("No news could be loaded.");
  }

  const rerender = () => {
    const filtered = applyFilters(
      news,
      searchInput.value,
      categoryFilter.value,
      sortSelect.value
    );
    renderNews(filtered);
  };

  searchInput.addEventListener("input", rerender);
  categoryFilter.addEventListener("change", rerender);
  sortSelect.addEventListener("change", rerender);
}

async function initAdminPage() {
  const form = document.getElementById("newsForm");
  const resetBtn = document.getElementById("resetBtn");
  const list = document.getElementById("adminList");

  await refreshAdminList();

  form.addEventListener("submit", handleAdminSubmit);
  resetBtn.addEventListener("click", () => {
    clearForm();
    showMessage("Form reset.", "success");
  });

  async function refreshAdminList() {
    const news = await fetchNewsData("api");
    renderAdminList(news);
  }

  async function handleAdminSubmit(event) {
    event.preventDefault();

    const payload = getFormValues();
    const errors = validateNews(payload);
    if (errors.length) {
      showMessage(errors[0], "error");
      return;
    }

    const id = document.getElementById("newsId").value;
    const method = id ? "PUT" : "POST";
    const url = id ? `${API_BASE}/news/${id}` : `${API_BASE}/news`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await safeJson(response);
        throw new Error(errorData.message || "Request failed.");
      }

      showMessage(id ? "News updated successfully." : "News added successfully.", "success");
      clearForm();
      await refreshAdminList();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function startEdit(id) {
    try {
      const news = await fetchNewsData("api");
      const item = news.find((entry) => String(entry.id) === String(id));
      if (!item) {
        showMessage("News item not found.", "error");
        return;
      }

      document.getElementById("formTitle").textContent = "Edit News";
      document.getElementById("saveBtn").textContent = "Update News";
      document.getElementById("newsId").value = item.id;
      document.getElementById("title").value = item.title;
      document.getElementById("category").value = item.category;
      document.getElementById("content").value = item.content;
      document.getElementById("image").value = item.image;
      showMessage("Edit the fields and click Update News.", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteNews(id) {
    const confirmed = window.confirm("Delete this news article?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/news/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const errorData = await safeJson(response);
        throw new Error(errorData.message || "Delete failed.");
      }

      showMessage("News deleted successfully.", "success");
      await refreshAdminList();
      if (document.getElementById("newsId").value === String(id)) {
        clearForm();
      }
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  function renderAdminList(news) {
    if (!news.length) {
      list.innerHTML = `<div class="empty-state">No news available. Add the first article using the form.</div>`;
      return;
    }

    list.innerHTML = news
      .map(
        (item) => `
          <article class="admin-item">
            <div class="admin-item-top">
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <p><strong>ID:</strong> ${escapeHtml(item.id)}</p>
                <p><strong>Category:</strong> ${escapeHtml(item.category)}</p>
                <p><strong>Date:</strong> ${escapeHtml(item.date)}</p>
                <p><strong>Image:</strong> ${escapeHtml(item.image)}</p>
                <p>${escapeHtml(item.content)}</p>
              </div>
            </div>
            <div class="admin-actions">
              <button class="mini-btn edit" data-edit="${item.id}">Edit</button>
              <button class="mini-btn delete" data-delete="${item.id}">Delete</button>
            </div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => startEdit(button.dataset.edit));
    });

    list.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteNews(button.dataset.delete));
    });
  }
}

async function fetchNewsData(mode) {
  const endpoints = mode === "api" ? [`${API_BASE}/news`] : [NEWS_FILE];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load ${endpoint}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load news data.");
}

function renderNews(news) {
  const grid = document.getElementById("newsGrid");
  if (!grid) return;

  if (!news.length) {
    renderEmpty("No matching news articles found.");
    return;
  }

  grid.innerHTML = news
    .map(
      (item) => `
        <article class="news-card">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
          <div class="news-card-content">
            <span class="news-badge">${escapeHtml(item.category)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <div class="news-meta">
              <span>ID: ${escapeHtml(item.id)}</span>
              <span>${escapeHtml(item.date)}</span>
            </div>
            <p class="news-content">${escapeHtml(item.content)}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderEmpty(message) {
  const grid = document.getElementById("newsGrid");
  if (grid) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }
}

function populateCategories(news, select) {
  const categories = [...new Set(news.map((item) => item.category).filter(Boolean))].sort();
  select.innerHTML = `<option value="all">All categories</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function populateStats(news) {
  const articleCount = document.getElementById("articleCount");
  const categoryCount = document.getElementById("categoryCount");
  if (articleCount) articleCount.textContent = news.length;
  if (categoryCount) {
    categoryCount.textContent = new Set(news.map((item) => item.category).filter(Boolean)).size;
  }
}

function applyFilters(news, searchText, category, sortMode) {
  const query = searchText.trim().toLowerCase();

  const filtered = news.filter((item) => {
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query);
    const matchesCategory = category === "all" || item.category === category;
    return matchesSearch && matchesCategory;
  });

  return filtered.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
  });
}

function getFormValues() {
  return {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value.trim(),
    content: document.getElementById("content").value.trim(),
    image: document.getElementById("image").value.trim()
  };
}

function validateNews(payload) {
  const errors = [];
  if (!payload.title) errors.push("Title is required.");
  if (!payload.category) errors.push("Category is required.");
  if (!payload.content) errors.push("Content is required.");
  if (!payload.image) errors.push("Image URL is required.");
  return errors;
}

function clearForm() {
  document.getElementById("newsForm").reset();
  document.getElementById("newsId").value = "";
  document.getElementById("formTitle").textContent = "Add News";
  document.getElementById("saveBtn").textContent = "Add News";
}

function showMessage(text, type) {
  const message = document.getElementById("message");
  if (!message) return;

  message.textContent = text;
  message.className = `message ${type}`;

  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    message.textContent = "";
    message.className = "message";
  }, 2800);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isLocalhost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function getLocalApiBase() {
  if (isLocalhost()) {
    return window.location.origin;
  }

  // Admin is intended to run against the local Express server, even if the page
  // itself is opened from a file URL or a deployed static host.
  return "http://localhost:3000";
}
