// ========================================
// MH MOVIES — DOWNLOADED EPISODES
// ========================================

const params = new URLSearchParams(window.location.search);
const seriesName = params.get("series") || "";

const Filesystem = window.Capacitor?.Plugins?.Filesystem;

const themeButton = document.getElementById("themeButton");
const backButton = document.getElementById("downloadedBackButton");
const posterEl = document.getElementById("downloadedPoster");
const nameEl = document.getElementById("downloadedSeriesName");
const metaEl = document.getElementById("downloadedSeriesMeta");
const seasonSelect = document.getElementById("downloadedSeasonSelect");
const episodeList = document.getElementById("downloadedEpisodeList");

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

if (backButton) {
    backButton.addEventListener("click", () => {
        window.location.href = "offline.html";
    });
}

// ---------- storage ----------
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

function createMovieFileName(title) {
    let safeTitle = String(title || "movie")
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (!safeTitle) {
        safeTitle = "movie";
    }

    return safeTitle + ".mp4";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function formatEpisodeTag(download) {
    if (download.season == null || download.episode == null) {
        return "";
    }

    return (
        "S" +
        String(download.season).padStart(2, "0") +
        "E" +
        String(download.episode).padStart(2, "0")
    );
}

// ---------- play ----------
async function playEpisode(download) {
    const fileName = createMovieFileName(download.title);
    const filePath = "movies/" + fileName;

    let localVideoUrl = null;

    if (download.file) {
        localVideoUrl = window.Capacitor.convertFileSrc(
            download.file
        );
    } else {
        const fileInfo = await Filesystem.getUri({
            directory: "DATA",
            path: filePath
        });

        if (!fileInfo || !fileInfo.uri) {
            throw new Error("Unable to locate the episode.");
        }

        await Filesystem.stat({
            directory: "DATA",
            path: filePath
        });

        localVideoUrl = window.Capacitor.convertFileSrc(
            fileInfo.uri
        );
    }

    let offlinePlayerUrl =
        "play.html?offline=" +
        encodeURIComponent(localVideoUrl) +
        "&title=" +
        encodeURIComponent(download.title);

    try {
        let subtitlePath = download.subtitleFilePath;

        if (!subtitlePath) {
            subtitlePath =
                "movies/" +
                fileName.replace(/\.mp4$/i, ".vtt");
        }

        const subtitleInfo = await Filesystem.getUri({
            directory: "DATA",
            path: subtitlePath
        });

        if (subtitleInfo && subtitleInfo.uri) {
            await Filesystem.stat({
                directory: "DATA",
                path: subtitlePath
            });

            offlinePlayerUrl +=
                "&subtitle=" +
                encodeURIComponent(
                    window.Capacitor.convertFileSrc(
                        subtitleInfo.uri
                    )
                );
        }
    } catch (subtitleError) {
        console.warn(
            "MH Movies: offline subtitle unavailable:",
            subtitleError
        );
    }

    window.location.href = offlinePlayerUrl;
}

// ---------- delete ----------
async function deleteMovieFile(download) {
    if (!Filesystem) return;

    const fileName = createMovieFileName(download.title);
    const baseName = fileName.replace(/\.mp4$/i, "");

    try {
        await Filesystem.deleteFile({
            directory: "DATA",
            path: "movies/" + fileName
        });
    } catch (error) {
        // ignore missing file
    }

    try {
        const listing = await Filesystem.readdir({
            directory: "DATA",
            path: "movies"
        });

        const files = Array.isArray(listing)
            ? listing
            : Array.isArray(listing?.files)
                ? listing.files
                : [];

        for (const entry of files) {
            const name =
                typeof entry === "string" ? entry : entry?.name;

            if (!name || name === fileName) continue;

            const matchesFamily =
                name === baseName ||
                name.startsWith(baseName + ".") ||
                name.startsWith(baseName + "_");

            if (!matchesFamily) continue;

            const isDir =
                typeof entry === "object" &&
                entry?.type === "directory";

            const path = "movies/" + name;

            try {
                if (isDir) {
                    await Filesystem.rmdir({
                        directory: "DATA",
                        path,
                        recursive: true
                    });
                } else {
                    await Filesystem.deleteFile({
                        directory: "DATA",
                        path
                    });
                }
            } catch (leftoverError) {
                console.warn(
                    "MH Movies: failed to remove leftover:",
                    name,
                    leftoverError
                );
            }
        }
    } catch (listError) {
        console.warn(
            "MH Movies: could not scan movies dir:",
            listError
        );
    }
}

// ---------- alert ----------
function showAlert(message, confirmMode = false) {
    return new Promise(resolve => {
        const existing = document.querySelector(".alerts");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "alerts";

        overlay.innerHTML = `
            <div class="alert-box">
                <div class="alert-message">
                    ${escapeHtml(message).replace(/\n/g, "<br>")}
                </div>
                <div class="alert-actions">
                    ${
                        confirmMode
                            ? `<button type="button" class="alert-cancel">Cancel</button>
                               <button type="button" class="alert-confirm">OK</button>`
                            : `<button type="button" class="alert-confirm">OK</button>`
                    }
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = result => {
            if (overlay.parentNode) overlay.remove();
            resolve(result);
        };

        overlay
            .querySelector(".alert-confirm")
            ?.addEventListener("click", () => close(true));

        overlay
            .querySelector(".alert-cancel")
            ?.addEventListener("click", () => close(false));
    });
}

async function deleteEpisode(download) {
    const confirmed = await showAlert(
        "Delete this episode? This removes the file too.",
        true
    );

    if (!confirmed) return;

    await deleteMovieFile(download);

    const downloads = getDownloads();
    const updated = downloads.filter(
        item => item.id !== download.id
    );

    saveDownloads(updated);
    render();
}

// ---------- render ----------
let episodes = [];
let currentSeason = null;

function render() {
    const downloads = getDownloads();

    episodes = downloads.filter(
        item =>
            item.isTv &&
            item.seriesName === seriesName &&
            item.status === "completed"
    );

    if (!episodes.length) {
        nameEl.textContent = seriesName || "Series";
        if (metaEl) {
            metaEl.textContent = "No downloaded episodes.";
        }
        if (seasonSelect) {
            seasonSelect.innerHTML = "";
        }
        if (episodeList) {
            episodeList.innerHTML =
                "<p>No downloaded episodes for this series.</p>";
        }
        return;
    }

    const first = episodes[0];

    nameEl.textContent = seriesName;
    if (posterEl && first.poster) {
        posterEl.src = first.poster;
    }

    const seasons = [
        ...new Set(
            episodes
                .map(ep => ep.season)
                .filter(s => s != null)
        )
    ].sort((a, b) => a - b);

    if (metaEl) {
        metaEl.textContent =
            episodes.length +
            " episode" +
            (episodes.length === 1 ? "" : "s");
    }

    if (seasonSelect) {
        seasonSelect.innerHTML = seasons
            .map(
                s =>
                    `<option value="${s}">Season ${s}</option>`
            )
            .join("");

        if (currentSeason == null) {
            currentSeason = seasons[0];
        }

        seasonSelect.value = String(currentSeason);
        seasonSelect.onchange = () => {
            currentSeason = Number(seasonSelect.value);
            renderEpisodeList();
        };
    }

    renderEpisodeList();
}

function renderEpisodeList() {
    if (!episodeList) return;

    const list = episodes
        .filter(ep => Number(ep.season) === Number(currentSeason))
        .sort((a, b) => Number(a.episode) - Number(b.episode));

    if (!list.length) {
        episodeList.innerHTML =
            "<p>No episodes in this season.</p>";
        return;
    }

    episodeList.innerHTML = list
        .map(
            (ep, index) => `
            <div class="episode-item" data-index="${index}">
                <div class="episode-info">
                    <span class="episode-number">
                        ${formatEpisodeTag(ep)}
                    </span>
                    <span class="episode-name">
                        ${escapeHtml(ep.title || "Episode")}
                    </span>
                </div>
                <div class="episode-actions">
                    <button
                        type="button"
                        class="episode-btn play-btn"
                        data-index="${index}"
                    >▶</button>
                    <button
                        type="button"
                        class="episode-btn delete-btn"
                        data-index="${index}"
                    >🗑</button>
                </div>
            </div>
        `
        )
        .join("");

    episodeList.querySelectorAll(".play-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const ep = list[Number(btn.dataset.index)];
            if (!ep) return;

            try {
                await playEpisode(ep);
            } catch (error) {
                console.error(
                    "MH Movies: episode playback failed:",
                    error
                );
                await showAlert(
                    "Unable to play this episode.\n\n" +
                        String(error?.message || error)
                );
            }
        });
    });

    episodeList
        .querySelectorAll(".delete-btn")
        .forEach(btn => {
            btn.addEventListener("click", async () => {
                const ep = list[Number(btn.dataset.index)];
                if (!ep) return;
                await deleteEpisode(ep);
            });
        });
}

render();
