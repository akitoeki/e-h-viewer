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

// Global variables to manage state and listeners for reverting
let originalBodyHTML = null;
let customStyleSheet = null;
let loopInterval = null; // To store the setInterval ID
let viewerKeyDownListener = null; // Reference to the main keydown listener
let viewerMouseMoveListener = null; // Reference to the mousemove listener
let escapeKeyListener = null; // Reference to the escape key listener itself
let initialKeyListener = null; // Listener for 'R' key to initially start

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

// Function to handle reverting to original UI
function revertToOriginalUI() {
  if (!started || !originalBodyHTML) {
    console.log(
      "Cannot revert: Script not started or original body not saved."
    );
    return;
  }

  console.log("Reverting to original page UI...");

  // 1. Stop image loading loop
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }

  // 2. Restore body content
  document.body.innerHTML = originalBodyHTML;

  // 3. Remove custom stylesheet
  if (customStyleSheet) {
    customStyleSheet.remove();
    customStyleSheet = null;
  }

  // 4. Remove added body classes (safer to remove all)
  document.body.removeAttribute("class");

  // 5. Remove event listeners
  if (viewerKeyDownListener) {
    document.removeEventListener("keydown", viewerKeyDownListener);
    viewerKeyDownListener = null;
  }
  if (viewerMouseMoveListener) {
    document.removeEventListener("mousemove", viewerMouseMoveListener);
    viewerMouseMoveListener = null;
  }
  if (escapeKeyListener) {
    document.removeEventListener("keydown", escapeKeyListener); // Remove self
    escapeKeyListener = null;
  }

  // 6. Reset script state variables
  started = false;
  currentPageIndex = 0;
  thread = 0;
  // Reset settings to defaults or keep last loaded? Resetting is safer.
  viewMode = "scroll";
  fitType = "contain";
  uiVisible = true;
  originalBodyHTML = null; // Allow storing again if script is re-run

  console.log("Viewer UI reverted.");

  // --- Re-add the initial 'R' key listener ---
  setupInitialKeyListener();
  // --- End re-adding listener ---
}

// Function to set up the Escape key listener
function setupEscapeListener() {
  // Remove any existing listener first
  if (escapeKeyListener) {
    document.removeEventListener("keydown", escapeKeyListener);
  }

  escapeKeyListener = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      revertToOriginalUI();
    }
  };
  document.addEventListener("keydown", escapeKeyListener);
}

// Function to set up other viewer event listeners
function setupViewerEventListeners() {
  // Remove existing listeners first to prevent duplicates if called again
  if (viewerKeyDownListener)
    document.removeEventListener("keydown", viewerKeyDownListener);
  if (viewerMouseMoveListener)
    document.removeEventListener("mousemove", viewerMouseMoveListener);

  // Keyboard navigation and UI toggle ('U' key, arrows)
  viewerKeyDownListener = (e) => {
    if (e.key === "u" || e.key === "U") {
      // U key toggles UI in both modes
      uiVisible = !uiVisible;
      document
        .querySelector(".control-panel")
        ?.classList.toggle("hidden", !uiVisible);
      document
        .querySelector(".keyboard-help")
        ?.classList.toggle("hidden", !uiVisible);
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
    // Note: The escape key logic is handled by its dedicated listener
  };

  // Mouse movement UI show/hide
  let mouseTimer;
  viewerMouseMoveListener = () => {
    clearTimeout(mouseTimer);
    if (!uiVisible) return; // If UI manually hidden, don't show on move

    document.querySelector(".control-panel")?.classList.remove("hidden");
    document.querySelector(".keyboard-help")?.classList.remove("hidden");

    if (viewMode === "page") {
      mouseTimer = setTimeout(() => {
        if (uiVisible) {
          // Check again in case U was pressed
          document.querySelector(".control-panel")?.classList.add("hidden");
          document.querySelector(".keyboard-help")?.classList.add("hidden");
        }
      }, 2000);
    }
  };

  document.addEventListener("keydown", viewerKeyDownListener);
  document.addEventListener("mousemove", viewerMouseMoveListener);
}

function createControlPanel() {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  customStyleSheet = styleSheet; // Store reference to stylesheet
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
        R: Enter/Re-enter Reader Mode (Initial Page)<br>
        ESC: Exit Reader Mode<br>
        Left Arrow / PageUp: Previous Page (Fullscreen)<br>
        Right Arrow / PageDown / Space: Next Page (Fullscreen)<br>
        U: Toggle UI visibility<br>
        Mouse: Click left/right side to navigate (Fullscreen)
    `;
  document.body.appendChild(keyboardHelp);

  // --- Setup Event Listeners ---
  setupViewerEventListeners(); // Setup U key, arrows, mousemove
  setupEscapeListener(); // Setup Escape key listener

  // --- Control Panel Element Event Listeners ---
  document.getElementById("viewMode").addEventListener("change", (e) => {
    viewMode = e.target.value;
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
    isFullscreen = viewMode === "page";

    const viewerContainer = document.querySelector(".viewer-container");
    viewerContainer?.classList.toggle("scroll-mode", viewMode === "scroll");

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

  // Navigation overlay listeners
  leftOverlay.addEventListener("click", () => navigatePage("prev"));
  rightOverlay.addEventListener("click", () => navigatePage("next"));
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

// Function to actually start the reader process (fetches links, calls startDownload)
function initiateReaderMode() {
  if (started) {
    console.log("Reader mode already active.");
    return;
  }
  console.log("Initiating reader mode...");

  // Remove the initial 'R' listener if it exists
  if (initialKeyListener) {
    document.removeEventListener("keydown", initialKeyListener);
    initialKeyListener = null;
  }

  // --- Logic moved from the initial 'if (ss[3] === "g")' block ---
  var url = document.URL; // Re-check URL here in case of SPA navigation
  var ss = url.split("/");
  if (ss[3] !== "g") {
    console.error(
      "Not on a compatible gallery page (URL structure mismatch). Cannot initiate reader."
    );
    setupInitialKeyListener(); // Re-add listener if check fails here
    return;
  }

  var total = parseInt(
    document.querySelector(".gtb td:last-child")?.previousElementSibling
      ?.children?.[0]?.innerHTML ?? "0"
  );
  if (!total || isNaN(total) || total <= 0) {
    console.error("Could not determine total pages or total is zero.");
    setupInitialKeyListener(); // Re-add listener
    return;
  }

  console.log({ total });
  var cleanUrl = "https://e-hentai.org/g/" + ss[4] + "/" + ss[5] + "/?p=";
  console.log({ cleanUrl });

  images = []; // Reset images array before fetching

  const fetchPromises = [];
  for (let i = 0; i < total; i++) {
    const pageUrl = cleanUrl + i;
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
          return null;
        })
    );
  }

  Promise.all(fetchPromises)
    .then((results) => {
      console.log("All gallery pages fetched for link gathering.");
      results.forEach((result) => {
        if (result) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(result, "text/html");
          const gdtElement = doc.querySelector("#gdt");
          if (gdtElement) {
            const links = gdtElement.querySelectorAll("a");
            links.forEach((linkElement) => {
              const link = linkElement.getAttribute("href");
              if (link && link.includes("s/")) {
                images.push(link);
              }
            });
          } else {
            console.warn("Could not find #gdt element on a gallery page.");
          }
        }
      });

      console.log(`Total image page links gathered: ${images.length}`);
      if (images.length > 0) {
        startDownload(); // Call the function that builds the reader UI
      } else {
        console.error("No image links found. Cannot start reader mode.");
        setupInitialKeyListener(); // Re-add listener if no links found
      }
    })
    .catch((error) => {
      console.error("An error occurred during initial link gathering:", error);
      setupInitialKeyListener(); // Re-add listener on major error
    });
  // --- End moved logic ---
}

// Function to set up the initial 'R' key listener
function setupInitialKeyListener() {
  // Remove any existing listener first
  if (initialKeyListener) {
    document.removeEventListener("keydown", initialKeyListener);
  }
  console.log("Setting up initial 'R' key listener.");
  initialKeyListener = function (e) {
    // Check if we're typing in an input field
    const targetTagName = e.target.tagName.toLowerCase();
    if (
      targetTagName === "input" ||
      targetTagName === "textarea" ||
      targetTagName === "select"
    ) {
      return; // Ignore 'R' key if typing in form controls
    }

    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      initiateReaderMode(); // Start the process
    }
  };
  document.addEventListener("keydown", initialKeyListener);
}

function startDownload() {
  // Store original body *before* clearing, only if not already stored
  if (originalBodyHTML === null) {
    console.log("Storing original body HTML.");
    originalBodyHTML = document.body.innerHTML;
  }

  if (!started) {
    // Ensure startDownload logic runs only once per execution flow
    // Clear existing elements potentially added by previous runs if revert wasn't perfect
    document
      .querySelectorAll(
        ".viewer-container, .control-panel, .navigation-overlay, .keyboard-help"
      )
      .forEach((el) => el.remove());
    if (customStyleSheet) customStyleSheet.remove(); // Remove previous stylesheet just in case

    // Clear
    document.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
    var desc = document.querySelector(".gm");

    document.body.innerHTML = ""; // Clear existing body
    document.body.style.background = "#121212";

    createControlPanel(); // Setup UI and ALL event listeners (including ESC)

    const viewerContainer = document.querySelector(".viewer-container");
    if (desc) viewerContainer.appendChild(desc);

    console.log("Start Download called");
    started = true;

    // Load cache once
    const imageCache = loadCache();
    const imagesToFetch = [];

    // --- Prioritize and immediately load cached images ---
    console.log(`Processing ${images.length} total image links.`);
    const initialImageLinks = [...images];

    initialImageLinks.forEach((link) => {
      if (imageCache[link]) {
        console.log("Using cached image (immediate load):", link);
        const container = document.createElement("div");
        container.className = "image-container";
        createAndAppendImage(imageCache[link], container, viewerContainer);
      } else {
        imagesToFetch.push(link);
      }
    });
    console.log(`${imagesToFetch.length} images require fetching.`);

    // --- Call updateLayout once after processing cache ---
    console.log("Updating layout after initial cache processing.");
    updateLayout();
    // --- End initial updateLayout call ---

    // Now, set up the interval loop ONLY for images that need fetching
    if (imagesToFetch.length === 0) {
      console.log("No images require fetching (all were cached).");
      return;
    }

    // Assign interval ID to global variable
    loopInterval = setInterval(function () {
      if (thread < maxThread) {
        if (imagesToFetch.length > 0) {
          var container = document.createElement("div");
          container.className = "image-container";
          var link = imagesToFetch.shift();

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
                imageCache[link] = img.src;
                const cacheKeys = Object.keys(imageCache);
                if (cacheKeys.length > CACHE_LIMIT) {
                  delete imageCache[cacheKeys[0]];
                }
                saveCache(imageCache);
                createAndAppendImage(img.src, container, viewerContainer);
              } else {
                console.error(
                  "Could not find image element (#img) or its src on page:",
                  link
                );
                container.remove();
              }
            })
            .catch((error) => {
              console.error("Error fetching image page:", link, error);
              container.remove();
            });
        }
      } else {
        if (imagesToFetch.length > 0) {
          timeout += 1000;
          if (timeout > imgLoadTimeout) {
            console.warn("Image load timeout reached, resetting thread count.");
            thread = 0;
            timeout = 0;
          }
        }
      }

      // Stop the interval
      if (imagesToFetch.length === 0 && thread === 0) {
        console.log("All images processed.");
        clearInterval(loopInterval);
        loopInterval = null; // Clear the interval ID
        console.log("Updating layout after all fetching finished.");
        updateLayout();
      }
    }, 1000);
  } else {
    console.warn("startDownload called again while already started. Ignoring.");
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

  // Initially hide container in page mode if it's not the current page
  if (viewMode === "page" && newImageIndex !== currentPageIndex) {
    container.style.display = "none";
  }
  // Important: If it *is* the first page (index 0), it will default to display: flex/block (depending on CSS)
  // or be explicitly set by the initial updateLayout call.

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

    // Only affect this specific container after load for visibility
    if (viewMode === "page") {
      // Ensure correct display based on current page index
      container.style.display =
        newImageIndex === currentPageIndex ? "flex" : "none";
    }
    // No style changes needed for scroll mode here
  };

  img.onerror = function () {
    console.error("Image failed to load:", src);
    if (thread > 0) {
      thread--; // Decrement thread count on error
    }
    console.log("Image load error, Threads:", thread);
    container.remove(); // Remove container if image fails to load
  };
}

// --- Initial Script Execution --- (REMOVED AUTOMATIC START)
// Check if on a compatible page BUT DON'T start automatically
var currentUrl = document.URL;
var currentSs = currentUrl.split("/");
if (currentSs[3] === "g") {
  console.log("On a compatible gallery page. Press 'R' to enter reader mode.");
  // Set up the listener that waits for 'R'
  setupInitialKeyListener();
} else {
  console.log("Not on a compatible gallery page for the reader mode script.");
}
// --- End Initial Script Execution ---
