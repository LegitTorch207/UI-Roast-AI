console.log("app.js loaded!");

// --- Elements ---
const fileInput          = document.getElementById("fileInput");
const dropZone           = document.getElementById("dropZone");
const previewContainer   = document.getElementById("previewContainer");
const previewImage       = document.getElementById("previewImage");
const removeBtn          = document.getElementById("removeBtn");
const analyzeBtn         = document.getElementById("analyzeBtn");
const loadingSection     = document.getElementById("loadingSection");
const resultsSection     = document.getElementById("resultsSection");

// Score elements
const designScore        = document.getElementById("designScore");
const accessibilityScore = document.getElementById("accessibilityScore");
const mobileScore        = document.getElementById("mobileScore");

// List elements
const uiIssues           = document.getElementById("uiIssues");
const colorSuggestions   = document.getElementById("colorSuggestions");
const mobileTips         = document.getElementById("mobileTips");
const ctaFixes           = document.getElementById("ctaFixes");

let selectedFile = null;
let isAnalyzing  = false;

/* =========================
   Helpers: show / hide
========================= */
function show(el)     { el.style.display = "block"; }
function hide(el)     { el.style.display = "none";  }
function showFlex(el) { el.style.display = "flex";  }

/* =========================
   Drop Zone — drag events only
   NO click listener on dropZone
   The <label for="fileInput"> handles
   opening the picker natively
========================= */
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", (e) => {
  e.stopPropagation();
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("drag-over");
  handleFile(e.dataTransfer.files[0]);
});

/* =========================
   File Input Change
========================= */
fileInput.addEventListener("change", (e) => {
  e.stopPropagation();
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
  // Reset so same file can be re-selected
  fileInput.value = "";
});

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please upload a valid image file.");
    return;
  }

  selectedFile = file;
  console.log("File selected:", selectedFile.name);

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    showFlex(previewContainer);
    analyzeBtn.disabled = false;
    console.log("Preview ready.");
  };
  reader.readAsDataURL(file);
}

/* =========================
   Remove Image
========================= */
removeBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  selectedFile = null;
  previewImage.src = "";

  hide(previewContainer);
  hide(resultsSection);
  hide(loadingSection);
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyze Design";

  console.log("Image removed.");
});

/* =========================
   Analyze Button
========================= */
analyzeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  if (!selectedFile || isAnalyzing) return;

  isAnalyzing = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  show(loadingSection);
  hide(resultsSection);

  console.log("Analyzing:", selectedFile.name);

  try {
    const formData = new FormData();
    formData.append("image", selectedFile);

    const response = await fetch("https://legittorch207-ui-roast-ai-backend.hf.space/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Backend returned:", data);

    renderResults(data);

    hide(loadingSection);
    show(resultsSection);

    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (error) {
    console.error("Analysis failed:", error);
    alert(`Error: ${error.message}\n\nMake sure your Flask backend is running.`);
    hide(loadingSection);
  } finally {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Design";
  }
});

/* =========================
   Render Results
========================= */
function renderResults(data) {
  designScore.textContent        = data.design_score        ?? "—";
  accessibilityScore.textContent = data.accessibility_score ?? "—";
  mobileScore.textContent        = data.mobile_score        ?? "—";

  renderList(uiIssues,         data.ui_issues);
  renderList(colorSuggestions, data.color_suggestions);
  renderList(mobileTips,       data.mobile_tips);
  renderList(ctaFixes,         data.cta_fixes);
}

function renderList(element, items) {
  element.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No feedback available.";
    li.style.opacity = "0.5";
    element.appendChild(li);
    return;
  }

  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = item;
    li.style.opacity = "0";
    li.style.transform = "translateY(6px)";
    li.style.transition = `opacity 0.3s ease ${i * 60}ms, transform 0.3s ease ${i * 60}ms`;
    element.appendChild(li);

    // Double rAF ensures transition triggers correctly
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        li.style.opacity = "1";
        li.style.transform = "translateY(0)";
      });
    });
  });
}