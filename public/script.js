// ============================================
// IKYTOOLS - GLOBAL SCRIPTS
// Brutal & Savage Edition 🔥💀
// ============================================

// Global variables
window.currentUser = null;
window.clickAudio = null;

// Initialize audio on first user interaction
function initAudio() {
    if (!window.clickAudio) {
        window.clickAudio = new Audio('/audio/click.mp3');
        window.clickAudio.preload = 'auto';
    }
}

// Play click sound with error handling
function playClick() {
    try {
        initAudio();
        window.clickAudio.currentTime = 0;
        window.clickAudio.play().catch(e => {
            console.log('Audio autoplay blocked, user interaction needed');
        });
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Format numbers with K/M/B
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Format date to readable format
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
        <div class="toast-message">${message}</div>
        <div class="toast-close" onclick="this.parentElement.remove()">✖</div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
        playClick();
    } catch (err) {
        showToast('Failed to copy!', 'error');
    }
}

// Download file from URL
function downloadFile(url, filename) {
    playClick();
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || url.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Check and update user limit
async function checkAndUpdateLimit() {
    if (!window.currentUser) return false;
    
    try {
        const response = await fetch('/api/check-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: window.currentUser.username })
        });
        const data = await response.json();
        
        if (data.allowed) {
            window.currentUser.limit = data.limit;
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            
            // Update limit badge if exists
            const limitBadge = document.getElementById('limitBadge');
            if (limitBadge) {
                limitBadge.textContent = `🎯 Limit: ${data.limit}/50`;
            }
            return true;
        } else {
            showToast(data.message || 'Limit habis! Besok lagi ya!', 'error');
            return false;
        }
    } catch (error) {
        console.error('Limit check error:', error);
        return false;
    }
}

// Use one limit (call after successful API call)
async function useLimit() {
    if (!window.currentUser) return false;
    
    try {
        const response = await fetch('/api/use-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: window.currentUser.username })
        });
        const data = await response.json();
        
        if (data.success) {
            window.currentUser.limit = data.remaining;
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            
            const limitBadge = document.getElementById('limitBadge');
            if (limitBadge) {
                limitBadge.textContent = `🎯 Limit: ${data.remaining}/50`;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Use limit error:', error);
        return false;
    }
}

// Create loading spinner
function showLoadingSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-spinner-container">
            <div class="loading-spinner"></div>
            <p>Memproses request...</p>
        </div>
    `;
}

// Create result container with animation
function showResult(containerId, content) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.style.opacity = '0';
    container.innerHTML = content;
    setTimeout(() => {
        container.style.transition = 'opacity 0.3s';
        container.style.opacity = '1';
    }, 50);
}

// Create modal dialog
function showModal(title, content, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="custom-modal-content">
            <div class="custom-modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.custom-modal').remove()">✖</button>
            </div>
            <div class="custom-modal-body">
                ${content}
            </div>
            <div class="custom-modal-footer">
                <button class="btn-cancel" onclick="this.closest('.custom-modal').remove()">Batal</button>
                <button class="btn-confirm" id="modalConfirmBtn">Konfirmasi</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    document.getElementById('modalConfirmBtn').onclick = () => {
        if (onConfirm) onConfirm();
        modal.remove();
        playClick();
    };
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate random ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Get file extension from URL
function getFileExtension(url) {
    return url.split(/[#?]/)[0].split('.').pop().trim();
}

// Check if URL is image
function isImageUrl(url) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const ext = getFileExtension(url).toLowerCase();
    return imageExtensions.includes(ext);
}

// Check if URL is video
function isVideoUrl(url) {
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
    const ext = getFileExtension(url).toLowerCase();
    return videoExtensions.includes(ext);
}

// Check if URL is audio
function isAudioUrl(url) {
    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    const ext = getFileExtension(url).toLowerCase();
    return audioExtensions.includes(ext);
}

// Render media preview
function renderMediaPreview(url, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (isImageUrl(url)) {
        container.innerHTML = `<img src="${url}" alt="Preview" class="media-preview-image">`;
    } else if (isVideoUrl(url)) {
        container.innerHTML = `<video controls class="media-preview-video"><source src="${url}" type="video/mp4"></video>`;
    } else if (isAudioUrl(url)) {
        container.innerHTML = `<audio controls class="media-preview-audio"><source src="${url}" type="audio/mpeg"></audio>`;
    } else {
        container.innerHTML = `<p>🔗 <a href="${url}" target="_blank">Link Media</a></p>`;
    }
}

// Create download button with file info
function createDownloadButton(url, filename, type = 'file') {
    return `
        <button class="download-btn" onclick="downloadFile('${url}', '${filename}'); playClick()">
            📥 Download ${type.toUpperCase()}
            <span class="download-info">${filename || 'file'}</span>
        </button>
    `;
}

// Add CSS for dynamic elements (injected)
function injectDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(30,30,46,0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            border-left: 3px solid;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .toast-notification.show {
            transform: translateX(0);
        }
        .toast-notification.success { border-left-color: #00ff88; }
        .toast-notification.error { border-left-color: #ff4757; }
        .toast-notification.info { border-left-color: #4facfe; }
        .toast-icon { font-size: 20px; }
        .toast-message { font-size: 14px; }
        .toast-close {
            cursor: pointer;
            padding: 0 5px;
            font-size: 12px;
            opacity: 0.7;
        }
        .toast-close:hover { opacity: 1; }
        
        .loading-spinner-container {
            text-align: center;
            padding: 40px;
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(102,126,234,0.3);
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .custom-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(5px);
            z-index: 20000;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .custom-modal.show {
            opacity: 1;
        }
        .custom-modal-content {
            background: #1e1e2e;
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            transform: scale(0.9);
            transition: transform 0.3s;
        }
        .custom-modal.show .custom-modal-content {
            transform: scale(1);
        }
        .custom-modal-header {
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .custom-modal-body {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
        }
        .custom-modal-footer {
            padding: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .modal-close, .btn-cancel, .btn-confirm {
            padding: 8px 20px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }
        .modal-close {
            background: transparent;
            color: white;
            font-size: 20px;
        }
        .btn-cancel {
            background: #ff4757;
            color: white;
        }
        .btn-confirm {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .media-preview-image {
            max-width: 100%;
            border-radius: 10px;
            margin: 10px 0;
        }
        .media-preview-video {
            max-width: 100%;
            border-radius: 10px;
            margin: 10px 0;
        }
        .media-preview-audio {
            width: 100%;
            margin: 10px 0;
        }
        
        .download-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
            transition: transform 0.2s;
            margin: 5px;
        }
        .download-btn:hover {
            transform: translateY(-2px);
        }
        .download-info {
            font-size: 10px;
            opacity: 0.8;
            display: block;
        }
        
        .result-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .result-item {
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            padding: 10px;
            text-align: center;
        }
        .result-item img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
        }
    `;
    document.head.appendChild(style);
}

// Auto-inject styles
injectDynamicStyles();

// Export functions for global use
window.playClick = playClick;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.showToast = showToast;
window.copyToClipboard = copyToClipboard;
window.downloadFile = downloadFile;
window.checkAndUpdateLimit = checkAndUpdateLimit;
window.useLimit = useLimit;
window.showLoadingSpinner = showLoadingSpinner;
window.showResult = showResult;
window.showModal = showModal;
window.formatFileSize = formatFileSize;
window.generateId = generateId;
window.debounce = debounce;
window.escapeHtml = escapeHtml;
window.isValidUrl = isValidUrl;
window.renderMediaPreview = renderMediaPreview;
window.createDownloadButton = createDownloadButton;
window.isImageUrl = isImageUrl;
window.isVideoUrl = isVideoUrl;
window.isAudioUrl = isAudioUrl;

console.log('[IkyGPT] Global scripts loaded! 🔥💀');