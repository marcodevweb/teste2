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
    const compressNote = document.getElementById('compress-note');

    let selectedFile = null;
    let isVideo = false;
    let previewObjectUrl = null;

    const MAX_UPLOAD_SIZE = 95 * 1024 * 1024; // 95MB — seguro abaixo do limite Cloudinary

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

        let fileToUpload = selectedFile;

        try {
            // --- Comprimir vídeo se for grande ---
            if (isVideo && selectedFile.size > MAX_UPLOAD_SIZE) {
                setProgress(5, 'Comprimindo vídeo...');
                compressNote.style.display = 'block';
                fileToUpload = await compressVideo(selectedFile);
                compressNote.style.display = 'none';
                setProgress(40, 'Compressão concluída! Enviando...');
            } else {
                setProgress(5, 'Preparando upload...');
            }

            // --- Upload para o Cloudinary ---
            const mediaUrl = await uploadToCloudinary(fileToUpload);
            setProgress(90, 'Salvando postagem...');

            // --- Salva no Firebase ---
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

            setProgress(100, 'Publicado!');
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 5000);

            // Reset
            form.reset();
            selectedFile = null;
            placeholder.classList.remove('hidden');
            mediaPreview.classList.add('hidden');
            videoPreview.classList.add('hidden');
            if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
            setTimeout(() => progressContainer.classList.add('hidden'), 2000);

        } catch (err) {
            alert('Erro ao publicar: ' + err.message);
            console.error(err);
            progressContainer.classList.add('hidden');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // --- Compressão de vídeo com FFmpeg.wasm ---
    async function compressVideo(file) {
        if (typeof FFmpeg === 'undefined') {
            throw new Error('FFmpeg não carregou. Verifique sua conexão e tente recarregar a página.');
        }

        const { FFmpeg: FFmpegClass } = FFmpeg;
        const { fetchFile } = FFmpegUtil;

        const ffmpeg = new FFmpegClass();

        ffmpeg.on('progress', ({ progress }) => {
            const pct = Math.round(5 + progress * 35); // de 5% a 40%
            setProgress(pct, `Comprimindo vídeo: ${Math.round(progress * 100)}%`);
        });

        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        });

        const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
        const outputName = 'output.mp4';

        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Comprime para H.264 com qualidade CRF 28 (bom balanço tamanho/qualidade)
        await ffmpeg.exec([
            '-i', inputName,
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'fast',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ]);

        const data = await ffmpeg.readFile(outputName);
        const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

        console.log(`Vídeo comprimido: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressedBlob.size / 1024 / 1024).toFixed(1)}MB`);

        return new File([compressedBlob], 'video_comprimido.mp4', { type: 'video/mp4' });
    }

    // --- Upload simples para Cloudinary (arquivo já está abaixo de 95MB) ---
    async function uploadToCloudinary(file) {
        const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        let res;
        try {
            res = await fetch(uploadUrl, { method: 'POST', body: formData });
        } catch (err) {
            throw new Error('Falha de rede: ' + err.message);
        }

        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error('Cloudinary: ' + (data.error ? data.error.message : JSON.stringify(data)));
        }

        return data.secure_url;
    }

    function setProgress(percent, label) {
        progressBar.style.width = Math.min(percent, 100) + '%';
        progressPercent.textContent = Math.min(percent, 100) + '%';
        if (label) progressLabel.textContent = label;
    }
});
