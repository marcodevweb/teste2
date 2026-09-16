document.addEventListener('DOMContentLoaded', async () => {
    const postsContainer = document.getElementById('posts-container');
    const modal = document.getElementById('media-modal');
    const modalContent = document.getElementById('modal-content-container');
    const closeModal = document.querySelector('.close-modal');

    // Make sure we have the mediaFiles from data.js
    if (typeof mediaFiles === 'undefined' || !Array.isArray(mediaFiles)) {
        postsContainer.innerHTML = '<p style="text-align:center; padding:20px;">Erro ao carregar dados do arquivo.</p>';
        return;
    }

    // Filter static files
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.jfif'];
    let files = mediaFiles.filter(f => validExtensions.includes(f.Extension.toLowerCase()));
    files.sort(() => Math.random() - 0.5);

    let currentIndex = 0;
    const postsPerLoad = 10;
    let allPosts = [];

    // --- Busca posts do Firebase Realtime Database via REST ---
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/posts.json`);
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
                const fbPosts = Object.entries(data).map(([key, val]) => ({
                    ...val,
                    fbKey: key,
                    isLocal: true,
                    mediaData: val.mediaUrl  // compatibilidade com createPostElement
                }));
                fbPosts.sort((a, b) => b.timestamp - a.timestamp);
                allPosts = [
                    ...fbPosts,
                    ...files.map(f => ({ ...f, isLocal: false }))
                ];
            }
        }
    } catch (e) {
        console.error('Erro ao carregar posts do Firebase:', e);
    }

    // Se não veio nada do Firebase, usa só os estáticos
    if (allPosts.length === 0) {
        allPosts = files.map(f => ({ ...f, isLocal: false }));
    }

    console.log('Posts no feed:', allPosts.length);
    loadMorePosts();

    function createPostElement(file) {
        const post = document.createElement('div');
        post.className = 'post';

        let isVideo, mediaPath, captionText, likesText;

        if (file.isLocal) {
            isVideo = file.isVideo;
            mediaPath = file.mediaData;  // URL do Cloudinary
            captionText = file.caption || '';
            likesText = `${file.likes || 0} curtidas`;
        } else {
            isVideo = ['.mp4', '.webm'].includes(file.Extension.toLowerCase());
            mediaPath = `conteudo/${encodeURIComponent(file.Name)}`;
            captionText = file.Name.replace(file.Extension, '');
            const r = Math.floor(Math.random() * 49) + 1;
            likesText = `${r},${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)} curtidas`;
        }

        const mediaHtml = isVideo
            ? `<video class="post-media" src="${mediaPath}" controls loop></video>`
            : `<img class="post-media" src="${mediaPath}" alt="Post" loading="lazy">`;

        post.innerHTML = `
            <div class="post-header">
                <img src="SaveInta.com_688760702_18098701861922501_8266598103887159661_n.jpg" alt="User" class="post-avatar">
                <span class="post-user">annadelarosavip</span>
                <i class="fa-solid fa-ellipsis post-options"></i>
            </div>
            <div class="post-content" data-path="${mediaPath}" data-type="${isVideo ? 'video' : 'image'}">
                ${mediaHtml}
            </div>
            <div class="post-actions">
                <i class="fa-regular fa-heart like-btn"></i>
                <i class="fa-regular fa-comment"></i>
                <i class="fa-regular fa-paper-plane"></i>
                <i class="fa-regular fa-bookmark" style="margin-left: auto;"></i>
            </div>
            <div class="post-likes">${likesText}</div>
            <div class="post-caption">
                <span>annadelarosavip</span> ${captionText}
            </div>
        `;

        // Like
        const likeBtn = post.querySelector('.like-btn');
        const mediaContent = post.querySelector('.post-content');

        const toggleLike = () => {
            if (likeBtn.classList.contains('fa-regular')) {
                likeBtn.classList.remove('fa-regular');
                likeBtn.classList.add('fa-solid', 'liked');
            } else {
                likeBtn.classList.remove('fa-solid', 'liked');
                likeBtn.classList.add('fa-regular');
            }
        };

        likeBtn.addEventListener('click', toggleLike);

        mediaContent.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (likeBtn.classList.contains('fa-regular')) toggleLike();
        });

        mediaContent.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'video') return;
            openModal(mediaPath, isVideo ? 'video' : 'image');
        });

        return post;
    }

    function loadMorePosts() {
        const end = Math.min(currentIndex + postsPerLoad, allPosts.length);

        if (allPosts.length === 0 && currentIndex === 0) {
            postsContainer.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#737373;">
                    <i class="fa-regular fa-image" style="font-size:48px; color:#ff8c00; margin-bottom:16px; display:block;"></i>
                    <p style="font-size:16px; margin-bottom:16px;">Nenhuma postagem ainda.</p>
                    <a href="admin.html" style="background:#ff8c00; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600;">+ Criar Postagem</a>
                </div>
            `;
            const loadingMore = document.querySelector('.loading-more');
            if (loadingMore) loadingMore.style.display = 'none';
            return;
        }

        const fragment = document.createDocumentFragment();
        try {
            for (let i = currentIndex; i < end; i++) {
                if (allPosts[i]) fragment.appendChild(createPostElement(allPosts[i]));
            }
            postsContainer.appendChild(fragment);
        } catch (e) {
            console.error('Erro ao renderizar posts:', e);
        }

        currentIndex = end;
        const loadingMore = document.querySelector('.loading-more');
        if (loadingMore && currentIndex >= allPosts.length) {
            loadingMore.style.display = 'none';
        }
    }

    function openModal(path, type) {
        modalContent.innerHTML = type === 'video'
            ? `<video src="${path}" controls autoplay loop></video>`
            : `<img src="${path}" alt="Expanded Media">`;
        modal.classList.add('active');
    }

    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        modalContent.innerHTML = '';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        }
    });

    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 500 && currentIndex < allPosts.length) {
            loadMorePosts();
        }
    });
});
