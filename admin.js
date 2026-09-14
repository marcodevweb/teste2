document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('post-form');
    const mediaInput = document.getElementById('media');
    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    const successMessage = document.getElementById('success-message');

    let selectedFile = null;
    let isVideo = false;
    let previewObjectUrl = null;

    // --- Inicializa IndexedDB ---
    let db;
    const dbRequest = indexedDB.open('AnnaDB', 1);

    dbRequest.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains('posts')) {
            db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
        }
    };

    dbRequest.onsuccess = function(event) {
        db = event.target.result;
    };

    dbRequest.onerror = function(event) {
        console.error('Erro ao abrir IndexedDB:', event.target.error);
    };

    // --- Preview sem base64: usa createObjectURL (zero consumo de RAM extra) ---
    mediaInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Libera URL anterior
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
        }

        selectedFile = file;
        isVideo = file.type.startsWith('video/');
        previewObjectUrl = URL.createObjectURL(file);

        placeholder.classList.add('hidden');

        if (isVideo) {
            videoPreview.src = previewObjectUrl;
            videoPreview.classList.remove('hidden');
            mediaPreview.classList.add('hidden');
        } else {
            mediaPreview.src = previewObjectUrl;
            mediaPreview.classList.remove('hidden');
            videoPreview.classList.add('hidden');
        }
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!selectedFile) {
            alert('Por favor, selecione uma foto ou vídeo.');
            return;
        }

        if (!db) {
            alert('Banco de dados ainda iniciando. Aguarde um segundo e tente novamente.');
            return;
        }

        const caption = document.getElementById('caption').value;
        const likes = parseInt(document.getElementById('likes').value || '0', 10);

        // Salva o Blob (arquivo bruto) diretamente — sem base64, sem crash de memória
        const newPost = {
            blob: selectedFile,        // Blob nativo: muito mais eficiente
            mimeType: selectedFile.type,
            fileName: selectedFile.name,
            isVideo: isVideo,
            caption: caption,
            likes: likes,
            timestamp: Date.now()
        };

        const tx = db.transaction(['posts'], 'readwrite');
        const store = tx.objectStore('posts');
        const addReq = store.add(newPost);

        addReq.onsuccess = function() {
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 3000);

            // Reset
            form.reset();
            selectedFile = null;
            placeholder.classList.remove('hidden');
            mediaPreview.classList.add('hidden');
            videoPreview.classList.add('hidden');
            mediaPreview.src = '';
            videoPreview.src = '';
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = null;
            }
        };

        addReq.onerror = function(event) {
            alert('Erro ao salvar: ' + event.target.error);
        };
    });
});
