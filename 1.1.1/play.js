const getMHExtractor = () => window.Capacitor?.Plugins?.MHExtractor || null;
const getMHSubtitle = () => window.Capacitor?.Plugins?.MHPlayer || null;
const getMHPlayer = () => window.Capacitor?.Plugins?.MHPlayer || null;
const getMHDownload = () => window.Capacitor?.Plugins?.MHDownload || null;

const params = new URLSearchParams(window.location.search);

const movieId = params.get("id");
const freeMovieId = params.get("freeMovie");
const offlineVideo = params.get("offline");
const offlineTitle = params.get("title");
const directVideoUrl = params.get("video");
const embedCustom = params.get("embed");
const mediaType = params.get("type");
const mediaSeason = params.get("season");
const mediaEpisode = params.get("episode");
const autoDownload = params.get("autoDownload") === "1";
const urlPoster = params.get("poster") || "";
const urlSubtitle = params.get("subtitle") || "";

const movieTitle = document.getElementById("movieTitle");
const movieMeta = document.getElementById("movieMeta");
const movieOverview = document.getElementById("movieOverview");
const subtitleSelector = document.getElementById("subtitleSelector");
const moviePoster = document.getElementById("moviePoster");
const backButton = document.getElementById("backButton");
const retryPlayButton = document.getElementById("retryPlayButton");
const downloadMovieButton = document.getElementById("downloadMovieButton");
const downloadSection = document.getElementById("downloadSection");
const downloadStatus = document.getElementById("downloadStatus");
const loadingOverlay = document.getElementById("loadingOverlay");
const noSourceOverlay = document.getElementById("noSourceOverlay");
const errorOverlay = document.getElementById("errorOverlay");

const MH_CONFIG_URL =
    "https://mh-movies-config.cyberharzard.workers.dev/";

const SECOND_VIDEO_API =
    "https://source2.cyberharzard.workers.dev/embed/";

const DEFAULT_EMBED_SOURCE =
    "https://mhmo.shop/embed/tv/1399/1/1";

const MOVIE_CATALOGUE_URL =
    "https://freelegalmovies.cyberharzard.workers.dev/";

const MH_SUBTITLE_API =
    "https://mh-movies-subtitles.cyberharzard.workers.dev";

let AUTHORIZED_VIDEO_API = "";
let availableMovieList = [];
let videoSource = "";
let isEmbedSource = false;
let selectedVideoSource = "mhmo";

let currentMovieMetadata = {
    title: "",
    year: "",
    overview: "",
    poster: "",
    tmdbId: movieId || "",
    imdbId: "",
    mediaType: mediaType || "movie",
    urlPoster: urlPoster || ""
};

const MH_PLAYBACK_KEY = "mhMoviesPlaybackProgress";
let playbackKey = "";
let playbackSaveTimer = null;
let playbackRestoreDone = false;

function showOverlay(element) {
    if (element) element.classList.remove("hidden");
}

function hideOverlay(element) {
    if (element) element.classList.add("hidden");
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (!value || value <= 0) {
        return "";
    }

    const units = ["B", "KB", "MB", "GB"];
    let index = 0;
    let size = value;

    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }

    return size.toFixed(size >= 100 || index === 0 ? 0 : 1) +
        " " + units[index];
}

function showVariantPicker(variants) {
    return new Promise(resolve => {
        const existing = document.querySelector(".alerts");

        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement("div");
        overlay.className = "alerts";

        const rows = variants.map((variant, index) => {
            const res = variant.resolution
                ? variant.resolution.replace("x", " × ")
                : (variant.bandwidth
                    ? Math.round(variant.bandwidth / 1000) + " kbps"
                    : "Quality " + (index + 1));

            const size = formatBytes(variant.estimatedBytes);
            const sizeLabel = size ? " · ~" + size : "";

            return `
                <button
                    type="button"
                    class="alert-confirm variant-choice"
                    data-variant-index="${index}"
                    style="display:block;width:100%;margin:6px 0;text-align:center;"
                >
                    ${res}${sizeLabel}
                </button>
            `;
        }).join("");

        overlay.innerHTML = `
            <div class="alert-box">
                <div class="alert-message">
                    Choose download quality
                </div>
                <div class="alert-actions" style="flex-direction:column;">
                    ${rows}
                    <button type="button" class="alert-cancel" data-variant-cancel="1">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = result => {
            if (overlay.parentNode) {
                overlay.remove();
            }
            resolve(result);
        };

        overlay.querySelectorAll(".variant-choice").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.dataset.variantIndex);
                close(variants[idx] || null);
            });
        });

        overlay.querySelector("[data-variant-cancel]")
            ?.addEventListener("click", () => close(null));
    });
}

function isEmbedUrl(url) {
    if (!url) return false;

    const value = String(url).toLowerCase();

    return (
        value.includes("/embed/") ||
        value.includes("embed.") ||
        value.includes("/iframe/")
    );
}

function formatTime(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.floor(Number(milliseconds || 0) / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

function buildPlaybackKey() {
    if (offlineVideo) return "offline:" + offlineVideo;
    if (freeMovieId) return "free:" + freeMovieId;
    if (movieId) return "movie:" + movieId;
    if (directVideoUrl) return "video:" + directVideoUrl;
    if (embedCustom) return "embed:" + embedCustom;
    return "";
}

playbackKey = buildPlaybackKey();

function getPlaybackProgress() {
    if (!playbackKey) return 0;

    try {
        const saved = JSON.parse(
            localStorage.getItem(MH_PLAYBACK_KEY) || "{}"
        );

        const entry = saved?.[playbackKey];

        if (
            !entry ||
            !Number.isFinite(Number(entry.position))
        ) {
            return 0;
        }

        return Number(entry.position);
    } catch (error) {
        console.error(
            "MH Movies: unable to read playback progress:",
            error
        );
        return 0;
    }
}

async function savePlaybackProgress() {
    if (
        !playbackKey ||
        !getMHPlayer() ||
        isEmbedSource
    ) {
        return;
    }

    try {
        const mhPlayer = getMHPlayer();

        if (typeof mhPlayer.getState !== "function") {
            return;
        }

        const state = await mhPlayer.getState();

        if (
            !state?.available ||
            !Number.isFinite(Number(state.position)) ||
            Number(state.position) <= 0
        ) {
            return;
        }

        let saved = JSON.parse(
            localStorage.getItem(MH_PLAYBACK_KEY) || "{}"
        );

        if (!saved || typeof saved !== "object") {
            saved = {};
        }

        saved[playbackKey] = {
            position: Number(state.position),
            duration: Number.isFinite(Number(state.duration))
                ? Number(state.duration)
                : 0,
            title: movieTitle?.textContent || "",
            timestamp: Date.now()
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
    if (!playbackKey) return;

    try {
        const saved = JSON.parse(
            localStorage.getItem(MH_PLAYBACK_KEY) || "{}"
        );

        if (saved && typeof saved === "object") {
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

async function restorePlaybackProgress() {
    if (
        playbackRestoreDone ||
        !playbackKey ||
        !getMHPlayer() ||
        isEmbedSource
    ) {
        return;
    }

    playbackRestoreDone = true;

    const savedPosition = getPlaybackProgress();

    if (savedPosition <= 0) {
        return;
    }

    try {
        const mhPlayer = getMHPlayer();

        if (typeof mhPlayer.getState !== "function") {
            return;
        }

        const state = await mhPlayer.getState();

        if (
            !state?.available ||
            !Number.isFinite(Number(state.duration))
        ) {
            return;
        }

        if (
            savedPosition >= Number(state.duration) - 5000
        ) {
            clearPlaybackProgress();
            return;
        }

        const targetTime = Math.min(
            savedPosition,
            Math.max(0, Number(state.duration) - 1000)
        );

        if (typeof mhPlayer.seekTo === "function") {
            await mhPlayer.seekTo({
                position: targetTime
            });
        }

        console.log(
            "MH Movies: playback position restored:",
            targetTime
        );
    } catch (error) {
        console.error(
            "MH Movies: unable to restore playback position:",
            error
        );
    }
}

function startPlaybackSaveTimer() {
    if (playbackSaveTimer) {
        clearInterval(playbackSaveTimer);
    }

    playbackSaveTimer = setInterval(
        async () => {
            try {
                const mhPlayer = getMHPlayer();

                if (
                    !mhPlayer ||
                    typeof mhPlayer.getState !== "function" ||
                    isEmbedSource
                ) {
                    return;
                }

                const state = await mhPlayer.getState();

                if (state?.available && state.playing) {
                    await savePlaybackProgress();
                }
            } catch (error) {
                console.error(
                    "MH Movies: playback timer failed:",
                    error
                );
            }
        },
        5000
    );
}

function stopPlaybackSaveTimer() {
    if (playbackSaveTimer) {
        clearInterval(playbackSaveTimer);
        playbackSaveTimer = null;
    }
}

window.MHShowSubtitlePicker = function () {
    if (!subtitleSelector) return;

    if (!subtitleSelector.children.length) {
        return;
    }

    subtitleSelector.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    subtitleSelector.classList.remove("subtitle-flash");
    // force reflow so the animation can restart
    void subtitleSelector.offsetWidth;
    subtitleSelector.classList.add("subtitle-flash");

    window.setTimeout(() => {
        subtitleSelector.classList.remove("subtitle-flash");
    }, 1600);
};

async function loadSubtitleList() {
    if (!subtitleSelector) return;

    // Prefer the real title passed from the catalogue (script.js).
    // Falls back to whatever metadata we have.
    const searchTitle = (offlineTitle || currentMovieMetadata.title || "").trim();

    if (!searchTitle) {
        subtitleSelector.innerHTML = "";
        return;
    }

    try {
        const searchUrl =
            MH_SUBTITLE_API +
            "/movies/search?searchType=text&q=" +
            encodeURIComponent(searchTitle);

        const response = await fetch(searchUrl);

        if (!response.ok) {
            throw new Error("Subtitle movie search HTTP " + response.status);
        }

        const result = await response.json();
        const matches = Array.isArray(result.data) ? result.data : [];

        console.log("MH Movies: subtitle text matches:", matches);

        const requestedSeason = Number.parseInt(mediaSeason || "", 10);

        let match;

        if (mediaType === "tv" && Number.isFinite(requestedSeason)) {
            match = matches.find(
                item =>
                    Number(item.season) === requestedSeason &&
                    /tv/i.test(String(item.type || ""))
            );

            if (!match) {
                match = matches.find(
                    item => Number(item.season) === requestedSeason
                );
            }
        } else {
            const wanted = searchTitle.toLowerCase();
            match = matches.find(
                item =>
                    String(item.title || "").toLowerCase() === wanted &&
                    !/tv/i.test(String(item.type || ""))
            );
            if (!match) {
                match = matches.find(
                    item => String(item.title || "").toLowerCase() === wanted
                );
            }
            if (!match) {
                match = matches[0];
            }
        }

        if (!match || !match.movieId) {
            subtitleSelector.innerHTML = "";
            return;
        }

        console.log(
            "MH Movies: chosen subtitle movie:",
            match.movieId,
            match.title,
            match.season
        );

        const subtitlesResponse = await fetch(
            MH_SUBTITLE_API +
                "/subtitles?movieId=" +
                encodeURIComponent(match.movieId)
        );

        if (!subtitlesResponse.ok) {
            throw new Error(
                "Subtitle list HTTP " + subtitlesResponse.status
            );
        }

        const subtitlesResult = await subtitlesResponse.json();
        const subtitles = Array.isArray(subtitlesResult.data)
            ? subtitlesResult.data
            : [];

        console.log("MH Movies: subtitles found:", subtitles);

        const englishSubtitles = subtitles.filter(subtitle => {
            if (
                !String(subtitle.language || "")
                    .toLowerCase()
                    .includes("english")
            ) {
                return false;
            }

            if (mediaType !== "tv") {
                return true;
            }

            const seasonNumber = Number.parseInt(mediaSeason || "", 10);
            const episodeNumber = Number.parseInt(mediaEpisode || "", 10);

            if (
                !Number.isFinite(seasonNumber) ||
                !Number.isFinite(episodeNumber)
            ) {
                return false;
            }

            const episodeTag =
                "S" +
                String(seasonNumber).padStart(2, "0") +
                "E" +
                String(episodeNumber).padStart(2, "0");

            const releaseInfo = Array.isArray(subtitle.releaseInfo)
                ? subtitle.releaseInfo.join(" ")
                : "";

            return (
                Number(subtitle.files) === 1 &&
                new RegExp(episodeTag, "i").test(releaseInfo)
            );
        });

        if (!englishSubtitles.length) {
            subtitleSelector.innerHTML = "";
            return;
        }

        const escapeHtml = value =>
            String(value).replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const options = englishSubtitles.map((subtitle, index) => ({
            index,
            label:
                subtitle.releaseInfo?.[0] ||
                "English subtitle " + (index + 1)
        }));

        subtitleSelector.innerHTML = `
            <div class="subtitle-title">Subtitles</div>
            <button type="button" class="subtitle-picker" id="subtitlePicker">
                <span class="subtitle-picker-label" id="subtitlePickerLabel">
                    Off
                </span>
                <span class="subtitle-picker-chevron"></span>
            </button>
            <div class="subtitle-menu" id="subtitleMenu" hidden>
                <button type="button" class="subtitle-menu-item" data-subtitle-index="-1">
                    Off
                </button>
                ${options.map(option => `
                    <button
                        type="button"
                        class="subtitle-menu-item"
                        data-subtitle-index="${option.index}"
                    >
                        ${escapeHtml(option.label)}
                    </button>
                `).join("")}
            </div>
        `;

        console.log("MH Movies: English subtitles:", englishSubtitles);

        const subtitlePicker =
            subtitleSelector.querySelector("#subtitlePicker");

        const subtitlePickerLabel =
            subtitleSelector.querySelector("#subtitlePickerLabel");

        const subtitleMenu =
            subtitleSelector.querySelector("#subtitleMenu");

        const subtitleSelect = subtitlePicker;

        async function MHApplySubtitle(subtitle, selectEl) {
            if (!subtitle || !subtitle.subtitleId) {
                return false;
            }

            const mhSubtitle = getMHSubtitle();

            if (
                !mhSubtitle ||
                typeof mhSubtitle.downloadSubtitle !== "function" ||
                typeof mhSubtitle.setSubtitle !== "function"
            ) {
                console.warn("MH Movies: subtitle plugin unavailable");
                return false;
            }

            if (selectEl) {
                selectEl.disabled = true;
            }

            try {
                const downloadUrl =
                    MH_SUBTITLE_API +
                    "/subtitles/" +
                    encodeURIComponent(subtitle.subtitleId) +
                    "/download";

                const result = await mhSubtitle.downloadSubtitle({
                    downloadUrl,
                    baseName: "mh-subtitle-" + subtitle.subtitleId
                });

                if (!result || !result.uri) {
                    throw new Error("Subtitle file was not returned");
                }

                await mhSubtitle.setSubtitle({
                    uri: result.uri,
                    language: "en"
                });

                if (selectEl) {
                    selectEl.disabled = false;
                }

                return true;
            } catch (error) {
                console.error(
                    "MH Movies: subtitle load failed:",
                    error
                );

                if (selectEl) {
                    selectEl.disabled = false;
                }

                return false;
            }
        }

        if (subtitlePicker && subtitleMenu) {
            subtitlePicker.addEventListener("click", () => {
                subtitleMenu.hidden = !subtitleMenu.hidden;
            });

            subtitleMenu
                .querySelectorAll(".subtitle-menu-item")
                .forEach(item => {
                    item.addEventListener("click", async () => {
                        const index = Number(item.dataset.subtitleIndex);

                        subtitleMenu.hidden = true;

                        if (index < 0) {
                            subtitlePickerLabel.textContent = "Off";

                            subtitleMenu
                                .querySelectorAll(".subtitle-menu-item")
                                .forEach(el =>
                                    el.classList.toggle(
                                        "active",
                                        el === item
                                    )
                                );

                            const mhPlayer = getMHPlayer();

                            if (
                                mhPlayer &&
                                typeof mhPlayer.toggleSubtitles ===
                                    "function"
                            ) {
                                await mhPlayer.toggleSubtitles();
                            }

                            return;
                        }

                        const subtitle = englishSubtitles[index];

                        const ok = await MHApplySubtitle(
                            subtitle,
                            subtitlePicker
                        );

                        if (ok) {
                            subtitlePickerLabel.textContent =
                                subtitle.releaseInfo?.[0] ||
                                "English subtitle " + (index + 1);

                            subtitleMenu
                                .querySelectorAll(".subtitle-menu-item")
                                .forEach(el =>
                                    el.classList.toggle(
                                        "active",
                                        el === item
                                    )
                                );
                        }
                    });
                });
        }

        // Stash for auto-load once the player has actually started.
        window.__MHFirstSubtitle = englishSubtitles[0] || null;
        window.__MHFirstSubtitleButton = subtitleSelect;
        window.__MHApplySubtitle = MHApplySubtitle;

    } catch (error) {
        console.warn("MH Movies: subtitle lookup failed:", error);
        subtitleSelector.innerHTML = "";
    }
}

async function loadTMDBMetadata() {
    if (!movieId) return;

    try {
        const type =
            mediaType === "tv" ? "tv" : "movie";

        const response = await fetch(
            MH_CONFIG_URL
        );

        if (!response.ok) {
            throw new Error(
                "Config HTTP " + response.status
            );
        }

        const config = await response.json();

        AUTHORIZED_VIDEO_API =
            config.videoApi || AUTHORIZED_VIDEO_API;
    } catch (error) {
        console.error(
            "MH Movies: config fetch failed:",
            error
        );
    }

    try {
        const endpoint =
            "https://tmdb.cyberharzard.workers.dev/" +
            type +
            "/" +
            encodeURIComponent(movieId) +
            "?language=en-US";

        const response = await fetch(endpoint);

        if (!response.ok) {
            throw new Error(
                "TMDB HTTP " + response.status
            );
        }

        const data = await response.json();

        currentMovieMetadata.title =
            data.title ||
            data.name ||
            "Movie Player";

        currentMovieMetadata.year =
            (
                data.release_date ||
                data.first_air_date ||
                ""
            ).slice(0, 4);

        currentMovieMetadata.overview =
            data.overview || "";

        currentMovieMetadata.poster =
            data.poster_path
                ? "https://image.tmdb.org/t/p/w500" +
                  data.poster_path
                : "";

        try {
            const externalIdsEndpoint =
                "https://tmdb.cyberharzard.workers.dev/" +
                type +
                "/" +
                encodeURIComponent(movieId) +
                "/external_ids";

            const externalIdsResponse =
                await fetch(externalIdsEndpoint);

            if (externalIdsResponse.ok) {
                const externalIds =
                    await externalIdsResponse.json();

                currentMovieMetadata.imdbId =
                    data.imdb_id || externalIds.imdb_id || "";
            }
        } catch (error) {
            console.warn(
                "MH Movies: IMDb ID lookup failed:",
                error
            );
        }

    } catch (error) {
        console.error(
            "MH Movies: metadata failed:",
            error
        );
    }
}

async function getAuthorizedVideoUrl(tmdbId) {
    if (!tmdbId) return "";

    if (!AUTHORIZED_VIDEO_API) {
        try {
            const response =
                await fetch(MH_CONFIG_URL);

            if (!response.ok) {
                throw new Error(
                    "Config HTTP " + response.status
                );
            }

            const config =
                await response.json();

            AUTHORIZED_VIDEO_API =
                config.videoApi || "";
        } catch (error) {
            console.error(
                "MH Movies: video API config failed:",
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

function getSourceTwoUrl() {
    if (!movieId) return "";

    return (
        SECOND_VIDEO_API +
        encodeURIComponent(movieId)
    );
}

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
        document.createElement("div");

    selector.id =
        "mhVideoSourceSelector";

    selector.style.cssText =
        "display:flex;gap:8px;margin:12px 0;" +
        "align-items:center;flex-wrap:wrap;";

    const label =
        document.createElement("span");

    label.textContent =
        "Video Source:";

    label.style.cssText =
        "font-size:14px;font-weight:600;";

    selector.appendChild(label);

    function createButton(source, text) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.dataset.source = source;
        button.textContent = text;

        button.style.cssText =
            "border:1px solid currentColor;" +
            "border-radius:8px;padding:7px 12px;" +
            "background:transparent;color:inherit;" +
            "font-size:13px;font-weight:600;";

        button.addEventListener(
            "click",
            () => {
                if (
                    selectedVideoSource ===
                    source
                ) {
                    return;
                }

                selectedVideoSource = source;

                try {
                    localStorage.setItem(
                        "mhMoviesVideoSource:" +
                        movieId,
                        source
                    );
                } catch (error) {
                    console.error(
                        "MH Movies: unable to save source:",
                        error
                    );
                }

                updateVideoSourceButtons();
                playbackRestoreDone = false;
                loadMovie();
            }
        );

        return button;
    }

    selector.appendChild(
        createButton("mhmo", "MHMO")
    );

    selector.appendChild(
        createButton("source2", "SOURCE 2")
    );

    const target =
        movieMeta || movieTitle;

    if (
        target &&
        target.parentNode
    ) {
        target.parentNode.insertBefore(
            selector,
            target.nextSibling
        );
    }
    
    updateVideoSourceButtons();
}

function updateVideoSourceButtons() {
    const selector =
        document.getElementById(
            "mhVideoSourceSelector"
        );

    if (!selector) return;

    selector
        .querySelectorAll(
            "button[data-source]"
        )
        .forEach(button => {
            const active =
                button.dataset.source ===
                selectedVideoSource;

            button.style.fontWeight =
                active ? "800" : "600";

            button.style.opacity =
                active ? "1" : "0.65";

            button.setAttribute(
                "aria-pressed",
                active ? "true" : "false"
            );
        });
}

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
            "Catalogue error: " +
            response.status
        );
    }

    const movies =
        await response.json();

    if (!Array.isArray(movies)) {
        throw new Error(
            "Invalid movie catalogue."
        );
    }

    availableMovieList = movies;
}

function getCurrentFreeMovie() {
    if (!freeMovieId) return null;

    return (
        availableMovieList.find(
            movie =>
                String(movie.id) ===
                String(freeMovieId)
        ) || null
    );
}

function showMovieAlert(
    message,
    options = {}
) {
    return new Promise(resolve => {
        const existing =
            document.querySelector(".alerts");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "alerts";

        overlay.innerHTML = `
            <div class="alert-box">
                <div class="alert-message">
                    ${String(message)
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\n/g, "<br>")}
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

        const close = result => {
            if (overlay.parentNode) {
                overlay.remove();
            }

            resolve(result);
        };

        overlay
            .querySelector(".alert-confirm")
            ?.addEventListener(
                "click",
                () => close(true)
            );

        overlay
            .querySelector(".alert-cancel")
            ?.addEventListener(
                "click",
                () => close(false)
            );
    });
}

let downloadStatusTimer = null;

function showDownloadStatus(
    message,
    duration = 4000
) {
    if (!downloadStatus) return;

    clearTimeout(downloadStatusTimer);

    if (!message) {
        downloadStatus.textContent = "";
        downloadStatus.style.display = "none";
        return;
    }

    const text = String(message);
    const maxLength = 90;

    downloadStatus.textContent =
        text.length > maxLength
            ? text.slice(0, maxLength - 3) + "..."
            : text;

    downloadStatus.style.display = "block";

    if (duration > 0) {
        downloadStatusTimer =
            setTimeout(() => {
                downloadStatus.textContent = "";
                downloadStatus.style.display = "none";
            }, duration);
    }
}

function toNativeFileUrl(url) {
    if (!url) return url;

    const marker = "/_capacitor_file_/";
    const idx = String(url).indexOf(marker);

    if (idx >= 0) {
        return "file:///" + String(url).slice(idx + marker.length);
    }

    return url;
}

async function openJustPlayer(url) {
    if (!url) {
        throw new Error(
            "No playable video URL."
        );
    }

    const mhPlayer = getMHPlayer();

    if (
        !mhPlayer ||
        typeof mhPlayer.open !== "function"
    ) {
        throw new Error(
            "Just Player native plugin is unavailable."
        );
    }

    const nativeUrl = toNativeFileUrl(url);

    console.log(
        "MH Movies: opening Just Player:",
        nativeUrl
    );

    await mhPlayer.open({
        url: String(nativeUrl),
        returnUrl: window.location.href
    });

    startPlaybackSaveTimer();

    setTimeout(
        restorePlaybackProgress,
        1200
    );
}

async function resolvePlayableUrl(url) {
    if (!url) return "";

    if (!isEmbedUrl(url)) {
        return url;
    }

    const extractor =
        getMHExtractor();

    if (!extractor ||
        typeof extractor.extract !== "function") {
        throw new Error(
            "The native video extractor is unavailable."
        );
    }

    console.log(
        "MH Movies: extracting playable URL:",
        url
    );

    const extracted =
        await extractor.extract({
            url: String(url)
        });

    if (
        !extracted ||
        !extracted.url
    ) {
        throw new Error(
            "The source did not provide a playable video."
        );
    }

    return extracted.url;
}

async function loadMovie() {
    videoSource = "";
    isEmbedSource = false;
    playbackRestoreDone = false;

    hideOverlay(loadingOverlay);
    hideOverlay(noSourceOverlay);
    hideOverlay(errorOverlay);

    if (offlineVideo) {
        if (movieTitle) {
            movieTitle.textContent =
                offlineTitle || "Offline Movie";
        }

        if (movieMeta) {
            movieMeta.textContent =
                "Downloaded";
        }

        if (movieOverview) {
            movieOverview.textContent =
                "Opening Just Player...";
        }

        videoSource = offlineVideo;

        try {
            await openJustPlayer(
                videoSource
            );

            // Attach the saved offline subtitle if one was provided.
            if (urlSubtitle) {
                const mhSubtitle = getMHSubtitle();

                if (
                    mhSubtitle &&
                    typeof mhSubtitle.setSubtitle === "function"
                ) {
                    setTimeout(async () => {
                        try {
                            await mhSubtitle.setSubtitle({
                                uri: toNativeFileUrl(urlSubtitle),
                                language: "en"
                            });
                        } catch (subtitleError) {
                            console.warn(
                                "MH Movies: offline subtitle load failed:",
                                subtitleError
                            );
                        }
                    }, 700);
                }
            }
        } catch (error) {
            console.error(
                "MH Movies: offline player failed:",
                error
            );

            if (movieOverview) {
                movieOverview.textContent =
                    "Unable to open this video.";
            }

            showOverlay(errorOverlay);
        }

        return;
    }

    if (freeMovieId) {
        try {
            await loadMovieCatalogue();
        } catch (error) {
            console.error(
                "MH Movies: catalogue failed:",
                error
            );

            if (movieTitle) {
                movieTitle.textContent =
                    "Unable to Fetch Movie";
            }

            if (movieMeta) {
                movieMeta.textContent =
                    "Catalogue unavailable";
            }

            if (movieOverview) {
                movieOverview.textContent =
                    "Please check your internet connection and try again.";
            }

            showOverlay(errorOverlay);
            return;
        }

        const freeMovie =
            getCurrentFreeMovie();

        if (!freeMovie) {
            if (movieTitle) {
                movieTitle.textContent =
                    "Movie Not Found";
            }

            if (movieOverview) {
                movieOverview.textContent =
                    "Return to MH Movies and select another movie.";
            }

            showOverlay(noSourceOverlay);
            return;
        }

        if (movieTitle) {
            movieTitle.textContent =
                freeMovie.title || "Movie";
        }

        if (movieMeta) {
            movieMeta.textContent =
                freeMovie.year || "";
        }

        if (movieOverview) {
            movieOverview.textContent =
                freeMovie.overview ||
                "Preparing Just Player...";
        }

        videoSource =
            directVideoUrl ||
            embedCustom ||
            freeMovie.videoUrl ||
            "";

        if (
            !videoSource &&
            freeMovie.tmdbId
        ) {
            videoSource =
                await getAuthorizedVideoUrl(
                    freeMovie.tmdbId
                );
        }

        if (!videoSource) {
            if (movieOverview) {
                movieOverview.textContent =
                    "This movie does not currently have a playable video source.";
            }

            showOverlay(noSourceOverlay);
            return;
        }

        await launchResolvedPlayer();
        return;
    }

    if (
        !movieId &&
        !embedCustom &&
        !directVideoUrl
    ) {
        if (movieTitle) {
            movieTitle.textContent =
                "Movie Player";
        }

        if (movieMeta) {
            movieMeta.textContent =
                "Default source";
        }

        if (movieOverview) {
            movieOverview.textContent =
                "Opening Just Player...";
        }

        videoSource =
            DEFAULT_EMBED_SOURCE;

        await launchResolvedPlayer();
        return;
    }

    await loadTMDBMetadata();
    await loadSubtitleList();

    if (
        moviePoster &&
        currentMovieMetadata.poster
    ) {
        moviePoster.src =
            currentMovieMetadata.poster;

        moviePoster.style.display =
            "block";
    }

    if (movieTitle) {
        movieTitle.textContent =
            offlineTitle ||
            currentMovieMetadata.title ||
            "Movie Player";
    }

    if (movieMeta) {
        movieMeta.textContent =
            currentMovieMetadata.year || "";
    }

    if (movieOverview) {
        movieOverview.textContent =
            currentMovieMetadata.overview ||
            "Preparing Just Player...";
    }

    createVideoSourceButtons();

    videoSource =
        directVideoUrl ||
        embedCustom ||
        "";

    if (movieId) {
        if (
            selectedVideoSource ===
            "source2"
        ) {
            videoSource =
                getSourceTwoUrl();
        } else {
            videoSource =
                await getAuthorizedVideoUrl(
                    movieId
                );
        }
    }

    if (!videoSource) {
        videoSource =
            DEFAULT_EMBED_SOURCE;
    }

    await launchResolvedPlayer();

    if (
        autoDownload &&
        downloadMovieButton
    ) {
        setTimeout(
            () => downloadMovieButton.click(),
            300
        );
    }
}

async function launchResolvedPlayer() {
    hideOverlay(errorOverlay);
    hideOverlay(noSourceOverlay);
    showOverlay(loadingOverlay);

    try {
        const playableUrl =
            await resolvePlayableUrl(
                videoSource
            );

        if (!playableUrl) {
            throw new Error(
                "No playable video URL was returned."
            );
        }

        isEmbedSource = false;

        await openJustPlayer(
            playableUrl
        );

        // Auto-load the first English subtitle once the player is live.
        // Small delay so the native setMediaItem call has landed.
        if (
            window.__MHFirstSubtitle &&
            typeof window.__MHApplySubtitle === "function"
        ) {
            setTimeout(() => {
                window.__MHApplySubtitle(
                    window.__MHFirstSubtitle,
                    window.__MHFirstSubtitleButton
                );
            }, 700);
        }

        hideOverlay(loadingOverlay);

        if (movieOverview) {
            movieOverview.textContent =
                "Playing with Just Player.";
        }
    } catch (error) {
        console.error(
            "MH Movies: Just Player launch failed:",
            error
        );

        hideOverlay(loadingOverlay);

        if (movieOverview) {
            movieOverview.textContent =
                "Unable to open this video source.";
        }

        showOverlay(errorOverlay);
    }
}

if (downloadMovieButton) {
    downloadMovieButton.addEventListener(
        "click",
        async event => {
            event.preventDefault();
            event.stopPropagation();

            const currentMovie =
                getCurrentFreeMovie();

            let downloadUrl =
                currentMovie?.videoUrl ||
                directVideoUrl ||
                "";

            if (
                isEmbedUrl(downloadUrl) ||
                (!downloadUrl && videoSource)
            ) {
                const extractor =
                    getMHExtractor();

                if (!extractor ||
                    typeof extractor.extract !== "function") {
                    showDownloadStatus(
                        "The native video extractor is not available."
                    );
                    return;
                }

                const extractionUrl =
                    videoSource || "";

                if (!extractionUrl) {
                    showDownloadStatus(
                        "No video source is available to extract."
                    );
                    return;
                }

                showDownloadStatus(
                    "Finding downloadable video...",
                    0
                );

                try {
                    const extracted =
                        await extractor.extract({
                            url: extractionUrl
                        });

                    if (
                        !extracted ||
                        !extracted.url
                    ) {
                        showDownloadStatus(
                            "The extractor could not find a downloadable video."
                        );
                        return;
                    }

                    downloadUrl =
                        extracted.url;
                } catch (error) {
                    console.error(
                        "MH Movies: extraction failed:",
                        error
                    );

                    showDownloadStatus(
                        "Could not find a downloadable video from this source."
                    );
                    return;
                }
            }

            if (isEmbedUrl(downloadUrl)) {
                showDownloadStatus(
                    "The available source is an embedded player, not a downloadable video file."
                );
                return;
            }

            if (
                downloadUrl.toLowerCase().includes(".m3u8")
            ) {
                const downloadPlugin = getMHDownload();

                if (
                    downloadPlugin &&
                    typeof downloadPlugin.listVariants === "function"
                ) {
                    showDownloadStatus("Checking available qualities...", 0);

                    try {
                        const variantResult =
                            await downloadPlugin.listVariants({
                                url: downloadUrl
                            });

                        const variants =
                            Array.isArray(variantResult?.variants)
                                ? variantResult.variants
                                : [];

                        if (variants.length > 1) {
                            showDownloadStatus("", 0);

                            const chosen =
                                await showVariantPicker(variants);

                            if (!chosen || !chosen.url) {
                                return;
                            }

                            downloadUrl = chosen.url;
                        } else if (variants.length === 1 && variants[0].url) {
                            downloadUrl = variants[0].url;
                        }

                        showDownloadStatus("", 0);
                    } catch (error) {
                        console.warn(
                            "MH Movies: variant listing failed:",
                            error
                        );

                        showDownloadStatus("", 0);
                    }
                }
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
                downloads = [];
            }

            if (!Array.isArray(downloads)) {
                downloads = [];
            }

            const title =
                currentMovie?.title ||
                currentMovieMetadata.title ||
                movieTitle?.textContent ||
                "Movie";

            const existing =
                downloads.find(
                    item =>
                        String(item.id) ===
                            downloadId ||
                        String(
                            item.title || ""
                        )
                            .trim()
                            .toLowerCase() ===
                            String(title)
                                .trim()
                                .toLowerCase()
                );

            if (existing) {
                await showMovieAlert(
                    "This movie is already in your downloads."
                );
                return;
            }

            const movieDownload = {
                id: downloadId,
                title,
                year:
                    currentMovie?.year ||
                    currentMovieMetadata.year ||
                    "",
                poster:
                    currentMovie?.poster ||
                    currentMovieMetadata.poster ||
                    urlPoster ||
                    "",
                videoUrl: downloadUrl,
                status: "queued",
                progress: 0,
                downloaded: 0,
                totalSize: 0,
                speed: 0,
                remaining: 0,
                file: "",
                filePath: "",
                message: "",
                subtitleStatus: "queued",
                subtitleId: "",
                subtitleFilePath: "",
                subtitleRelease: "",
                subtitleError: "",
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
                JSON.stringify(downloads)
            );

            await showMovieAlert(
                "Movie added to download queue."
            );

            window.location.href =
                "offline.html";
        }
    );
}

if (retryPlayButton) {
    retryPlayButton.addEventListener(
        "click",
        () => {
            playbackRestoreDone = false;
            loadMovie();
        }
    );
}

if (backButton) {
    backButton.addEventListener(
        "click",
        async () => {
            await savePlaybackProgress();
            stopPlaybackSaveTimer();
            window.history.back();
        }
    );
}

const PlayerApp =
    window.Capacitor?.Plugins?.App;

if (PlayerApp) {
    PlayerApp.addListener(
        "backButton",
        async () => {
            await savePlaybackProgress();
            stopPlaybackSaveTimer();
            window.history.back();
        }
    );
}

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

    window.addEventListener("pagehide", () => {
        savePlaybackProgress();
        stopPlaybackSaveTimer();
        const mhPlayer = getMHPlayer();
        if (mhPlayer && typeof mhPlayer.close === "function") {
            mhPlayer.close().catch(() => {});
        }
    });

loadMovie();
