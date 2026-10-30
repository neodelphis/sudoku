(function () {
  const fileInput = document.getElementById("file-input");
  const btnPhoto = document.getElementById("btn-photo");
  const btnGallery = document.getElementById("btn-gallery");
  const btnDemo = document.getElementById("btn-demo");
  const btnSolve = document.getElementById("btn-solve");
  const btnClear = document.getElementById("btn-clear");
  const previewWrap = document.getElementById("preview-wrap");
  const placeholder = document.getElementById("placeholder");
  const preview = document.getElementById("preview");
  const overlay = document.getElementById("overlay");
  const status = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const resultZone = document.getElementById("result-zone");
  const gridCanvas = document.getElementById("grid-canvas");
  const errorMsg = document.getElementById("error-msg");

  let currentImage = null;
  let currentGrid = null;
  let currentConfidences = null;
  let currentCorners = null;
  let shownSolution = false;

  const WARP = 450;

  function setStatus(text, visible) {
    status.classList.toggle("hidden", !visible);
    if (text) statusText.textContent = text;
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
  }
  function clearError() {
    errorMsg.classList.add("hidden");
  }

  btnPhoto.addEventListener("click", () => {
    fileInput.setAttribute("capture", "environment");
    fileInput.click();
  });
  btnGallery.addEventListener("click", () => {
    fileInput.removeAttribute("capture");
    fileInput.click();
  });
  btnDemo.addEventListener("click", () => loadDemo());
  btnClear.addEventListener("click", reset);
  btnSolve.addEventListener("click", showSolution);

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
    fileInput.value = "";
  });

  function reset() {
    currentImage = null;
    currentGrid = null;
    currentConfidences = null;
    currentCorners = null;
    shownSolution = false;
    previewWrap.classList.add("hidden");
    overlay.classList.add("hidden");
    placeholder.classList.remove("hidden");
    resultZone.classList.add("hidden");
    clearError();
    setStatus(null, false);
  }

  function loadFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      processImage(img);
    };
    img.onerror = () => showError("Impossible de lire cette image.");
    img.src = url;
  }

  async function loadDemo() {
    const img = new Image();
    img.onload = () => processImage(img);
    img.onerror = () => showError("Image de démo introuvable (lance un serveur local, ex. npx serve).");
    img.src = "assets/demo-grid.png";
  }

  async function processImage(img) {
    clearError();
    shownSolution = false;
    currentImage = img;
    drawPreview(img);
    setStatus("Analyse de la photo…", true);
    try {
      const result = await analyze(img);
      currentGrid = result.grid;
      currentConfidences = result.confidences;
      currentCorners = result.corners;
      drawOverlay(img, result.corners);
      drawGrid(currentGrid, null);
      resultZone.classList.remove("hidden");
      setStatus(null, false);
      const filled = countFilled(currentGrid);
      if (filled === 0) showError("Aucun chiffre reconnu. Essaie une photo plus nette, bien cadrée sur la grille.");
      else if (filled < 17) showError(`Seulement ${filled} chiffres reconnus — la grille risque d'être ambiguë. Recadre plus serré.`);
    } catch (err) {
      console.error(err);
      setStatus(null, false);
      showError("Grille non détectée. Cadre bien les 4 coins de la grille, photo nette et bien éclairée.");
    }
  }

  function drawPreview(img) {
    const maxW = 1280;
    const scale = Math.min(1, maxW / img.naturalWidth);
    preview.width = Math.round(img.naturalWidth * scale);
    preview.height = Math.round(img.naturalHeight * scale);
    const ctx = preview.getContext("2d");
    ctx.drawImage(img, 0, 0, preview.width, preview.height);
    overlay.width = preview.width;
    overlay.height = preview.height;
    previewWrap.classList.remove("hidden");
    placeholder.classList.add("hidden");
  }

  async function analyze(img) {
    const canvas = document.createElement("canvas");
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const { gray, bin } = SudokuVision.preprocessPhoto(imageData.data, canvas.width, canvas.height);
    const det = SudokuGrid.detectGrid(bin, canvas.width, canvas.height);
    if (!det) throw new Error("grid not found");

    const warped = SudokuGrid.warpGrid(gray, canvas.width, canvas.height, det.corners, WARP);
    const cells = SudokuVision.extractCells(warped, WARP);
    setStatus("Chargement du modèle de reconnaissance (Hugging Face)…", true);
    const { grid, confidences } = await SudokuOCR.readGrid(cells, {
      inkRatio: (pixels) => {
        let dark = 0;
        for (let i = 0; i < pixels.length; i++) if (pixels[i] < 128) dark++;
        return dark / pixels.length;
      },
      onCell: () => {},
    });
    setStatus("Lecture des 81 cases…", true);
    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;
    const corners = det.corners.map(([x, y]) => [x / scaleX, y / scaleY]);
    return { grid, confidences, corners };
  }

  function drawOverlay(img, corners) {
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!corners) return;
    const sx = overlay.width / img.naturalWidth;
    const sy = overlay.height / img.naturalHeight;
    ctx.strokeStyle = "rgba(83, 216, 164, 0.9)";
    ctx.lineWidth = Math.max(2, overlay.width / 200);
    ctx.beginPath();
    corners.forEach(([x, y], i) => {
      const px = x * sx;
      const py = y * sy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  }

  function drawGrid(grid, solution) {
    const ctx = gridCanvas.getContext("2d");
    const size = gridCanvas.width;
    const cell = size / 9;
    ctx.fillStyle = "#f5f3ee";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#b9b4a8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 9; i++) {
      ctx.lineWidth = i % 3 === 0 ? 3 : 1;
      ctx.strokeStyle = i % 3 === 0 ? "#333" : "#b9b4a8";
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(cell * 0.55)}px -apple-system, sans-serif`;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r][c];
        const solved = solution && solution[r][c] !== v;
        if (v !== 0) {
          ctx.fillStyle = solved ? "#0f9b8e" : "#1a1a2e";
          ctx.fillText(String(v), (c + 0.5) * cell, (r + 0.5) * cell + cell * 0.03);
        } else if (solution && solution[r][c] !== 0) {
          ctx.fillStyle = "#0f9b8e";
          ctx.fillText(String(solution[r][c]), (c + 0.5) * cell, (r + 0.5) * cell + cell * 0.03);
        }
      }
    }
  }

  function showSolution() {
    if (!currentGrid) return;
    clearError();
    const res = SudokuSolver.solveSudoku(currentGrid);
    if (!res.ok) {
      showError(
        res.reason === "invalide"
          ? "La grille reconnue contient un conflit — vérifie la photo (certains chiffres ont peut-être été mal lus)."
          : "Cette grille n'a pas de solution."
      );
      return;
    }
    shownSolution = true;
    drawGrid(currentGrid, res.solution);
    btnSolve.textContent = "🔄 Masquer la correction";
    btnSolve.onclick = () => {
      shownSolution = false;
      drawGrid(currentGrid, null);
      btnSolve.textContent = "✅ Voir la correction";
      btnSolve.onclick = showSolution;
    };
  }

  function countFilled(grid) {
    let n = 0;
    for (const row of grid) for (const v of row) if (v !== 0) n++;
    return n;
  }
})();
