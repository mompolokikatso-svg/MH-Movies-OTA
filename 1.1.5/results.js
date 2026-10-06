// ========================================
// MH MOVIES — SHARED RESULTS PAGE
// (movies + series, with pagination)
// ========================================

const API_BASE_URL = "https://tmdb.cyberharzard.workers.dev";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

const params = new URLSearchParams(window.location.search);
const resultType = params.get("type") || "movie";
const basePath = params.get("path") || "";
const pageTitle = params.get("title") || "Results";

const themeButton = document.getElementById("themeButton");
const backButton = document.getElementById("resultsBackButton");

// ---------- theme (synced with index) ----------
(function applyTheme() {
    let theme = "dark";

    try {
        const saved = localStorage.getItem("mhMoviesTheme");
        if (saved === "dark" || saved === "light") {
            theme = saved;
        }
    } catch (e) {
        // ignore
    }

    const apply = () => {
        const isDark = theme === "dark";
        document.body.classList.toggle("dark-mode", isDark);
        if (themeButton) {
            themeButton.textContent = isDark ? "🌙" : "☀️";
        }
    };

    apply();

    if (themeButton) {
        themeButton.addEventListener("click", () => {
            theme = theme === "dark" ? "light" : "dark";

            try {
                localStorage.setItem("mhMoviesTheme", theme);
            } catch (e) {
                // ignore
            }

            apply();
        });
    }
})();

function escapeHtml(value) {
    return String(value || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

if (backButton) {
    backButton.addEventListener("click", () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href =
                resultType === "tv" ? "series.html" : "index.html";
        }
    });
}

const titleEl = document.getElementById("resultsTitle");
const gridEl = document.getElementById("resultsGrid");
const paginationEl = document.getElementById("resultsPagination");
const prevButton = document.getElementById("resultsPrev");
const nextButton = document.getElementById("resultsNext");
const pageNumberEl = document.getElementById("resultsPageNumber");

let currentPage = 1;
let totalPages = 1;

if (titleEl) {
    titleEl.textContent = pageTitle;
}

async function fetchPage(page) {
    if (!basePath) {
        throw new Error("No results path provided.");
    }

    const separator = basePath.includes("?") ? "&" : "?";

    const url =
        API_BASE_URL +
        basePath +
        separator +
        "language=en-US&page=" +
        page;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("HTTP " + response.status);
    }

    return response.json();
}

function renderGrid(items) {
    if (!gridEl) return;

    gridEl.innerHTML = "";

    if (!items || !items.length) {
        gridEl.innerHTML = "<p>No results found.</p>";
        return;
    }

    items.forEach(item => {
        const isTv = resultType === "tv";
        const name = isTv ? item.name : item.title;

        if (!item.poster_path) return;

        const card = document.createElement("div");
        card.className = "movie-card";

        card.innerHTML = `
            <img
                src="${POSTER_BASE}${item.poster_path}"
                alt="${escapeHtml(name || "Title")}"
                loading="lazy"
            >
            <h3>${escapeHtml(name || "Unknown")}</h3>
            <p>⭐ ${
                item.vote_average != null
                    ? item.vote_average.toFixed(1)
                    : "N/A"
            }</p>
        `;

        card.addEventListener("click", () => {
            if (isTv) {
                window.location.href =
                    "series-details.html?id=" +
                    encodeURIComponent(item.id);
            } else {
                window.location.href =
                    "play.html?id=" + encodeURIComponent(item.id);
            }
        });

        gridEl.appendChild(card);
    });
}

function updatePagination() {
    if (paginationEl) {
        paginationEl.style.display = "flex";
    }

    if (pageNumberEl) {
        pageNumberEl.textContent = "Page " + currentPage;
    }

    if (prevButton) {
        prevButton.disabled = currentPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }
}

async function load(page) {
    gridEl.innerHTML = "<p>Loading...</p>";

    try {
        const data = await fetchPage(page);
        const results = data.results || [];

        currentPage = data.page || page;
        totalPages = Math.min(data.total_pages || 1, 500);

        renderGrid(results);
        updatePagination();

        window.scrollTo(0, 0);
    } catch (error) {
        console.error("MH Movies: results load failed:", error);
        gridEl.innerHTML = "<p>Unable to load results.</p>";

        if (paginationEl) {
            paginationEl.style.display = "none";
        }
    }
}

if (prevButton) {
    prevButton.addEventListener("click", () => {
        if (currentPage > 1) {
            load(currentPage - 1);
        }
    });
}

if (nextButton) {
    nextButton.addEventListener("click", () => {
        if (currentPage < totalPages) {
            load(currentPage + 1);
        }
    });
}

load(1);
