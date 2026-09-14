document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('post-form');
    const mediaInput = document.getElementById('media');
    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    const successMessage = document.getElementById('success-message');
    const submitBtn = form.querySelector('.submit-btn');

    let selectedFile = null;
    let isVideo = false;
    let previewObjectUrl = null;

    // --- Preview com createObjectURL (sem base64, sem crash) ---
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

        // Verifica se Cloudinary está configurado
        if (CLOUDINARY_CLOUD_NAME === 'SEU_CLOUD_NAME_AQUI') {
            alert('Configure o Cloudinary no arquivo firebase-config.js primeiro!\nAcesse cloudinary.com e crie uma conta gratuita.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando mídia... (pode demorar)';

        try {
            // 1. Upload do arquivo para o Cloudinary
            const mediaUrl = await uploadToCloudinary(selectedFile);

            submitBtn.textContent = 'Salvando postagem...';

            // 2. Salva os metadados no Firebase Realtime Database
            const caption = document.getElementById('caption').value;
            const likes = parseInt(document.getElementById('likes').value || '0', 10);

            const newPost = {
                mediaUrl: mediaUrl,
                isVideo: isVideo,
                fileName: selectedFile.name,
                caption: caption,
                likes: likes,
                timestamp: Date.now()
            };

            await savePostToFirebase(newPost);

            // Sucesso!
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 4000);

            // Reset form
            form.reset();
            selectedFile = null;
            placeholder.classList.remove('hidden');
            mediaPreview.classList.add('hidden');
            videoPreview.classList.add('hidden');
            mediaPreview.src = '';
            videoPreview.src = '';
            if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

        } catch (err) {
            alert('Erro ao publicar: ' + err.message);
            console.error(err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publicar no Site';
        }
    });

    // --- Upload para o Cloudinary via REST (sem SDK, sem npm) ---
    async function uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
            { method: 'POST', body: formData }
        );

        if (!res.ok) throw new Error('Falha no upload para o Cloudinary.');
        const data = await res.json();
        if (data.error) throw new Error('Cloudinary: ' + data.error.message);
        return data.secure_url;
    }

    // --- Salva post no Firebase Realtime Database via REST (sem SDK, sem npm) ---
    async function savePostToFirebase(post) {
        const res = await fetch(`${FIREBASE_DB_URL}/posts.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post)
        });

        if (!res.ok) throw new Error('Falha ao salvar no Firebase.');
        return res.json();
    }
});
