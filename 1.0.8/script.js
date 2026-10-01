// ========================================
// MH MOVIES API CONFIGURATION
// ========================================

const API_BASE_URL =
    "https://tmdb.cyberharzard.workers.dev";


// ========================================
// ELEMENTS
// ========================================

const movieGrid =
    document.getElementById("movieGrid");

const searchInput =
    document.getElementById("searchInput");

const availableMovies =
    document.getElementById("availableMovies");

const searchButton =
    document.getElementById("searchButton");

const themeButton =
    document.getElementById("themeButton");

const homePage =
    document.getElementById("homePage");

const detailsPage =
    document.getElementById("detailsPage");

const backButton =
    document.getElementById("backButton");

const detailsPoster =
    document.getElementById("detailsPoster");

const detailsTitle =
    document.getElementById("detailsTitle");

const detailsRating =
    document.getElementById("detailsRating");

const detailsDate =
    document.getElementById("detailsDate");

const detailsRuntime =
    document.getElementById("detailsRuntime");

const detailsGenres =
    document.getElementById("detailsGenres");

const detailsOverview =
    document.getElementById("detailsOverview");

const watchButton =
    document.getElementById("watchButton");

const trailerButton =
    document.getElementById("trailerButton");

const trailerPlayer =
    document.getElementById("trailerPlayer");

const trailerFrame =
    document.getElementById("trailerFrame");

const closeTrailer =
    document.getElementById("closeTrailer");

const downloadButton =
    document.getElementById("downloadButton");

const favoriteButton =
    document.getElementById("favoriteButton");

const watchlistButton = document.getElementById("watchlistButton");

if (watchlistButton) {
    watchlistButton.addEventListener("click", () => {
        window.location.href = "watchlist.html";
    });
}

const downloadsButton =
    document.getElementById("downloadsButton");


// =========================================================
// MH MOVIES
// SESSION / PAGE RESTORE
// =========================================================

const MH_SESSION_KEY =
    "mhMoviesSession";


function saveMHSession(
    extra = {}
) {

    try {

        let existing = {};

        try {

            existing =
                JSON.parse(
                    localStorage.getItem(
                        MH_SESSION_KEY
                    ) || "{}"
                );

        } catch (error) {

            existing = {};

        }

        const session = {

            ...existing,

            page:
                window.location.pathname
                    .split("/")
                    .pop() ||
                "index.html",

            url:
                window.location.href,

            scrollY:
                window.scrollY ||
                0,

            timestamp:
                Date.now(),

            ...extra

        };

        localStorage.setItem(
            MH_SESSION_KEY,
            JSON.stringify(
                session
            )
        );

    } catch (error) {

        console.error(
            "MH Movies: unable to save session:",
            error
        );

    }

}


function getMHSession() {

    try {

        const saved =
            localStorage.getItem(
                MH_SESSION_KEY
            );

        if (!saved) {

            return null;

        }

        const session =
            JSON.parse(
                saved
            );

        if (
            !session ||
            typeof session !== "object"
        ) {

            return null;

        }

        return session;

    } catch (error) {

        console.error(
            "MH Movies: unable to read session:",
            error
        );

        return null;

    }

}


function clearMHSession() {

    try {

        localStorage.removeItem(
            MH_SESSION_KEY
        );

    } catch (error) {

        console.error(
            "MH Movies: unable to clear session:",
            error
        );

    }

}


window.addEventListener(
    "pagehide",
    () => {

        saveMHSession();

    }
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "hidden"
        ) {

            saveMHSession();

        }

    }
);


// =========================================================
// CUSTOM ALERT POPUP
// =========================================================

function showMovieAlert(message) {

    const existing =
        document.querySelector(
            ".alerts"
        );

    if (existing) {

        existing.remove();

    }

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        "alerts";

    const box =
        document.createElement(
            "div"
        );

    box.className =
        "alert-box";

    const messageText =
        document.createElement(
            "div"
        );

    messageText.className =
        "alert-message";

    messageText.textContent =
        message;

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "alert-actions";

    const okButton =
        document.createElement(
            "button"
        );

    okButton.className =
        "alert-confirm";

    okButton.textContent =
        "OK";

    okButton.addEventListener(
        "click",
        () => {

            overlay.remove();

        }
    );

    actions.appendChild(
        okButton
    );

    box.appendChild(
        messageText
    );

    box.appendChild(
        actions
    );

    overlay.appendChild(
        box
    );

    document.body.appendChild(
        overlay
    );

}


// ========================================
// DOWNLOADS PAGE
// ========================================

if (downloadsButton) {

    downloadsButton.addEventListener(
        "click",
        () => {

            saveMHSession({

                page:
                    "index.html",

                returnPage:
                    "downloads",

                scrollY:
                    window.scrollY || 0

            });

            window.location.href =
                "offline.html";

        }
    );

}


// ========================================
// MH MOVIES API REQUEST
// ========================================

async function tmdbRequest(
    endpoint
) {

    try {

        const response =
            await fetch(
                API_BASE_URL +
                endpoint,
                {
                    method:
                        "GET",

                    headers: {

                        accept:
                            "application/json"

                    }

                }
            );

        if (!response.ok) {

            throw new Error(
                `API error: ${response.status}`
            );

        }

        return await response.json();

    } catch (error) {

        console.error(
            "MH Movies API request failed:",
            error
        );

        if (movieGrid) {

            movieGrid.innerHTML = `
                <p>Unable to load movies.</p>
            `;

        }

        return null;

    }

}


// =========================================================
// STREAMING HOME SECTIONS
// =========================================================

async function loadHomeSections() {

    try {

        const [
            trending,
            popular,
            nowPlaying,
            topRated
        ] = await Promise.all([

            tmdbRequest(
                "/trending/movie/week?language=en-US"
            ),

            tmdbRequest(
                "/movie/popular?language=en-US&page=1"
            ),

            tmdbRequest(
                "/movie/now_playing?language=en-US&page=1"
            ),

            tmdbRequest(
                "/movie/top_rated?language=en-US&page=1"
            )

        ]);

        if (trending) {

            displayHorizontalMovies(
                trending.results || [],
                "trendingMovies"
            );

        }

        if (popular) {

            displayHorizontalMovies(
                popular.results || [],
                "popularMovies"
            );

        }

        if (nowPlaying) {

            displayHorizontalMovies(
                nowPlaying.results || [],
                "nowPlayingMovies"
            );

        }

        if (topRated) {

            displayHorizontalMovies(
                topRated.results || [],
                "topRatedMovies"
            );

        }

    } catch (error) {

        console.error(
            "Failed to load home sections:",
            error
        );

    }

}


// =========================================================
// HORIZONTAL MOVIE CARDS
// =========================================================

function displayHorizontalMovies(
    movies,
    containerId
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {

        return;

    }

    container.innerHTML =
        "";

    movies.forEach(
        movie => {

            if (!movie.poster_path) {

                return;

            }

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "movie-card";

            card.innerHTML = `

                <img
                    src="https://image.tmdb.org/t/p/w500${movie.poster_path}"
                    alt="${movie.title || "Movie"}"
                    loading="lazy"
                >

                <h3>
                    ${movie.title || "Unknown Title"}
                </h3>

                <p>
                    ⭐ ${
                        movie.vote_average != null
                            ? movie.vote_average.toFixed(1)
                            : "N/A"
                    }
                </p>

            `;

            card.addEventListener(
                "click",
                () =>
                    openMovieDetails(
                        movie.id
                    )
            );

            container.appendChild(
                card
            );

        }
    );

}


// =========================================================
// REMOTE FREE MOVIE CATALOGUE
// =========================================================

const MOVIE_CATALOGUE_URL =
    "https://freelegalmovies.cyberharzard.workers.dev/";

let availableMovieList =
    [];


async function loadAvailableMovies() {

    try {

        const response =
            await fetch(
                MOVIE_CATALOGUE_URL,
                {
                    method:
                        "GET",

                    cache:
                        "no-store"

                }
            );

        if (!response.ok) {

            throw new Error(
                `Catalogue error: ${response.status}`
            );

        }

        const movies =
            await response.json();

        if (!Array.isArray(movies)) {

            throw new Error(
                "Invalid movie catalogue."
            );

        }

        availableMovieList =
            movies;

        displayAvailableMovies();

    } catch (error) {

        console.error(
            "Failed to load movie catalogue:",
            error
        );

        if (availableMovies) {

            availableMovies.innerHTML = `
                <p>Unable to load available movies.</p>
            `;

        }

    }

}


function displayAvailableMovies() {

    if (!availableMovies) {

        return;

    }

    availableMovies.innerHTML =
        "";

    availableMovieList.forEach(
        movie => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "movie-card";

            card.innerHTML = `

                <img
                    src="${movie.poster || ""}"
                    alt="${movie.title || "Movie"}"
                    loading="lazy"
                >

                <h3>
                    ${movie.title || "Unknown Title"}
                </h3>

                <p>
                    ${movie.year || ""}
                </p>

                <button class="watch-now-button">
                    ▶ Watch Now
                </button>

            `;

            const watchNowButton =
                card.querySelector(
                    ".watch-now-button"
                );

            watchNowButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    if (!movie.videoUrl) {

                        showMovieAlert(
                            "This movie is not available to watch yet."
                        );

                        return;

                    }

                    saveMHSession({

                        page:
                            "index.html",

                        returnPage:
                            "available-movies",

                        movieId:
                            movie.id,

                        scrollY:
                            window.scrollY || 0

                    });

                    window.location.href =
                        `play.html?freeMovie=${encodeURIComponent(
                            movie.id
                        )}&video=${encodeURIComponent(
                            movie.videoUrl
                        )}`;

                }
            );

            availableMovies.appendChild(
                card
            );

        }
    );

}


// ========================================
// DISPLAY MOVIES
// ========================================

function displayMovies(
    movies
) {

    if (!movieGrid) {

        return;

    }

    movieGrid.innerHTML =
        "";

    if (
        !movies ||
        movies.length === 0
    ) {

        movieGrid.innerHTML = `
            <p>No movies found.</p>
        `;

        return;

    }

    movies.forEach(
        movie => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "movie-card";

            const poster =
                movie.poster_path

                    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`

                    : "https://via.placeholder.com/500x750?text=No+Poster";

            card.innerHTML = `

                <img
                    src="${poster}"
                    alt="Movie poster"
                    loading="lazy"
                >

                <h3>
                    ${movie.title || "Unknown Title"}
                </h3>

            `;

            card.addEventListener(
                "click",
                () => {

                    openMovieDetails(
                        movie.id
                    );

                }
            );

            movieGrid.appendChild(
                card
            );

        }
    );

}


// ========================================
// PAGINATION
// ========================================

const pagination =
    document.getElementById(
        "pagination"
    );

const previousPage =
    document.getElementById(
        "previousPage"
    );

const nextPage =
    document.getElementById(
        "nextPage"
    );

const pageNumber =
    document.getElementById(
        "pageNumber"
    );


let currentPage =
    1;

let totalPages =
    1;

let currentPaginationType =
    "";

let currentPaginationValue =
    "";


// ========================================
// LOAD PAGINATED MOVIES
// ========================================

async function loadPaginatedMovies(
    page = 1
) {

    let endpoint =
        "";

    if (
        currentPaginationType ===
        "search"
    ) {

        endpoint =
            `/search/movie?query=${encodeURIComponent(
                currentPaginationValue
            )}&language=en-US&page=${page}`;

    }

    if (
        currentPaginationType ===
        "genre"
    ) {

        endpoint =
            `/discover/movie?with_genres=${currentPaginationValue}&language=en-US&sort_by=popularity.desc&page=${page}`;

    }

    if (
        currentPaginationType ===
        "section"
    ) {

        endpoint =
            `${currentPaginationValue}&page=${page}`;

    }

    if (!endpoint) {

        return;

    }

    const data =
        await tmdbRequest(
            endpoint
        );

    if (!data) {

        return;

    }

    currentPage =
        data.page ||
        page;

    totalPages =
        Math.min(
            data.total_pages ||
                1,
            500
        );

    displayMovies(
        data.results ||
        []
    );

    updatePagination();

    window.scrollTo(
        0,
        0
    );

}


// ========================================
// UPDATE PAGINATION
// ========================================

function updatePagination() {

    if (!pagination) {

        return;

    }

    pagination.style.display =
        "flex";

    if (pageNumber) {

        pageNumber.textContent =
            `Page ${currentPage}`;

    }

    if (previousPage) {

        previousPage.disabled =
            currentPage <= 1;

    }

    if (nextPage) {

        nextPage.disabled =
            currentPage >=
            totalPages;

    }

}


// ========================================
// PREVIOUS PAGE
// ========================================

if (previousPage) {

    previousPage.addEventListener(
        "click",
        () => {

            if (
                currentPage > 1
            ) {

                loadPaginatedMovies(
                    currentPage - 1
                );

            }

        }
    );

}


// ========================================
// NEXT PAGE
// ========================================

if (nextPage) {

    nextPage.addEventListener(
        "click",
        () => {

            if (
                currentPage <
                totalPages
            ) {

                loadPaginatedMovies(
                    currentPage + 1
                );

            }

        }
    );

}


// ========================================
// LOAD POPULAR MOVIES
// ========================================

async function loadPopularMovies() {

    const data =
        await tmdbRequest(
            "/movie/popular?language=en-US&page=1"
        );

    if (data) {

        displayMovies(
            data.results ||
            []
        );

    }

}


// ========================================
// SEARCH MOVIES
// ========================================

async function searchMovies(
    query
) {

    currentPaginationType =
        "search";

    currentPaginationValue =
        query;

    homePage.style.display =
        "none";

    detailsPage.style.display =
        "none";

    const searchResultsPage =
        document.getElementById(
            "searchResultsPage"
        );

    if (!searchResultsPage) {

        return;

    }

    searchResultsPage.classList.remove(
        "hidden"
    );

    searchResultsPage.style.display =
        "block";

    const resultsTitle =
        searchResultsPage.querySelector(
            "h2"
        );

    if (resultsTitle) {

        resultsTitle.textContent =
            "Search Results";

    }

    await loadPaginatedMovies(
        1
    );

}


// ========================================
// OPEN MOVIE DETAILS
// ========================================

async function openMovieDetails(
    movieId
) {

    const detailsLoading =
        document.getElementById(
            "detailsLoading"
        );

    saveMHSession({

        page:
            "index.html",

        returnPage:
            "home",

        movieId:
            movieId,

        scrollY:
            window.scrollY || 0

    });

    homePage.style.display =
        "none";

    const searchResultsPage =
        document.getElementById(
            "searchResultsPage"
        );

    if (searchResultsPage) {

        searchResultsPage.style.display =
            "none";

        searchResultsPage.classList.add(
            "hidden"
        );

    }

    detailsPage.classList.remove(
        "hidden"
    );

    detailsPage.style.display =
        "block";

    if (detailsLoading) {

        detailsLoading.style.display =
            "flex";

    }

    detailsPoster.style.display =
        "none";

    detailsTitle.style.display =
        "none";

    detailsRating.style.display =
        "none";

    detailsDate.style.display =
        "none";

    detailsRuntime.style.display =
        "none";

    detailsGenres.style.display =
        "none";

    detailsOverview.style.display =
        "none";

    const detailsButtons =
        document.querySelector(
            ".details-buttons"
        );

    if (detailsButtons) {

        detailsButtons.style.display =
            "none";

    }

    const movie =
        await tmdbRequest(
            `/movie/${movieId}?language=en-US`
        );

    if (!movie) {

        if (detailsLoading) {

            detailsLoading.innerHTML = `

                <div class="details-loading-title">
                    Unable to fetch movie data.
                </div>

                <div class="details-loading-text">
                    Please try again.
                </div>

            `;

        }

        return;

    }

    const poster =
        movie.poster_path

            ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`

            : "https://via.placeholder.com/780x1170?text=No+Poster";

    detailsPoster.src =
        poster;

    detailsTitle.textContent =
        movie.title ||
        "Unknown Title";

    detailsRating.textContent =
        `⭐ ${
            movie.vote_average != null
                ? movie.vote_average.toFixed(1)
                : "N/A"
        }`;

    detailsDate.textContent =
        movie.release_date

            ? `📅 ${movie.release_date}`

            : "📅 Unknown";

    detailsRuntime.textContent =
        movie.runtime

            ? `⏱️ ${movie.runtime} min`

            : "";

    detailsGenres.textContent =
        movie.genres &&
        movie.genres.length

            ? "🎭 " +
              movie.genres
                  .map(
                      genre =>
                          genre.name
                  )
                  .join(", ")

            : "";

    detailsOverview.textContent =
        movie.overview ||
        "No description available.";

    watchButton.dataset.movieId =
        movie.id;

    trailerButton.dataset.movieId =
        movie.id;

    downloadButton.dataset.movieId =
        movie.id;

    favoriteButton.dataset.movieId =
        movie.id;

    if (detailsLoading) {

        detailsLoading.style.display =
            "none";

    }

    detailsPoster.style.display =
        "";

    detailsTitle.style.display =
        "";

    detailsRating.style.display =
        "";

    detailsDate.style.display =
        "";

    detailsRuntime.style.display =
        "";

    detailsGenres.style.display =
        "";

    detailsOverview.style.display =
        "";

    if (detailsButtons) {

        detailsButtons.style.display =
            "";

    }

    window.scrollTo(
        0,
        0
    );

}


// ========================================
// BACK BUTTON
// ========================================

if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            detailsPage.style.display =
                "none";

            homePage.style.display =
                "block";

            const session =
                getMHSession();

            const restoreScroll =
                session &&
                Number.isFinite(
                    Number(
                        session.scrollY
                    )
                )
                    ? Number(
                        session.scrollY
                    )
                    : 0;

            window.scrollTo(
                0,
                restoreScroll
            );

        }
    );

}


// ========================================
// BACK FROM SEARCH
// ========================================

const backFromSearch =
    document.getElementById(
        "backFromSearch"
    );


if (backFromSearch) {

    backFromSearch.addEventListener(
        "click",
        () => {

            const searchResultsPage =
                document.getElementById(
                    "searchResultsPage"
                );

            if (searchResultsPage) {

                searchResultsPage.style.display =
                    "none";

                searchResultsPage.classList.add(
                    "hidden"
                );

            }

            homePage.style.display =
                "block";

            const session =
                getMHSession();

            const restoreScroll =
                session &&
                Number.isFinite(
                    Number(
                        session.scrollY
                    )
                )
                    ? Number(
                        session.scrollY
                    )
                    : 0;

            window.scrollTo(
                0,
                restoreScroll
            );

        }
    );

}


// =========================================================
// ANDROID PHONE BACK BUTTON
// =========================================================

const App =
    window.Capacitor?.Plugins?.App;

let homeBackArmed =
    false;

let homeBackTimer =
    null;


if (App) {

    App.addListener(
        "backButton",
        async ({ canGoBack }) => {

            const currentPage =
                window.location.pathname
                    .split("/")
                    .pop();

            const isHome =
                currentPage === "" ||
                currentPage ===
                    "index.html";

            if (isHome) {

                if (homeBackArmed) {

                    clearTimeout(
                        homeBackTimer
                    );

                    homeBackArmed =
                        false;

                    App.exitApp();

                    return;

                }

                homeBackArmed =
                    true;

                showMovieAlert(
                    "Press back again to exit app"
                );

                clearTimeout(
                    homeBackTimer
                );

                homeBackTimer =
                    setTimeout(
                        () => {

                            homeBackArmed =
                                false;

                        },
                        2000
                    );

                return;

            }

            if (canGoBack) {

                window.history.back();

            } else {

                saveMHSession({

                    page:
                        "index.html",

                    returnPage:
                        "home",

                    scrollY:
                        0

                });

                window.location.href =
                    "index.html";

            }

        }
    );

}


// ========================================
// WATCH BUTTON
// ========================================

if (watchButton) {

    watchButton.addEventListener(
        "click",
        () => {

            const movieId =
                watchButton.dataset.movieId;

            if (!movieId) {

                return;

            }

            const freeMovie =
                availableMovieList.find(
                    movie =>
                        String(movie.id) ===
                        String(movieId)
                );

            if (
                freeMovie &&
                freeMovie.videoUrl
            ) {

                saveMHSession({

                    page:
                        "index.html",

                    returnPage:
                        "movie-details",

                    movieId:
                        movieId,

                    scrollY:
                        window.scrollY || 0

                });

                window.location.href =
                    `play.html?id=${movieId}&freeMovie=${encodeURIComponent(
                        freeMovie.id
                    )}&video=${encodeURIComponent(
                        freeMovie.videoUrl
                    )}`;

                return;

            }

            saveMHSession({

                page:
                    "index.html",

                returnPage:
                    "movie-details",

                movieId:
                    movieId,

                scrollY:
                    window.scrollY || 0

            });

            window.location.href =
                `play.html?id=${movieId}`;

        }
    );

}


// ========================================
// DOWNLOAD PARTS
// ========================================

function createDownloadParts(
    partCount = 8
) {

    const parts =
        [];

    const partSize =
        100 /
        partCount;

    for (
        let i = 0;
        i < partCount;
        i++
    ) {

        const start =
            i *
            partSize;

        const end =
            (i + 1) *
            partSize;

        parts.push({

            id:
                i + 1,

            startPercent:
                start,

            endPercent:
                end,

            progress:
                0,

            downloaded:
                0,

            status:
                "Waiting"

        });

    }

    return parts;

}


// ========================================
// DOWNLOAD BUTTON
// ========================================

if (downloadButton) {

    downloadButton.addEventListener(
        "click",
        async () => {

            const movieId =
                downloadButton.dataset.movieId;

            if (!movieId) {
                return;
            }

            saveMHSession({
                page:
                    "index.html",

                returnPage:
                    "downloads",

                movieId:
                    movieId,

                scrollY:
                    window.scrollY || 0
            });

            window.location.href =
                "play.html?id=" +
                encodeURIComponent(movieId) +
                "&autoDownload=1";

        }
    );

}


// ========================================
// PLAY TRAILER
// ========================================

if (trailerButton) {

    trailerButton.addEventListener(
        "click",
        async () => {

            const movieId =
                trailerButton.dataset.movieId;

            if (!movieId) {

                return;

            }

            trailerButton.textContent =
                "Loading trailer...";

            const data =
                await tmdbRequest(
                    `/movie/${movieId}/videos?language=en-US`
                );

            if (
                !data ||
                !data.results
            ) {

                trailerButton.textContent =
                    "▶ Play Trailer";

                showMovieAlert(
                    "Trailer not available."
                );

                return;

            }

            const trailer =
                data.results.find(
                    video =>
                        video.site ===
                            "YouTube" &&

                        video.type ===
                            "Trailer" &&

                        video.key
                );

            if (!trailer) {

                trailerButton.textContent =
                    "▶ Play Trailer";

                showMovieAlert(
                    "Trailer not available."
                );

                return;

            }

            trailerFrame.src =
                `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&playsinline=1&rel=0`;

            trailerPlayer.classList.remove(
                "hidden"
            );

            trailerButton.textContent =
                "▶ Play Trailer";

            trailerPlayer.scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "center"

            });

        }
    );

}


// ========================================
// CLOSE TRAILER
// ========================================

if (closeTrailer) {

    closeTrailer.addEventListener(
        "click",
        () => {

            trailerFrame.src =
                "";

            trailerPlayer.classList.add(
                "hidden"
            );

        }
    );

}


// ========================================
// WATCHLIST
// ========================================

if (favoriteButton) {

    favoriteButton.addEventListener(
        "click",
        () => {

            const movieId =
                favoriteButton.dataset.movieId;

            let watchlist =
                JSON.parse(
                    localStorage.getItem(
                        "watchlist"
                    )
                ) || [];

            if (
                !watchlist.includes(
                    movieId
                )
            ) {

                watchlist.push(
                    movieId
                );

                localStorage.setItem(
                    "watchlist",
                    JSON.stringify(
                        watchlist
                    )
                );

                favoriteButton.textContent =
                    "❤️ Added to Watchlist";

            } else {

                watchlist =
                    watchlist.filter(
                        id =>
                            id !== movieId
                    );

                localStorage.setItem(
                    "watchlist",
                    JSON.stringify(
                        watchlist
                    )
                );

                favoriteButton.textContent =
                    "❤️ Add to Watchlist";

            }

        }
    );

}


// ========================================
// SEARCH BUTTON
// ========================================

if (searchButton) {

    searchButton.addEventListener(
        "click",
        () => {

            const query =
                searchInput.value.trim();

            if (!query) {

                loadPopularMovies();

                return;

            }

            searchMovies(
                query
            );

        }
    );

}


// ========================================
// ENTER KEY SEARCH
// ========================================

if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                searchButton.click();

            }

        }
    );

}


// ========================================
// DARK MODE
// ========================================

function applySavedTheme() {

    const savedTheme =
        localStorage.getItem(
            "mhMoviesTheme"
        );

    if (
        savedTheme ===
        "dark"
    ) {

        document.body.classList.add(
            "dark-mode"
        );

    } else {

        document.body.classList.remove(
            "dark-mode"
        );

    }

}


if (themeButton) {

    themeButton.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "dark-mode"
            );

            const isDark =
                document.body.classList.contains(
                    "dark-mode"
                );

            localStorage.setItem(
                "mhMoviesTheme",
                isDark
                    ? "dark"
                    : "light"
            );

        }
    );

}


applySavedTheme();


// ========================================
// MOVIE GENRES
// ========================================

async function loadGenres() {

    const genresContainer =
        document.getElementById(
            "genresContainer"
        );

    if (!genresContainer) {

        return;

    }

    const data =
        await tmdbRequest(
            "/genre/movie/list?language=en-US"
        );

    if (
        !data ||
        !data.genres
    ) {

        return;

    }

    genresContainer.innerHTML =
        "";

    data.genres.forEach(
        genre => {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "genre-button";

            button.textContent =
                genre.name;

            button.addEventListener(
                "click",
                () => {

                    searchGenreMovies(
                        genre.id,
                        genre.name
                    );

                }
            );

            genresContainer.appendChild(
                button
            );

        }
    );

}


// ========================================
// SEE MORE GENRES
// ========================================

const seeMoreGenres =
    document.getElementById(
        "seeMoreGenres"
    );

const genresPage =
    document.getElementById(
        "genresPage"
    );

const allGenresContainer =
    document.getElementById(
        "allGenresContainer"
    );

const backFromGenres =
    document.getElementById(
        "backFromGenres"
    );


if (seeMoreGenres) {

    seeMoreGenres.addEventListener(
        "click",
        async () => {

            saveMHSession({

                page:
                    "index.html",

                returnPage:
                    "genres",

                scrollY:
                    window.scrollY || 0

            });

            homePage.style.display =
                "none";

            detailsPage.style.display =
                "none";

            genresPage.classList.remove(
                "hidden"
            );

            genresPage.style.display =
                "block";

            allGenresContainer.innerHTML = `
                <p>Loading genres...</p>
            `;

            const data =
                await tmdbRequest(
                    "/genre/movie/list?language=en-US"
                );

            if (
                !data ||
                !data.genres
            ) {

                allGenresContainer.innerHTML = `
                    <p>Unable to load genres.</p>
                `;

                return;

            }

            allGenresContainer.innerHTML =
                "";

            data.genres.forEach(
                genre => {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.className =
                        "genre-button";

                    button.textContent =
                        genre.name;

                    button.addEventListener(
                        "click",
                        () => {

                            searchGenreMovies(
                                genre.id,
                                genre.name
                            );

                        }
                    );

                    allGenresContainer.appendChild(
                        button
                    );

                }
            );

            window.scrollTo(
                0,
                0
            );

        }
    );

}


// ========================================
// BACK FROM GENRES
// ========================================

if (backFromGenres) {

    backFromGenres.addEventListener(
        "click",
        () => {

            genresPage.style.display =
                "none";

            genresPage.classList.add(
                "hidden"
            );

            homePage.style.display =
                "block";

            const session =
                getMHSession();

            const restoreScroll =
                session &&
                Number.isFinite(
                    Number(
                        session.scrollY
                    )
                )
                    ? Number(
                        session.scrollY
                    )
                    : 0;

            window.scrollTo(
                0,
                restoreScroll
            );

        }
    );

}


// ========================================
// SEARCH MOVIES BY GENRE
// ========================================

async function searchGenreMovies(
    genreId,
    genreName
) {

    currentPaginationType =
        "genre";

    currentPaginationValue =
        genreId;

    homePage.style.display =
        "none";

    detailsPage.style.display =
        "none";

    if (genresPage) {

        genresPage.style.display =
            "none";

        genresPage.classList.add(
            "hidden"
        );

    }

    const searchResultsPage =
        document.getElementById(
            "searchResultsPage"
        );

    if (!searchResultsPage) {

        return;

    }

    searchResultsPage.classList.remove(
        "hidden"
    );

    searchResultsPage.style.display =
        "block";

    const resultsTitle =
        searchResultsPage.querySelector(
            "h2"
        );

    if (resultsTitle) {

        resultsTitle.textContent =
            `🎭 ${genreName} Movies`;

    }

    await loadPaginatedMovies(
        1
    );

}


// ========================================
// SEE MORE + PAGINATION
// ========================================

document
    .querySelectorAll(
        ".see-more-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const section =
                        button.dataset.section;

                    let endpoint =
                        "";

                    let title =
                        "";

                    if (
                        section ===
                        "trending"
                    ) {

                        endpoint =
                            "/trending/movie/week?language=en-US";

                        title =
                            "🔥 Trending Movies";

                    }

                    if (
                        section ===
                        "popular"
                    ) {

                        endpoint =
                            "/movie/popular?language=en-US";

                        title =
                            "⭐ Popular Movies";

                    }

                    if (
                        section ===
                        "nowPlaying"
                    ) {

                        endpoint =
                            "/movie/now_playing?language=en-US";

                        title =
                            "🆕 Now Playing";

                    }

                    if (
                        section ===
                        "topRated"
                    ) {

                        endpoint =
                            "/movie/top_rated?language=en-US";

                        title =
                            "🏆 Top Rated Movies";

                    }

                    if (!endpoint) {

                        return;

                    }

                    currentPaginationType =
                        "section";

                    currentPaginationValue =
                        endpoint;

                    saveMHSession({

                        page:
                            "index.html",

                        returnPage:
                            "section",

                        section:
                            section,

                        scrollY:
                            window.scrollY || 0

                    });

                    homePage.style.display =
                        "none";

                    detailsPage.style.display =
                        "none";

                    const searchResultsPage =
                        document.getElementById(
                            "searchResultsPage"
                        );

                    if (!searchResultsPage) {

                        return;

                    }

                    searchResultsPage.classList.remove(
                        "hidden"
                    );

                    searchResultsPage.style.display =
                        "block";

                    const resultsTitle =
                        searchResultsPage.querySelector(
                            "h2"
                        );

                    if (resultsTitle) {

                        resultsTitle.textContent =
                            title;

                    }

                    await loadPaginatedMovies(
                        1
                    );

                }
            );

        }
    );


// ========================================
// START APP
// ========================================

const loadingScreen =
    document.getElementById(
        "loadingScreen"
    );


async function startApp() {

    const appAlreadyOpened =
        sessionStorage.getItem(
            "mhMoviesAppOpened"
        ) === "1";

    if (appAlreadyOpened) {

        if (loadingScreen) {
            loadingScreen.classList.add("hide");
        }

        document.body.classList.add("mh-app-ready");

    }

    await loadHomeSections();

    loadGenres();

    await loadAvailableMovies();

    setTimeout(
        () => {

            if (loadingScreen) {
                loadingScreen.classList.add("hide");
            }

            document.body.classList.add("mh-app-ready");

            sessionStorage.setItem(
                "mhMoviesAppOpened",
                "1"
            );

        },
        300
    );

}



// =========================================================
// INTERNET CONNECTION DETECTION
// =========================================================

const CONNECTION_CHECK_URL =
    "https://tmdb.cyberharzard.workers.dev";


async function checkInternetConnection() {

    if (!navigator.onLine) {
        return false;
    }

    try {
        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                5000
            );

        await fetch(
            "https://www.google.com/generate_204",
            {
                method: "GET",
                cache: "no-store",
                mode: "no-cors",
                signal: controller.signal
            }
        );

        clearTimeout(timeout);

        return true;

    } catch (error) {

        console.warn(
            "MH Movies: real internet check failed:",
            error
        );

        return false;
    }
}

// =========================================================
// INITIAL CONNECTION CHECK
// =========================================================

async function updateConnectionStatus() {

    const connected =
        await checkInternetConnection();

    if (!connected) {

        console.log(
            "📴 No working internet connection"
        );

        saveMHSession({

            page:
                "index.html",

            returnPage:
                "offline",

            scrollY:
                window.scrollY || 0

        });

        window.location.href =
            "offline.html";

        return;

    }

    console.log(
        "🌐 Internet connection confirmed"
    
    );

    await startApp();
}


updateConnectionStatus();


// =========================================================
// CONNECTION LOST
// =========================================================

window.addEventListener(
    "offline",
    () => {

        console.log(
            "📴 Network connection lost"
        );

        saveMHSession({

            page:
                "index.html",

            returnPage:
                "offline",

            scrollY:
                window.scrollY || 0

        });

        window.location.href =
            "offline.html";

    }
);


// =========================================================
// CONNECTION RESTORED
// =========================================================

window.addEventListener(
    "online",
    async () => {

        console.log(
            "🌐 Network connection detected"
        );

        const connected =
            await checkInternetConnection();

        if (connected) {

            console.log(
                "🌐 Internet connection restored"
            );

        }

    }
);
/* ========================================
   BOTTOM NAVIGATION
   ======================================== */

const homeNavButton =
    document.getElementById("homeNavButton");

const watchlistNavButton =
    document.getElementById("watchlistNavButton");

const downloadsNavButton =
    document.getElementById("downloadsNavButton");

if (homeNavButton) {
    homeNavButton.addEventListener(
        "click",
        () => {
            window.location.href = "index.html";
        }
    );
}

if (watchlistNavButton) {
    watchlistNavButton.addEventListener(
        "click",
        () => {
            window.location.href = "watchlist.html";
        }
    );
}

if (downloadsNavButton) {
    downloadsNavButton.addEventListener(
        "click",
        () => {
            window.location.href = "offline.html";
        }
    );
}
