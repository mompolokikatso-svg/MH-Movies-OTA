const TMDB_API =
    "https://tmdb.cyberharzard.workers.dev";

const watchlistGrid =
    document.getElementById("watchlistGrid");

const emptyWatchlist =
    document.getElementById("emptyWatchlist");

const backButton =
    document.getElementById("backButton");


async function tmdbRequest(endpoint) {

    try {

        const response =
            await fetch(
                TMDB_API + endpoint
            );

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch (error) {

        console.error(
            "MH Movies Watchlist:",
            error
        );

        return null;
    }
}


async function loadWatchlist() {

    let watchlist = [];

    try {

        watchlist =
            JSON.parse(
                localStorage.getItem(
                    "watchlist"
                ) || "[]"
            );

    } catch (error) {

        watchlist = [];
    }

    if (
        !Array.isArray(watchlist) ||
        watchlist.length === 0
    ) {

        watchlistGrid.innerHTML = "";
        emptyWatchlist.style.display = "block";

        return;
    }

    emptyWatchlist.style.display = "none";

    watchlistGrid.innerHTML = "";

    for (
        const movieId of watchlist
    ) {

        const movie =
            await tmdbRequest(
                `/movie/${encodeURIComponent(movieId)}?language=en-US`
            );

        if (!movie) {
            continue;
        }

        const card =
            document.createElement("div");

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

                window.location.href =
                    "play.html?id=" +
                    encodeURIComponent(movie.id);

            }
        );

        watchlistGrid.appendChild(card);
    }

    if (
        watchlistGrid.children.length === 0
    ) {

        emptyWatchlist.style.display = "block";

    }

}


if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "index.html";

        }
    );

}


loadWatchlist();
