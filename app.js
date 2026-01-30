/**
 * Voice2Text Pro Application Logic
 */

// DOM Elements
const recordButton = document.getElementById('recordButton');
const statusIndicator = document.getElementById('statusIndicator');
const transcriptionArea = document.getElementById('transcription');
const copyButton = document.getElementById('copyButton');
const webhookInput = document.getElementById('webhookUrl');

// State Variables
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Configuration
const MIME_TYPE = 'audio/webm'; // WebM is the standard format supported by MediaRecorder

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('عذراً، المتصفح لا يدعم تسجيل الصوت.');
        recordButton.disabled = true;
    }
});

// Event Listeners
recordButton.addEventListener('click', toggleRecording);
copyButton.addEventListener('click', copyToClipboard);

/**
 * Toggles the recording state
 */
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

/**
 * Starts audio recording
 */
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = handleRecordingStop;

        mediaRecorder.start();
        isRecording = true;
        updateUIState('recording');

    } catch (err) {
        console.error('Error accessing microphone:', err);
        showError('فشل الوصول للميكروفون. تأكد من السماح بالأذن.');
    }
}

/**
 * Stops audio recording
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // Stop all tracks to release microphone
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
}

/**
 * Handles logic after recording stops
 */
async function handleRecordingStop() {
    updateUIState('processing');

    const audioBlob = new Blob(audioChunks, { type: MIME_TYPE });

    // Validate Webhook URL
    const webhookUrl = webhookInput.value.trim();
    if (!webhookUrl || webhookUrl.includes('example.com')) {
        showError('الرجاء إدخال رابط Webhook صحيح.');
        return;
    }

    await sendAudioToWebhook(audioBlob, webhookUrl);
}

/**
 * Sends audio blob to N8N webhook.
 * For HTTPS cloud URLs, connects directly (N8N cloud allows CORS).
 * For localhost URLs, uses the local proxy.
 */
async function sendAudioToWebhook(audioBlob, targetUrl) {
    const formData = new FormData();
    // Try 'file' as the field name (common in file uploads)
    formData.append('file', audioBlob, 'recording.webm');

    // Debug: Log what we're sending
    console.log('[Debug] Audio blob size:', audioBlob.size, 'bytes');
    console.log('[Debug] Audio blob type:', audioBlob.type);

    // Determine if we need to use proxy (only for localhost)
    const useProxy = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
    const requestUrl = useProxy ? `/proxy?url=${encodeURIComponent(targetUrl)}` : targetUrl;

    console.log(`[Upload] Sending to: ${requestUrl} (proxy: ${useProxy})`);

    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText.substring(0, 100)}`);
        }

        // Try to parse as JSON first, fallback to plain text
        const contentType = response.headers.get('content-type');
        let data;

        try {
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // If not JSON, treat as plain text
                const textResponse = await response.text();
                data = { text: textResponse };
            }
        } catch (e) {
            // If JSON parsing fails, treat as plain text
            const textResponse = await response.text();
            data = { text: textResponse };
        }

        // Debug: Show what N8N actually returned
        console.log('[Debug] N8N Response:', JSON.stringify(data, null, 2));

        if (data.text) {
            // Standard response with transcribed text
            transcriptionArea.value = data.text;
            updateUIState('ready');
        } else if (data.message === "Workflow was started") {
            // N8N accepted the request and started processing
            transcriptionArea.value = "✅ تم إرسال التسجيل بنجاح!\n\nN8N بدأ معالجة الملف الصوتي.\n\nملاحظة: الـ Workflow مضبوط على 'Don't Wait for Response'، لذلك لن نستقبل النص المحول مباشرة.\n\nلتلقي النص المحول:\n1. اذهب لإعدادات Webhook في N8N\n2. غير Response Mode إلى 'When Last Node Finishes'\n3. أضف عقدة 'Respond to Webhook' في النهاية\n4. ضع فيها: { \"text\": \"النص المحول\" }";
            updateUIState('ready');
        } else {
            throw new Error('Response format invalid (missing "text" field)');
        }

    } catch (error) {
        console.error('Upload failed:', error);

        // --- DEMO MODE / SIMULATION ---
        if (targetUrl.includes('example.com') || targetUrl.includes('your-n8n-instance')) {
            console.log('Simulating successful response for demo...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            transcriptionArea.value = "هذا نص تجريبي للمحاكاة.\nتم قبول التسجيل الصوتي، ولكن بما أنك لم تضع رابط N8N حقيقي، فهذا رد تلقائي لترية كيف يعمل التطبيق.\n\nThis is a demo response.";
            updateUIState('ready');
            return;
        }

        showError(`فشل الاتصال: ${error.message}`);
    }
}

/**
 * UI State Management
 * @param {string} state - 'ready', 'recording', 'processing'
 */
function updateUIState(state) {
    statusIndicator.className = 'status-indicator'; // Reset classes
    recordButton.className = 'record-btn';

    switch (state) {
        case 'ready':
            statusIndicator.textContent = 'جاهز للتسجيل';
            statusIndicator.classList.add('ready');
            recordButton.innerHTML = getMicIcon();
            break;
        case 'recording':
            statusIndicator.textContent = 'جارٍ التسجيل... (اضغط للإيقاف)';
            statusIndicator.classList.add('recording');
            recordButton.classList.add('recording');
            recordButton.innerHTML = getStopIcon();
            break;
        case 'processing':
            statusIndicator.textContent = 'جارٍ المعالجة والتحويل...';
            statusIndicator.classList.add('processing');
            recordButton.disabled = true; // Prevent clicks while processing
            recordButton.style.opacity = '0.5';
            break;
    }

    if (state !== 'processing') {
        recordButton.disabled = false;
        recordButton.style.opacity = '1';
    }
}

/**
 * Shows error message briefly
 */
function showError(msg) {
    statusIndicator.textContent = msg;
    statusIndicator.className = 'status-indicator';
    statusIndicator.style.color = 'var(--error-color)';
}

/**
 * Copy to clipboard
 */
function copyToClipboard() {
    const text = transcriptionArea.value;
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '✨ تم النسخ';
            setTimeout(() => {
                copyButton.innerHTML = originalText;
            }, 2000);
        });
    }
}

// Icons
function getMicIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 14C14.2091 14 16 12.2091 16 10V4C16 1.79086 14.2091 0 12 0C9.79086 0 8 1.79086 8 4V10C8 12.2091 9.79086 14 12 14Z" fill="currentColor"/>
            <path d="M19 10V11C19 14.866 15.866 18 12 18C8.13401 18 5 14.866 5 11V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 18V22M8 22H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
}

function getStopIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>`;
}
