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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentItem = { id: 37854, type: 'tv' }; // Default: One Piece

// --- AUTH & PAYWALL LOGIC ---

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        currentUser = result.user;
        document.getElementById('userInfo').innerText = `Logged in: ${currentUser.displayName}`;
        checkUserPaymentStatus(currentUser.uid);
    }).catch(err => alert("Google Login Error: " + err.message));
}

function checkUserPaymentStatus(uid) {
    db.collection("users").doc(uid).get().then(doc => {
        if (doc.exists && doc.data().isPaid === true) {
            alert("Welcome VIP User!");
            unlockSite();
        } else {
            alert("Logged in! Paki-submit ang proof of payment sa ibaba.");
        }
    });
}

function checkSecretPass() {
    const pass = document.getElementById('secretPassInput').value.trim();
    if (pass === "almaras") {
        alert("Access Granted via Secret Pass!");
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

async function submitTransaction() {
    const refNo = document.getElementById('refInput').value.trim();
    const fileInput = document.getElementById('proofInput');

    if (!currentUser) {
        alert("Pindutin muna ang Sign in with Google!");
        return;
    }
    if (!refNo) {
        alert("Pakilagay ang Reference ID!");
        return;
    }

    let base64Image = "";
    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        await new Promise(resolve => reader.onload = () => { base64Image = reader.result; resolve(); });
    }

    db.collection("transactions").add({
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName,
        referenceNumber: refNo,
        screenshot: base64Image,
        status: "Pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Transaction submitted! Hintaying i-approve ng admin.");
    }).catch(err => alert("Error: " + err.message));
}

// --- TMDB SEARCH & SELECTION LOGIC ---

async function searchTMDB() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
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
}

async function selectItem(item) {
    const isTv = item.media_type === 'tv';
    currentItem.id = item.id;
    currentItem.type = item.media_type;

    document.getElementById('cardTitle').innerText = item.title || item.name;
    document.getElementById('cardPoster').src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
    document.getElementById('cardRating').innerHTML = `&#9733; ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'} Rating`;
    
    const badge = document.getElementById('cardBadge');
    badge.innerText = isTv ? 'SERIES' : 'MOVIE';
    badge.className = `badge ${isTv ? 'badge-tv' : 'badge-movie'}`;

    const controls = document.getElementById('seriesControls');

    if (isTv) {
        controls.style.display = 'flex';
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
    } else {
        controls.style.display = 'none';
    }

    closeSearchModal();
}

// --- DYNAMIC EPISODES LOADER ---

async function loadSeasonEpisodes() {
    const seasonNumber = document.getElementById('seasonSelect').value || 1;
    const episodeSelect = document.getElementById('episodeSelect');
    episodeSelect.innerHTML = "<option>Loading ep...</option>";

    const res = await fetch(`https://api.themoviedb.org/3/tv/${currentItem.id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
    const seasonData = await res.json();

    episodeSelect.innerHTML = "";
    (seasonData.episodes || []).forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.episode_number;
        opt.innerText = `Ep ${ep.episode_number}: ${ep.name || ''}`;
        episodeSelect.appendChild(opt);
    });
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

function closeSearchModal() { 
    document.getElementById('searchModal').style.display = 'none'; 
}

function closePlayer() {
    document.getElementById('videoPlayer').src = '';
    document.getElementById('playerModal').style.display = 'none';
}

// Default load One Piece
window.onload = () => {
    selectItem({ 
        id: 37854, 
        media_type: 'tv', 
        name: 'One Piece', 
        poster_path: '/dum1NsAYVfyxGM14DYJgNf5i89q.jpg', 
        vote_average: 8.8 
    });
};