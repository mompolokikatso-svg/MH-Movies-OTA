const getMHExtractor = () => window.Capacitor?.Plugins?.MHExtractor || null;

/* =========================================================
   MH MOVIES
   MOVIE PLAYER
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const videoPlayer =
    document.getElementById("videoPlayer");

const videoContainer =
    document.getElementById("videoContainer");

const videoFrame =
    document.getElementById("videoFrame");

const playerControls =
    document.getElementById("playerControls");

const loadingOverlay =
    document.getElementById("loadingOverlay");

const noSourceOverlay =
    document.getElementById("noSourceOverlay");

const errorOverlay =
    document.getElementById("errorOverlay");

const playPauseButton =
    document.getElementById("playPauseButton");

const muteButton =
    document.getElementById("muteButton");

const subtitleButton =
    document.getElementById("subtitleButton");

const subtitleOverlay =
    document.getElementById("subtitleOverlay");

const subtitleSettings =
    document.getElementById("subtitleSettings");

const closeSubtitleSettings =
    document.getElementById("closeSubtitleSettings");

const subtitleEnabled =
    document.getElementById("subtitleEnabled");

const subtitleFont =
    document.getElementById("subtitleFont");

const subtitleSize =
    document.getElementById("subtitleSize");

const subtitleStyle =
    document.getElementById("subtitleStyle");

const subtitleDelay =
    document.getElementById("subtitleDelay");

const subtitlePosition =
    document.getElementById("subtitlePosition");

const fullscreenButton =
    document.getElementById("fullscreenButton");

const seekBar =
    document.getElementById("seekBar");

const currentTime =
    document.getElementById("currentTime");

const duration =
    document.getElementById("duration");

const movieTitle =
    document.getElementById("movieTitle");

const movieMeta =
    document.getElementById("movieMeta");

const movieOverview =
    document.getElementById("movieOverview");

const backButton =
    document.getElementById("backButton");

const retryPlayButton =
    document.getElementById("retryPlayButton");

const downloadMovieButton =
    document.getElementById("downloadMovieButton");

const downloadSection =
    document.getElementById("downloadSection");

/* =========================================================
   DOWNLOAD MOVIE BUTTON STYLE
========================================================= */

if (downloadMovieButton) {

    downloadMovieButton.style.cssText = `
        ...
    `;

    if (
        !downloadMovieButton.querySelector(
            ".mh-download-icon"
        )
    ) {

        const icon =
            document.createElement("span");

        icon.className =
            "mh-download-icon";

        icon.textContent =
            "⬇";

        icon.style.cssText = `
            font-size:18px;
            line-height:1;
        `;

        downloadMovieButton.prepend(icon);
    }
}

/* =========================================================
   MONETAG VIGNETTE BANNER
========================================================= */

(function () {
    const s = document.createElement("script");

    s.dataset.zone = "11836416";
    s.src = "https://n6wxm.com/vignette.min.js";

    document.documentElement.appendChild(s);
})();


/* =========================================================
   URL PARAMETERS
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const movieId =
    params.get("id");

const freeMovieId =
    params.get("freeMovie");

const offlineVideo =
    params.get("offline");
const offlineTitle =
    params.get("title");
const offlineSubtitle =
    params.get("subtitle");
const directVideoUrl =
    params.get("video");

const embedCustom =
    params.get("embed");

const mediaType =
    params.get("type");

const mediaSeason =
    params.get("season");

const mediaEpisode =
    params.get("episode");

const autoDownload =
    params.get("autoDownload") === "1";


/* =========================================================
   CURRENT MOVIE METADATA
========================================================= */

let currentMovieMetadata = {
    title: "",
    year: "",
    overview: "",
    poster: "",
    tmdbId: movieId || "",
    mediaType: mediaType || "movie"
};


/* =========================================================
   LOAD TMDB MOVIE METADATA
========================================================= */

async function loadTMDBMetadata() {

    if (!movieId) {
        return;
    }

    try {

        const endpoint =
            mediaType === "tv"
                ? "/tv/" +
                  encodeURIComponent(movieId) +
                  "?language=en-US"
                : "/movie/" +
                  encodeURIComponent(movieId) +
                  "?language=en-US";

        const response =
            await fetch(
                "https://tmdb.cyberharzard.workers.dev" +
                endpoint,
                {
                    method: "GET",
                    headers: {
                        accept: "application/json"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                "TMDB HTTP " + response.status
            );
        }

        const data =
            await response.json();

        currentMovieMetadata = {
            title:
                data.title ||
                data.name ||
                "",

            year:
                (
                    data.release_date ||
                    data.first_air_date ||
                    ""
                ).slice(0, 4),

            overview:
                data.overview ||
                "",

            poster:
                data.poster_path
                    ? "https://image.tmdb.org/t/p/w500" +
                      data.poster_path
                    : "",

            tmdbId:
                movieId,

            mediaType:
                mediaType || "movie"
        };

        console.log(
            "MH Movies: TMDB metadata loaded:",
            currentMovieMetadata
        );

    } catch (error) {

        console.error(
            "MH Movies: TMDB metadata failed:",
            error
        );

    }
}


/* =========================================================
   PLAYBACK PROGRESS
========================================================= */

const MH_PLAYBACK_KEY =
    "mhMoviesPlaybackProgress";

let playbackKey =
    "";

let playbackSaveTimer =
    null;

let playbackRestoreDone =
    false;


function buildPlaybackKey() {

    if (offlineVideo) {

        return (
            "offline:" +
            offlineVideo
        );

    }

    if (freeMovieId) {

        return (
            "free:" +
            freeMovieId
        );

    }

    if (movieId) {

        return (
            "movie:" +
            movieId
        );

    }

    if (directVideoUrl) {

        return (
            "video:" +
            directVideoUrl
        );

    }

    if (embedCustom) {

        return (
            "embed:" +
            embedCustom
        );

    }

    return "";

}


playbackKey =
    buildPlaybackKey();


function getPlaybackProgress() {

    if (!playbackKey) {

        return 0;

    }

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    MH_PLAYBACK_KEY
                ) || "{}"
            );

        if (
            !saved ||
            typeof saved !== "object"
        ) {

            return 0;

        }

        const position =
            Number(
                saved[playbackKey]?.position
            );

        if (
            !Number.isFinite(position) ||
            position < 0
        ) {

            return 0;

        }

        return position;

    } catch (error) {

        console.error(
            "MH Movies: unable to read playback progress:",
            error
        );

        return 0;

    }

}


function savePlaybackProgress() {

    if (
        !videoPlayer ||
        !playbackKey
    ) {

        return;

    }

    if (
        !Number.isFinite(
            videoPlayer.currentTime
        )
    ) {

        return;

    }

    if (
        videoPlayer.currentTime <= 0
    ) {

        return;

    }

    try {

        let saved =
            JSON.parse(
                localStorage.getItem(
                    MH_PLAYBACK_KEY
                ) || "{}"
            );

        if (
            !saved ||
            typeof saved !== "object"
        ) {

            saved = {};

        }

        saved[playbackKey] = {

            position:
                videoPlayer.currentTime,

            duration:
                Number.isFinite(
                    videoPlayer.duration
                )
                    ? videoPlayer.duration
                    : 0,

            title:
                movieTitle?.textContent ||
                "",

            timestamp:
                Date.now()

        };

        localStorage.setItem(
            MH_PLAYBACK_KEY,
            JSON.stringify(saved)
        );

    } catch (error) {

        console.error(
            "MH Movies: unable to save playback progress:",
            error
        );

    }

}


function clearPlaybackProgress() {

    if (!playbackKey) {

        return;

    }

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    MH_PLAYBACK_KEY
                ) || "{}"
            );

        if (
            saved &&
            typeof saved === "object"
        ) {

            delete saved[playbackKey];

            localStorage.setItem(
                MH_PLAYBACK_KEY,
                JSON.stringify(saved)
            );

        }

    } catch (error) {

        console.error(
            "MH Movies: unable to clear playback progress:",
            error
        );

    }

}


function restorePlaybackProgress() {

    if (
        playbackRestoreDone ||
        !videoPlayer ||
        !playbackKey
    ) {

        return;

    }

    playbackRestoreDone =
        true;

    const savedPosition =
        getPlaybackProgress();

    if (
        savedPosition <= 0
    ) {

        return;

    }

    if (
        !Number.isFinite(
            videoPlayer.duration
        )
    ) {

        return;

    }

    if (
        savedPosition >=
        videoPlayer.duration - 5
    ) {

        clearPlaybackProgress();

        return;

    }

    try {

        videoPlayer.currentTime =
            Math.min(
                savedPosition,
                Math.max(
                    0,
                    videoPlayer.duration - 1
                )
            );

        console.log(
            "MH Movies: playback position restored:",
            videoPlayer.currentTime
        );

        if (currentTime) {

            currentTime.textContent =
                formatTime(
                    videoPlayer.currentTime
                );

        }

        if (seekBar) {

            seekBar.value =
                (
                    videoPlayer.currentTime /
                    videoPlayer.duration
                ) * 100;

        }

    } catch (error) {

        console.error(
            "MH Movies: unable to restore playback position:",
            error
        );

    }

}


function startPlaybackSaveTimer() {

    if (playbackSaveTimer) {

        clearInterval(
            playbackSaveTimer
        );

    }

    playbackSaveTimer =
        setInterval(
            () => {

                if (
                    videoPlayer &&
                    !videoPlayer.paused
                ) {

                    savePlaybackProgress();

                }

            },
            5000
        );

}


function stopPlaybackSaveTimer() {

    if (playbackSaveTimer) {

        clearInterval(
            playbackSaveTimer
        );

        playbackSaveTimer =
            null;

    }

}


/* =========================================================
   MH MOVIES EMBED API
========================================================= */

let AUTHORIZED_VIDEO_API = "";

const MH_CONFIG_URL =
    "https://mh-movies-config.cyberharzard.workers.dev/";


/* =========================================================
   SECOND VIDEO SOURCE
========================================================= */

const SECOND_VIDEO_API =
    "https://vidsrc2.ru/embed/";


/* =========================================================
   DEFAULT EMBED
========================================================= */

const DEFAULT_EMBED_SOURCE =
    "https://mhmo.shop/embed/tv/1399/1/1";


/* =========================================================
   VIDEO SOURCE
========================================================= */

let videoSource =
    "";

let videoLoadTimer =
    null;

let isEmbedSource =
    false;


/* =========================================================
   SELECTED VIDEO SOURCE
========================================================= */

let selectedVideoSource =
    "mhmo";


if (movieId) {

    try {

        selectedVideoSource =
            localStorage.getItem(
                "mhMoviesVideoSource:" +
                movieId
            ) || "mhmo";

    } catch (error) {

        selectedVideoSource =
            "mhmo";

    }

}


if (
    selectedVideoSource !== "mhmo" &&
    selectedVideoSource !== "source2"
) {

    selectedVideoSource =
        "mhmo";

}


/* =========================================================
   SOURCE 2 URL
========================================================= */

function getSourceTwoUrl() {

    if (!movieId) {

        return "";

    }

    return (
        SECOND_VIDEO_API +
        encodeURIComponent(
            movieId
        )
    );

}


/* =========================================================
   SOURCE BUTTONS
========================================================= */

function createVideoSourceButtons() {

    if (
        !movieId ||
        document.getElementById(
            "mhVideoSourceSelector"
        )
    ) {

        return;

    }


    const selector =
        document.createElement(
            "div"
        );


    selector.id =
        "mhVideoSourceSelector";


    selector.style.cssText = `
        display:flex;
        gap:8px;
        margin:12px 0;
        align-items:center;
        flex-wrap:wrap;
    `;


    const label =
        document.createElement(
            "span"
        );


    label.textContent =
        "Video Source:";


    label.style.cssText = `
        font-size:14px;
        font-weight:600;
    `;


    selector.appendChild(
        label
    );


    function createButton(
        source,
        text
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.dataset.source =
            source;


        button.textContent =
            text;


        button.style.cssText = `
            border:1px solid currentColor;
            border-radius:8px;
            padding:7px 12px;
            background:transparent;
            color:inherit;
            font-size:13px;
            font-weight:600;
        `;


        button.addEventListener(
            "click",
            () => {

                if (
                    selectedVideoSource ===
                    source
                ) {

                    return;

                }


                selectedVideoSource =
                    source;


                try {

                    localStorage.setItem(
                        "mhMoviesVideoSource:" +
                        movieId,
                        source
                    );

                } catch (error) {

                    console.error(
                        "MH Movies: unable to save selected video source:",
                        error
                    );

                }


                updateVideoSourceButtons();


                playbackRestoreDone =
                    false;


                loadMovie();

            }
        );


        return button;

    }


    selector.appendChild(
        createButton(
            "mhmo",
            "MHMO"
        )
    );


    selector.appendChild(
        createButton(
            "source2",
            "SOURCE 2"
        )
    );


    const target =
        movieMeta ||
        movieTitle;


    if (
        target &&
        target.parentNode
    ) {

        target.parentNode.insertBefore(
            selector,
            target.nextSibling
        );

    } else {

        document.body.prepend(
            selector
        );

    }


    updateVideoSourceButtons();

}


/* =========================================================
   UPDATE SOURCE BUTTONS
========================================================= */

function updateVideoSourceButtons() {

    const selector =
        document.getElementById(
            "mhVideoSourceSelector"
        );


    if (!selector) {

        return;

    }


    const buttons =
        selector.querySelectorAll(
            "button[data-source]"
        );


    buttons.forEach(
        button => {

            const active =
                button.dataset.source ===
                selectedVideoSource;


            button.style.fontWeight =
                active
                    ? "800"
                    : "600";


            button.style.opacity =
                active
                    ? "1"
                    : "0.65";


            button.setAttribute(
                "aria-pressed",
                active
                    ? "true"
                    : "false"
            );

        }
    );

}


/* =========================================================
   BUILD MH MOVIES EMBED URL
========================================================= */

async function getAuthorizedVideoUrl(tmdbId) {
    if (!tmdbId) {
        return "";
    }

    if (!AUTHORIZED_VIDEO_API) {
        try {
            const response = await fetch(MH_CONFIG_URL);
            if (!response.ok) {
                throw new Error("Config HTTP " + response.status);
            }

            const config = await response.json();
            AUTHORIZED_VIDEO_API = config.videoApi || "";

            console.log(
                "MH Movies: remote video API loaded:",
                AUTHORIZED_VIDEO_API
            );
        } catch (error) {
            console.error(
                "MH Movies: remote video API config failed:",
                error
            );
            return "";
        }
    }

    if (!AUTHORIZED_VIDEO_API) {
        return "";
    }

    if (
        mediaType === "tv" &&
        mediaSeason &&
        mediaEpisode
    ) {
        return (
            AUTHORIZED_VIDEO_API +
            "/tv/" +
            encodeURIComponent(tmdbId) +
            "/" +
            encodeURIComponent(mediaSeason) +
            "/" +
            encodeURIComponent(mediaEpisode)
        );
    }

    if (mediaType === "tv") {
        return (
            AUTHORIZED_VIDEO_API +
            "/tv/" +
            encodeURIComponent(tmdbId) +
            "/1/1"
        );
    }

    return (
        AUTHORIZED_VIDEO_API +
        "/movie/" +
        encodeURIComponent(tmdbId)
    );
}

/* =========================================================
   REMOTE FREE MOVIE CATALOGUE
========================================================= */

const MOVIE_CATALOGUE_URL =
    "https://freelegalmovies.cyberharzard.workers.dev/";

let availableMovieList =
    [];


async function loadMovieCatalogue() {

    const response =
        await fetch(
            MOVIE_CATALOGUE_URL,
            {
                method: "GET",
                cache: "no-store"
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

}


/* =========================================================
   CUSTOM ALERT
========================================================= */

function showMovieAlert(
    message,
    options = {}
) {

    return new Promise(
        resolve => {

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


            overlay.innerHTML = `

                <div class="alert-box">

                    <div class="alert-message">
                        ${String(message)
                            .replace(
                                /</g,
                                "&lt;"
                            )
                            .replace(
                                />/g,
                                "&gt;"
                            )
                            .replace(
                                /\n/g,
                                "<br>"
                            )}
                    </div>

                    <div class="alert-actions">

                        ${
                            options.confirm
                            ? `
                                <button
                                    type="button"
                                    class="alert-cancel"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    class="alert-confirm"
                                >
                                    ${
                                        options.confirmText ||
                                        "OK"
                                    }
                                </button>
                            `
                            : `
                                <button
                                    type="button"
                                    class="alert-confirm"
                                >
                                    OK
                                </button>
                            `
                        }

                    </div>

                </div>

            `;


            document.body.appendChild(
                overlay
            );


            const close =
                result => {

                    if (
                        overlay.parentNode
                    ) {

                        overlay.remove();

                    }

                    resolve(result);

                };


            const confirmButton =
                overlay.querySelector(
                    ".alert-confirm"
                );


            const cancelButton =
                overlay.querySelector(
                    ".alert-cancel"
                );


            if (confirmButton) {

                confirmButton.addEventListener(
                    "click",
                    () => close(true)
                );

            }


            if (cancelButton) {

                cancelButton.addEventListener(
                    "click",
                    () => close(false)
                );

            }

        }
    );

}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(
    seconds
) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        return "0:00";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const secs =
        Math.floor(
            seconds % 60
        );


    return (
        minutes +
        ":" +
        String(secs).padStart(
            2,
            "0"
        )
    );

}


/* =========================================================
   OVERLAYS
========================================================= */

function showOverlay(
    overlay
) {

    if (!overlay) {

        return;

    }


    overlay.classList.remove(
        "hidden"
    );

}


function hideOverlay(
    overlay
) {

    if (!overlay) {

        return;

    }


    overlay.classList.add(
        "hidden"
    );

}


/* =========================================================
   PLAYER DISPLAY
========================================================= */

function showNativePlayer() {

    if (videoPlayer) {

        videoPlayer.style.display =
            "block";

    }


    if (playerControls) {

        playerControls.style.display =
            "";

    }


    if (videoFrame) {

        videoFrame.style.display =
            "none";

        videoFrame.src =
            "about:blank";

    }

}


function showEmbedPlayer() {

    if (videoPlayer) {

        videoPlayer.style.display =
            "none";

    }


    if (playerControls) {

        playerControls.style.display =
            "none";

    }


    if (videoFrame) {

        videoFrame.style.display =
            "block";

    }

}


/* =========================================================
   GET FREE MOVIE
========================================================= */

function getCurrentFreeMovie() {

    if (!freeMovieId) {

        return null;

    }


    return availableMovieList.find(
        movie =>
            String(
                movie.id
            ) ===
            String(
                freeMovieId
            )
    ) || null;

}


/* =========================================================
   CHECK EMBED URL
========================================================= */

function isEmbedUrl(
    url
) {

    if (!url) {

        return false;

    }


    const value =
        String(url)
            .toLowerCase();


    return (
        value.includes(
            "/embed/"
        ) ||
        value.includes(
            "embed."
        ) ||
        value.includes(
            "/iframe/"
        )
    );

}


/* =========================================================
   SHOW LOADING ERROR
========================================================= */

function showLoadingError(
    message
) {

    hideOverlay(
        loadingOverlay
    );


    if (errorOverlay) {

        showOverlay(
            errorOverlay
        );

    }


    console.error(
        "MH Movies:",
        message
    );

}


/* =========================================================
   LOAD MOVIE
========================================================= */

async function loadMovie() {

    videoSource =
        "";

    isEmbedSource =
        false;

    playbackRestoreDone =
        false;


    hideOverlay(
        noSourceOverlay
    );

    hideOverlay(
        errorOverlay
    );

    showOverlay(
        loadingOverlay
    );


    /* =====================================================
       OFFLINE DOWNLOADED MOVIE
    ===================================================== */

    if (offlineVideo) {

        console.log(
            "MH Movies: OFFLINE PLAYBACK MODE"
        );

        movieTitle.textContent =
            offlineTitle ||
            "Offline Movie";

        movieMeta.textContent =
            "Downloaded";

        movieOverview.textContent =
            "Playing from your device.";

        videoSource =
            offlineVideo;

        isEmbedSource =
            false;

        showNativePlayer();

        videoFrame.src =
            "about:blank";

        videoFrame.style.display =
            "none";

        videoPlayer.controls =
            false;

        videoPlayer.style.display =
            "block";

        videoPlayer.pause();

        videoPlayer.removeAttribute(
            "src"
        );

        videoPlayer.load();

        videoPlayer.src =
            videoSource;

        videoPlayer.load();

        console.log(
            "MH Movies: offline video source:",
            videoPlayer.src
        );

        return;

    }


    /* =====================================================
       FREE MOVIE
    ===================================================== */

    if (freeMovieId) {

        try {

            await loadMovieCatalogue();

        } catch (error) {

            console.error(
                "MH Movies: catalogue failed:",
                error
            );


            movieTitle.textContent =
                "Unable to Fetch Movie";


            movieMeta.textContent =
                "Catalogue unavailable";


            movieOverview.textContent =
                "Please check your internet connection and try again.";


            showLoadingError(
                "Movie catalogue could not be loaded."
            );


            return;

        }


        const freeMovie =
            getCurrentFreeMovie();


        if (!freeMovie) {

            movieTitle.textContent =
                "Movie Not Found";


            movieMeta.textContent =
                "";


            movieOverview.textContent =
                "Return to MH Movies and select another movie.";


            hideOverlay(
                loadingOverlay
            );


            showOverlay(
                noSourceOverlay
            );


            return;

        }


        movieTitle.textContent =
            freeMovie.title ||
            "Movie";


        movieMeta.textContent =
            freeMovie.year ||
            "";


        movieOverview.textContent =
            freeMovie.overview ||
            "This movie is available to watch on MH Movies.";


        videoSource =
            directVideoUrl ||
            embedCustom ||
            freeMovie.videoUrl ||
            "";


        isEmbedSource =
            isEmbedUrl(
                videoSource
            );


        if (
            !videoSource &&
            freeMovie.tmdbId
        ) {

            try {

                videoSource =
                    await getAuthorizedVideoUrl(
                        freeMovie.tmdbId
                    );


                isEmbedSource =
                    true;


            } catch (error) {

                console.error(
                    "MH Movies: free movie embed failed:",
                    error
                );


                videoSource =
                    "";

                isEmbedSource =
                    false;

            }

        }


        if (!videoSource) {

            movieOverview.textContent =
                "This movie does not currently have a playable video source.";


            hideOverlay(
                loadingOverlay
            );


            showOverlay(
                noSourceOverlay
            );


            return;

        }


        loadVideo();

        return;

    }


    /* =====================================================
       NO MOVIE SELECTED
    ===================================================== */

    if (
        !movieId &&
        !embedCustom &&
        !directVideoUrl
    ) {

        movieTitle.textContent =
            "Movie Player";


        movieMeta.textContent =
            "Default embed";


        movieOverview.textContent =
            "Watching via the MH Movies embed player.";


        videoSource =
            DEFAULT_EMBED_SOURCE;


        isEmbedSource =
            true;


        loadVideo();

        return;

    }


    /* =====================================================
       NORMAL MOVIE
    ===================================================== */

    await loadTMDBMetadata();

    const moviePoster =
        document.getElementById("moviePoster");

    if (
        moviePoster &&
        currentMovieMetadata.poster
    ) {
        moviePoster.src =
            currentMovieMetadata.poster;

        moviePoster.style.display =
            "block";
    }

    movieTitle.textContent =
        currentMovieMetadata.title ||
        "Movie Player";


    movieMeta.textContent =
        currentMovieMetadata.year || "";


    movieOverview.textContent =
        currentMovieMetadata.overview ||
        "Preparing movie player...";


    /*
       Show source buttons for normal
       TMDB movies / TV episodes.
    */

    createVideoSourceButtons();


    /* =====================================================
       EXPLICIT VIDEO / EMBED URL
    ===================================================== */

    videoSource =
        directVideoUrl ||
        embedCustom ||
        "";


    isEmbedSource =
        isEmbedUrl(
            videoSource
        );


    /* =====================================================
       SELECTED SOURCE
    ===================================================== */

    /*
       When a normal movie has an ID,
       the selected source takes priority.

       MHMO:
       https://mhmo.shop/embed/movie/{id}

       SOURCE 2:
       https://source.two/embed/{id}
    */

    if (movieId) {

        if (
            selectedVideoSource ===
            "source2"
        ) {

            videoSource =
                getSourceTwoUrl();

            isEmbedSource =
                true;

        } else {

            try {

                videoSource =
                    await getAuthorizedVideoUrl(
                        movieId
                    );

                isEmbedSource =
                    true;

            } catch (error) {

                console.error(
                    "MH Movies: unable to create MHMO embed:",
                    error
                );

                videoSource =
                    "";

                isEmbedSource =
                    false;

            }

        }

    }


    /* =====================================================
       DEFAULT EMBED FALLBACK
    ===================================================== */

    if (!videoSource) {

        videoSource =
            DEFAULT_EMBED_SOURCE;


        isEmbedSource =
            true;

    }


    loadVideo();

    if (
        autoDownload &&
        downloadMovieButton
    ) {

        setTimeout(
            () => {
                downloadMovieButton.click();
            },
            300
        );

    }

}



let downloadStatusTimer = null;

function showDownloadStatus(message, duration = 4000) {
    const status = document.getElementById("downloadStatus");

    if (!status) {
        return;
    }

    clearTimeout(downloadStatusTimer);

    if (!message) {
        status.textContent = "";
        status.style.display = "none";
        return;
    }

    const text = String(message);
    const maxLength = 90;

    status.textContent =
        text.length > maxLength
            ? text.slice(0, maxLength - 3) + "..."
            : text;

    status.style.display = "block";

    if (duration > 0) {
        downloadStatusTimer = setTimeout(() => {
            status.textContent = "";
            status.style.display = "none";
        }, duration);
    }
}

/* =========================================================
   DOWNLOAD MOVIE
========================================================= */

if (downloadMovieButton) {

    downloadMovieButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();
            event.stopPropagation();


            const currentMovie =
                getCurrentFreeMovie();


            if (downloadSection) {

                const hasDirectDownload =
                    currentMovie?.videoUrl &&
                    !isEmbedUrl(
                        currentMovie.videoUrl
                    );

                const hasNormalMovieSource =
                    directVideoUrl ||
                    videoSource;

                downloadSection.style.display =
                    hasDirectDownload ||
                    hasNormalMovieSource
                        ? "flex"
                        : "none";

            }
        


            let downloadUrl =
                currentMovie?.videoUrl ||
                directVideoUrl ||
                "";


            if (
                isEmbedSource &&
                (
                    !downloadUrl ||
                    isEmbedUrl(downloadUrl)
                )
            ) {
                const MHExtractor = getMHExtractor();
                if (!MHExtractor) {
                    showDownloadStatus("The native video extractor is not available.");
                    return;
                }

                const extractionUrl = videoSource || "";

                if (!extractionUrl) {
                    showDownloadStatus("No video source is available to extract.");
                    return;
                }

                showDownloadStatus("Finding downloadable video...", 0);

                try {
                    const extracted = await MHExtractor.extract({ url: extractionUrl });

                    if (!extracted || !extracted.url) {
                        showDownloadStatus("The extractor could not find a downloadable video.");
                        return;
                    }

                    downloadUrl = extracted.url;
                    showDownloadStatus("EXTRACTED URL: " + extracted.url, 4000);
                    console.log("MH Movies: native extractor found:", extracted);

                } catch (error) {
                    console.error("MH Movies: native extraction failed:", error);
                    showDownloadStatus("Could not find a downloadable video from this source.");
                    return;
                }
            }


            if (
                isEmbedUrl(
                    downloadUrl
                )
            ) {

                showDownloadStatus(
                    "The available source is an embedded player, not a downloadable video file."
                );

                return;

            }


            const downloadId =
                String(
                    freeMovieId ||
                    movieId ||
                    Date.now()
                );


            let downloads = [];


            try {

                downloads =
                    JSON.parse(
                        localStorage.getItem(
                            "mhMoviesDownloads"
                        ) || "[]"
                    );

            } catch (error) {

                console.error(
                    "MH Movies: unable to read downloads:",
                    error
                );

                downloads = [];

            }


            if (
                !Array.isArray(
                    downloads
                )
            ) {

                downloads = [];

            }


            const existing =
                downloads.find(
                    item =>
                        String(item.id) ===
                            downloadId ||
                        (
                            String(item.title || "")
                                .trim()
                                .toLowerCase() ===
                            String(
                                currentMovie?.title ||
                                currentMovieMetadata.title ||
                                movieTitle.textContent ||
                                "Movie"
                            )
                                .trim()
                                .toLowerCase()
                        )
                );


            if (existing) {

                await showMovieAlert(
                    "This movie is already in your downloads."
                );

                return;

            }




            const movieDownload = {

                id:
                    downloadId,

                title:
                    currentMovie?.title ||
                    currentMovieMetadata.title ||
                    movieTitle.textContent ||
                    "Movie",

                year:
                    currentMovie?.year ||
                    currentMovieMetadata.year ||
                    "",

                poster:
                    currentMovie?.poster ||
                    currentMovieMetadata.poster ||
                    "",

                videoUrl:
                    downloadUrl,

                status:
                    "queued",

                progress:
                    0,

                downloaded:
                    0,

                totalSize:
                    0,

                speed:
                    0,

                remaining:
                    0,

                file:
                    "",

                filePath:
                    "",

                message:
                    "",

                subtitleStatus:
                    "queued",

                subtitleId:
                    "",

                subtitleFilePath:
                    "",

                subtitleRelease:
                    "",

                subtitleError:
                    "",

                parts:
                    typeof createDownloadParts ===
                    "function"
                        ? createDownloadParts(8)
                        : []

            };


            downloads.push(
                movieDownload
            );


            localStorage.setItem(
                "mhMoviesDownloads",
                JSON.stringify(
                    downloads
                )
            );


            console.log(
                "MH Movies: movie added to download queue:",
                movieDownload
            );


            await showMovieAlert(
                "Movie added to download queue."
            );


            window.location.href =
                "offline.html";

        }
    );

}


/* =========================================================
   LOAD VIDEO
========================================================= */

function loadVideo() {

    console.log(
        "MH Movies: loadVideo()"
    );


    console.log(
        "MH Movies: video source:",
        videoSource
    );


    if (!videoSource) {

        hideOverlay(
            loadingOverlay
        );


        showOverlay(
            noSourceOverlay
        );


        return;

    }


    hideOverlay(
        noSourceOverlay
    );

    hideOverlay(
        errorOverlay
    );

    showOverlay(
        loadingOverlay
    );


    if (videoLoadTimer) {

        clearTimeout(
            videoLoadTimer
        );


        videoLoadTimer =
            null;

    }


    /* =====================================================
       EMBED PLAYBACK
    ===================================================== */

    if (isEmbedSource) {

        showEmbedPlayer();


        if (videoPlayer) {

            videoPlayer.pause();

            videoPlayer.removeAttribute(
                "src"
            );

            videoPlayer.load();

        }


        if (videoFrame) {

            videoFrame.src =
                videoSource;


            console.log(
                "MH Movies: embed src assigned:",
                videoFrame.src
            );

        }


        videoLoadTimer =
            setTimeout(
                () => {

                    hideOverlay(
                        loadingOverlay
                    );

                },
                10000
            );


        return;

    }


    /* =====================================================
       DIRECT VIDEO FILE
    ===================================================== */

    showNativePlayer();


    videoPlayer.pause();


    videoPlayer.removeAttribute(
        "src"
    );


    videoPlayer.load();


    videoPlayer.src =
        videoSource;


    console.log(
        "MH Movies: direct video src assigned:",
        videoPlayer.src
    );


    videoPlayer.load();


    videoLoadTimer =
        setTimeout(
            () => {

                if (
                    videoPlayer.readyState <
                    HTMLMediaElement.HAVE_FUTURE_DATA
                ) {

                    hideOverlay(
                        loadingOverlay
                    );


                    showOverlay(
                        errorOverlay
                    );


                    console.warn(
                        "MH Movies: video loading timed out.",
                        "readyState:",
                        videoPlayer.readyState,
                        "src:",
                        videoPlayer.currentSrc
                    );

                }

            },
            20000
        );

}


/* =========================================================
   IFRAME LOAD
========================================================= */

if (videoFrame) {

    videoFrame.addEventListener(
        "load",
        () => {

            if (!isEmbedSource) {

                return;

            }


            if (videoLoadTimer) {

                clearTimeout(
                    videoLoadTimer
                );


                videoLoadTimer =
                    null;

            }


            hideOverlay(
                loadingOverlay
            );


            console.log(
                "MH Movies: iframe loaded."
            );

        }
    );

}


/* =========================================================
   PLAY / PAUSE
========================================================= */

async function togglePlay() {

    if (
        isEmbedSource ||
        !videoPlayer.src
    ) {

        return;

    }




    if (videoPlayer.paused) {

        try {

            await videoPlayer.play();

        } catch (error) {

            console.error(
                "Unable to play video:",
                error
            );

        }

    } else {

        videoPlayer.pause();

    }

}


if (playPauseButton) {

    playPauseButton.addEventListener(
        "click",
        togglePlay
    );

}


/* =========================================================
   MH MOVIES CUSTOM SUBTITLES
========================================================= */

const SUBTITLE_SETTINGS_KEY =
    "mhMoviesSubtitleSettings";

let subtitleCues = [];
let subtitleLoaded = false;

let subtitleConfig = {
    enabled: true,
    font: "Arial",
    size: "medium",
    style: "outline",
    delay: 0,
    position: "bottom"
};

function loadSubtitleSettings() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    SUBTITLE_SETTINGS_KEY
                ) || "{}"
            );

        subtitleConfig = {
            ...subtitleConfig,
            ...saved
        };

    } catch (error) {

        console.warn(
            "MH Movies: subtitle settings could not be loaded:",
            error
        );

    }

    applySubtitleSettings();

}

function saveSubtitleSettings() {

    try {

        localStorage.setItem(
            SUBTITLE_SETTINGS_KEY,
            JSON.stringify(subtitleConfig)
        );

    } catch (error) {

        console.warn(
            "MH Movies: subtitle settings could not be saved:",
            error
        );

    }

}

function applySubtitleSettings() {

    if (!subtitleOverlay) {
        return;
    }

    subtitleOverlay.classList.remove(
        "subtitle-size-small",
        "subtitle-size-medium",
        "subtitle-size-large",
        "subtitle-size-xlarge",
        "subtitle-style-outline",
        "subtitle-style-box",
        "subtitle-style-shadow",
        "subtitle-position-top",
        "subtitle-position-middle"
    );

    subtitleOverlay.classList.add(
        "subtitle-size-" +
        subtitleConfig.size
    );

    subtitleOverlay.classList.add(
        "subtitle-style-" +
        subtitleConfig.style
    );

    if (
        subtitleConfig.position ===
        "top"
    ) {

        subtitleOverlay.classList.add(
            "subtitle-position-top"
        );

    } else if (
        subtitleConfig.position ===
        "middle"
    ) {

        subtitleOverlay.classList.add(
            "subtitle-position-middle"
        );

    }

    subtitleOverlay.style.fontFamily =
        subtitleConfig.font;

    if (subtitleEnabled) {
        subtitleEnabled.value =
            subtitleConfig.enabled
                ? "on"
                : "off";
    }

    if (subtitleFont) {
        subtitleFont.value =
            subtitleConfig.font;
    }

    if (subtitleSize) {
        subtitleSize.value =
            subtitleConfig.size;
    }

    if (subtitleStyle) {
        subtitleStyle.value =
            subtitleConfig.style;
    }

    if (subtitleDelay) {
        subtitleDelay.value =
            String(subtitleConfig.delay);
    }

    if (subtitlePosition) {
        subtitlePosition.value =
            subtitleConfig.position;
    }

    if (!subtitleConfig.enabled) {
        hideSubtitle();
    }

}

function showSubtitleSettings() {

    if (!subtitleSettings) {
        return;
    }

    subtitleSettings.classList.remove(
        "hidden"
    );

}

function hideSubtitleSettings() {

    if (!subtitleSettings) {
        return;
    }

    subtitleSettings.classList.add(
        "hidden"
    );

}

function hideSubtitle() {

    if (!subtitleOverlay) {
        return;
    }

    subtitleOverlay.textContent = "";

    subtitleOverlay.classList.add(
        "hidden"
    );

}

function parseSubtitleTimestamp(value) {

    const text =
        String(value || "").trim();

    const parts =
        text.split(":");

    if (parts.length === 3) {

        return (
            Number(parts[0]) * 3600 +
            Number(parts[1]) * 60 +
            Number(parts[2].replace(",", "."))
        );

    }

    if (parts.length === 2) {

        return (
            Number(parts[0]) * 60 +
            Number(parts[1].replace(",", "."))
        );

    }

    return NaN;

}

function parseWebVtt(text) {

    const cleanText =
        String(text || "")
            .replace(/^\uFEFF/, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    const lines =
        cleanText.split("\n");

    const cues = [];

    let i = 0;

    while (i < lines.length) {

        let line =
            lines[i].trim();

        if (
            !line ||
            /^WEBVTT/i.test(line) ||
            /^NOTE\b/i.test(line) ||
            /^STYLE\b/i.test(line) ||
            /^REGION\b/i.test(line)
        ) {

            i++;
            continue;

        }

        if (
            !line.includes("-->")
        ) {

            if (
                i + 1 < lines.length &&
                lines[i + 1].includes("-->")
            ) {

                i++;
                line =
                    lines[i].trim();

            } else {

                i++;
                continue;

            }

        }

        const parts =
            line.split(/\s+-->\s+/);

        if (parts.length < 2) {

            i++;
            continue;

        }

        const start =
            parseSubtitleTimestamp(
                parts[0]
            );

        const end =
            parseSubtitleTimestamp(
                parts[1]
                    .split(/\s+/)[0]
            );

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {

            i++;
            continue;

        }

        i++;

        const textLines = [];

        while (
            i < lines.length &&
            lines[i].trim() !== ""
        ) {

            textLines.push(
                lines[i]
            );

            i++;

        }

        const cueText =
            textLines
                .join("\n")
                .replace(
                    /<br\s*\/?>/gi,
                    "\n"
                )
                .replace(
                    /<[^>]+>/g,
                    ""
                )
                .trim();

        if (cueText) {

            cues.push({
                start,
                end,
                text: cueText
            });

        }

        i++;

    }

    return cues;

}

async function loadMovieSubtitles(url) {

    subtitleLoaded = false;
    subtitleCues = [];

    hideSubtitle();

    if (!url) {
        return;
    }

    try {

        console.log(
            "MH Movies: loading subtitles:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Subtitle HTTP " +
                response.status
            );

        }

        const text =
            await response.text();

        subtitleCues =
            parseWebVtt(text);

        subtitleLoaded =
            subtitleCues.length > 0;

        console.log(
            "MH Movies: subtitle cues loaded:",
            subtitleCues.length
        );

        if (!subtitleLoaded) {

            hideSubtitle();

        }

    } catch (error) {

        subtitleLoaded = false;
        subtitleCues = [];

        hideSubtitle();

        console.warn(
            "MH Movies: subtitle loading failed:",
            error
        );

    }

}

function updateSubtitleDisplay() {

    if (
        !subtitleLoaded ||
        !videoPlayer ||
        !subtitleConfig.enabled
    ) {

        hideSubtitle();
        return;

    }

    const current =
        Number(videoPlayer.currentTime);

    if (!Number.isFinite(current)) {

        hideSubtitle();
        return;

    }

    const delay =
        Number(subtitleConfig.delay) || 0;

    const subtitleTime =
        current - delay;

    const cue =
        subtitleCues.find(
            item =>
                subtitleTime >= item.start &&
                subtitleTime < item.end
        );

    if (!cue) {

        hideSubtitle();
        return;

    }

    if (!subtitleOverlay) {
        return;
    }

    subtitleOverlay.textContent =
        cue.text;

    subtitleOverlay.classList.remove(
        "hidden"
    );

}

if (subtitleButton) {

    subtitleButton.addEventListener(
        "click",
        () => {

            if (!subtitleLoaded) {

                showSubtitleSettings();

                console.log(
                    "MH Movies: no subtitle file is loaded."
                );

                return;

            }

            showSubtitleSettings();

        }
    );

}

if (closeSubtitleSettings) {

    closeSubtitleSettings.addEventListener(
        "click",
        hideSubtitleSettings
    );

}

if (subtitleEnabled) {

    subtitleEnabled.addEventListener(
        "change",
        () => {

            subtitleConfig.enabled =
                subtitleEnabled.value === "on";

            saveSubtitleSettings();
            applySubtitleSettings();
            updateSubtitleDisplay();

        }
    );

}

if (subtitleFont) {

    subtitleFont.addEventListener(
        "change",
        () => {

            subtitleConfig.font =
                subtitleFont.value;

            saveSubtitleSettings();
            applySubtitleSettings();

        }
    );

}

if (subtitleSize) {

    subtitleSize.addEventListener(
        "change",
        () => {

            subtitleConfig.size =
                subtitleSize.value;

            saveSubtitleSettings();
            applySubtitleSettings();

        }
    );

}

if (subtitleStyle) {

    subtitleStyle.addEventListener(
        "change",
        () => {

            subtitleConfig.style =
                subtitleStyle.value;

            saveSubtitleSettings();
            applySubtitleSettings();

        }
    );

}

if (subtitleDelay) {

    subtitleDelay.addEventListener(
        "change",
        () => {

            subtitleConfig.delay =
                Number(
                    subtitleDelay.value
                ) || 0;

            saveSubtitleSettings();
            updateSubtitleDisplay();

        }
    );

}

if (subtitlePosition) {

    subtitlePosition.addEventListener(
        "change",
        () => {

            subtitleConfig.position =
                subtitlePosition.value;

            saveSubtitleSettings();
            applySubtitleSettings();

        }
    );

}

if (videoPlayer) {

    videoPlayer.addEventListener(
        "timeupdate",
        updateSubtitleDisplay
    );

    videoPlayer.addEventListener(
        "seeked",
        updateSubtitleDisplay
    );

    videoPlayer.addEventListener(
        "loadedmetadata",
        updateSubtitleDisplay
    );

}

loadSubtitleSettings();

if (offlineSubtitle) {

    loadMovieSubtitles(
        offlineSubtitle
    );

}

/* =========================================================
   PLAY BUTTON STATE
========================================================= */

if (videoPlayer) {

    videoPlayer.addEventListener(
        "play",
        () => {

            if (playPauseButton) {

                playPauseButton.textContent =
                    "⏸";

            }


            startPlaybackSaveTimer();

        }
    );


    videoPlayer.addEventListener(
        "pause",
        () => {

            if (playPauseButton) {

                playPauseButton.textContent =
                    "▶";

            }


            savePlaybackProgress();

            stopPlaybackSaveTimer();

        }
    );

}


/* =========================================================
   TIME
========================================================= */

if (videoPlayer) {

    videoPlayer.addEventListener(
        "timeupdate",
        () => {

            if (
                !videoPlayer.duration ||
                !Number.isFinite(
                    videoPlayer.duration
                )
            ) {

                return;

            }


            const percent =
                (
                    videoPlayer.currentTime /
                    videoPlayer.duration
                ) * 100;


            if (seekBar) {

                seekBar.value =
                    percent;

            }


            if (currentTime) {

                currentTime.textContent =
                    formatTime(
                        videoPlayer.currentTime
                    );

            }

        }
    );

}


/* =========================================================
   DURATION / RESTORE PROGRESS
========================================================= */

if (videoPlayer) {

    videoPlayer.addEventListener(
        "loadedmetadata",
        () => {

            if (videoLoadTimer) {

                clearTimeout(
                    videoLoadTimer
                );


                videoLoadTimer =
                    null;

            }


            if (duration) {

                duration.textContent =
                    formatTime(
                        videoPlayer.duration
                    );

            }


            restorePlaybackProgress();


            if (
                playbackRestoreDone &&
                getPlaybackProgress() <= 0
            ) {

                if (currentTime) {

                    currentTime.textContent =
                        "0:00";

                }

                if (seekBar) {

                    seekBar.value =
                        0;

                }

            }


            hideOverlay(
                loadingOverlay
            );


            console.log(
                "MH Movies: video metadata loaded.",
                "Duration:",
                videoPlayer.duration,
                "ReadyState:",
                videoPlayer.readyState
            );

        }
    );

}


/* =========================================================
   VIDEO ENDED
========================================================= */

if (videoPlayer) {

    videoPlayer.addEventListener(
        "ended",
        () => {

            stopPlaybackSaveTimer();

            clearPlaybackProgress();

            if (seekBar) {

                seekBar.value =
                    100;

            }

            if (currentTime) {

                currentTime.textContent =
                    formatTime(
                        videoPlayer.duration
                    );

            }

            if (playPauseButton) {

                playPauseButton.textContent =
                    "▶";

            }

            console.log(
                "MH Movies: movie finished. Saved progress cleared."
            );

        }
    );

}


/* =========================================================
   SEEK
========================================================= */

if (
    seekBar &&
    videoPlayer
) {

    seekBar.addEventListener(
        "input",
        () => {

            if (
                !videoPlayer.duration ||
                !Number.isFinite(
                    videoPlayer.duration
                )
            ) {

                return;

            }


            const percentage =
                Number(
                    seekBar.value
                );


            videoPlayer.currentTime =
                (
                    percentage / 100
                ) *
                videoPlayer.duration;


            savePlaybackProgress();

        }
    );

}


/* =========================================================
   MUTE
========================================================= */

if (
    muteButton &&
    videoPlayer
) {

    muteButton.addEventListener(
        "click",
        () => {

            videoPlayer.muted =
                !videoPlayer.muted;


            muteButton.textContent =
                videoPlayer.muted
                    ? "🔇"
                    : "🔊";

        }
    );

}


/* =========================================================
   FULLSCREEN
========================================================= */

async function lockToCurrentLandscape() {

    const ScreenOrientation =
        window.Capacitor?.Plugins?.ScreenOrientation;


    if (!ScreenOrientation) {

        return;

    }


    const currentType =
        screen.orientation?.type ||
        "";


    const targetOrientation =
        currentType.startsWith(
            "landscape"
        )
            ? currentType
            : "landscape-primary";


    try {

        await ScreenOrientation.lock({
            orientation:
                targetOrientation
        });

    } catch (error) {

        console.error(
            "Unable to lock orientation:",
            error
        );

    }

}


async function toggleFullscreen() {

    try {

        const ScreenOrientation =
            window.Capacitor?.Plugins?.ScreenOrientation;


        if (
            document.fullscreenElement
        ) {

            await document.exitFullscreen();


            if (ScreenOrientation) {

                await ScreenOrientation.unlock();

            }

        } else {

            if (!videoContainer) {

                return;

            }


            await videoContainer.requestFullscreen();


            if (ScreenOrientation) {

                await lockToCurrentLandscape();

            }

        }

    } catch (error) {

        console.error(
            "Fullscreen / rotation failed:",
            error
        );

    }

}


/* =========================================================
   ORIENTATION CHANGE
========================================================= */

if (screen.orientation) {

    screen.orientation.addEventListener(
        "change",
        () => {

            if (
                document.fullscreenElement
            ) {

                lockToCurrentLandscape();

            }

        }
    );

}


/* =========================================================
   FULLSCREEN BUTTON
========================================================= */

if (fullscreenButton) {

    fullscreenButton.addEventListener(
        "click",
        toggleFullscreen
    );

}


/* =========================================================
   FULLSCREEN ICON
========================================================= */

document.addEventListener(
    "fullscreenchange",
    () => {

        if (!fullscreenButton) {

            return;

        }


        fullscreenButton.textContent =
            document.fullscreenElement
                ? "⤢"
                : "⛶";

    }
);


/* =========================================================
   SAVE PROGRESS WHEN APP LEAVES PLAYER
========================================================= */

window.addEventListener(
    "pagehide",
    () => {

        savePlaybackProgress();

        stopPlaybackSaveTimer();

    }
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "hidden"
        ) {

            savePlaybackProgress();

        }

    }
);


/* =========================================================
   ANDROID BACK BUTTON
========================================================= */

const PlayerApp =
    window.Capacitor?.Plugins?.App;


if (PlayerApp) {

    PlayerApp.addListener(
        "backButton",
        async () => {

            if (
                document.fullscreenElement
            ) {

                try {

                    await document.exitFullscreen();

                } catch (error) {

                    console.error(
                        "Unable to exit fullscreen:",
                        error
                    );

                }


                const ScreenOrientation =
                    window.Capacitor?.Plugins?.ScreenOrientation;


                if (ScreenOrientation) {

                    try {

                        await ScreenOrientation.unlock();

                    } catch (error) {

                        console.error(
                            "Unable to unlock orientation:",
                            error
                        );

                    }

                }


                return;

            }


            savePlaybackProgress();

            window.history.back();

        }
    );

}


/* =========================================================
   VIDEO ERROR
========================================================= */

if (videoPlayer) {

    videoPlayer.addEventListener(
        "error",
        () => {

            savePlaybackProgress();

            hideOverlay(
                loadingOverlay
            );


            showOverlay(
                errorOverlay
            );


            const mediaError =
                videoPlayer.error;


            console.error(
                "MH Movies: video loading error:",
                mediaError
            );


            if (mediaError) {

                console.error(
                    "MH Movies: video error code:",
                    mediaError.code
                );


                console.error(
                    "MH Movies: video error message:",
                    mediaError.message
                );

            }


            console.error(
                "MH Movies: current video source:",
                videoPlayer.currentSrc
            );

        }
    );


    videoPlayer.addEventListener(
        "canplay",
        () => {

            console.log(
                "MH Movies: video can play."
            );


            console.log(
                "MH Movies: readyState:",
                videoPlayer.readyState
            );


            console.log(
                "MH Movies: duration:",
                videoPlayer.duration
            );


            hideOverlay(
                loadingOverlay
            );


            hideOverlay(
                errorOverlay
            );

        }
    );

}


/* =========================================================
   RETRY
========================================================= */

if (retryPlayButton) {

    retryPlayButton.addEventListener(
        "click",
        () => {

            playbackRestoreDone =
                false;

            loadMovie();

        }
    );

}


/* =========================================================
   BACK
========================================================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            savePlaybackProgress();

            window.history.back();

        }
    );

}


/* =========================================================
   DOUBLE CLICK → FULLSCREEN
========================================================= */

if (videoContainer) {

    videoContainer.addEventListener(
        "dblclick",
        toggleFullscreen
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

loadMovie();
