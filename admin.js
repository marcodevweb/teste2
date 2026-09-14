document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('post-form');
    const submitBtn = document.getElementById('submit-btn');
    const successMessage = document.getElementById('success-message');
    const uploadArea = document.getElementById('upload-area');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const uploadPreview = document.getElementById('upload-preview');

    let uploadedMediaUrl = null;
    let uploadedIsVideo = false;

    // --- Abre o Cloudinary Upload Widget ao clicar na área ---
    uploadArea.addEventListener('click', () => {
        if (typeof cloudinary === 'undefined') {
            alert('Widget do Cloudinary ainda carregando. Aguarde um segundo e tente novamente.');
            return;
        }

        const widget = cloudinary.createUploadWidget(
            {
                cloudName: CLOUDINARY_CLOUD_NAME,
                uploadPreset: CLOUDINARY_UPLOAD_PRESET,
                sources: ['local'],
                multiple: false,
                maxFiles: 1,
                resourceType: 'auto',
                language: 'pt',
                text: {
                    pt: {
                        or: 'ou',
                        menu: { files: 'Meus Arquivos' },
                        selection_counter: { file: 'Arquivo' },
                        actions: {
                            upload: 'Enviar',
                            next: 'Próximo',
                            back: 'Voltar',
                            retry: 'Tentar novamente'
                        }
                    }
                }
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary widget error:', error);
                    alert('Erro no upload: ' + (error.message || JSON.stringify(error)));
                    return;
                }

                if (result && result.event === 'success') {
                    const info = result.info;
                    uploadedMediaUrl = info.secure_url;
                    uploadedIsVideo = info.resource_type === 'video';

                    // Mostra preview
                    uploadPlaceholder.style.display = 'none';
                    uploadPreview.style.display = 'block';

                    if (uploadedIsVideo) {
                        uploadPreview.innerHTML = `
                            <video src="${uploadedMediaUrl}" controls style="max-width:100%; max-height:300px; border-radius:8px;"></video>
                            <p style="color:#4caf50; margin-top:8px;">✅ Vídeo enviado com sucesso!</p>
                        `;
                    } else {
                        uploadPreview.innerHTML = `
                            <img src="${uploadedMediaUrl}" style="max-width:100%; max-height:300px; border-radius:8px; object-fit:contain;">
                            <p style="color:#4caf50; margin-top:8px;">✅ Foto enviada com sucesso!</p>
                        `;
                    }

                    submitBtn.disabled = false;
                }
            }
        );

        widget.open();
    });

    // --- Publicar post no Firebase ---
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!uploadedMediaUrl) {
            alert('Por favor, envie uma foto ou vídeo primeiro.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Publicando...';

        const caption = document.getElementById('caption').value;
        const likes = parseInt(document.getElementById('likes').value || '0', 10);

        const newPost = {
            mediaUrl: uploadedMediaUrl,
            isVideo: uploadedIsVideo,
            caption: caption,
            likes: likes,
            timestamp: Date.now()
        };

        try {
            const res = await fetch(`${FIREBASE_DB_URL}/posts.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(JSON.stringify(errData));
            }

            // Sucesso!
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 5000);

            // Reset
            form.reset();
            uploadedMediaUrl = null;
            uploadedIsVideo = false;
            uploadPlaceholder.style.display = '';
            uploadPreview.style.display = 'none';
            uploadPreview.innerHTML = '';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Publicar no Site';

        } catch (err) {
            alert('Erro ao salvar no Firebase: ' + err.message);
            console.error(err);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publicar no Site';
        }
    });
});
