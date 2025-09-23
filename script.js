class QRGenerator {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.qrDisplay = document.getElementById('qrDisplay');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.currentQRCode = null;
        this.libraryLoaded = false;

        this.checkLibraryAndInit();
    }

    checkLibraryAndInit() {
        // Check if QR code library is loaded
        if (typeof qrcode !== 'undefined') {
            this.libraryLoaded = true;
            this.initEventListeners();
            this.setInitialValue();
        } else {
            // Wait a bit more for library to load
            setTimeout(() => {
                if (typeof qrcode !== 'undefined') {
                    this.libraryLoaded = true;
                    this.initEventListeners();
                    this.setInitialValue();
                } else {
                    this.showError('QR code library failed to load. Please refresh the page.');
                }
            }, 1000);
        }
    }

    initEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generateQRCode());
        this.downloadBtn.addEventListener('click', () => this.downloadQRCode());

        // Generate on Enter key
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateQRCode();
            }
        });

        // Auto-generate on input change (with debounce)
        let timeout;
        this.textInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (this.textInput.value.trim()) {
                    this.generateQRCode();
                }
            }, 500);
        });
    }

    setInitialValue() {
        // Set example.com as default
        this.textInput.value = 'https://example.com';
        // Generate initial QR code
        setTimeout(() => this.generateQRCode(), 100);
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.successMessage.style.display = 'none';
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
        this.errorMessage.style.display = 'none';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.successMessage.style.display = 'none';
        }, 3000);
    }

    hideMessages() {
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }

    generateQRCode() {
        const inputText = this.textInput.value.trim();

        if (!inputText) {
            this.showError('Please enter some text or a URL');
            return;
        }

        if (!this.libraryLoaded) {
            this.showError('QR code library is still loading. Please wait a moment and try again.');
            return;
        }

        try {
            // Show loading state
            this.generateBtn.innerHTML = '<span class="loading"></span>Generating...';
            this.generateBtn.disabled = true;

            // Create QR code - using the correct function name
            const qr = qrcode(0, 'M'); // Medium error correction
            qr.addData(inputText);
            qr.make();

            // Create image with custom styling
            const cellSize = 8;
            const margin = 20;
            const qrImg = qr.createImgTag(cellSize, margin, "QR Code");

            // Update display
            this.qrDisplay.innerHTML = qrImg;

            // Store current QR code for download
            this.currentQRCode = qr;

            // Enable download button
            this.downloadBtn.disabled = false;

            this.hideMessages();

        } catch (error) {
            this.showError('Error generating QR code: ' + error.message);
            console.error('QR Generation Error:', error);
        } finally {
            // Reset button state
            this.generateBtn.innerHTML = 'Generate QR Code';
            this.generateBtn.disabled = false;
        }
    }

    downloadQRCode() {
        if (!this.currentQRCode) {
            this.showError('Please generate a QR code first');
            return;
        }

        try {
            // Create canvas for download
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const cellSize = 10;
            const margin = 40;
            const moduleCount = this.currentQRCode.getModuleCount();
            const size = moduleCount * cellSize + margin * 2;

            canvas.width = size;
            canvas.height = size;

            // Fill background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            // Draw QR code
            ctx.fillStyle = '#000000';
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (this.currentQRCode.isDark(row, col)) {
                        ctx.fillRect(
                            col * cellSize + margin,
                            row * cellSize + margin,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }

            // Download
            const link = document.createElement('a');
            link.download = `qrcode-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            this.showSuccess('QR code downloaded successfully!');

        } catch (error) {
            this.showError('Error downloading QR code. Please try again.');
            console.error('Download Error:', error);
        }
    }
}

// Initialize when page loads and library is ready
function initApp() {
    if (typeof qrcode !== 'undefined') {
        new QRGenerator();
    } else {
        // Wait for library to load
        setTimeout(initApp, 100);
    }
}

document.addEventListener('DOMContentLoaded', initApp);