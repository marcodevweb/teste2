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

    // Inicializa o cliente do Supabase
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

        try {
            setProgress(10, 'Iniciando upload para o Supabase...');

            // --- Upload para o Supabase Storage ---
            const mediaUrl = await uploadToSupabase(selectedFile);
            
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
            alert('Erro ao publicar: ' + (err.message || err));
            console.error(err);
            progressContainer.classList.add('hidden');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // --- Upload Direto para o Supabase ---
    async function uploadToSupabase(file) {
        setProgress(30, 'Enviando arquivo (isso pode demorar dependendo do tamanho)...');
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // O SDK do Supabase cuida do upload de arquivos grandes automaticamente
        const { data, error } = await supabaseClient.storage
            .from('midias')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw new Error('Supabase Storage: ' + error.message);
        }

        setProgress(80, 'Gerando link público...');

        // Pegar URL pública do arquivo
        const { data: publicUrlData } = supabaseClient.storage
            .from('midias')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    }

    function setProgress(percent, label) {
        progressBar.style.width = Math.min(percent, 100) + '%';
        progressPercent.textContent = Math.min(percent, 100) + '%';
        if (label) progressLabel.textContent = label;
    }
});
