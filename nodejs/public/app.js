// State management
let currentPages = [];
let currentPageIndex = 0;
let llmAvailable = false;

// DOM elements
const singleTab = document.getElementById('single-tab');
const multiTab = document.getElementById('multi-tab');
const singleFile = document.getElementById('single-file');
const multiFile = document.getElementById('multi-file');
const processSingleBtn = document.getElementById('process-single-btn');
const processMultiBtn = document.getElementById('process-multi-btn');
const confThreshold = document.getElementById('conf-threshold');
const iouThreshold = document.getElementById('iou-threshold');
const iouGroup = document.getElementById('iou-group');
const confValue = document.getElementById('conf-value');
const iouValue = document.getElementById('iou-value');
const statusText = document.getElementById('status-text');
const navControls = document.getElementById('nav-controls');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageSlider = document.getElementById('page-slider');
const pageInfo = document.getElementById('page-info');
const annotatedContainer = document.getElementById('annotated-container');
const signaturesSection = document.getElementById('signatures-section');
const signaturesContainer = document.getElementById('signatures-container');
const loading = document.getElementById('loading');
const totalInferences = document.getElementById('total-inferences');
const avgTime = document.getElementById('avg-time');
const lastTime = document.getElementById('last-time');
const llmOption = document.getElementById('llm-option');
const llmWarning = document.getElementById('llm-warning');

// Get selected detection method
function getDetectionMethod() {
    const selected = document.querySelector('input[name="detection-method"]:checked');
    return selected ? selected.value : 'yolov8';
}

// Check available detection methods on page load
async function checkDetectionMethods() {
    try {
        const response = await fetch('/api/detection-methods');
        const data = await response.json();
        
        const llmMethod = data.methods.find(m => m.id === 'llm');
        llmAvailable = llmMethod && llmMethod.available;
        
        if (!llmAvailable) {
            llmOption.classList.add('disabled');
            llmWarning.classList.remove('hidden');
        } else {
            llmOption.classList.remove('disabled');
            llmWarning.classList.add('hidden');
        }
        
        console.log('Detection methods:', data);
    } catch (error) {
        console.error('Failed to check detection methods:', error);
    }
}

// Handle detection method change
document.querySelectorAll('input[name="detection-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const method = e.target.value;
        
        // Show/hide IoU threshold for LLM (not applicable)
        if (method === 'llm') {
            iouGroup.style.opacity = '0.5';
            iouGroup.title = 'IoU threshold not applicable for LLM detection';
        } else {
            iouGroup.style.opacity = '1';
            iouGroup.title = '';
        }
        
        // Prevent selecting LLM if not available
        if (method === 'llm' && !llmAvailable) {
            e.preventDefault();
            document.querySelector('input[name="detection-method"][value="yolov8"]').checked = true;
            alert('LLM detection is not available. Please set HF_TOKEN environment variable.');
        }
    });
});

// Initialize on page load
checkDetectionMethods();

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
    });
});

// Threshold sliders
confThreshold.addEventListener('input', (e) => {
    confValue.textContent = parseFloat(e.target.value).toFixed(2);
});

iouThreshold.addEventListener('input', (e) => {
    iouValue.textContent = parseFloat(e.target.value).toFixed(2);
});

// Show loading
function showLoading() {
    loading.classList.remove('hidden');
}

// Hide loading
function hideLoading() {
    loading.classList.add('hidden');
}

// Update status
function updateStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.style.color = isError ? '#ef4444' : '#374151';
}

// Update metrics
function updateMetrics(metrics) {
    totalInferences.textContent = metrics.totalInferences || 0;
    avgTime.textContent = `${(metrics.avgTime || 0).toFixed(2)} ms`;
    lastTime.textContent = `${(metrics.inferenceTime || 0).toFixed(2)} ms`;
}

// Process single file
processSingleBtn.addEventListener('click', async () => {
    const file = singleFile.files[0];
    if (!file) {
        updateStatus('Please select a file', true);
        return;
    }

    const detectionMethod = getDetectionMethod();
    
    showLoading();
    updateStatus(`Processing with ${detectionMethod === 'llm' ? 'Qwen2.5-VL LLM' : 'YOLOv8s'}...`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('conf_threshold', confThreshold.value);
    formData.append('iou_threshold', iouThreshold.value);
    formData.append('detection_method', detectionMethod);

    try {
        const response = await fetch('/api/process-single', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Processing failed');
        }

        // Display annotated image
        annotatedContainer.innerHTML = `
            <img src="data:image/png;base64,${data.annotatedImage}" alt="Annotated document">
        `;

        // Display signatures
        displaySignaturesForSinglePage(data.signatures);

        // Update metrics
        updateMetrics(data.metrics);

        // Hide navigation controls
        navControls.classList.add('hidden');

        const methodLabel = detectionMethod === 'llm' ? '(LLM)' : '(YOLOv8)';
        updateStatus(`Found ${data.signatures.length} signature(s) ${methodLabel}`);
    } catch (error) {
        updateStatus(error.message, true);
        console.error('Error:', error);
    } finally {
        hideLoading();
    }
});

// Process multi-page PDF
processMultiBtn.addEventListener('click', async () => {
    const file = multiFile.files[0];
    if (!file) {
        updateStatus('Please select a PDF file', true);
        return;
    }

    const detectionMethod = getDetectionMethod();
    
    showLoading();
    updateStatus(`Processing PDF with ${detectionMethod === 'llm' ? 'Qwen2.5-VL LLM' : 'YOLOv8s'}...`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('conf_threshold', confThreshold.value);
    formData.append('iou_threshold', iouThreshold.value);
    formData.append('detection_method', detectionMethod);

    try {
        const response = await fetch('/api/process-pdf', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Processing failed');
        }

        // Store pages data
        currentPages = data.pages;
        currentPageIndex = 0;

        // Display first page
        displayPage(0);

        // Setup navigation
        setupNavigation(data.totalPages);

        // Display all signatures grouped by page
        displaySignaturesGrouped(data.pages);

        const methodLabel = detectionMethod === 'llm' ? '(LLM)' : '(YOLOv8)';
        updateStatus(`Processed ${data.totalPages} pages, found ${data.totalSignatures} total signature(s) ${methodLabel}`);
    } catch (error) {
        updateStatus(error.message, true);
        console.error('Error:', error);
    } finally {
        hideLoading();
    }
});

// Display single page from multi-page PDF
function displayPage(index) {
    if (index < 0 || index >= currentPages.length) return;

    currentPageIndex = index;
    const page = currentPages[index];

    // Display annotated image
    annotatedContainer.innerHTML = `
        <img src="data:image/png;base64,${page.annotatedImage}" alt="Page ${page.pageNum}">
    `;

    // Update page info
    pageInfo.textContent = `Page ${page.pageNum} of ${currentPages.length}`;
    pageSlider.value = page.pageNum;

    // Update metrics
    updateMetrics(page.metrics);
}

// Setup navigation controls
function setupNavigation(totalPages) {
    navControls.classList.remove('hidden');
    pageSlider.min = 1;
    pageSlider.max = totalPages;
    pageSlider.value = 1;
    pageInfo.textContent = `Page 1 of ${totalPages}`;
}

// Navigation button handlers
prevBtn.addEventListener('click', () => {
    if (currentPageIndex > 0) {
        displayPage(currentPageIndex - 1);
    }
});

nextBtn.addEventListener('click', () => {
    if (currentPageIndex < currentPages.length - 1) {
        displayPage(currentPageIndex + 1);
    }
});

pageSlider.addEventListener('input', (e) => {
    const pageNum = parseInt(e.target.value);
    displayPage(pageNum - 1);
});

// Display signatures for single file
function displaySignaturesForSinglePage(signatures) {
    signaturesSection.classList.remove('hidden');
    
    if (signatures.length === 0) {
        signaturesContainer.innerHTML = '<div class="no-signatures">No signatures detected</div>';
        return;
    }

    const html = `
        <div class="page-signatures">
            <div class="page-header">
                📄 Signatures Found: ${signatures.length}
            </div>
            <div class="page-content">
                <div class="signatures-grid">
                    ${signatures.map((sig, idx) => `
                        <div class="signature-item">
                            <img src="data:image/png;base64,${sig.image}" alt="Signature ${idx + 1}">
                            <div class="signature-confidence">
                                Signature ${idx + 1} (conf: ${(sig.confidence * 100).toFixed(1)}%)
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    signaturesContainer.innerHTML = html;
}

// Display signatures grouped by page
function displaySignaturesGrouped(pages) {
    signaturesSection.classList.remove('hidden');
    
    const html = pages.map(page => {
        const sigCount = page.signatures.length;
        const signaturesHtml = sigCount > 0
            ? page.signatures.map((sig, idx) => `
                <div class="signature-item">
                    <img src="data:image/png;base64,${sig.image}" alt="Signature ${idx + 1}">
                    <div class="signature-confidence">
                        Signature ${idx + 1} (conf: ${(sig.confidence * 100).toFixed(1)}%)
                    </div>
                </div>
            `).join('')
            : '<div class="no-signatures">No signatures detected on this page</div>';

        return `
            <div class="page-signatures">
                <div class="page-header" onclick="togglePageContent(${page.pageNum})">
                    📄 Page ${page.pageNum} - ${sigCount} signature(s) found
                </div>
                <div class="page-content" id="page-content-${page.pageNum}">
                    <div class="signatures-grid">
                        ${signaturesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    signaturesContainer.innerHTML = html;
}

// Toggle page content (collapse/expand)
function togglePageContent(pageNum) {
    const content = document.getElementById(`page-content-${pageNum}`);
    if (content) {
        content.classList.toggle('collapsed');
    }
}

// Make toggle function global
window.togglePageContent = togglePageContent;
