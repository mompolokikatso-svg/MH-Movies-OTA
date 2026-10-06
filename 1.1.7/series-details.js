// ========================================
// MH MOVIES — SERIES DETAILS
// ========================================

const API_BASE_URL = "https://tmdb.cyberharzard.workers.dev";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

const params = new URLSearchParams(window.location.search);
const tvId = params.get("id");

const themeButton = document.getElementById("themeButton");

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

function escapeHtml(value) {
    return String(value || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ---------- download plugins ----------
const getMHExtractor = () =>
    window.Capacitor?.Plugins?.MHExtractor || null;

const getMHDownload = () =>
    window.Capacitor?.Plugins?.MHDownload || null;

const MH_CONFIG_URL =
    "https://mh-movies-config.cyberharzard.workers.dev/";

let AUTHORIZED_VIDEO_API = "";

async function getVideoApiBase() {
    if (AUTHORIZED_VIDEO_API) return AUTHORIZED_VIDEO_API;

    try {
        const res = await fetch(MH_CONFIG_URL);
        const config = await res.json();
        AUTHORIZED_VIDEO_API = config.videoApi || "";
    } catch (e) {
        console.error("MH Movies: config fetch failed:", e);
    }

    return AUTHORIZED_VIDEO_API;
}

function getDownloads() {
    try {
        const raw = JSON.parse(
            localStorage.getItem("mhMoviesDownloads") || "[]"
        );
        return Array.isArray(raw) ? raw : [];
    } catch (e) {
        return [];
    }
}

function saveDownloads(list) {
    try {
        localStorage.setItem(
            "mhMoviesDownloads",
            JSON.stringify(list)
        );
    } catch (e) {
        console.warn("MH Movies: saveDownloads failed:", e);
    }
}

function makeParts(count) {
    return Array.from({ length: count }, (_, i) => ({
        index: i,
        downloaded: 0,
        status: "pending"
    }));
}

function episodeFileName(seriesName, season, episode) {
    const safe =
        String(seriesName || "Series")
            .replace(/[^a-z0-9]/gi, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "") || "Series";

    return (
        safe +
        "_S" + String(season).padStart(2, "0") +
        "E" + String(episode).padStart(2, "0") +
        ".mp4"
    );
}

function episodeTitle(seriesName, season, episode) {
    return (
        seriesName +
        " S" + String(season).padStart(2, "0") +
        "E" + String(episode).padStart(2, "0")
    );
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

    return (
        size.toFixed(size >= 100 || index === 0 ? 0 : 1) +
        " " +
        units[index]
    );
}

function showVariantPicker(variants) {
    return new Promise(resolve => {
        const existing = document.querySelector(".alerts");

        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement("div");
        overlay.className = "alerts";

        const rows = variants
            .map((variant, index) => {
                const res = variant.resolution
                    ? variant.resolution.replace("x", " × ")
                    : variant.bandwidth
                        ? Math.round(variant.bandwidth / 1000) +
                          " kbps"
                        : "Quality " + (index + 1);

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
            })
            .join("");

        overlay.innerHTML = `
            <div class="alert-box">
                <div class="alert-message">
                    Choose download quality
                </div>
                <div class="alert-actions" style="flex-direction:column;">
                    ${rows}
                    <button
                        type="button"
                        class="alert-cancel"
                        data-variant-cancel="1"
                    >
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

        overlay
            .querySelectorAll(".variant-choice")
            .forEach(btn => {
                btn.addEventListener("click", () => {
                    const idx = Number(btn.dataset.variantIndex);
                    close(variants[idx] || null);
                });
            });

        overlay
            .querySelector("[data-variant-cancel]")
            ?.addEventListener("click", () => close(null));
    });
}

const backButton = document.getElementById("seriesDetailsBack");

if (backButton) {
    backButton.addEventListener("click", () => {
        window.location.href = "series.html";
    });
}

let currentSeries = null;

const loadingEl = document.getElementById("seriesDetailsLoading");
const contentEl = document.getElementById("seriesDetailsContent");
const posterEl = document.getElementById("seriesPoster");
const titleEl = document.getElementById("seriesTitle");
const ratingEl = document.getElementById("seriesRating");
const yearEl = document.getElementById("seriesYear");
const overviewEl = document.getElementById("seriesOverview");
const seasonListEl = document.getElementById("seasonList");

async function fetchTv(path) {
    const response = await fetch(
        API_BASE_URL + path + "?language=en-US"
    );

    if (!response.ok) {
        throw new Error("TV HTTP " + response.status);
    }

    return response.json();
}

async function loadSeries() {
    if (!tvId) {
        if (loadingEl) {
            loadingEl.innerHTML = "<p>No series selected.</p>";
        }
        return;
    }

    try {
        const data = await fetchTv("/tv/" + encodeURIComponent(tvId));
        currentSeries = data;

        titleEl.textContent = data.name || "Series";
        ratingEl.textContent =
            "⭐ " +
            (data.vote_average != null
                ? data.vote_average.toFixed(1)
                : "N/A");
        yearEl.textContent = (data.first_air_date || "").slice(0, 4);
        overviewEl.textContent =
            data.overview || "No description available.";

        if (data.poster_path) {
            posterEl.src = POSTER_BASE + data.poster_path;
        }

        const seasons = (data.seasons || []).filter(
            season => season.season_number > 0
        );

        seasonListEl.innerHTML = "";

        if (!seasons.length) {
            seasonListEl.innerHTML = "<p>No seasons available.</p>";
        } else {
            seasons.forEach(season => {
                seasonListEl.appendChild(
                    createSeasonBlock(season)
                );
            });
        }

        if (loadingEl) {
            loadingEl.style.display = "none";
        }
        if (contentEl) {
            contentEl.style.display = "block";
        }
    } catch (error) {
        console.error("MH Movies: series details failed:", error);

        if (loadingEl) {
            loadingEl.innerHTML = "<p>Unable to load series.</p>";
        }
    }
}

function createSeasonBlock(season) {
    const wrapper = document.createElement("div");
    wrapper.className = "season-block";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "season-header";
    header.innerHTML = `
        <span class="season-name">
            ${escapeHtml(season.name || "Season " + season.season_number)}
        </span>
        <span class="season-count">
            ${season.episode_count || 0} eps
        </span>
        <span class="season-chevron"></span>
    `;

    const episodeBox = document.createElement("div");
    episodeBox.className = "season-episodes";
    episodeBox.hidden = true;

    let loaded = false;

    header.addEventListener("click", async () => {
        const isOpen = !episodeBox.hidden;

        // close all other seasons (accordion behaviour)
        seasonListEl
            .querySelectorAll(".season-episodes")
            .forEach(box => {
                box.hidden = true;
            });
        seasonListEl
            .querySelectorAll(".season-header")
            .forEach(h => h.classList.remove("open"));

        if (isOpen) {
            return;
        }

        episodeBox.hidden = false;
        header.classList.add("open");

        if (loaded) {
            return;
        }

        episodeBox.innerHTML = "<p>Loading episodes...</p>";

        try {
            const data = await fetchTv(
                "/tv/" +
                    encodeURIComponent(tvId) +
                    "/season/" +
                    encodeURIComponent(season.season_number)
            );

            const episodes = data.episodes || [];

            if (!episodes.length) {
                episodeBox.innerHTML = "<p>No episodes found.</p>";
                return;
            }

            episodeBox.innerHTML = `
                <div class="episode-toolbar">
                    <button type="button" class="episode-toolbar-btn select-all">
                        Select all
                    </button>
                    <button type="button" class="episode-toolbar-btn download-selected">
                        ⬇ Download selected
                    </button>
                </div>
                ${episodes.map(episode => `
                    <div
                        class="episode-item"
                        data-episode="${episode.episode_number}"
                    >
                        <label class="episode-check">
                            <input
                                type="checkbox"
                                class="episode-select"
                                data-episode="${episode.episode_number}"
                            >
                        </label>
                        <div class="episode-info">
                            <span class="episode-number">
                                E${String(episode.episode_number).padStart(2, "0")}
                            </span>
                            <span class="episode-name">
                                ${escapeHtml(episode.name || "Episode")}
                            </span>
                        </div>
                        <div class="episode-actions">
                            <button
                                type="button"
                                class="episode-btn play-btn"
                                data-episode="${episode.episode_number}"
                            >
                                ▶
                            </button>
                            <button
                                type="button"
                                class="episode-btn download-btn"
                                data-episode="${episode.episode_number}"
                            >
                                ⬇
                            </button>
                        </div>
                    </div>
                `).join("")}
            `;

            episodeBox
                .querySelectorAll(".play-btn")
                .forEach(btn => {
                    btn.addEventListener("click", () => {
                        playEpisode(
                            season.season_number,
                            Number(btn.dataset.episode)
                        );
                    });
                });

            episodeBox
                .querySelectorAll(".download-btn")
                .forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const episodeNumber =
                            Number(btn.dataset.episode);

                        btn.disabled = true;
                        btn.textContent = "…";

                        try {
                            await downloadEpisode(
                                season.season_number,
                                episodeNumber
                            );
                            btn.textContent = "✓";
                        } catch (error) {
                            if (
                                String(error?.message) === "cancelled"
                            ) {
                                btn.disabled = false;
                                btn.textContent = "⬇";
                                return;
                            }

                            console.error(
                                "MH Movies: episode download failed:",
                                error
                            );
                            btn.disabled = false;
                            btn.textContent = "⬇";
                        }
                    });
                });

            const selectAllBtn =
                episodeBox.querySelector(".select-all");

            if (selectAllBtn) {
                selectAllBtn.addEventListener("click", () => {
                    const boxes = episodeBox.querySelectorAll(
                        ".episode-select"
                    );

                    const allChecked = Array.from(boxes).every(
                        box => box.checked
                    );

                    boxes.forEach(box => {
                        box.checked = !allChecked;
                    });

                    selectAllBtn.textContent = allChecked
                        ? "Select all"
                        : "Clear selection";
                });
            }

            const downloadSelectedBtn = episodeBox.querySelector(
                ".download-selected"
            );

            if (downloadSelectedBtn) {
                downloadSelectedBtn.addEventListener(
                    "click",
                    async () => {
                        const checked = Array.from(
                            episodeBox.querySelectorAll(
                                ".episode-select"
                            )
                        ).filter(box => box.checked);

                        if (!checked.length) {
                            return;
                        }

                        downloadSelectedBtn.disabled = true;
                        const originalLabel =
                            downloadSelectedBtn.textContent;

                        // Extraction runs one at a time (native plugin),
                        // so download episodes sequentially.
                        for (let i = 0; i < checked.length; i++) {
                            const episodeNumber = Number(
                                checked[i].dataset.episode
                            );

                            downloadSelectedBtn.textContent =
                                `Downloading ${i + 1}/${checked.length}…`;

                            try {
                                await downloadEpisode(
                                    season.season_number,
                                    episodeNumber
                                );
                            } catch (error) {
                                if (
                                    String(error?.message) === "cancelled"
                                ) {
                                    break;
                                }

                                console.error(
                                    "MH Movies: batch download failed:",
                                    error
                                );
                            }
                        }

                        downloadSelectedBtn.disabled = false;
                        downloadSelectedBtn.textContent =
                            originalLabel;
                    }
                );
            }

            loaded = true;
        } catch (error) {
            console.error(
                "MH Movies: season load failed:",
                error
            );
            episodeBox.innerHTML =
                "<p>Unable to load episodes.</p>";
        }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(episodeBox);

    return wrapper;
}

async function downloadEpisode(season, episode) {
    const seriesName = currentSeries?.name || "Series";
    const poster = currentSeries?.poster_path
        ? POSTER_BASE + currentSeries.poster_path
        : "";

    const extractor = getMHExtractor();
    const downloader = getMHDownload();

    if (!extractor || typeof extractor.extract !== "function") {
        throw new Error("Video extractor is unavailable.");
    }

    if (!downloader || typeof downloader.enqueue !== "function") {
        throw new Error("Download plugin is unavailable.");
    }

    // Record must exist before enqueue so offline.js can track it.
    const recordId =
        "tv-" +
        tvId +
        "-s" +
        String(season).padStart(2, "0") +
        "e" +
        String(episode).padStart(2, "0");

    const downloads = getDownloads();

    if (
        downloads.some(
            item => String(item.id) === String(recordId)
        )
    ) {
        // Already queued or downloaded.
        return;
    }

    const videoApi = await getVideoApiBase();

    if (!videoApi) {
        throw new Error("Video API is unavailable.");
    }

    const embedUrl =
        videoApi +
        "/tv/" +
        encodeURIComponent(tvId) +
        "/" +
        encodeURIComponent(season) +
        "/" +
        encodeURIComponent(episode);

    let extracted = await extractor.extract({ url: embedUrl });

    if (!extracted || !extracted.url) {
        throw new Error("Could not resolve a downloadable video.");
    }

    // Offer quality choices (with estimated size) for HLS sources.
    let downloadUrl = extracted.url;

    if (downloadUrl.toLowerCase().includes(".m3u8")) {
        const variantPlugin = window.Capacitor?.Plugins?.MHDownload;

        if (
            variantPlugin &&
            typeof variantPlugin.listVariants === "function"
        ) {
            try {
                const variantResult =
                    await variantPlugin.listVariants({
                        url: downloadUrl
                    });

                const variants = Array.isArray(
                    variantResult?.variants
                )
                    ? variantResult.variants
                    : [];

                if (variants.length > 1) {
                    const chosen =
                        await showVariantPicker(variants);

                    if (!chosen || !chosen.url) {
                        // User cancelled — abort this episode.
                        throw new Error("cancelled");
                    }

                    downloadUrl = chosen.url;
                } else if (
                    variants.length === 1 &&
                    variants[0].url
                ) {
                    downloadUrl = variants[0].url;
                }
            } catch (variantError) {
                if (
                    String(variantError?.message) === "cancelled"
                ) {
                    throw variantError;
                }

                console.warn(
                    "MH Movies: variant listing failed:",
                    variantError
                );
            }
        }
    }

    const fileName = episodeFileName(seriesName, season, episode);
    const title = episodeTitle(seriesName, season, episode);

    const record = {
        id: recordId,
        title,
        seriesName,
        year: (currentSeries?.first_air_date || "").slice(0, 4),
        poster,
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
        isTv: true,
        season,
        episode,
        parts: makeParts(8)
    };

    const updated = getDownloads();
    updated.push(record);
    saveDownloads(updated);

    const result = await downloader.enqueue({
        url: downloadUrl,
        title,
        fileName
    });

    if (
        !result ||
        result.downloadId === undefined ||
        result.downloadId === null
    ) {
        throw new Error("Android download could not be started.");
    }

    // Link the native job to our record and mark it as running so
    // offline.js's queue does NOT enqueue it a second time.
    const latest = getDownloads();
    const stored = latest.find(
        item => String(item.id) === String(recordId)
    );

    if (stored) {
        stored.nativeDownloadId = Number(result.downloadId);
        stored.status = "downloading";
        saveDownloads(latest);
    }
}

function playEpisode(season, episode) {
    const title = currentSeries?.name || "Series";
    const poster = currentSeries?.poster_path
        ? POSTER_BASE + currentSeries.poster_path
        : "";

    const url =
        "play.html?id=" +
        encodeURIComponent(tvId) +
        "&type=tv" +
        "&season=" +
        encodeURIComponent(season) +
        "&episode=" +
        encodeURIComponent(episode) +
        "&title=" +
        encodeURIComponent(title) +
        "&poster=" +
        encodeURIComponent(poster);

    window.location.href = url;
}

loadSeries();
