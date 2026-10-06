/* =========================================================
MH MOVIES
OFFLINE / DOWNLOAD MANAGER
========================================================= */

/* =========================================================
ELEMENTS
========================================================= */

const connectionStatus =
document.getElementById("connectionStatus");

const activeDownloads =
document.getElementById("activeDownloads");

const queuedDownloads =
document.getElementById("queuedDownloads");

const completedDownloads =
document.getElementById("completedDownloads");

const MHDownload =
window.Capacitor?.Plugins?.MHDownload;

console.log(
    "MH Movies: Capacitor plugins:",
    window.Capacitor?.Plugins
);

console.log(
    "MH Movies: MHDownload plugin:",
    MHDownload
);

const Filesystem =
window.Capacitor?.Plugins?.Filesystem;

const SUBTITLE_API_BASE =
    "https://mh-movies-subtitles.cyberharzard.workers.dev";

function showOfflineAlert(message, options = {}) {
    return new Promise(resolve => {
        const existing = document.querySelector(".alerts");

        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement("div");
        overlay.className = "alerts";

        const escapeHtml = value =>
            String(value)
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");

        overlay.innerHTML = `
            <div class="alert-box">
                <div class="alert-message">
                    ${escapeHtml(message)}
                </div>
                <div class="alert-actions">
                    ${options.confirm
                        ? `<button type="button" class="alert-cancel">Cancel</button>
                           <button type="button" class="alert-confirm">${escapeHtml(options.confirmText || "OK")}</button>`
                        : `<button type="button" class="alert-confirm">OK</button>`}
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
            .querySelector(".alert-confirm")
            ?.addEventListener("click", () => close(true));

        overlay
            .querySelector(".alert-cancel")
            ?.addEventListener("click", () => close(false));
    });
}

function showOfflineConfirm(message) {
    return showOfflineAlert(message, { confirm: true });
}

async function prepareMovieSubtitle(downloadId) {

    const downloads = getDownloads();

    const download = downloads.find(
        item => String(item.id) === String(downloadId)
    );

    if (!download) {
        return;
    }

    if (
        download.subtitleStatus === "completed" &&
        download.subtitleFilePath
    ) {
        return;
    }

    try {

        download.subtitleStatus = "searching";
        saveDownloads(downloads);
        displayDownloads();

        const title = String(download.title || "").trim();
        const year = String(download.year || "").trim();

        if (!title) {
            throw new Error("Movie title is missing.");
        }

        const movieResponse = await fetch(
            SUBTITLE_API_BASE +
            "/movies/search?searchType=text&q=" +
            encodeURIComponent(title),
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!movieResponse.ok) {
            throw new Error(
                "Subtitle movie search failed: HTTP " +
                movieResponse.status
            );
        }

        const movieData = await movieResponse.json();

        const movies =
            Array.isArray(movieData?.data)
                ? movieData.data
                : Array.isArray(movieData?.movies)
                    ? movieData.movies
                    : [];

        if (!movies.length) {
            throw new Error("No matching SubSource movie found.");
        }

        const normalize = value =>
            String(value || "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim();

        const normalizedTitle = normalize(title);

        let subsourceMovie = movies.find(movie =>
            normalize(movie.title) === normalizedTitle &&
            year &&
            String(movie.releaseYear || "") === year
        );

        if (!subsourceMovie) {
            subsourceMovie = movies.find(movie =>
                normalize(movie.title) === normalizedTitle
            );
        }

        if (!subsourceMovie && year) {
            subsourceMovie = movies.find(movie =>
                String(movie.releaseYear || "") === year
            );
        }

        if (!subsourceMovie) {
            subsourceMovie = movies[0];
        }

        const subsourceMovieId =
            subsourceMovie.movieId ||
            subsourceMovie.id;

        if (!subsourceMovieId) {
            throw new Error("SubSource movie ID was not found.");
        }

        const subtitleResponse = await fetch(
            SUBTITLE_API_BASE +
            "/subtitles?movieId=" +
            encodeURIComponent(subsourceMovieId) +
            "&language=english",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!subtitleResponse.ok) {
            throw new Error(
                "Subtitle search failed: HTTP " +
                subtitleResponse.status
            );
        }

        const subtitleData = await subtitleResponse.json();

        const subtitles =
            Array.isArray(subtitleData?.data)
                ? subtitleData.data
                : Array.isArray(subtitleData?.subtitles)
                    ? subtitleData.subtitles
                    : [];

        if (!subtitles.length) {
            throw new Error("No English subtitles found.");
        }

        const englishSubtitles =
            subtitles.filter(item =>
                String(item.language || "").toLowerCase() === "english"
            );

        const selectedSubtitle =
            (englishSubtitles.length
                ? englishSubtitles
                : subtitles
            ).sort((a, b) => {

                const score = item => {

                    let value = 0;

                    if (!item.hearingImpaired) {
                        value += 100;
                    }

                    if (
                        year &&
                        String(item.releaseInfo || "")
                            .includes(year)
                    ) {
                        value += 50;
                    }

                    if (
                        normalize(item.releaseInfo)
                            .includes(normalizedTitle)
                    ) {
                        value += 30;
                    }

                    value += Math.min(
                        20,
                        Math.log10(
                            Math.max(
                                1,
                                Number(item.downloads || 0)
                            )
                        ) * 5
                    );

                    return value;
                };

                return score(b) - score(a);
            })[0];

        if (!selectedSubtitle) {
            throw new Error("No usable English subtitle found.");
        }

        const subtitleId =
            selectedSubtitle.subtitleId ||
            selectedSubtitle.id;

        if (!subtitleId) {
            throw new Error("Subtitle ID was not found.");
        }

        download.subtitleStatus = "downloading";
        download.subtitleId = String(subtitleId);
        download.subtitleRelease =
            selectedSubtitle.releaseInfo || "";

        saveDownloads(downloads);
        displayDownloads();

        const zipResponse = await fetch(
            SUBTITLE_API_BASE +
            "/subtitles/" +
            encodeURIComponent(subtitleId) +
            "/download",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!zipResponse.ok) {
            throw new Error(
                "Subtitle download failed: HTTP " +
                zipResponse.status
            );
        }

        const zipBuffer =
            await zipResponse.arrayBuffer();

        if (typeof JSZip === "undefined") {
            throw new Error("JSZip is not available.");
        }

        const zip =
            await JSZip.loadAsync(zipBuffer);

        const names = Object.keys(zip.files);

        const subtitleEntry =
            names.find(name =>
                /\.srt$/i.test(name) &&
                !zip.files[name].dir
            ) ||
            names.find(name =>
                /\.vtt$/i.test(name) &&
                !zip.files[name].dir
            );

        if (!subtitleEntry) {
            throw new Error(
                "No SRT or VTT subtitle file was found."
            );
        }

        const subtitleText =
            await zip.files[subtitleEntry].async("text");

        const vttText =
            /\.vtt$/i.test(subtitleEntry)
                ? subtitleText.replace(/^\uFEFF/, "")
                : convertSrtToVtt(subtitleText);

        const subtitleFilePath =
            "movies/" +
            createMovieFileName(download.title)
                .replace(/\.mp4$/i, ".vtt");

        await Filesystem.writeFile({
            path: subtitleFilePath,
            data: vttText,
            directory: "DATA",
            encoding: "utf8"
        });

        download.subtitleStatus = "completed";
        download.subtitleFilePath = subtitleFilePath;

        saveDownloads(downloads);
        displayDownloads();

        console.log(
            "MH Movies: subtitle saved:",
            subtitleFilePath
        );

    } catch (error) {

        console.warn(
            "MH Movies: subtitle preparation failed:",
            error
        );

        const latestDownloads = getDownloads();

        const latestDownload =
            latestDownloads.find(
                item =>
                    String(item.id) === String(downloadId)
            );

        if (latestDownload) {

            latestDownload.subtitleStatus = "unavailable";
            latestDownload.subtitleError =
                String(error?.message || error);

            saveDownloads(latestDownloads);
            displayDownloads();
        }
    }
}

function convertSrtToVtt(srtText) {

    const text =
        String(srtText || "")
            .replace(/^\uFEFF/, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    const lines = text.split("\n");
    const output = ["WEBVTT", ""];

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i].trim();

        if (/^\d+$/.test(line)) {
            continue;
        }

        if (
            /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/
                .test(line)
        ) {
            output.push(line.replace(/,/g, "."));
            continue;
        }

        output.push(lines[i]);
    }

    return output.join("\n");
}


if (!MHDownload) {
console.error(
"MH Movies: native download plugin not available."
);
}

if (!Filesystem) {
console.error(
"MH Movies: Filesystem plugin not available."
);
}

/* =========================================================
DOWNLOAD STORAGE
========================================================= */

const DOWNLOAD_STORAGE_KEY =
"mhMoviesDownloads";

/* =========================================================
ACTIVE DOWNLOAD LOCK
========================================================= */

let activeDownloadId = null;

/* =========================================================
GET DOWNLOADS
========================================================= */

function getDownloads() {

try {

    const saved =
        localStorage.getItem(
            DOWNLOAD_STORAGE_KEY
        );

    if (!saved) {
        return [];
    }


    const downloads =
        JSON.parse(saved);


    return Array.isArray(downloads)
        ? downloads
        : [];

} catch (error) {

    console.error(
        "Unable to read downloads:",
        error
    );

    return [];

}

}

/* =========================================================
SAVE DOWNLOADS
========================================================= */

function saveDownloads(downloads) {

try {

    localStorage.setItem(
        DOWNLOAD_STORAGE_KEY,
        JSON.stringify(downloads)
    );

} catch (error) {

    console.error(
        "Unable to save downloads:",
        error
    );

}

}

/* =========================================================
GO HOME
========================================================= */

function goHome() {

window.location.href =
    "index.html";

}

/* =========================================================
FORMAT FILE SIZE
========================================================= */

function formatSize(bytes) {

if (
    !bytes ||
    bytes <= 0 ||
    !Number.isFinite(Number(bytes))
) {

    return "0 MB";

}


const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB"
];


let size =
    Number(bytes);

let index = 0;


while (
    size >= 1024 &&
    index < units.length - 1
) {

    size /= 1024;
    index++;

}


return (
    size.toFixed(
        size >= 10 ? 0 : 1
    ) +
    " " +
    units[index]
);

}

/* =========================================================
FORMAT SPEED
========================================================= */

function formatSpeed(bytesPerSecond) {

if (
    !bytesPerSecond ||
    bytesPerSecond <= 0
) {

    return "0 MB/s";

}


return (
    formatSize(bytesPerSecond) +
    "/s"
);

}

/* =========================================================
FORMAT TIME
========================================================= */

function formatTime(seconds) {

if (
    !seconds ||
    seconds <= 0 ||
    !Number.isFinite(Number(seconds))
) {

    return "--";

}


const hours =
    Math.floor(
        seconds / 3600
    );


const minutes =
    Math.floor(
        (seconds % 3600) / 60
    );


const secs =
    Math.floor(
        seconds % 60
    );


if (hours > 0) {

    return (
        hours +
        "h " +
        minutes +
        "m"
    );

}


if (minutes > 0) {

    return (
        minutes +
        "m " +
        secs +
        "s"
    );

}


return secs + "s";

}

/* =========================================================
ESCAPE HTML
========================================================= */

function escapeHTML(value) {

return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

/* =========================================================
CREATE SAFE FILE NAME
========================================================= */

function createMovieFileName(title) {

let safeTitle =
    String(title || "movie")
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");


if (!safeTitle) {
    safeTitle = "movie";
}


return safeTitle + ".mp4";

}

/* =========================================================
DELETE PHYSICAL MOVIE FILE
========================================================= */

async function deleteMovieFile(download) {
    if (!Filesystem) {
        return;
    }

    const fileName =
        createMovieFileName(
            download.title
        );

    const baseName =
        fileName.replace(/\.mp4$/i, "");

    // Delete the main movie file.
    try {
        await Filesystem.deleteFile({
            directory: "DATA",
            path: "movies/" + fileName
        });

        console.log(
            "MH Movies: deleted file:",
            fileName
        );
    } catch (error) {
        console.log(
            "MH Movies: no physical file to delete:",
            fileName
        );
    }

    // Delete leftovers: .hls.ts, .hls.mp4, .hls_segments/, .vtt, etc.
    try {
        const listing = await Filesystem.readdir({
            directory: "DATA",
            path: "movies"
        });

        const files =
            Array.isArray(listing)
                ? listing
                : Array.isArray(listing?.files)
                    ? listing.files
                    : [];

        for (const entry of files) {
            const name =
                typeof entry === "string"
                    ? entry
                    : entry?.name;

            if (!name || name === fileName) {
                continue;
            }

            const matchesFamily =
                name === baseName ||
                name.startsWith(baseName + ".") ||
                name.startsWith(baseName + "_");

            if (!matchesFamily) {
                continue;
            }

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

                console.log(
                    "MH Movies: deleted leftover:",
                    name
                );
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

/* =========================================================
CREATE DOWNLOAD CARD
========================================================= */

function createDownloadCard(download) {

const card =
    document.createElement("div");


card.className =
    "download-card";


const progress =
    Math.min(
        100,
        Math.max(
            0,
            Number(download.progress || 0)
        )
    );


const downloaded =
    Number(
        download.downloaded || 0
    );


const total =
    Number(
        download.totalSize || 0
    );


const speed =
    Number(
        download.speed || 0
    );


const remaining =
    Number(
        download.remaining || 0
    );


const poster =
    escapeHTML(
        download.poster || ""
    );


const title =
    escapeHTML(
        download.title ||
        "Unknown Movie"
    );


let actions = "";


/* =====================================================
   ACTIVE DOWNLOAD
===================================================== */

if (
    download.status === "downloading"
) {
    actions = `
        <span class="download-action">
            ⬇ Downloading
        </span>
        <button
            class="download-action pause-download"
            type="button"
        >⏸ Pause</button>
                <button
                    class="download-action delete delete-download"
                    type="button"
                >🗑 Delete</button>
    `;
}

else if (
    download.status === "paused"
) {
    actions = `
        <span class="download-action">
            ⏸ Paused
        </span>
        <button
            class="download-action resume-download"
            type="button"
        >▶ Resume</button>
                <button
                    class="download-action delete delete-download"
                    type="button"
                >🗑 Delete</button>
    `;
}

/* =====================================================
   QUEUED
===================================================== */

else if (
    download.status ===
    "queued"
) {

    actions = `
        <span class="download-action">
            ⏳ Queued
        </span>

        <button
            class="download-action cancel-download"
            type="button"
        >
            ✕ Remove
        </button>
    `;

}


/* =====================================================
   CONVERTING TO MP4
===================================================== */

else if (
    download.status ===
    "processing"
) {

    actions = `
        <span class="download-action">
            📦 Finalizing download
        </span>
        <button
            class="download-action delete delete-download"
            type="button"
        >🗑 Delete</button>
    `;

}


/* =====================================================
   FAILED
===================================================== */

else if (
    download.status ===
    "failed"
) {

    actions = `
        <button
            class="download-action retry-download"
            type="button"
        >
            🔄 Retry
        </button>

        <button
            class="download-action delete delete-download"
            type="button"
        >
            🗑 Delete
        </button>
    `;

}


/* =====================================================
   COMPLETED
===================================================== */

else if (
    download.status ===
    "completed"
) {

    actions = `
        <button
            class="download-action play-download"
            type="button"
        >
            ▶ Play Offline
        </button>

        <button
            class="download-action delete delete-download"
            type="button"
        >
            🗑 Delete
        </button>
    `;

}


/* =====================================================
   UNKNOWN STATUS
===================================================== */

else {

    actions = `
        <button
            class="download-action delete delete-download"
            type="button"
        >
            🗑 Delete
        </button>
    `;

}


const processingLabel =
    download.status === "processing"
        ? "📦 Finalizing download"
        : null;


card.innerHTML = `

    <img
        class="download-poster"
        src="${poster}"
        alt=""
    >


    <div class="download-info">

        <h3 class="download-title">
            ${title}
        </h3>


        <div class="download-meta">

            ${
                processingLabel ||
                `${formatSize(downloaded)} / ${formatSize(total)}`
            }

        </div>

        ${
            download.status === "processing"
                ? `
        <div class="download-meta">
            ✅ Download complete — Finalizing (no internet needed)
        </div>
        `
                : ""
        }


        ${
            download.status === "processing"
                ? ""
                : `
        <div class="download-progress">

            <div
                class="download-progress-bar"
                style="width: ${progress}%"
            ></div>

        </div>


        <div class="download-progress-text">

            <span>
                ${progress.toFixed(1)}%
            </span>

            <span>
                ${formatSpeed(speed)}
            </span>

        </div>
        `
        }


        ${
            download.status === "processing"
                ? ""
                : `
        <div class="download-meta">

            ⏱
            ${formatTime(remaining)}
            remaining

        </div>
        `
        }


        <div class="download-actions">

            ${actions}

        </div>


        ${
            download.parts &&
            Array.isArray(download.parts) &&
            download.parts.length
            ? createPartsHTML(
                download.parts
            )
            : ""
        }

    </div>

`;


/* =====================================================
   RETRY
===================================================== */

const retryButton =
    card.querySelector(
        ".retry-download"
    );


if (retryButton) {

    retryButton.addEventListener(
        "click",
        () => {

            startMovieDownload(
                download.id
            );

        }
    );

}


/* =====================================================
   PAUSE DOWNLOAD
===================================================== */
const pauseButton =
    card.querySelector(".pause-download");

if (pauseButton) {
    pauseButton.addEventListener(
        "click",
        async () => {
            try {
                await MHDownload.pause({
                    downloadId: String(
                        download.nativeDownloadId
                    )
                });

                download.status = "paused";
                saveDownloads(getDownloads());
                displayDownloads();
            } catch (error) {
                console.error(
                    "MH Movies: pause failed:",
                    error
                );
            }
        }
    );
}

/* =====================================================
   RESUME DOWNLOAD
===================================================== */
const resumeButton =
    card.querySelector(".resume-download");

if (resumeButton) {
    resumeButton.addEventListener(
        "click",
        async () => {
            try {
                await MHDownload.resume({
                    downloadId: String(
                        download.nativeDownloadId
                    )
                });

                download.status = "queued";
                saveDownloads(getDownloads());
                displayDownloads();
            } catch (error) {
                console.error(
                    "MH Movies: resume failed:",
                    error
                );
            }
        }
    );
}

/* =====================================================
   REMOVE QUEUED DOWNLOAD
===================================================== */

const cancelButton =
    card.querySelector(
        ".cancel-download"
    );


if (cancelButton) {

    cancelButton.addEventListener(
        "click",
        async () => {

            const confirmed =
                await showOfflineConfirm(
                    "Remove this movie from the download queue?"
                );


            if (!confirmed) {
                return;
            }


            const downloads =
                getDownloads();


            const updated =
                downloads.filter(
                    item =>
                        item.id !==
                        download.id
                );


            saveDownloads(
                updated
            );


            displayDownloads();

            processDownloadQueue();

        }
    );

}


/* =====================================================
   PLAY OFFLINE
===================================================== */

const playButton =
    card.querySelector(
        ".play-download"
    );

if (playButton) {

    playButton.addEventListener(
        "click",
        async () => {

            try {

                /*
                   Build the exact filename used
                   when the movie was downloaded.
                */

                const fileName =
                    createMovieFileName(
                        download.title
                    );

                const filePath =
                    "movies/" +
                    fileName;


                /*
                   Get the current native URI
                   directly from Capacitor.
                */

                let localVideoUrl = null;

                /*
                   Prefer the exact native URI saved when
                   the download completed.
                */

                if (download.file) {

                    localVideoUrl =
                        window.Capacitor.convertFileSrc(
                            download.file
                        );

                } else {

                    /*
                       Fallback: reconstruct the expected
                       Capacitor DATA path.
                    */

                    const fileInfo =
                        await Filesystem.getUri({
                            directory: "DATA",
                            path: filePath
                        });

                    if (
                        !fileInfo ||
                        !fileInfo.uri
                    ) {
                        throw new Error(
                            "Unable to locate the downloaded movie."
                        );
                    }

                    await Filesystem.stat({
                        directory: "DATA",
                        path: filePath
                    });

                    localVideoUrl =
                        window.Capacitor.convertFileSrc(
                            fileInfo.uri
                        );
                }



                console.log(
                    "MH Movies: offline WebView URI:",
                    localVideoUrl
                );


                /*
                   Open the existing MH Movies player.
                */

                let offlinePlayerUrl =
                    "play.html?offline=" +
                    encodeURIComponent(
                        localVideoUrl
                    ) +
                    "&title=" +
                    encodeURIComponent(
                        download.title
                    );

                /*
                   Resolve the saved English subtitle if available.
                   Subtitle failure must never prevent movie playback.
                */
                let localSubtitleUrl = null;

                try {

                    let subtitlePath =
                        download.subtitleFilePath;

                    if (!subtitlePath) {
                        subtitlePath =
                            "movies/" +
                            fileName.replace(
                                /\.mp4$/i,
                                ".vtt"
                            );
                    }

                    const subtitleInfo =
                        await Filesystem.getUri({
                            directory: "DATA",
                            path: subtitlePath
                        });

                    if (
                        subtitleInfo &&
                        subtitleInfo.uri
                    ) {

                        await Filesystem.stat({
                            directory: "DATA",
                            path: subtitlePath
                        });

                        localSubtitleUrl =
                            window.Capacitor.convertFileSrc(
                                subtitleInfo.uri
                            );

                        console.log(
                            "MH Movies: offline subtitle URI:",
                            localSubtitleUrl
                        );
                    }

                } catch (subtitleError) {

                    console.warn(
                        "MH Movies: offline subtitle unavailable:",
                        subtitleError
                    );

                    localSubtitleUrl = null;
                }

                if (localSubtitleUrl) {

                    offlinePlayerUrl +=
                        "&subtitle=" +
                        encodeURIComponent(
                            localSubtitleUrl
                        );
                }

                window.location.href =
                    offlinePlayerUrl;

            } catch (error) {

                console.error(
                    "MH Movies: offline playback failed:",
                    error
                );


                await showOfflineAlert(
                    "Unable to play this downloaded movie.\n\n" +
                    String(
                        error?.message ||
                        error
                    )
                );

            }

        }
    );

}


/* =====================================================
   DELETE DOWNLOAD
===================================================== */

const deleteButton =
    card.querySelector(
        ".delete-download"
    );


if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            async () => {
                const confirmed =
                    await showOfflineConfirm(
                        "Delete this download? This removes the files too."
                    );

                if (!confirmed) {
                    return;
                }

                // If still active, cancel the native job before deleting
                // so it stops writing to a file we're about to remove.
                if (
                    download.nativeDownloadId &&
                    (download.status === "downloading" ||
                        download.status === "paused" ||
                        download.status === "processing" ||
                        download.status === "queued")
                ) {
                    try {
                        if (
                            MHDownload &&
                            typeof MHDownload.cancel === "function"
                        ) {
                            await MHDownload.cancel({
                                downloadId: String(
                                    download.nativeDownloadId
                                )
                            });
                        }
                    } catch (cancelError) {
                        console.warn(
                            "MH Movies: native cancel failed:",
                            cancelError
                        );
                    }
                }

                if (activeDownloadId === download.id) {
                    activeDownloadId = null;
                }

                await deleteMovieFile(download);

                const downloads = getDownloads();

                const updated = downloads.filter(
                    item => item.id !== download.id
                );

                saveDownloads(updated);

                displayDownloads();
            }
        );

}


return card;

}

/* =========================================================
DOWNLOAD PARTS
========================================================= */

function createPartsHTML(parts) {

return `

    <div class="download-parts">

        <button
            class="parts-toggle"
            type="button"
        >

            <span>
                📦 Download Sections
            </span>

            <span class="parts-arrow">
                ▼
            </span>

        </button>


        <div class="parts-content">

            ${
                parts.map(
                    (part, index) => {

                        const progress =
                            Math.min(
                                100,
                                Math.max(
                                    0,
                                    Number(
                                        part.progress ||
                                        0
                                    )
                                )
                            );


                        return `

                            <div
                                class="download-part"
                            >

                                <div
                                    class="part-header"
                                >

                                    <span>
                                        Part ${
                                            index + 1
                                        }
                                    </span>

                                    <span>
                                        ${
                                            escapeHTML(
                                                part.status ||
                                                "Waiting"
                                            )
                                        }
                                    </span>

                                </div>


                                <div
                                    class="download-progress"
                                >

                                    <div
                                        class="download-progress-bar"
                                        style="
                                            width: ${progress}%;
                                        "
                                    ></div>

                                </div>


                                <div
                                    class="download-progress-text"
                                >

                                    <span>
                                        ${progress.toFixed(1)}%
                                    </span>

                                    <span>
                                        ${
                                            escapeHTML(
                                                part.status ||
                                                "Waiting"
                                            )
                                        }
                                    </span>

                                </div>

                            </div>

                        `;

                    }
                ).join("")

            }

        </div>

    </div>

`;

}

/* =========================================================
PARTS DROPDOWN
========================================================= */

document.addEventListener(
"click",
(event) => {

    const toggle =
        event.target.closest(
            ".parts-toggle"
        );


    if (!toggle) {
        return;
    }


    const container =
        toggle.closest(
            ".download-parts"
        );


    if (!container) {
        return;
    }


    container.classList.toggle(
        "parts-open"
    );

}

);

/* =========================================================
UPDATE DOWNLOAD STATUS
========================================================= */

function updateDownloadStatus(
downloadId,
newStatus
) {

const downloads =
    getDownloads();


const download =
    downloads.find(
        item =>
            String(item.id) ===
            String(downloadId)
    );


if (!download) {
    return;
}


/*
   Never manually change an active native
   download to paused because the current
   FileTransfer plugin does not support
   real pause/resume.
*/

if (
    activeDownloadId ===
    downloadId &&
    newStatus !== "completed" &&
    newStatus !== "failed"
) {

    return;

}


download.status =
    newStatus;


saveDownloads(
    downloads
);


displayDownloads();

}

/* =========================================================
START MOVIE DOWNLOAD
NATIVE ANDROID DOWNLOAD MANAGER
========================================================= */

async function startMovieDownload(downloadId) {

    if (activeDownloadId !== null) {
        return;
    }

    const downloads = getDownloads();

    const download = downloads.find(
        item => String(item.id) === String(downloadId)
    );

    if (!download) {
        return;
    }

    /*
       Refresh the movie source before checking for a
       download URL. This also repairs old download
       records that were saved without a videoUrl.
    */
    try {
        const catalogueResponse =
            await fetch(
                "https://freelegalmovies.cyberharzard.workers.dev/",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (catalogueResponse.ok) {
            const catalogue =
                await catalogueResponse.json();

            if (Array.isArray(catalogue)) {
                const freshMovie =
                    catalogue.find(
                        movie =>
                            String(movie.id) ===
                                String(download.id) ||
                            (
                                String(movie.title || "")
                                    .trim()
                                    .toLowerCase() ===
                                String(download.title || "")
                                    .trim()
                                    .toLowerCase()
                            )
                    );

                if (
                    freshMovie &&
                    freshMovie.videoUrl
                ) {
                    download.videoUrl =
                        freshMovie.videoUrl;

                    console.log(
                        "MH Movies: refreshed download source",
                        download.videoUrl
                    );
                }
            }
        }
    } catch (refreshError) {
        console.warn(
            "MH Movies: source refresh failed, using existing URL",
            refreshError
        );
    }

    if (!download.videoUrl) {
        await showOfflineAlert(
            "This movie does not have a download source."
        );
        return;
    }

    if (download.status === "downloading") {
        return;
    }

    if (!MHDownload) {
        download.status = "failed";
        saveDownloads(downloads);
        displayDownloads();

        await showOfflineAlert(
            "Download system is unavailable. Please restart MH Movies."
        );

        return;
    }

    const fileName =
        createMovieFileName(download.title);

    activeDownloadId = downloadId;

    try {

        download.status = "downloading";

        /*
           Keep existing progress/file information when
           retrying or resuming a partial download.
        */

        download.progress =
            Number(download.progress || 0);

        download.downloaded =
            Number(download.downloaded || 0);

        download.speed = 0;
        download.remaining = 0;

        saveDownloads(downloads);
        displayDownloads();

        
        console.log("MH Movies: calling MHDownload.enqueue", {
            url: download.videoUrl,
            title: download.title,
            fileName: fileName
        });

        const result =
            await MHDownload.enqueue({
                url: download.videoUrl,
                title: download.title,
                fileName: fileName
            });

        
        if (
            !result ||
            result.downloadId === undefined ||
            result.downloadId === null
        ) {
            throw new Error(
                "Android download could not be started."
            );
        }

        download.nativeDownloadId =
            Number(result.downloadId);

        /* Prepare English subtitle independently.
           Subtitle failure must never fail the movie download. */
        prepareMovieSubtitle(downloadId).catch(
            subtitleError =>
                console.warn(
                    "MH Movies: background subtitle task failed:",
                    subtitleError
                )
        );

        try {
            const immediateStatus =
                await MHDownload.getStatus({
                    downloadId:
                        Number(result.downloadId)
                });

            

            console.log(
                "MH Movies: immediate native status:",
                immediateStatus
            );
        } catch (statusError) {
            await showOfflineAlert(
                "GET STATUS ERROR:\n" +
                String(
                    statusError?.message ||
                    statusError
                )
            );

            console.error(
                "MH Movies: immediate status error:",
                statusError
            );
        }

        saveDownloads(downloads);
        displayDownloads();

        const __pollStart = Date.now();
        const __pollMaxMs = 3 * 60 * 60 * 1000; // 3h ceiling
        let finished = false;
        let lastBytes = 0;
        let lastTime = Date.now();

        while (!finished) {

            await new Promise(
                resolve => setTimeout(resolve, 1000)

            );
            if (Date.now() - __pollStart > __pollMaxMs) {
                console.warn(
                    "MH Movies: download poll timed out."
                );
                download.status = "failed";
                download.speed = 0;
                download.remaining = 0;
                saveDownloads(downloads);
                displayDownloads();
                finished = true;
                break;
            }

            let statusResult;

            try {

                statusResult =
                    await MHDownload.getStatus({
                        downloadId:
                            Number(
                                download.nativeDownloadId
                            )
                    });

            } catch (statusError) {

                console.error(
                    "MH Movies: download status check failed:",
                    statusError
                );

                continue;
            }

            if (!statusResult) {
                console.log("MH Movies DOWNLOAD STATUS:", statusResult);
                continue;
            }

            console.log("MH Movies DOWNLOAD STATUS:", statusResult);
            

            const bytes =
                Number(
                    statusResult.downloaded || 0
                );

            const total =
                Number(
                    statusResult.total || 0
                );

            const now = Date.now();

            const elapsed =
                (now - lastTime) / 1000;

            if (
                elapsed > 0 &&
                bytes >= lastBytes
            ) {

                const currentSpeed =
                    (bytes - lastBytes) /
                    elapsed;

                if (
                    Number.isFinite(
                        currentSpeed
                    )
                ) {

                    download.speed =
                        Math.max(
                            0,
                            currentSpeed
                        );
                }
            }

            lastBytes = bytes;
            lastTime = now;

            download.downloaded = bytes;

            if (total > 0) {

                download.totalSize = total;

                download.progress =
                    Math.min(
                        100,
                        (bytes / total) * 100
                    );

                if (download.speed > 0) {

                    download.remaining =
                        Math.max(
                            0,
                            (total - bytes) /
                            download.speed
                        );
                }
            }

            if (
                statusResult.status ===
                "queued"
            ) {

                download.status =
                    "downloading";

            } else if (
                statusResult.status ===
                "downloading"
            ) {

                download.status =
                    "downloading";

            } else if (
                statusResult.status ===
                "paused"
            ) {

                download.status =
                    "paused";
                

            } else if (
                statusResult.status ===
                "processing"
            ) {

                download.status =
                    "processing";

                download.speed = 0;
                download.remaining = 0;

            } else if (
                statusResult.status ===
                "completed"
            ) {

                download.status =
                    "completed";

                download.progress = 100;
                download.remaining = 0;
                download.speed = 0;

                if (
                    statusResult.downloaded >
                    0
                ) {

                    download.downloaded =
                        Number(
                            statusResult.downloaded
                        );
                }

                if (
                    statusResult.total >
                    0
                ) {

                    download.totalSize =
                        Number(
                            statusResult.total
                        );
                }

                if (statusResult.localUri) {

                    download.file =
                        statusResult.localUri;
                }

                finished = true;

                await showOfflineAlert(
                    download.title +
                    " downloaded successfully."
                );

            } else if (
                statusResult.status ===
                "failed"
            ) {

                download.status =
                    "failed";

                download.speed = 0;
                download.remaining = 0;
                download.file = null;

                finished = true;

                await showOfflineAlert(
                    "Movie download failed." +
                    "\n\n" +
                    (statusResult.error || "No native error reported.")
                );

            } else if (
                statusResult.status ===
                "not_found"
            ) {

                download.status =
                    "failed";

                download.speed = 0;
                download.remaining = 0;
                /* Keep existing download.file for recovery. */

                finished = true;

                await showOfflineAlert(
                    "Movie download could not be found."
                );
            }

            saveDownloads(downloads);
            displayDownloads();
        }

    } catch (error) {

        console.error(
            "MH Movies: native movie download failed:",
            error
        );

        download.status = "failed";
        download.speed = 0;
        download.remaining = 0;

        saveDownloads(downloads);
        displayDownloads();

        await showOfflineAlert(
            "Movie download failed:\n\n" +
            String(
                error?.message ||
                error
            )
        );

    } finally {

        activeDownloadId = null;

        setTimeout(
            () => {
                processDownloadQueue();
            },
            300
        );
    }
}

/* =========================================================
DISPLAY DOWNLOADS
========================================================= */

function formatEpisodeTag(download) {
    if (
        download.season == null ||
        download.episode == null
    ) {
        return "";
    }

    return (
        "S" +
        String(download.season).padStart(2, "0") +
        "E" +
        String(download.episode).padStart(2, "0")
    );
}

async function playOfflineRecord(download) {
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
            throw new Error(
                "Unable to locate the downloaded video."
            );
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

async function deleteOfflineRecord(download) {
    if (activeDownloadId === download.id) {
        await showOfflineAlert(
            "This download is still running. Please wait for it to finish."
        );
        return;
    }

    const confirmed = await showOfflineConfirm(
        "Delete this download?"
    );

    if (!confirmed) {
        return;
    }

    await deleteMovieFile(download);

    const downloads = getDownloads();
    const updated = downloads.filter(
        item => item.id !== download.id
    );

    saveDownloads(updated);
    displayDownloads();
}

function createSeriesGroupCard(seriesName, episodes) {
    const card = document.createElement("div");
    card.className = "download-card series-group-card";

    const poster = escapeHTML(episodes[0]?.poster || "");
    const title = escapeHTML(seriesName);

    const seasons = new Set(
        episodes
            .map(ep => ep.season)
            .filter(s => s != null)
    );

    card.innerHTML = `
        <img class="download-poster" src="${poster}" alt="">
        <div class="download-info">
            <h3 class="download-title">${title}</h3>
            <div class="download-meta">
                ${episodes.length} episode${
                    episodes.length === 1 ? "" : "s"
                }${
                    seasons.size > 1
                        ? " · " + seasons.size + " seasons"
                        : seasons.size === 1
                            ? " · " + seasons.size + " season"
                            : ""
                }
            </div>
            <div class="download-actions">
                <button
                    type="button"
                    class="download-action open-series"
                >
                    ▶ Open episodes
                </button>
            </div>
        </div>
    `;

    card.querySelector(".open-series")?.addEventListener(
        "click",
        () => {
            window.location.href =
                "downloaded-series.html?series=" +
                encodeURIComponent(seriesName);
        }
    );

    return card;
}

function displayDownloads() {

const downloads =
    getDownloads();


const downloading =
    downloads.filter(
        item =>
            item.status ===
            "downloading" || item.status === "paused" || item.status === "processing"
    );


const queued =
    downloads.filter(
        item =>
            item.status ===
            "queued"
    );


const completed =
    downloads.filter(
        item =>
            item.status ===
            "completed"
    );


const failed =
    downloads.filter(
        item =>
            item.status ===
            "failed"
    );


/* =====================================================
   ACTIVE DOWNLOADS
===================================================== */

if (activeDownloads) {

    activeDownloads.innerHTML =
        "";


    if (
        downloading.length ===
        0
    ) {

        activeDownloads.innerHTML = `
            <p class="empty-message">
                No active downloads
            </p>
        `;

    } else {

        downloading.forEach(
            download => {

                activeDownloads.appendChild(
                    createDownloadCard(
                        download
                    )
                );

            }
        );

    }

}


/* =====================================================
   QUEUED DOWNLOADS
===================================================== */

if (queuedDownloads) {

    queuedDownloads.innerHTML =
        "";


    if (
        queued.length ===
        0
    ) {

        queuedDownloads.innerHTML = `
            <p class="empty-message">
                Download queue is empty
            </p>
        `;

    } else {

        queued.forEach(
            download => {

                queuedDownloads.appendChild(
                    createDownloadCard(
                        download
                    )
                );

            }
        );

    }

}


/* =====================================================
   COMPLETED DOWNLOADS
===================================================== */

    if (completedDownloads) {
        completedDownloads.innerHTML = "";

        // Group completed TV episodes by series.
        const groups = {};
        const standalone = [];

        completed.forEach(download => {
            if (download.isTv && download.seriesName) {
                if (!groups[download.seriesName]) {
                    groups[download.seriesName] = [];
                }
                groups[download.seriesName].push(download);
            } else {
                standalone.push(download);
            }
        });

        const hasAny =
            Object.keys(groups).length > 0 ||
            standalone.length > 0 ||
            failed.length > 0;

        if (!hasAny) {
            completedDownloads.innerHTML = `
                <p class="empty-message">
                    No downloaded movies
                </p>
            `;
        } else {
            // Series groups first.
            Object.keys(groups).forEach(seriesName => {
                completedDownloads.appendChild(
                    createSeriesGroupCard(
                        seriesName,
                        groups[seriesName]
                    )
                );
            });

            // Then standalone completed movies.
            standalone.forEach(download => {
                completedDownloads.appendChild(
                    createDownloadCard(download)
                );
            });

            // Failed downloads keep their own card (retry/delete).
            failed.forEach(download => {
                completedDownloads.appendChild(
                    createDownloadCard(download)
                );
            });
        }
    }

}

/* =========================================================
PROCESS DOWNLOAD QUEUE
========================================================= */

async function processDownloadQueue() {

/*
   Another download is already running.
*/

if (
    activeDownloadId !== null
) {

    return;

}


const downloads =
    getDownloads();


const nextDownload =
    downloads.find(
        download =>
            download.status ===
            "queued"
    );


if (!nextDownload) {
    return;
}


await startMovieDownload(
    nextDownload.id
);

}

/* =========================================================
RECOVER STALE DOWNLOADS
========================================================= */

async function recoverStaleDownloads() {

    const downloads =
        getDownloads();

    if (!MHDownload) {
        displayDownloads();
        return;
    }

    let changed = false;

    for (const download of downloads) {

        if (!download.nativeDownloadId) {
            continue;
        }

        try {

            const result =
                await MHDownload.getStatus({
                    downloadId:
                        Number(
                            download.nativeDownloadId
                        )
                });

            if (!result) {
                continue;
            }

            const downloaded =
                Number(
                    result.downloaded || 0
                );

            const total =
                Number(
                    result.total || 0
                );

            download.downloaded =
                downloaded;

            if (total > 0) {

                download.totalSize =
                    total;

                download.progress =
                    Math.min(
                        100,
                        (
                            downloaded /
                            total
                        ) * 100
                    );
            }

            if (
                result.status ===
                "queued"
            ) {

                download.status =
                    "downloading";

                changed = true;

            } else if (
                result.status ===
                "downloading"
            ) {

                download.status =
                    "downloading";

                changed = true;

            } else if (
                result.status ===
                "paused"
            ) {

                download.status =
                    "paused";

                changed = true;

            } else if (
                result.status ===
                "completed"
            ) {

                download.status =
                    "completed";

                download.progress =
                    100;

                download.remaining =
                    0;

                download.speed =
                    0;

                if (result.localUri) {

                    download.file =
                        result.localUri;
                }

                changed = true;

            } else if (
                result.status ===
                "failed"
            ) {

                download.status =
                    "failed";

                download.speed =
                    0;

                download.remaining =
                    0;

                changed = true;

            } else if (
                result.status ===
                "not_found"
            ) {

                /*
                 * Native download IDs only live in memory.
                 * The movie file can still exist after an app restart.
                 */

                let localFileExists = false;

                try {

                    const fileName =
                        createMovieFileName(
                            download.title
                        );

                    await Filesystem.stat({
                        directory: "DATA",
                        path: "movies/" + fileName
                    });

                    localFileExists = true;

                } catch (fileError) {

                    localFileExists = false;
                }

                if (localFileExists) {

                    download.status =
                        "completed";

                    download.progress =
                        100;

                    download.remaining =
                        0;

                    download.speed =
                        0;

                } else {

                    download.status =
                        "failed";

                    download.speed =
                        0;

                    download.remaining =
                        0;
                }

                changed = true;
            }

        } catch (error) {

            console.error(
                "MH Movies: unable to recover native download:",
                error
            );
        }
    }

    if (changed) {
        saveDownloads(downloads);
    }

    displayDownloads();
}

async function checkRealInternet() {

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

        clearTimeout(timeout);

        console.warn(
            "MH Movies: real internet check failed:",
            error
        );

        return false;
    }
}


async function updateConnectionMessage() {

const message =
    document.getElementById(
        "connectionMessage"
    );


if (!message) {
    return;
}


const isOnline =
    await checkRealInternet();


if (isOnline) {

    message.innerHTML = `

        <div class="offline-icon">
            🟢
        </div>

        <h1>
            You're Online
        </h1>

        <p>
            Internet connection is available.
        </p>

        <p>
            You can manage your downloaded movies below.
        </p>

        <button
            id="backHomeButton"
            class="offline-button"
        >
            🏠 Back to Home
        </button>

    `;


    const newBackHomeButton =
        document.getElementById(
            "backHomeButton"
        );


    if (newBackHomeButton) {

        newBackHomeButton.addEventListener(
            "click",
            goHome
        );

    }

} else {

    message.innerHTML = `

        <div class="offline-icon">
            📴
        </div>

        <h1>
            You're Offline
        </h1>

        <p>
            No internet connection is available.
        </p>

        <p>
            You can still watch your downloaded movies.
        </p>

        <button
            id="retryButton"
            class="offline-button"
        >
            🔄 Try Again
        </button>

    `;


    const newRetryButton =
        document.getElementById(
            "retryButton"
        );


    if (newRetryButton) {

        newRetryButton.addEventListener(
            "click",
            () => {

                updateConnectionMessage();

            }
        );

    }

}

}

/* =========================================================
NETWORK EVENTS
========================================================= */

async function autoRetryFailedDownloads() {
    const online = await checkRealInternet();

    if (!online) {
        return;
    }

    const downloads = getDownloads();
    let changed = false;

    downloads.forEach(download => {
        if (download.status === "failed" && download.videoUrl) {
            download.status = "queued";
            download.error = null;
            download.speed = 0;
            download.remaining = 0;
            changed = true;
        }
    });

    if (changed) {
        saveDownloads(downloads);
        displayDownloads();
        processDownloadQueue();
    }
}

window.addEventListener(
"online",
() => {

    updateConnectionMessage();

        autoRetryFailedDownloads();
    processDownloadQueue();

}

);

window.addEventListener(
"offline",
() => {

    updateConnectionMessage();

}

);

/* =========================================================
START
========================================================= */

recoverStaleDownloads();

updateConnectionMessage();

displayDownloads();

processDownloadQueue();

/* =========================================================
AUTOMATIC REAL INTERNET CHECK
========================================================= */

setInterval(
() => {

    updateConnectionMessage();

},
3000

);

// Periodically revive failed downloads when internet is back.
setInterval(
    () => {
        autoRetryFailedDownloads();
    },
    30000
);
