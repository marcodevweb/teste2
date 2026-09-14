document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('post-form');
    const mediaInput = document.getElementById('media');
    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    const successMessage = document.getElementById('success-message');
    const submitBtn = document.getElementById('submit-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const progressPercent = document.getElementById('progress-percent');

    let selectedFile = null;
    let isVideo = false;
    let previewObjectUrl = null;

    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB por pedaço

    // --- Preview sem base64 ---
    mediaInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);

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

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!selectedFile) {
            alert('Por favor, selecione uma foto ou vídeo.');
            return;
        }

        submitBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        setProgress(0, 'Iniciando upload...');

        try {
            const mediaUrl = await uploadChunked(selectedFile);

            setProgress(100, 'Salvando postagem...');

            const caption = document.getElementById('caption').value;
            const likes = parseInt(document.getElementById('likes').value || '0', 10);

            const newPost = {
                mediaUrl: mediaUrl,
                isVideo: isVideo,
                caption: caption,
                likes: likes,
                timestamp: Date.now()
            };

            const res = await fetch(`${FIREBASE_DB_URL}/posts.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost)
            });

            if (!res.ok) {
                const errData = await res.text();
                throw new Error('Firebase: ' + errData);
            }

            // Sucesso!
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 5000);

            // Reset
            form.reset();
            selectedFile = null;
            placeholder.classList.remove('hidden');
            mediaPreview.classList.add('hidden');
            videoPreview.classList.add('hidden');
            if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
            progressContainer.classList.add('hidden');

        } catch (err) {
            alert('Erro ao publicar: ' + err.message);
            console.error(err);
            progressContainer.classList.add('hidden');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // --- Chunked upload direto na API do Cloudinary ---
    async function uploadChunked(file) {
        const resourceType = isVideo ? 'video' : 'image';
        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
        const uniqueId = generateUUID();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        let finalUrl = null;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk, file.name);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const chunkLabel = totalChunks > 1
                ? `Enviando parte ${i + 1} de ${totalChunks}...`
                : 'Enviando arquivo...';
            setProgress(Math.round((i / totalChunks) * 95), chunkLabel);

            let res;
            try {
                res = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'X-Unique-Upload-Id': uniqueId,
                        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
                    },
                    body: formData
                });
            } catch (networkErr) {
                throw new Error(`Falha de rede no chunk ${i + 1}: ${networkErr.message}`);
            }

            const data = await res.json();

            if (res.status === 200) {
                // Upload completo — último chunk retorna 200 com a URL final
                if (!data.secure_url) throw new Error('Cloudinary não retornou URL: ' + JSON.stringify(data));
                finalUrl = data.secure_url;
            } else if (res.status === 206) {
                // Chunk aceito, continua
            } else {
                throw new Error('Erro no Cloudinary: ' + (data.error ? data.error.message : JSON.stringify(data)));
            }
        }

        return finalUrl;
    }

    function setProgress(percent, label) {
        progressBar.style.width = percent + '%';
        progressPercent.textContent = percent + '%';
        if (label) progressLabel.textContent = label;
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
});
