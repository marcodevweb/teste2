document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const modal = document.getElementById('media-modal');
    const modalContent = document.getElementById('modal-content-container');
    const closeModal = document.querySelector('.close-modal');

    // Make sure we have the mediaFiles from data.js
    if (typeof mediaFiles === 'undefined' || !Array.isArray(mediaFiles)) {
        postsContainer.innerHTML = '<p style="text-align:center; padding:20px;">Erro ao carregar dados do arquivo.</p>';
        return;
    }

    // Filter out files that are not media (optional, based on extension)
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.jfif'];
    let files = mediaFiles.filter(f => validExtensions.includes(f.Extension.toLowerCase()));
    
    // Sort randomly to mix photos and videos
    files.sort(() => Math.random() - 0.5);

    let currentIndex = 0;
    const postsPerLoad = 10;
    let allPosts = [];

    // --- Abre o mesmo banco usado pelo admin.js (AnnaDB) ---
    const dbRequest = indexedDB.open('AnnaDB', 1);

    dbRequest.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('posts')) {
            db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
        }
    };

    dbRequest.onerror = function() {
        initFeed([]);
    };

    dbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const tx = db.transaction(['posts'], 'readonly');
        const store = tx.objectStore('posts');
        const getAll = store.getAll();

        getAll.onsuccess = function() {
            const dbPosts = (getAll.result || []).map(post => {
                // Converte o Blob para um objectURL (zero base64, zero crash)
                const url = URL.createObjectURL(post.blob);
                return { ...post, mediaData: url, isLocal: true };
            });
            // Mais recentes primeiro
            dbPosts.sort((a, b) => b.timestamp - a.timestamp);
            initFeed(dbPosts);
        };

        getAll.onerror = function() {
            initFeed([]);
        };
    };

    function initFeed(localPosts) {
        allPosts = [
            ...localPosts,
            ...files.map(f => ({ ...f, isLocal: false }))
        ];
        console.log('Posts no feed:', allPosts.length);
        loadMorePosts();
    }


    function createPostElement(file) {
        const post = document.createElement('div');
        post.className = 'post';

        let isVideo, mediaPath, captionText, likesText;

        if (file.isLocal) {
            isVideo = file.isVideo;
            mediaPath = file.mediaData;
            captionText = file.caption || '';
            const likesCount = file.likes || 0;
            likesText = `${likesCount} curtidas`;
        } else {
            isVideo = ['.mp4', '.webm'].includes(file.Extension.toLowerCase());
            mediaPath = `ANNA conteudos/${encodeURIComponent(file.Name)}`;
            captionText = file.Name.replace(file.Extension, '');
            
            const randomLikes = Math.floor(Math.random() * 49) + 1;
            likesText = `${randomLikes},${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)} curtidas`;
        }

        const mediaHtml = isVideo 
            ? `<video class="post-media" src="${mediaPath}" controls loop></video>`
            : `<img class="post-media" src="${mediaPath}" alt="Post Content" loading="lazy">`;

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

        // Like interaction
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
        
        // Double click to like
        mediaContent.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (likeBtn.classList.contains('fa-regular')) {
                toggleLike();
            }
        });

        // Click to open modal
        mediaContent.addEventListener('click', (e) => {
            // Don't open modal if clicking on video controls
            if (e.target.tagName.toLowerCase() === 'video') return;
            
            const path = mediaContent.getAttribute('data-path');
            const type = mediaContent.getAttribute('data-type');
            
            openModal(path, type);
        });

        return post;
    }

    function loadMorePosts() {
        const fragment = document.createDocumentFragment();
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

        try {
            for (let i = currentIndex; i < end; i++) {
                if (allPosts[i]) {
                    fragment.appendChild(createPostElement(allPosts[i]));
                }
            }
            postsContainer.appendChild(fragment);
        } catch (e) {
            console.error("Error rendering posts", e);
        }
        
        currentIndex = end;

        if (currentIndex >= allPosts.length) {
            const loadingMore = document.querySelector('.loading-more');
            if (loadingMore) {
                loadingMore.style.display = 'none';
            }
        }
    }

    // Modal logic
    function openModal(path, type) {
        modalContent.innerHTML = type === 'video' 
            ? `<video src="${path}" controls autoplay loop></video>`
            : `<img src="${path}" alt="Expanded Media">`;
        modal.classList.add('active');
    }

    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        modalContent.innerHTML = ''; // Stop video
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        }
    });

    // Infinite Scroll
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 500 && currentIndex < allPosts.length) {
            loadMorePosts();
        }
    });

});
