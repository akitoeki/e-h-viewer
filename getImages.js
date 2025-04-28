var url = document.URL;
var ss = url.split("/");
var images = [];
var thumbs = [];
var started = false;

// View mode settings
var viewMode = localStorage.getItem("ehviewer_view_mode") || "scroll"; // 'scroll' or 'page'
var fitType = localStorage.getItem("ehviewer_fit_type") || "contain"; // 'original', 'contain', 'fill-height', 'fill-width'
var currentPageIndex = 0;
var isFullscreen = false;
var thread = 0;
var maxThread = 3;
var threadLife = [];
var imgLoadTimeout = 20000;
var timeout = 0;
var uiVisible = true; // Track UI visibility for both modes

// Simple cache system
const CACHE_KEY = "ehviewer_image_cache";
const CACHE_LIMIT = 100;
// Storage keys for settings
const VIEW_MODE_KEY = "ehviewer_view_mode";
const FIT_TYPE_KEY = "ehviewer_fit_type";

// Load cache from localStorage
function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch (e) {
    console.error("Error loading cache:", e);
    return {};
  }
}

// Save cache to localStorage
function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Error saving cache:", e);
  }
}

// Control panel styles
const styles = `
  body {
    margin: 0;
    padding: 0;
    background: #121212 !important;
    color: #f1f1f1 !important;
  }

  body.fullscreen-mode {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000 !important;
    width: 100vw;
    height: 100vh;
  }
  
  .viewer-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: #121212;
    display: flex;
    flex-direction: column;
    align-items: center; /* Center images horizontally */
  }
  .viewer-container .gm {
    display: none ;
  }

  .viewer-container.fullscreen {
    overflow: hidden;
    background: #000;
    align-items: initial; /* Reset alignment for fullscreen */
  }

  .control-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
    color: white;
    transition: opacity 0.3s;
  }
  
  .control-panel.hidden {
    opacity: 0;
  }
  
  .control-panel:hover {
    opacity: 1 !important;
  }

  .control-panel select, .control-panel button {
    margin: 5px;
    padding: 3px;
    background: #333;
    color: white;
    border: 1px solid #666;
  }
  
  .page-controls {
    display: none;
    margin-top: 10px;
  }
  
  .page-controls button {
    margin: 0 5px;
    padding: 5px 10px;
    cursor: pointer;
  }

  .image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%; /* Occupy full width for alignment */
    position: relative;
    background: #121212;
  }
  
  .scroll-mode .image-container {
    margin-bottom: 20px; /* Gap between images in scroll mode */
    min-height: 100vh; /* Ensure container takes vertical space */
  }
  
  .image-container.fullscreen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
  }

  .image-container img {
    display: block; /* Remove extra space below image */
    background: #121212;
    /* Default behavior (can be overridden by fit classes) */
    max-width: 100%; 
    max-height: 100%;
    object-fit: contain; /* Default to contain if no class matches */
  }
  
  .image-container img.fit-original {
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: none !important;
    object-fit: none !important;
  }
  
  .image-container img.fit-contain {
    width: auto !important; /* Let container size dictate */
    height: auto !important;
    max-width: 100vw !important; /* Max width is viewport width */
    max-height: 100vh !important; /* Max height is viewport height */
    object-fit: contain !important;
  }
  
  .image-container img.fit-fill-height {
    height: 100vh !important;
    width: auto !important;
    object-fit: cover !important; 
    max-width: none !important; /* Allow width to exceed viewport if needed */
  }
  
  .image-container img.fit-fill-width {
    width: 100vw !important;
    height: auto !important;
    object-fit: cover !important;
    max-height: none !important; /* Allow height to exceed viewport if needed */
  }

  .keyboard-help {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px;
    border-radius: 5px;
    color: white;
    font-size: 12px;
    z-index: 9999;
    transition: opacity 0.3s;
  }
  
  .keyboard-help.hidden {
    opacity: 0;
  }
  
  .keyboard-help:hover {
    opacity: 1 !important;
  }

  .navigation-overlay {
    position: fixed;
    top: 0;
    width: 50%;
    height: 100vh;
    background: transparent;
    z-index: 9998;
    cursor: pointer;
    display: none;
  }

  .navigation-overlay.left {
    left: 0;
    cursor: w-resize;
  }

  .navigation-overlay.right {
    right: 0;
    cursor: e-resize;
  }

  .fullscreen .navigation-overlay {
    display: block;
  }
`;

function createControlPanel() {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create viewer container
  const viewerContainer = document.createElement("div");
  viewerContainer.className = "viewer-container";
  if (viewMode === "scroll") {
    viewerContainer.classList.add("scroll-mode");
  }
  document.body.appendChild(viewerContainer);

  const panel = document.createElement("div");
  panel.className = "control-panel";
  panel.innerHTML = `
        <div>
            <label>View Mode:</label>
            <select id="viewMode">
                <option value="scroll" ${
                  viewMode === "scroll" ? "selected" : ""
                }>Scroll</option>
                <option value="page" ${
                  viewMode === "page" ? "selected" : ""
                }>Fullscreen</option>
            </select>
        </div>
        <div>
            <label>Fit Type:</label>
            <select id="fitType">
                <option value="original" ${
                  fitType === "original" ? "selected" : ""
                }>Original</option>
                <option value="contain" ${
                  fitType === "contain" ? "selected" : ""
                }>Fit</option>
                <option value="fill-height" ${
                  fitType === "fill-height" ? "selected" : ""
                }>Fill Height</option>
                <option value="fill-width" ${
                  fitType === "fill-width" ? "selected" : ""
                }>Fill Width</option>
            </select>
        </div>
        <div class="page-controls">
            <button id="prevPage">Previous</button>
            <span id="pageInfo">Page 1 of 1</span>
            <button id="nextPage">Next</button>
        </div>
        <div>
            <button id="clearCacheBtn">Clear Cache</button>
        </div>
    `;
  document.body.appendChild(panel);

  // Add navigation overlays
  const leftOverlay = document.createElement("div");
  leftOverlay.className = "navigation-overlay left";
  const rightOverlay = document.createElement("div");
  rightOverlay.className = "navigation-overlay right";
  document.body.appendChild(leftOverlay);
  document.body.appendChild(rightOverlay);

  // Add keyboard help
  const keyboardHelp = document.createElement("div");
  keyboardHelp.className = "keyboard-help";
  keyboardHelp.innerHTML = `
        Keyboard Controls:<br>
        Left Arrow / PageUp: Previous Page<br>
        Right Arrow / PageDown / Space: Next Page<br>
        U: Toggle UI visibility in any mode<br>
        Mouse: Click left/right side to navigate
    `;
  document.body.appendChild(keyboardHelp);

  // Event listeners
  document.getElementById("viewMode").addEventListener("change", (e) => {
    viewMode = e.target.value;
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
    isFullscreen = viewMode === "page";

    // Update viewer container class for scroll mode spacing
    const viewerContainer = document.querySelector(".viewer-container");
    viewerContainer.classList.toggle("scroll-mode", viewMode === "scroll");

    updateLayout();
  });

  document.getElementById("fitType").addEventListener("change", (e) => {
    fitType = e.target.value;
    localStorage.setItem(FIT_TYPE_KEY, fitType);
    updateLayout();
  });

  document.getElementById("prevPage").addEventListener("click", () => {
    navigatePage("prev");
  });

  document.getElementById("nextPage").addEventListener("click", () => {
    navigatePage("next");
  });

  document.getElementById("clearCacheBtn").addEventListener("click", () => {
    const confirmClear = confirm(
      "Are you sure you want to clear the image cache?"
    );
    if (confirmClear) {
      localStorage.removeItem(CACHE_KEY);
      alert("Image cache cleared!");
    }
  });

  leftOverlay.addEventListener("click", () => navigatePage("prev"));
  rightOverlay.addEventListener("click", () => navigatePage("next"));

  // Keyboard navigation and UI toggle
  document.addEventListener("keydown", (e) => {
    if (e.key === "u" || e.key === "U") {
      // U key toggles UI in both modes
      uiVisible = !uiVisible;
      document
        .querySelector(".control-panel")
        .classList.toggle("hidden", !uiVisible);
      document
        .querySelector(".keyboard-help")
        .classList.toggle("hidden", !uiVisible);
      e.preventDefault();
    } else if (viewMode === "page") {
      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          navigatePage("prev");
          e.preventDefault();
          break;
        case "ArrowRight":
        case "PageDown":
        case " ":
          navigatePage("next");
          e.preventDefault();
          break;
      }
    }
  });

  // Mouse movement UI show/hide
  let mouseTimer;
  document.addEventListener("mousemove", () => {
    clearTimeout(mouseTimer);

    // If UI is manually hidden via 'U', don't show it on mouse move
    if (!uiVisible) return;

    // Show UI elements
    document.querySelector(".control-panel").classList.remove("hidden");
    document.querySelector(".keyboard-help").classList.remove("hidden");

    // Set timeout to hide UI again only if in page mode
    if (viewMode === "page") {
      mouseTimer = setTimeout(() => {
        // Check uiVisible again in case 'U' was pressed during the timeout
        if (uiVisible) {
          document.querySelector(".control-panel").classList.add("hidden");
          document.querySelector(".keyboard-help").classList.add("hidden");
        }
      }, 2000);
    }
  });
}

function navigatePage(direction) {
  const containers = document.querySelectorAll(".image-container");
  if (direction === "prev" && currentPageIndex > 0) {
    currentPageIndex--;
    updateLayout();
  } else if (direction === "next" && currentPageIndex < containers.length - 1) {
    currentPageIndex++;
    updateLayout();
  }
}

function updateLayout() {
  const viewerContainer = document.querySelector(".viewer-container");
  const containers = document.querySelectorAll(".image-container");
  const pageControls = document.querySelector(".page-controls");
  const pageInfo = document.getElementById("pageInfo");

  // Prevent layout updates from causing flickering by batching changes
  requestAnimationFrame(() => {
    // Update body and container classes
    document.body.classList.toggle("fullscreen-mode", viewMode === "page");
    viewerContainer.classList.toggle("fullscreen", viewMode === "page");
    viewerContainer.classList.toggle("scroll-mode", viewMode === "scroll");

    containers.forEach((container, index) => {
      container.classList.toggle("fullscreen", viewMode === "page");
      const img = container.querySelector("img");
      if (img) {
        // Remove all existing fit classes
        img.classList.remove(
          "fit-original",
          "fit-contain",
          "fit-fill-height",
          "fit-fill-width"
          // Include old classes here if they might still exist from previous versions
          // "fit-width", "fit-height", "fill-width", "fill-height"
        );

        // Add the correct new fit class
        switch (fitType) {
          case "original":
            img.classList.add("fit-original");
            break;
          case "contain":
            img.classList.add("fit-contain");
            break;
          case "fill-height":
            img.classList.add("fit-fill-height");
            break;
          case "fill-width":
            img.classList.add("fit-fill-width");
            break;
        }
      }

      if (viewMode === "page") {
        container.style.display = index === currentPageIndex ? "flex" : "none";
        pageControls.style.display = "block";
        const totalPages = containers.length > 0 ? containers.length : 1; // Avoid showing 0 pages
        pageInfo.textContent = `Page ${currentPageIndex + 1} of ${totalPages}`;
      } else {
        container.style.display = "flex";
        pageControls.style.display = "none";
      }
    });
  });
}

console.log(ss);

// Get GID, Token & Image links
if (ss[3] === "g") {
  var total = parseInt(
    document.querySelector(".gtb td:last-child").previousElementSibling
      .children[0].innerHTML
  );
  console.log({ total });
  var cleanUrl = "https://e-hentai.org/g/" + ss[4] + "/" + ss[5] + "/?p=";
  console.log({ cleanUrl });

  // --- Refactored Initial Link Gathering using Promises ---
  const fetchPromises = [];
  for (let i = 0; i < total; i++) {
    const pageUrl = cleanUrl + i;
    // Add fetch promise to the array
    fetchPromises.push(
      fetch(pageUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `HTTP error! status: ${response.status} for ${pageUrl}`
            );
          }
          return response.text();
        })
        .catch((error) => {
          console.error("Error fetching gallery page:", pageUrl, error);
          return null; // Return null on error to allow Promise.all to complete
        })
    );
  }

  // Wait for all gallery pages to be fetched
  Promise.all(fetchPromises)
    .then((results) => {
      console.log("All gallery pages fetched.");
      results.forEach((result) => {
        if (result) {
          // Process only successful fetches
          const parser = new DOMParser();
          const doc = parser.parseFromString(result, "text/html");
          const gdtElement = doc.querySelector("#gdt"); // Target the main container

          if (gdtElement) {
            const links = gdtElement.querySelectorAll("a"); // Find links within #gdt
            links.forEach((linkElement) => {
              const link = linkElement.getAttribute("href");
              if (link && link.includes("s/")) {
                // Basic check if it's an image page link
                // console.log("Found image page link:", link);
                images.push(link);
                // thumbs are not currently used, so skipping thumbs.push
                // thumbs.push(linkElement.innerHTML);
              }
            });
          } else {
            console.warn("Could not find #gdt element on a gallery page.");
          }
        }
      });

      console.log(`Total image page links gathered: ${images.length}`);
      // Call startDownload ONLY ONCE after all links are collected
      if (images.length > 0) {
        startDownload();
      } else {
        console.error("No image links found. Cannot start download.");
        // Optionally display a message to the user
      }
    })
    .catch((error) => {
      console.error("An error occurred during initial link gathering:", error);
      // Handle cases where Promise.all itself fails (though individual fetch errors are caught above)
    });
  // --- End Refactored Initial Link Gathering ---
}

function startDownload() {
  if (!started) {
    // Ensure startDownload logic runs only once
    // Clear
    document.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
    var desc = document.querySelector(".gm");

    document.body.innerHTML = "";
    document.body.style.background = "#121212";

    createControlPanel();

    const viewerContainer = document.querySelector(".viewer-container");
    if (desc) viewerContainer.appendChild(desc);

    console.log("Start Download called");
    started = true;

    // Load cache once
    const imageCache = loadCache();
    const imagesToFetch = [];

    // --- Prioritize and immediately load cached images ---
    console.log(`Processing ${images.length} total image links.`);
    const initialImageLinks = [...images]; // Copy original links
    // images = []; // Don't clear here, keep original list for reference if needed?
    // Let's stick with the original plan of processing `initialImageLinks`
    // and populating `imagesToFetch`.

    initialImageLinks.forEach((link) => {
      if (imageCache[link]) {
        console.log("Using cached image (immediate load):", link);
        const container = document.createElement("div");
        container.className = "image-container";
        // Pass the viewerContainer obtained after createControlPanel
        createAndAppendImage(imageCache[link], container, viewerContainer);
      } else {
        // Add to the list to be fetched later
        imagesToFetch.push(link);
      }
    });
    console.log(`${imagesToFetch.length} images require fetching.`);
    // --- End immediate cache processing ---

    // Now, set up the interval loop ONLY for images that need fetching
    if (imagesToFetch.length === 0) {
      console.log("No images require fetching (all were cached).");
      // Update layout once if needed, especially for page mode page count
      if (viewMode === "page") updateLayout();
      return; // No need to start the interval loop
    }

    let loop = setInterval(function () {
      if (thread < maxThread) {
        if (imagesToFetch.length > 0) {
          // Check imagesToFetch instead of images
          var container = document.createElement("div");
          container.className = "image-container";
          // Use viewerContainer directly

          var link = imagesToFetch.shift(); // Get link from fetch list

          console.log("Fetching image from:", link);
          fetch(link)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${link}`);
              }
              return response.text();
            })
            .then((result) => {
              var parser = new DOMParser();
              var doc = parser.parseFromString(result, "text/html");
              var img = doc.querySelector("#img");

              if (img && img.src) {
                // Cache the image URL
                imageCache[link] = img.src;

                // Manage cache size
                const cacheKeys = Object.keys(imageCache);
                if (cacheKeys.length > CACHE_LIMIT) {
                  delete imageCache[cacheKeys[0]]; // Remove oldest entry
                }
                saveCache(imageCache); // Save cache after potential modification

                createAndAppendImage(img.src, container, viewerContainer);
              } else {
                console.error(
                  "Could not find image element (#img) or its src on page:",
                  link
                );
                container.remove();
                // Decrement thread here? No, createAndAppendImage wasn't called.
              }
            })
            .catch((error) => {
              console.error("Error fetching image page:", link, error);
              container.remove(); // Remove container on fetch error
            });
        }
      } else {
        // This timeout logic is for when max threads are busy
        if (imagesToFetch.length > 0) {
          timeout += 1000;
          if (timeout > imgLoadTimeout) {
            console.warn("Image load timeout reached, resetting thread count.");
            thread = 0;
            timeout = 0;
          }
        }
      }

      // Stop the interval if there are no more images to fetch and no active threads
      if (imagesToFetch.length === 0 && thread === 0) {
        console.log("All images processed.");
        clearInterval(loop);
        // Update layout once at the very end, especially for page count in page mode
        if (viewMode === "page") updateLayout();
      }
    }, 1000);
  }
}

function createAndAppendImage(src, container, viewerContainer) {
  const img = document.createElement("img");

  // Set up container styles before image loads
  container.classList.toggle("fullscreen", viewMode === "page");

  // Apply correct initial fit class based on current setting
  img.classList.remove(
    // Ensure no other fit classes are present initially
    "fit-original",
    "fit-contain",
    "fit-fill-height",
    "fit-fill-width"
  );
  switch (fitType) {
    case "original":
      img.classList.add("fit-original");
      break;
    case "contain":
      img.classList.add("fit-contain");
      break;
    case "fill-height":
      img.classList.add("fit-fill-height");
      break;
    case "fill-width":
      img.classList.add("fit-fill-width");
      break;
  }

  // Append image to container first
  container.appendChild(img);

  // Get the index *before* appending to the main viewer container
  const allContainers = viewerContainer.querySelectorAll(".image-container");
  const newImageIndex = allContainers.length; // Index will be the current count

  // Initially hide container in page mode to prevent flicker
  if (viewMode === "page" && newImageIndex !== currentPageIndex) {
    container.style.display = "none";
  }

  // Append container to the main viewer
  viewerContainer.appendChild(container);

  // Increment thread count *before* setting src, as this represents an active image load
  thread++;

  // Set the src last to trigger load
  img.src = src;

  img.onload = function () {
    if (thread > 0) {
      thread--; // Decrement thread count on successful load
    }
    console.log("Image loaded, index:", newImageIndex, "Threads:", thread);

    // Only affect this specific container after load
    if (viewMode === "page") {
      // Ensure correct display based on current page index
      container.style.display =
        newImageIndex === currentPageIndex ? "flex" : "none";

      // Update page info if this newly loaded image is the current page
      if (newImageIndex === currentPageIndex) {
        const pageInfo = document.getElementById("pageInfo");
        const totalPages =
          viewerContainer.querySelectorAll(".image-container").length;
        if (pageInfo) {
          pageInfo.textContent = `Page ${
            currentPageIndex + 1
          } of ${totalPages}`;
        }
      }
    }
    // No style changes needed for scroll mode here
  };

  img.onerror = function () {
    console.error("Image failed to load:", src);
    if (thread > 0) {
      thread--; // Decrement thread count on error
    }
    console.log("Image load error, Threads:", thread);
    // Maybe add placeholder or remove container? For now, just log.
    container.remove(); // Remove container if image fails to load
    if (viewMode === "page") {
      // Need to update page count if a container is removed
      const pageInfo = document.getElementById("pageInfo");
      const totalPages =
        viewerContainer.querySelectorAll(".image-container").length;
      if (pageInfo) {
        pageInfo.textContent = `Page ${currentPageIndex + 1} of ${totalPages}`;
      }
    }
  };
}
