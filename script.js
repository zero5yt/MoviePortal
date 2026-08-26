// --- CONFIGURATIONS ---
const TMDB_API_KEY = "86fd55697899e8444fa3da3ddd24518d";
const PAYPAL_LINK = "https://paypal.me/RoderickAlmaras/50PHP";
const TELEGRAM_LINK = "https://t.me/pinomaxTvVip";

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

// 🎬 TATLONG FEATURED ITEMS PARA SA CAROUSEL
const carouselList = [
    { id: 37854, type: 'tv', name: 'One Piece', poster: 'https://image.tmdb.org/t/p/w500/cMD9Ygz11yjYnzv0VgtmuNeE9mP.jpg', rating: 8.8, year: '1999' },
    { id: 1062722, type: 'movie', name: 'Frankenstein', poster: 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', rating: 8.4, year: '2025' },
    { id: 85937, type: 'tv', name: 'Demon Slayer', poster: 'https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg', rating: 8.7, year: '2019' }
];

let currentSlideIndex = 0;
let carouselTimer = null;

// --- GOOGLE AUTH & PAYWALL ---

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        currentUser = result.user;
        document.getElementById('userInfo').innerText = `Logged in: ${currentUser.displayName}`;
        updateHeaderUser(currentUser);
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

function checkSecretPass() {
    const pass = document.getElementById('secretPassInput').value.trim();
    if (pass === "almaras") {
        alert("Access Granted via Secret Pass!");
        if (!currentUser) {
            updateHeaderUser({ displayName: "Admin Roderick", photoURL: "" });
        }
        unlockSite();
    } else {
        alert("Maling Password!");
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

// --- 🌟 CAROUSEL ENGINE (FADE IN / FADE OUT) ---

function applySlide(index) {
    const item = carouselList[index];
    const container = document.getElementById('cardFadeContent');

    // 1. Fade out muna
    container.classList.add('fading');

    setTimeout(async () => {
        // 2. Palitan ang laman habang nakatago
        currentItem.id = item.id;
        currentItem.type = item.type;

        document.getElementById('cardTitle').innerText = item.name;
        document.getElementById('cardPoster').src = item.poster;
        document.getElementById('cardRating').innerHTML = `&#9733; ${item.rating} Rating (${item.year})`;

        const badge = document.getElementById('cardBadge');
        badge.innerText = item.type === 'tv' ? 'SERIES' : 'MOVIE';
        badge.className = `badge ${item.type === 'tv' ? 'badge-tv' : 'badge-movie'}`;

        const controls = document.getElementById('seriesControls');

        if (item.type === 'tv') {
            controls.style.display = 'flex';
            await loadSeasonsForTv(item.id);
        } else {
            controls.style.display = 'none';
        }

        // 3. I-update ang Active Dots
        const dots = document.querySelectorAll('.carousel-dots .dot');
        dots.forEach((d, i) => {
            d.classList.toggle('active', i === index);
        });

        // 4. Fade back in
        container.classList.remove('fading');
    }, 350);
}

function startCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % carouselList.length;
        applySlide(currentSlideIndex);
    }, 4500); // Lilipat kusa bawat 4.5 seconds
}

function manualSelectSlide(index) {
    currentSlideIndex = index;
    applySlide(index);
    startCarousel(); // I-reset ang timer pag pinindot ang dot
}

// --- TMDB SEASONS & EPISODES FETCHER ---

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

// --- TMDB SEARCH (ITITIGIL ANG CAROUSEL KAPAG MAY HINANAP NA SPECIFIC) ---

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
        filtered.forEach(item => {
            const title = item.title || item.name;
            const isTv = item.media_type === 'tv';
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/150';
            
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `
                <img src="${poster}" width="45" style="border-radius:4px;">
                <div>
                    <div style="font-weight:bold;">${title}</div>
                    <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'SERIES' : 'MOVIE'}</span>
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
    // Ititigil ang auto-slide para hindi mapalitan ang hinanap ng user
    if (carouselTimer) clearInterval(carouselTimer);
    document.getElementById('carouselDots').style.display = 'none';

    const isTv = item.media_type === 'tv';
    currentItem.id = item.id;
    currentItem.type = item.media_type;

    const container = document.getElementById('cardFadeContent');
    container.classList.add('fading');

    setTimeout(async () => {
        document.getElementById('cardTitle').innerText = item.title || item.name;
        document.getElementById('cardPoster').src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
        document.getElementById('cardRating').innerHTML = `&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'} Rating`;
        
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

        container.classList.remove('fading');
    }, 350);

    closeSearchModal();
}

// --- WATCH / PLAYER LOGIC ---

function handleWatchClick() {
    let finalUrl = "";
    if (currentItem.type === 'movie') {
        finalUrl = `https://vidup.to/movie/${currentItem.id}?autoPlay=true`;
    } else {
        const season = document.getElementById('seasonSelect').value || 1;
        const episode = document.getElementById('episodeSelect').value || 1;
        finalUrl = `https://vidup.to/tv/${currentItem.id}/${season}/${episode}?autoPlay=true`;
    }

    document.getElementById('videoPlayer').src = finalUrl;
    document.getElementById('playerModal').style.display = 'flex';
}

function closeSearchModal() { document.getElementById('searchModal').style.display = 'none'; }
function closePlayer() {
    document.getElementById('videoPlayer').src = '';
    document.getElementById('playerModal').style.display = 'none';
}

// SIMULAN ANG CAROUSEL PAGBUKAS NG SITE
window.onload = () => {
    applySlide(0);
    startCarousel();
};
