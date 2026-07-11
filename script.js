let songs = [];
let currentIndex = 0;
const player = document.getElementById('player');
let isRepeat = false;
let isShuffle = false;
let isPlaying = false;
let favorites = [];
let recentlyPlayed = [];
let isDarkTheme = true;

// Load favorites from localStorage on startup
function loadFavoritesFromStorage() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
        try {
            const favIds = JSON.parse(stored);
            favorites = songs.filter(song => favIds.includes(song.title));
        } catch (e) {
            console.log('Could not load favorites from storage');
        }
    }
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
    const favIds = favorites.map(fav => fav.title);
    localStorage.setItem('favorites', JSON.stringify(favIds));
}

// Load recently played from localStorage
function loadRecentlyPlayedFromStorage() {
    const stored = localStorage.getItem('recentlyPlayed');
    if (stored) {
        try {
            recentlyPlayed = JSON.parse(stored);
        } catch (e) {
            console.log('Could not load recently played from storage');
        }
    }
}

// Save recently played to localStorage
function saveRecentlyPlayedToStorage() {
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed.slice(0, 20)));
}

// Add to recently played
function addToRecentlyPlayed(song) {
    recentlyPlayed = recentlyPlayed.filter(s => s.title !== song.title);
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
    // Don't trigger if user is typing in search input
    if (document.activeElement.id === 'search') return;

    switch(event.code) {
        case 'Space':
            event.preventDefault();
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
        player.volume = 0;
        volumeSlider.value = 0;
    } else {
        player.volume = 0.5;
        volumeSlider.value = 0.5;
    }
}

async function loadPlaylist() {
    try {
        const response = await fetch('songs.json');
        songs = await response.json();
        loadThemePreference();
        loadFavoritesFromStorage();
        loadRecentlyPlayedFromStorage();
        renderPlaylist(songs);
        renderRecentlyPlayed();

        if (songs.length > 0) {
            playSong(0);
        }

        // Handle song end
        player.addEventListener('ended', () => {
            if (!isRepeat) nextSong();
            else player.currentTime = 0;
        });

        // Volume slider
        const volumeSlider = document.getElementById('volume');
        volumeSlider.addEventListener('input', () => {
            player.volume = volumeSlider.value;
        });

        // Progress bar + time display
        const progressBar = document.getElementById('progress');
        const timeDisplay = document.getElementById('time-display');

        player.addEventListener('timeupdate', () => {
            if (player.duration) {
                progressBar.value = (player.currentTime / player.duration) * 100;
                timeDisplay.textContent = formatTime(player.currentTime) + " / " + formatTime(player.duration);
            }
        });

        progressBar.addEventListener('input', () => {
            player.currentTime = (progressBar.value / 100) * player.duration;
        });

        // Play/pause state tracking
        player.addEventListener('play', () => {
            isPlaying = true;
            updatePlayPauseButton();
            updateAlbumArtAnimation();
            addToRecentlyPlayed(songs[currentIndex]);
        });

        player.addEventListener('pause', () => {
            isPlaying = false;
            updatePlayPauseButton();
            updateAlbumArtAnimation();
        });

        // Search bar with artist search
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filteredSongs = songs.filter(song => 
                song.title.toLowerCase().includes(query) || 
                (song.artist && song.artist.toLowerCase().includes(query))
            );
            renderPlaylist(filteredSongs);
        });

        // Add keyboard shortcuts listener
        document.addEventListener('keydown', handleKeyboardShortcuts);
    } catch (error) {
        console.error('Error loading playlist:', error);
    }
}

function renderPlaylist(songList) {
    const playlist = document.getElementById('playlist');
    playlist.innerHTML = "";

    if (songList.length === 0) {
        playlist.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No songs found</p>";
        return;
    }

    songList.forEach((song, index) => {
        const actualIndex = songs.indexOf(song);
        const div = document.createElement('div');
        div.className = 'song';
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
        favBtn.textContent = favorites.includes(song) ? "⭐" : "☆";
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song, favBtn);
        };

        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = "⬇️";
        downloadBtn.href = song.file;
        downloadBtn.download = song.title + ".mp3";
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

    for (let i = 1; i <= Math.min(5, songs.length - currentIndex - 1); i++) {
        const song = songs[currentIndex + i];
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.onclick = () => playSong(currentIndex + i);

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

    if (songs.length - currentIndex - 1 === 0) {
        queue.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>No more songs in queue</p>";
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
            const index = songs.indexOf(songs.find(s => s.title === song.title));
            if (index >= 0) playSong(index);
        };

        const img = document.createElement('img');
        img.className = 'recent-item-cover';
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
    if (favorites.includes(song)) {
        favorites = favorites.filter(fav => fav !== song);
        btn.textContent = "☆";
    } else {
        favorites.push(song);
        btn.textContent = "⭐";
    }
    saveFavoritesToStorage();
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
            const index = songs.indexOf(song);
            playSong(index);
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
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song, favBtn);
        };

        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = "⬇️";
        downloadBtn.href = song.file;
        downloadBtn.download = song.title + ".mp3";
        downloadBtn.onclick = (e) => e.stopPropagation();

        actions.appendChild(favBtn);
        actions.appendChild(downloadBtn);

        div.appendChild(songInfo);
        div.appendChild(duration);
        div.appendChild(actions);
        favDiv.appendChild(div);
    });
}

function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    player.src = songs[index].file;
    player.play();
    isPlaying = true;
    updatePlayPauseButton();
    updateNowPlaying();
    highlightCurrentSong();
    updateAlbumArtAnimation();
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
        player.play();
    }
}

function nextSong() {
    currentIndex = (currentIndex + 1) % songs.length;
    playSong(currentIndex);
}

function prevSong() {
    currentIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(currentIndex);
}

function shuffleSong() {
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * songs.length);
    } while (randomIndex === currentIndex && songs.length > 1);
    playSong(randomIndex);
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('repeat-btn');
    btn.textContent = isRepeat ? "🔁 Repeat (On)" : "🔁 Repeat (Off)";
    btn.style.opacity = isRepeat ? "1" : "0.7";
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function highlightCurrentSong() {
    const allSongs = document.querySelectorAll('.playlist .song');
    allSongs.forEach((s, idx) => s.classList.remove('active'));
    if (allSongs[currentIndex]) {
        allSongs[currentIndex].classList.add('active');
        allSongs[currentIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        indicator.classList.remove('hidden');
    } else {
        albumArt.classList.remove('playing');
        indicator.classList.add('hidden');
    }
}

// Initialize
loadPlaylist();
