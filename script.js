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

function openPayPal() {
    window.open(PAYPAL_LINK, '_blank');
}

function contactDev() {
    window.open(TELEGRAM_LINK, '_blank');
}

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

// 🚀 DIRECT SEND SA REALTIME DATABASE (WALANG SABLAY!)
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

// --- TMDB SEARCH & UI ---

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
            div.onclick = () => selectItem(item);
            list.appendChild(div);
        });

        document.getElementById('searchModal').style.display = 'flex';
    } catch (err) {
        alert("Search error.");
    }
}

async function selectItem(item) {
    const isTv = item.media_type === 'tv';
    currentItem.id = item.id;
    currentItem.type = item.media_type;

    document.getElementById('cardTitle').innerText = item.title || item.name;
    document.getElementById('cardPoster').src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
    document.getElementById('cardRating').innerHTML = `&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'} Rating`;
    
    const badge = document.getElementById('cardBadge');
    badge.innerText = isTv ? 'SERIES' : 'MOVIE';
    badge.className = `badge ${isTv ? 'badge-tv' : 'badge-movie'}`;

    const controls = document.getElementById('seriesControls');

    if (isTv) {
        controls.style.display = 'flex';
        try {
            const res = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}`);
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

            loadSeasonEpisodes();
        } catch (e) {}
    } else {
        controls.style.display = 'none';
    }

    closeSearchModal();
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

// Auto-load One Piece
window.onload = async () => {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/37854?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        selectItem({
            id: data.id,
            media_type: 'tv',
            name: data.name,
            poster_path: data.poster_path,
            vote_average: data.vote_average
        });
    } catch (e) {}
};
