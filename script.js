// --- CONFIGURATIONS ---
const TMDB_API_KEY = "86fd55697899e8444fa3da3ddd24518d";
const PAYPAL_LINK = "https://paypal.me/RoderickAlmaras/50PHP";
const TELEGRAM_LINK = "https://t.me/pinomaxTvVip";
const OWNER_EMAIL = "roderickalmaras05@gmail.com"; // Ang iyong secure Admin Gmail

const firebaseConfig = {
    apiKey: "AIzaSyCEGHT9fn6j-Yu-uBwUneBUenmBdBf-ymM",
    authDomain: "streamixph-web.firebaseapp.com",
    databaseURL: "https://streamixph-web-default-rtdb.firebaseio.com",
    projectId: "streamixph-web",
    storageBucket: "streamixph-web.firebasestorage.app",
    messagingSenderId: "906840066024",
    appId: "1:906840066024:web:c7b05c1a5e25bb162e465d",
    measurementId: "G-S6D0NHPD6N"
};

// Initialize Firebase Realtime Database
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentItem = { id: 37854, type: 'tv' };

let trendingList = [];
let currentSlideIndex = 0;
let carouselInterval = null;

// --- GOOGLE AUTH & PAYWALL ---

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        currentUser = result.user;
        document.getElementById('userInfo').innerText = `Logged in: ${currentUser.displayName}`;
        updateHeaderUser(currentUser);

        // Auto-unlock kung ikaw ang Owner
        if (currentUser.email === OWNER_EMAIL) {
            alert("👑 Welcome Owner Roderick! VIP Unlocked.");
            unlockSite();
            return;
        }

        checkUserPaymentStatus(currentUser.uid);
    }).catch(err => alert("Google Login Error: " + err.message));
}

function checkUserPaymentStatus(uid) {
    db.ref('users/' + uid).once('value').then(snapshot => {
        if (snapshot.exists() && snapshot.val().isPaid === true) {
            alert("Welcome VIP User!");
            unlockSite();
        } else {
            alert("Logged in! I-send lamang ang PayPal Transaction ID sa ibaba.");
        }
    });
}

// 🛡️ SECURE ADMIN CHECK (Gmail-based, walang password na mananakaw)
function checkOwnerAccess() {
    if (!currentUser) {
        alert("Pindutin muna ang 'Sign In with Google' gamit ang Admin Gmail mo!");
        return;
    }
    if (currentUser.email === OWNER_EMAIL) {
        alert("👑 Owner Access Granted!");
        unlockSite();
    } else {
        alert("❌ Hindi authorized ang email na ito bilang Admin!");
    }
}

function unlockSite() {
    document.getElementById('gatekeeperModal').style.display = 'none';
}

function openPayPal() { window.open(PAYPAL_LINK, '_blank'); }
function contactDev() { window.open(TELEGRAM_LINK, '_blank'); }

function updateHeaderUser(user) {
    const avatar = document.getElementById('userAvatar');
    const welcome = document.getElementById('userWelcome');

    if (user && user.photoURL) {
        avatar.src = user.photoURL;
    }
    if (user && user.displayName) {
        const firstName = user.displayName.split(" ")[0];
        welcome.innerText = `Hi, ${firstName}!`;
    }
}

function submitTransaction() {
    const refNo = document.getElementById('refInput').value.trim();

    if (!currentUser) {
        alert("Pindutin muna ang 'Sign In with Google' sa itaas!");
        return;
    }
    if (!refNo) {
        alert("Pakilagay ang Transaction / Reference ID!");
        return;
    }

    db.ref('transactions').push({
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName,
        referenceNumber: refNo,
        status: "Pending",
        timestamp: Date.now()
    }).then(() => {
        alert("✅ SUCCESS! Naipadala na ang Transaction ID.\nHintaying i-confirm sa Admin Dashboard.");
        document.getElementById('refInput').value = "";
    }).catch(err => {
        alert("❌ Error: " + err.message);
    });
}

// --- 🌟 REAL-TIME TMDB TRENDING CAROUSEL ENGINE ---

async function fetchTrendingAndStartCarousel() {
    try {
        // Kumuha ng Top 4 Trending Movies & Series sa TMDB
        const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        
        trendingList = (data.results || [])
            .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
            .slice(0, 4);

        if (trendingList.length === 0) {
            // Fallback kung walang internet
            trendingList = [
                { id: 37854, media_type: 'tv', name: 'One Piece', poster_path: '/cMD9Ygz11yjYnzv0VgtmuNeE9mP.jpg', vote_average: 8.8, first_air_date: '1999' }
            ];
        }

        renderDots();
        showSlide(0);
        startAutoSlide();
    } catch (e) {
        console.error("Trending error:", e);
    }
}

function renderDots() {
    const dotsContainer = document.getElementById('carouselDots');
    dotsContainer.innerHTML = "";
    trendingList.forEach((_, idx) => {
        const dot = document.createElement('span');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.onclick = () => manualSelectSlide(idx);
        dotsContainer.appendChild(dot);
    });
}

async function showSlide(index) {
    if (!trendingList || trendingList.length === 0) return;
    currentSlideIndex = index;
    const item = trendingList[index];
    const container = document.getElementById('cardFadeContent');

    // 1. Fade Out
    container.classList.add('fade-out');

    setTimeout(async () => {
        // 2. Palitan ang laman habang nakatago
        const isTv = item.media_type === 'tv';
        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date || '';
        const year = date ? `(${date.split('-')[0]})` : '';

        currentItem.id = item.id;
        currentItem.type = item.media_type;

        document.getElementById('cardTitle').innerText = title;
        document.getElementById('cardPoster').src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        document.getElementById('cardRating').innerHTML = `&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'} Rating ${year}`;

        const badge = document.getElementById('cardBadge');
        badge.innerText = isTv ? 'SERIES' : 'MOVIE';
        badge.className = `badge ${isTv ? 'badge-tv' : 'badge-movie'}`;

        const controls = document.getElementById('seriesControls');
        if (isTv) {
            controls.style.display = 'flex';
            await loadSeasonsForTv(item.id);
        } else {
            controls.style.display = 'none';
        }

        // 3. I-update ang Dots
        const dots = document.querySelectorAll('.carousel-dots .dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === index));

        // 4. Fade Back In
        container.classList.remove('fade-out');
    }, 400);
}

function startAutoSlide() {
    stopAutoSlide();
    carouselInterval = setInterval(() => {
        const next = (currentSlideIndex + 1) % trendingList.length;
        showSlide(next);
    }, 4500); // Kusa lilipat bawat 4.5 seconds
}

function stopAutoSlide() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

function manualSelectSlide(index) {
    showSlide(index);
    startAutoSlide();
}

// --- TMDB SEASONS & EPISODES ---

async function loadSeasonsForTv(tvId) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}`);
        const tvData = await res.json();
        
        const seasonSelect = document.getElementById('seasonSelect');
        seasonSelect.innerHTML = "";

        (tvData.seasons || []).forEach(s => {
            if (s.season_number > 0) {
                const opt = document.createElement('option');
                opt.value = s.season_number;
                opt.innerText = `Season ${s.season_number}`;
                seasonSelect.appendChild(opt);
            }
        });

        await loadSeasonEpisodes();
    } catch (e) {}
}

async function loadSeasonEpisodes() {
    const seasonNumber = document.getElementById('seasonSelect').value || 1;
    const episodeSelect = document.getElementById('episodeSelect');
    episodeSelect.innerHTML = "<option>Loading...</option>";

    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${currentItem.id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
        const seasonData = await res.json();

        episodeSelect.innerHTML = "";
        (seasonData.episodes || []).forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.episode_number;
            opt.innerText = `Ep ${ep.episode_number}: ${ep.name || ''}`;
            episodeSelect.appendChild(opt);
        });
    } catch (e) {
        episodeSelect.innerHTML = "<option value='1'>Episode 1</option>";
    }
}

// --- 🔍 SEARCH NA MAY TAON / YEAR SA POPUP ---

async function searchTMDB() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const list = document.getElementById('searchResultsList');
        list.innerHTML = "";

        const filtered = (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        
        if (filtered.length === 0) {
            list.innerHTML = "<p style='padding:15px; color:#888;'>Walang nahanap na movie o series.</p>";
        }

        filtered.forEach(item => {
            const title = item.title || item.name;
            const isTv = item.media_type === 'tv';
            const date = item.release_date || item.first_air_date || 'N/A';
            const year = date !== 'N/A' ? date.split('-')[0] : 'N/A';
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/150';
            
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `
                <img src="${poster}" width="50" height="70" style="border-radius:4px; object-fit:cover;">
                <div class="result-info">
                    <div class="result-title-row">
                        ${title} <span class="result-year-badge">(${year})</span>
                    </div>
                    <div>
                        <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'SERIES' : 'MOVIE'}</span>
                        <span style="font-size:12px; color:#46d369; margin-left:6px;">&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                    </div>
                </div>
            `;
            div.onclick = () => selectSearchedItem(item);
            list.appendChild(div);
        });

        document.getElementById('searchModal').style.display = 'flex';
    } catch (err) {
        alert("Search error.");
    }
}

async function selectSearchedItem(item) {
    // Itigil ang carousel para manatili ang hinanap
    stopAutoSlide();
    document.getElementById('carouselDots').style.display = 'none';

    const isTv = item.media_type === 'tv';
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date || '';
    const year = date ? `(${date.split('-')[0]})` : '';

    currentItem.id = item.id;
    currentItem.type = item.media_type;

    const container = document.getElementById('cardFadeContent');
    container.classList.add('fade-out');

    setTimeout(async () => {
        document.getElementById('cardTitle').innerText = title;
        document.getElementById('cardPoster').src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
        document.getElementById('cardRating').innerHTML = `&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'} Rating ${year}`;
        
        const badge = document.getElementById('cardBadge');
        badge.innerText = isTv ? 'SERIES' : 'MOVIE';
        badge.className = `badge ${isTv ? 'badge-tv' : 'badge-movie'}`;

        const controls = document.getElementById('seriesControls');

        if (isTv) {
            controls.style.display = 'flex';
            await loadSeasonsForTv(item.id);
        } else {
            controls.style.display = 'none';
        }

        container.classList.remove('fade-out');
    }, 350);

    closeSearchModal();
}

// --- 🎬 MULTI-SERVER WATCH LOGIC (MAY SUBTITLES) ---

function handleWatchClick() {
    const server = document.getElementById('serverSelect').value;
    let finalUrl = "";

    const season = document.getElementById('seasonSelect').value || 1;
    const episode = document.getElementById('episodeSelect').value || 1;

    if (server === "1") {
        // Server 1: Vidup
        finalUrl = currentItem.type === 'movie'
            ? `https://vidup.to/movie/${currentItem.id}?autoPlay=true`
            : `https://vidup.to/tv/${currentItem.id}/${season}/${episode}?autoPlay=true`;
    } else if (server === "2") {
        // Server 2: VidSrc (Maraming Subtitles / CC button sa loob)
        finalUrl = currentItem.type === 'movie'
            ? `https://vidsrc.cc/v2/embed/movie/${currentItem.id}`
            : `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${season}/${episode}`;
    }

    document.getElementById('videoPlayer').src = finalUrl;
    document.getElementById('playerModal').style.display = 'flex';
}

function closeSearchModal() { document.getElementById('searchModal').style.display = 'none'; }
function closePlayer() {
    document.getElementById('videoPlayer').src = '';
    document.getElementById('playerModal').style.display = 'none';
}

// PAGBUKAS NG SITE: Simulan ang Trending Carousel
window.onload = () => {
    fetchTrendingAndStartCarousel();
};
