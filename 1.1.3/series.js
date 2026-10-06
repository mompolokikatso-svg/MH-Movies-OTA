// ========================================
// MH MOVIES — SERIES PAGE
// ========================================

const API_BASE_URL = "https://tmdb.cyberharzard.workers.dev";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

const loadingScreen = document.getElementById("loadingScreen");
const themeButton = document.getElementById("themeButton");

// ---------- loading screen ----------
function finishLoading() {
    if (loadingScreen) {
        loadingScreen.classList.add("hide");
    }
    document.body.classList.add("mh-app-ready");
}

// ---------- theme ----------
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

// ---------- bottom nav ----------
const homeNavButton = document.getElementById("homeNavButton");
const seriesNavButton = document.getElementById("seriesNavButton");
const watchlistNavButton = document.getElementById("watchlistNavButton");
const downloadsNavButton = document.getElementById("downloadsNavButton");

if (homeNavButton) {
    homeNavButton.addEventListener("click", () => {
        window.location.href = "index.html";
    });
}

if (seriesNavButton) {
    seriesNavButton.addEventListener("click", () => {
        window.location.href = "series.html";
    });
}

if (watchlistNavButton) {
    watchlistNavButton.addEventListener("click", () => {
        window.location.href = "watchlist.html";
    });
}

if (downloadsNavButton) {
    downloadsNavButton.addEventListener("click", () => {
        window.location.href = "offline.html";
    });
}

// ---------- helpers ----------
function escapeHtml(value) {
    return String(value || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function renderSeriesRow(container, items) {
    if (!container) return;

    container.innerHTML = "";

    (items || []).forEach(series => {
        if (!series || !series.poster_path) return;

        const card = document.createElement("div");
        card.className = "movie-card";

        card.innerHTML = `
            <img
                src="${POSTER_BASE}${series.poster_path}"
                alt="${escapeHtml(series.name || "Series")}"
                loading="lazy"
            >
            <h3>${escapeHtml(series.name || "Unknown")}</h3>
            <p>⭐ ${
                series.vote_average != null
                    ? series.vote_average.toFixed(1)
                    : "N/A"
            }</p>
        `;

        card.addEventListener("click", () => {
            window.location.href =
                "series-details.html?id=" +
                encodeURIComponent(series.id);
        });

        container.appendChild(card);
    });
}

async function fetchTv(path) {
    const separator = path.includes("?") ? "&" : "?";

    const response = await fetch(
        API_BASE_URL + path + separator + "language=en-US"
    );

    if (!response.ok) {
        throw new Error("TV HTTP " + response.status);
    }

    return response.json();
}

// ---------- load home rows ----------
async function loadSeriesSections() {
    try {
        const [anime, trending, popular, topRated, airing] =
            await Promise.all([
                fetchTv(
                    "/discover/tv?with_genres=16&sort_by=popularity.desc"
                ),
                fetchTv("/trending/tv/week"),
                fetchTv("/tv/popular"),
                fetchTv("/tv/top_rated"),
                fetchTv("/tv/airing_today")
            ]);

        renderSeriesRow(
            document.getElementById("animeSeries"),
            anime.results || []
        );
        renderSeriesRow(
            document.getElementById("trendingSeries"),
            trending.results || []
        );
        renderSeriesRow(
            document.getElementById("popularSeries"),
            popular.results || []
        );
        renderSeriesRow(
            document.getElementById("topRatedSeries"),
            topRated.results || []
        );
        renderSeriesRow(
            document.getElementById("airingSeries"),
            airing.results || []
        );
    } catch (error) {
        console.error("MH Movies: series load failed:", error);
    } finally {
        finishLoading();
    }
}

// ---------- genres ----------
async function loadSeriesGenres() {
    const container = document.getElementById("seriesGenres");

    if (!container) return;

    try {
        const data = await fetchTv("/genre/tv/list");

        (data.genres || []).forEach(genre => {
            const button = document.createElement("button");
            button.className = "genre-button";
            button.textContent = genre.name;
            button.addEventListener("click", () => {
                showSeriesResults(
                    "🎭 " + genre.name + " Series",
                    "/discover/tv?with_genres=" +
                        genre.id +
                        "&sort_by=popularity.desc"
                );
            });
            container.appendChild(button);
        });
    } catch (error) {
        console.error("MH Movies: series genres failed:", error);
    }
}

// ---------- results page ----------
const seriesResultsPage =
    document.getElementById("seriesResultsPage");
const seriesResultsGrid =
    document.getElementById("seriesResultsGrid");
const seriesResultsTitle =
    document.getElementById("seriesResultsTitle");
const backFromSeriesResults =
    document.getElementById("backFromSeriesResults");

async function showSeriesResults(title, endpoint) {
    if (!seriesResultsPage || !seriesResultsGrid) return;

    seriesResultsTitle.textContent = title;
    seriesResultsGrid.innerHTML = "<p>Loading...</p>";

    seriesResultsPage.classList.remove("hidden");
    seriesResultsPage.style.display = "block";

    try {
        const data = await fetchTv(endpoint);
        const results = data.results || [];

        seriesResultsGrid.innerHTML = "";

        results.forEach(series => {
            if (!series || !series.poster_path) return;

            const card = document.createElement("div");
            card.className = "movie-card";
            card.innerHTML = `
                <img
                    src="${POSTER_BASE}${series.poster_path}"
                    alt="${escapeHtml(series.name || "Series")}"
                    loading="lazy"
                >
                <h3>${escapeHtml(series.name || "Unknown")}</h3>
                <p>⭐ ${
                    series.vote_average != null
                        ? series.vote_average.toFixed(1)
                        : "N/A"
                }</p>
            `;
            card.addEventListener("click", () => {
                window.location.href =
                    "series-details.html?id=" +
                    encodeURIComponent(series.id);
            });
            seriesResultsGrid.appendChild(card);
        });

        seriesResultsPage.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error("MH Movies: series results failed:", error);
        seriesResultsGrid.innerHTML = "<p>Unable to load.</p>";
    }
}

if (backFromSeriesResults) {
    backFromSeriesResults.addEventListener("click", () => {
        seriesResultsPage.classList.add("hidden");
        seriesResultsPage.style.display = "none";
    });
}

// ---------- see more ----------
document
    .querySelectorAll(".see-more-button")
    .forEach(button => {
        button.addEventListener("click", () => {
            const section = button.dataset.section;

            const map = {
                anime: {
                    title: "🌸 Anime",
                    endpoint:
                        "/discover/tv?with_genres=16&sort_by=popularity.desc"
                },
                trending: {
                    title: "🔥 Trending Series",
                    endpoint: "/trending/tv/week"
                },
                popular: {
                    title: "⭐ Popular Series",
                    endpoint: "/tv/popular"
                },
                topRated: {
                    title: "🏆 Top Rated Series",
                    endpoint: "/tv/top_rated"
                },
                airing: {
                    title: "📡 Airing Today",
                    endpoint: "/tv/airing_today"
                }
            };

            const config = map[section];

            if (config) {
                showSeriesResults(config.title, config.endpoint);
            }
        });
    });

// ---------- search ----------
const seriesSearchInput =
    document.getElementById("seriesSearchInput");
const seriesSearchButton =
    document.getElementById("seriesSearchButton");

async function searchSeries() {
    const query = (seriesSearchInput?.value || "").trim();

    if (!query) {
        return;
    }

    try {
        const response = await fetch(
            API_BASE_URL +
                "/search/tv?query=" +
                encodeURIComponent(query) +
                "&language=en-US"
        );

        const data = await response.json();
        const results = data.results || [];

        if (!results.length) {
            return;
        }

        window.location.href =
            "series-details.html?id=" +
            encodeURIComponent(results[0].id);
    } catch (error) {
        console.error("MH Movies: series search failed:", error);
    }
}

if (seriesSearchButton) {
    seriesSearchButton.addEventListener("click", searchSeries);
}

if (seriesSearchInput) {
    seriesSearchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            searchSeries();
        }
    });
}

// ---------- boot ----------
loadSeriesSections();
loadSeriesGenres();
