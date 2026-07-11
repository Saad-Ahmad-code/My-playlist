let songs = [];
let currentIndex = 0;
const player = document.getElementById('player');
let isRepeat = false;
let isShuffle = false;
let isPlaying = false;
let favorites = [];
let recentlyPlayed = [];
let isDarkTheme = true;
let previousVolume = 1; 
let isDraggingProgress = false;
let progressRAF = null;

// Load favorites from localStorage on startup
function loadFavoritesFromStorage() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
        try {
            const favIds = JSON.parse(stored);
            favorites = songs.filter(song => favIds.includes(song.id));
        } catch (e) {
            console.warn('Could not load favorites from storage');
        }
    }
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
    const favIds = favorites.map(fav => fav.id);
    localStorage.setItem('favorites', JSON.stringify(favIds));
}

// Load recently played from localStorage
function loadRecentlyPlayedFromStorage() {
    const stored = localStorage.getItem('recentlyPlayed');
    if (stored) {
        try {
            recentlyPlayed = JSON.parse(stored);
        } catch (e) {
            console.warn('Could not load recently played from storage');
        }
    }
}

// Save recently played to localStorage
function saveRecentlyPlayedToStorage() {
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed.slice(0, 20)));
}

// Add to recently played
function addToRecentlyPlayed(song) {
    if (!song) return;
    recentlyPlayed = recentlyPlayed.filter(s => s.id !== song.id);
    recentlyPlayed.unshift({ ...song, playedAt: new Date().toISOString() });
    recentlyPlayed = recentlyPlayed.slice(0, 20);
    saveRecentlyPlayedToStorage();
    renderRecentlyPlayed();
}

// Load theme preference
function loadThemePreference() {
    const stored = localStorage.getItem('theme');
    isDarkTheme = stored !== 'light';
    applyTheme();
}

// Toggle theme
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    applyTheme();
}

// Apply theme
function applyTheme() {
    const btn = document.getElementById('theme-toggle');
    if (isDarkTheme) {
        document.body.classList.remove('light-theme');
        btn.textContent = '☀️ Light';
    } else {
        document.body.classList.add('light-theme');
        btn.textContent = '🌙 Dark';
    }
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(event) {
    const active = document.activeElement;
    if (active.id === 'search') return;
    // Let arrow keys work normally when a slider (progress/volume) has focus
    if (active.tagName === 'INPUT' && active.type === 'range') return;

    switch(event.code) {
        case 'Space':
            event.preventDefault();
            if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
                document.activeElement.blur();
            }
            togglePlayPause();
            break;
        case 'ArrowRight':
            event.preventDefault();
            nextSong();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            prevSong();
            break;
        case 'KeyM':
            event.preventDefault();
            toggleMute();
            break;
    }
}

function toggleMute() {
    const volumeSlider = document.getElementById('volume');
    if (player.volume > 0) {
        previousVolume = player.volume;
        player.volume = 0;
    } else {
        player.volume = previousVolume || 0.5;
    }
    volumeSlider.value = player.volume;
    localStorage.setItem('volume', player.volume);
    updateVolumeUI();
}

function updateVolumeUI() {
    const muteBtn = document.getElementById('mute-toggle-btn');
    if (player.volume === 0) {
        muteBtn.textContent = '🔇 Mute';
    } else if (player.volume < 0.4) {
        muteBtn.textContent = '🔉 Vol Low';
    } else if (player.volume < 0.7) {
        muteBtn.textContent = '🔉 Vol Mid';
    } else {
        muteBtn.textContent = '🔊 Vol High';
    }
}

function startProgressLoop() {
    cancelAnimationFrame(progressRAF);
    const progressBar = document.getElementById('progress');
    const timeDisplay = document.getElementById('time-display');
    const step = () => {
        if (player.duration && !isDraggingProgress) {
            progressBar.max = Math.floor(player.duration);
            progressBar.value = Math.floor(player.currentTime);
            timeDisplay.textContent = formatTime(player.currentTime) + " / " + formatTime(player.duration);
        }
        if (!player.paused && !player.ended) {
            progressRAF = requestAnimationFrame(step);
        }
    };
    progressRAF = requestAnimationFrame(step);
}

function stopProgressLoop() {
    cancelAnimationFrame(progressRAF);
    progressRAF = null;
}

function setupPlayerControls() {
    // Handle song end
    player.addEventListener('ended', () => {
        stopProgressLoop();
        if (isRepeat) {
            player.currentTime = 0;
            player.play();
        } else {
            nextSong();
        }
    });

    // Surface playback errors (e.g. missing/broken mp3 file)
    player.addEventListener('error', () => {
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) timeDisplay.textContent = 'Unable to play this track';
        console.error('Playback error for:', songs[currentIndex] && songs[currentIndex].file);
    });

    // Volume slider — restore last-used volume, then keep label/state in sync
    const volumeSlider = document.getElementById('volume');
    const storedVolume = parseFloat(localStorage.getItem('volume'));
    if (!isNaN(storedVolume)) {
        player.volume = storedVolume;
        volumeSlider.value = storedVolume;
        if (storedVolume > 0) previousVolume = storedVolume;
    }
    updateVolumeUI();

    volumeSlider.addEventListener('input', () => {
        player.volume = volumeSlider.value;
        if (player.volume > 0) previousVolume = player.volume;
        localStorage.setItem('volume', player.volume);
        updateVolumeUI();
    });

    // Progress bar + time display (precision seeking)
    const progressBar = document.getElementById('progress');
    const timeDisplay = document.getElementById('time-display');

    player.addEventListener('loadedmetadata', () => {
        progressBar.max = Math.floor(player.duration) || 100;
    });

    player.addEventListener('timeupdate', () => {
        if (player.duration && player.paused && !isDraggingProgress) {
            progressBar.value = Math.floor(player.currentTime);
            timeDisplay.textContent = formatTime(player.currentTime) + " / " + formatTime(player.duration);
        }
    });

    progressBar.addEventListener('input', () => {
        isDraggingProgress = true;
        timeDisplay.textContent = formatTime(progressBar.value) + " / " + formatTime(player.duration);
    });

    progressBar.addEventListener('change', () => {
        player.currentTime = progressBar.value;
        isDraggingProgress = false;
        if (!player.paused) {
            startProgressLoop();
        }
    });

    // Play/pause state tracking
    player.addEventListener('play', () => {
        isPlaying = true;
        updatePlayPauseButton();
        updateAlbumArtAnimation();
        addToRecentlyPlayed(songs[currentIndex]);
        startProgressLoop();
    });

    player.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayPauseButton();
        updateAlbumArtAnimation();
        stopProgressLoop();
    });

    // Search bar with live (debounced) updates + clear button
    const searchInput = document.getElementById('search');
    const searchClear = document.getElementById('search-clear');
    let searchDebounce = null;

    const runSearch = () => {
        const query = searchInput.value.trim().toLowerCase();
        searchClear.style.display = query ? 'block' : 'none';
        const filteredSongs = songs.filter(song =>
            song.title.toLowerCase().includes(query) ||
            (song.artist && song.artist.toLowerCase().includes(query))
        );
        renderPlaylist(filteredSongs, searchInput.value.trim());
    };

    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(runSearch, 150);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        runSearch();
        searchInput.focus();
    });

    document.addEventListener('keydown', handleKeyboardShortcuts);
}

async function loadSongsData() {
    // Prefer the inline <script id="songs-data"> block — this lets the player
    // work by just double-clicking index.html, with no local server needed.
    const inline = document.getElementById('songs-data');
    if (inline && inline.textContent.trim()) {
        try {
            return JSON.parse(inline.textContent);
        } catch (e) {
            console.warn('songs-data block had invalid JSON, falling back to fetch:', e);
        }
    }
    // Fallback: fetch songs.json. Note this requires serving the page over
    // http(s):// (e.g. `npx serve` or VS Code Live Server) — most browsers
    // block fetch() of local files when the page is opened directly (file://).
    const response = await fetch('songs.json');
    if (!response.ok) throw new Error('Failed to fetch songs.json: ' + response.status);
    return response.json();
}

async function fetchAndRenderSongs() {
    songs = await loadSongsData();
    loadThemePreference();
    loadFavoritesFromStorage();
    loadRecentlyPlayedFromStorage();
    renderPlaylist(songs);
    renderRecentlyPlayed();
    renderFavorites();

    if (songs.length > 0) {
        loadSong(0);
    }
}

async function loadPlaylist() {
    setupPlayerControls();
    try {
        await fetchAndRenderSongs();
    } catch (error) {
        console.error('Error loading playlist:', error);
        const playlist = document.getElementById('playlist');
        if (playlist) {
            playlist.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>Couldn't load any songs. If you opened this file directly (file://), try running it through a local server instead — e.g. <code>npx serve</code> or VS Code's Live Server.</p>";
        }
    }
}

function renderPlaylist(songList, searchQuery) {
    const playlist = document.getElementById('playlist');
    playlist.innerHTML = "";

    if (songList.length === 0) {
        const message = document.createElement('p');
        message.style.textAlign = 'center';
        message.style.color = 'var(--text-muted)';
        message.textContent = searchQuery ? `No songs found for "${searchQuery}"` : "No songs found";
        playlist.appendChild(message);
        return;
    }

    songList.forEach((song) => {
        const actualIndex = songs.findIndex(s => s.id === song.id);
        const div = document.createElement('div');
        div.className = 'song';
        div.dataset.songId = song.id;
        if (actualIndex === currentIndex) div.classList.add('active');

        const songInfo = document.createElement('div');
        songInfo.className = 'song-info';
        songInfo.onclick = () => playSong(actualIndex);

        const title = document.createElement('div');
        title.className = 'song-title';
        title.textContent = song.title;

        const artist = document.createElement('div');
        artist.className = 'song-artist';
        artist.textContent = song.artist || "Unknown Artist";

        songInfo.appendChild(title);
        songInfo.appendChild(artist);

        const duration = document.createElement('div');
        duration.className = 'song-duration';
        duration.textContent = song.duration || '0:00';

        const actions = document.createElement('div');
        actions.className = 'song-actions';

        const favBtn = document.createElement('span');
        favBtn.className = 'favorite-btn';
        favBtn.textContent = favorites.some(f => f.id === song.id) ? "⭐" : "☆";
        favBtn.setAttribute('role', 'button');
        favBtn.setAttribute('aria-label', `Toggle favorite for ${song.title}`);
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song, favBtn);
        };

        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = "⬇️";
        downloadBtn.href = song.file;
        downloadBtn.download = song.title + ".mp3";
        downloadBtn.setAttribute('aria-label', `Download ${song.title}`);
        downloadBtn.onclick = (e) => e.stopPropagation();

        actions.appendChild(favBtn);
        actions.appendChild(downloadBtn);

        div.appendChild(songInfo);
        div.appendChild(duration);
        div.appendChild(actions);
        playlist.appendChild(div);
    });

    renderQueue();
}

function renderQueue() {
    const queue = document.getElementById('queue');
    queue.innerHTML = "";

    if (songs.length === 0) {
        queue.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No songs in queue</p>";
        return;
    }

    if (songs.length === 1) {
        queue.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No more songs in queue</p>";
        return;
    }

    // Playback wraps around (see nextSong), so the queue preview wraps too
    // instead of dead-ending near the end of the playlist.
    if (isShuffle) {
        const note = document.createElement('p');
        note.style.textAlign = 'center';
        note.style.color = 'var(--text-muted)';
        note.style.fontSize = '0.85em';
        note.style.marginBottom = '8px';
        note.textContent = '🔀 Shuffle is on — actual next song may differ from this preview';
        queue.appendChild(note);
    }

    const upcomingCount = Math.min(5, songs.length - 1);
    for (let i = 1; i <= upcomingCount; i++) {
        const wrappedIndex = (currentIndex + i) % songs.length;
        const song = songs[wrappedIndex];
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.onclick = () => playSong(wrappedIndex);

        const index = document.createElement('div');
        index.className = 'queue-item-index';
        index.textContent = i;

        const info = document.createElement('div');
        info.className = 'queue-item-info';

        const title = document.createElement('div');
        title.className = 'queue-item-title';
        title.textContent = song.title;

        const artist = document.createElement('div');
        artist.className = 'queue-item-artist';
        artist.textContent = song.artist || "Unknown Artist";

        info.appendChild(title);
        info.appendChild(artist);

        const duration = document.createElement('div');
        duration.className = 'queue-item-duration';
        duration.textContent = song.duration || '0:00';

        item.appendChild(index);
        item.appendChild(info);
        item.appendChild(duration);
        queue.appendChild(item);
    }
}

function renderRecentlyPlayed() {
    const container = document.getElementById('recently-played');
    container.innerHTML = "";

    if (recentlyPlayed.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No recently played songs</p>";
        return;
    }

    recentlyPlayed.slice(0, 12).forEach(song => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.onclick = () => {
            const index = songs.findIndex(s => s.id === song.id);
            if (index >= 0) playSong(index);
        };

        const img = document.createElement('img');
        img.className = 'recent-item-cover';
        img.loading = 'lazy';
        img.src = song.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop';
        img.alt = song.title;

        const title = document.createElement('div');
        title.className = 'recent-item-title';
        title.textContent = song.title;

        const artist = document.createElement('div');
        artist.className = 'recent-item-artist';
        artist.textContent = song.artist || "Unknown";

        const time = document.createElement('span');
        time.className = 'recent-item-time';
        time.textContent = formatPlayedTime(song.playedAt);

        div.appendChild(img);
        div.appendChild(title);
        div.appendChild(artist);
        div.appendChild(time);
        container.appendChild(div);
    });
}

function formatPlayedTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function toggleFavorite(song, btn) {
    if (favorites.some(f => f.id === song.id)) {
        favorites = favorites.filter(fav => fav.id !== song.id);
    } else {
        favorites.push(song);
    }
    saveFavoritesToStorage();
    
    // Refresh interfaces to maintain synchronization
    const searchInput = document.getElementById('search');
    const rawQuery = searchInput ? searchInput.value.trim() : '';
    const query = rawQuery.toLowerCase();
    if (query) {
        const filteredSongs = songs.filter(song =>
            song.title.toLowerCase().includes(query) ||
            (song.artist && song.artist.toLowerCase().includes(query))
        );
        renderPlaylist(filteredSongs, rawQuery);
    } else {
        renderPlaylist(songs);
    }
    renderFavorites();
}

function renderFavorites() {
    const favDiv = document.getElementById('favorites');
    favDiv.innerHTML = "";

    if (favorites.length === 0) {
        favDiv.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No favorites yet</p>";
        return;
    }

    favorites.forEach(song => {
        const div = document.createElement('div');
        div.className = 'song';

        const songInfo = document.createElement('div');
        songInfo.className = 'song-info';
        songInfo.onclick = () => {
            const index = songs.findIndex(s => s.id === song.id);
            if (index >= 0) playSong(index);
        };

        const title = document.createElement('div');
        title.className = 'song-title';
        title.textContent = song.title;

        const artist = document.createElement('div');
        artist.className = 'song-artist';
        artist.textContent = song.artist || "Unknown Artist";

        songInfo.appendChild(title);
        songInfo.appendChild(artist);

        const duration = document.createElement('div');
        duration.className = 'song-duration';
        duration.textContent = song.duration || '0:00';

        const actions = document.createElement('div');
        actions.className = 'song-actions';

        const favBtn = document.createElement('span');
        favBtn.className = 'favorite-btn active';
        favBtn.textContent = "⭐";
        favBtn.setAttribute('role', 'button');
        favBtn.setAttribute('aria-label', `Remove ${song.title} from favorites`);
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song, favBtn);
        };

        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = "⬇️";
        downloadBtn.href = song.file;
        downloadBtn.download = song.title + ".mp3";
        downloadBtn.setAttribute('aria-label', `Download ${song.title}`);
        downloadBtn.onclick = (e) => e.stopPropagation();

        actions.appendChild(favBtn);
        actions.appendChild(downloadBtn);

        div.appendChild(songInfo);
        div.appendChild(duration);
        div.appendChild(actions);
        favDiv.appendChild(div);
    });
}

function loadSong(index) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    player.src = songs[index].file;

    // Reset progress display immediately so the old song's position doesn't linger
    const progressBar = document.getElementById('progress');
    const timeDisplay = document.getElementById('time-display');
    if (progressBar) progressBar.value = 0;
    if (timeDisplay) timeDisplay.textContent = '00:00 / 00:00';

    updateNowPlaying();
    highlightCurrentSong();
    updateAlbumArtAnimation();
    renderQueue();
}

function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    loadSong(index);
    player.play().catch(error => {
        console.warn('Auto-play blocked by browser or path error:', error);
    });
}

function updatePlayPauseButton() {
    const btn = document.getElementById('play-pause-btn');
    if (btn) {
        btn.textContent = isPlaying ? "⏸ Pause" : "▶ Play";
    }
}

function togglePlayPause() {
    if (isPlaying) {
        player.pause();
    } else {
        player.play().catch(error => console.error(error));
    }
}

function nextSong() {
    if (isShuffle && songs.length > 1) {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * songs.length);
        } while (randomIndex === currentIndex);
        playSong(randomIndex);
    } else {
        currentIndex = (currentIndex + 1) % songs.length;
        playSong(currentIndex);
    }
}

function prevSong() {
    currentIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(currentIndex);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('shuffle-btn');
    if (btn) {
        btn.textContent = isShuffle ? "🔀 Shuffle (On)" : "🔀 Shuffle (Off)";
        btn.classList.toggle('active-toggle', isShuffle);
    }
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('repeat-btn');
    if (btn) {
        btn.textContent = isRepeat ? "🔁 Repeat (On)" : "🔁 Repeat (Off)";
        btn.classList.toggle('active-toggle', isRepeat);
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function highlightCurrentSong() {
    const currentSong = songs[currentIndex];
    const allSongs = document.querySelectorAll('.playlist .song');
    allSongs.forEach(s => s.classList.remove('active'));
    if (!currentSong) return;

    const match = document.querySelector(`.playlist .song[data-song-id="${currentSong.id}"]`);
    if (match) {
        match.classList.add('active');
    }
}

function updateNowPlaying() {
    const card = document.getElementById('now-playing-card');
    const title = document.getElementById('now-playing-title');
    const artist = document.getElementById('now-playing-artist');
    const albumArt = document.getElementById('album-art');

    if (songs[currentIndex]) {
        title.textContent = songs[currentIndex].title;
        artist.textContent = songs[currentIndex].artist || 'Unknown Artist';
        albumArt.src = songs[currentIndex].cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop';
        card.style.display = 'flex';
    }
}

function updateAlbumArtAnimation() {
    const albumArt = document.getElementById('album-art');
    const indicator = document.querySelector('.playing-indicator');

    if (isPlaying) {
        albumArt.classList.add('playing');
        if (indicator) indicator.classList.remove('hidden');
    } else {
        albumArt.classList.remove('playing');
        if (indicator) indicator.classList.add('hidden');
    }
}

// Initialize
loadPlaylist();