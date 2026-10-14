/* RunCrew — Espace Club (runcrew.fr/club)
   Dépend des SDK Firebase compat chargés dans <head> et de /js/site.js. Chargé en defer. */
// ─── Configuration Firebase Web ───
const firebaseConfig = {
  apiKey: "AIzaSyDBZN64PqkoFARkF0sFAsxcvhbVDEm8eaE",
  authDomain: "runcrew-89257.firebaseapp.com",
  projectId: "runcrew-89257",
  storageBucket: "runcrew-89257.firebasestorage.app",
  messagingSenderId: "903695840840",
  appId: "1:903695840840:web:a17bb21c91380e679a0a7d",
  databaseURL: "https://runcrew-89257-default-rtdb.firebaseio.com"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// État local du club connecté
let currentClub = null;
let currentClubId = null;
let coachesList = [];
let sessionsList = [];

// ─── Utilitaires ───
const $ = (id) => document.getElementById(id);
// Échappe tout contenu issu de la base avant insertion en HTML (anti-XSS)
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function showError(box, msg, info) {
  box.textContent = msg;
  box.classList.toggle('info', !!info);
  box.style.display = 'block';
}
function hideError(box) { box.style.display = 'none'; box.classList.remove('info'); }
function authMessage(err) {
  const map = {
    'auth/wrong-password': "Mot de passe incorrect.",
    'auth/invalid-credential': "Email ou mot de passe incorrect.",
    'auth/invalid-login-credentials': "Email ou mot de passe incorrect.",
    'auth/user-not-found': "Aucun club enregistré avec cet email.",
    'auth/invalid-email': "Format d'email invalide.",
    'auth/weak-password': "Le mot de passe doit comporter au moins 8 caractères.",
    'auth/too-many-requests': "Trop de tentatives. Réessayez dans quelques minutes.",
    'auth/network-request-failed': "Connexion impossible. Vérifiez votre accès internet.",
    'auth/email-already-in-use': "Un compte existe déjà avec cet email. Connectez-vous ou utilisez « Mot de passe oublié »."
  };
  return map[err && err.code] || (err && err.message) || "Une erreur est survenue.";
}

// ─── Onglets inscription / connexion ───
function showAuthTab(type) {
  const login = type === 'login';
  $('registerFormBox').style.display = login ? 'none' : 'block';
  $('loginFormBox').style.display = login ? 'block' : 'none';
  $('tabBtnRegister').classList.toggle('active', !login);
  $('tabBtnLogin').classList.toggle('active', login);
}
function goToAuth(type) {
  showAuthTab(type);
  $('acces').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { const f = $(type === 'login' ? 'loginEmail' : 'regClubName'); if (f) f.focus({ preventScroll: true }); }, 500);
}

// ─── Écouteur d'authentification ───
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await loadClubData(user.uid);
  } else {
    showVisitor();
  }
});

function showVisitor() {
  $('visitorView').style.display = 'block';
  $('dashboardView').style.display = 'none';
  $('navVisitorLinks').style.display = 'flex';
  $('navUserLinks').style.display = 'none';
}

// ─── Chargement des données du club ───
async function loadClubData(uid) {
  try {
    const snap = await db.collection('clubs').where('ownerUid', '==', uid).limit(1).get();
    if (snap.empty) {
      const userEmail = auth.currentUser.email;
      const snapByEmail = await db.collection('clubs').where('email', '==', userEmail).limit(1).get();
      if (!snapByEmail.empty) {
        currentClubId = snapByEmail.docs[0].id;
        currentClub = snapByEmail.docs[0].data();
      }
    } else {
      currentClubId = snap.docs[0].id;
      currentClub = snap.docs[0].data();
    }

    if (currentClub) {
      renderDashboard();
      await fetchCoaches();
      await fetchSessions();
      return true;
    }
    showVisitor();
    return false;
  } catch (err) {
    console.error("Erreur chargement club :", err);
    showVisitor();
    return false;
  }
}

// ─── Rendu du tableau de bord ───
function renderDashboard() {
  $('visitorView').style.display = 'none';
  $('dashboardView').style.display = 'block';
  $('navVisitorLinks').style.display = 'none';
  $('navUserLinks').style.display = 'flex';

  const name = currentClub.clubName || 'Votre club';
  $('navClubName').textContent = name;
  $('dashClubNameTitle').textContent = name;
  $('dashAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'C';
  $('dashCityMeta').textContent = currentClub.city || 'France';
  $('dashContactMeta').textContent = currentClub.contactName ? `Responsable : ${currentClub.contactName}` : (currentClub.email || '');
  $('dashClubCodeText').textContent = currentClub.clubCode || 'CODE';
  $('statMembersCount').textContent = currentClub.memberCount || '–';

  $('editClubName').value = currentClub.clubName || '';
  $('editCity').value = currentClub.city || '';
  $('editPostalCode').value = currentClub.postalCode || '';
  $('editContactName').value = currentClub.contactName || '';
  $('editPhone').value = currentClub.phone || '';
}

// ─── Entraîneurs ───
async function fetchCoaches() {
  if (!currentClubId) return;
  try {
    const coachesSnap = await db.collection('clubs').doc(currentClubId).collection('coaches').get();
    coachesList = [];
    coachesSnap.forEach(doc => coachesList.push({ id: doc.id, ...doc.data() }));

    // Premier coach saisi à l'inscription mais pas encore créé en sous-document
    if (coachesList.length === 0 && currentClub.coachesRaw) {
      const rawCoach = currentClub.coachesRaw;
      const data = { firstname: rawCoach, lastname: '', specialty: 'Entraîneur référent', phone: currentClub.phone || '' };
      const ref = await db.collection('clubs').doc(currentClubId).collection('coaches').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      coachesList.push({ id: ref.id, ...data });
    }
    renderCoachesList();
  } catch (err) {
    console.error("Erreur chargement entraîneurs :", err);
  }
}

function renderCoachesList() {
  const grid = $('coachesListGrid');
  const selectEl = $('sessionCoachSelect');
  grid.innerHTML = '';
  selectEl.innerHTML = '';
  $('coachesCount').textContent = coachesList.length;
  $('statCoachesCount').textContent = coachesList.length;

  if (coachesList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        Aucun entraîneur enregistré pour le moment.<br>
        <button class="btn btn-primary btn-sm" type="button" data-action="openAddCoachModal">Ajouter votre premier entraîneur</button>
      </div>`;
    return;
  }

  coachesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.firstname;
    opt.textContent = `${c.firstname} (${c.specialty || 'Entraîneur'})`;
    selectEl.appendChild(opt);

    const card = document.createElement('div');
    card.className = 'coach-card';
    card.innerHTML = `
      <div>
        <div class="coach-card-top">
          <div class="coach-avatar" aria-hidden="true">${esc((c.firstname || '?').charAt(0).toUpperCase())}</div>
          <div>
            <div class="coach-name">${esc(c.firstname)} ${esc(c.lastname || '')}</div>
            <div class="coach-role">${esc(c.specialty || 'Entraîneur')}</div>
          </div>
        </div>
        <div class="coach-details">
          <span>${esc(c.phone || 'Contact non renseigné')}</span>
          <span class="on">Cockpit terrain activé</span>
        </div>
      </div>
      <div class="coach-actions">
        <button class="btn btn-danger btn-xs" type="button" data-coach="${esc(c.id)}">Retirer du club</button>
      </div>`;
    card.querySelector('[data-coach]').addEventListener('click', () => deleteCoach(c.id));
    grid.appendChild(card);
  });
}

// ─── Séances ───
async function fetchSessions() {
  if (!currentClubId) return;
  try {
    const snap = await db.collection('clubs').doc(currentClubId).collection('sessions').get();
    sessionsList = [];
    snap.forEach(doc => sessionsList.push({ id: doc.id, ...doc.data() }));
    sessionsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderSessionsList();
  } catch (err) {
    console.error("Erreur chargement séances :", err);
  }
}

function renderSessionsList() {
  const container = $('sessionsListContainer');
  container.innerHTML = '';
  $('sessionsCount').textContent = sessionsList.length;
  $('statSessionsCount').textContent = sessionsList.length;

  if (sessionsList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Aucune séance planifiée. Programmez la première : vos licenciés la verront dans l'application.<br>
        <button class="btn btn-primary btn-sm" type="button" data-action="openAddSessionModal">Programmer une séance</button>
      </div>`;
    return;
  }

  sessionsList.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML = `
      <div class="session-main">
        <div class="session-date-badge">
          <div class="session-date-day">${esc((s.day || '').slice(0, 3))}</div>
          <div class="session-date-hour">${esc(s.time || '')}</div>
        </div>
        <div class="session-info">
          <h4>${esc(s.title)}</h4>
          <p>Animée par <strong>${esc(s.coach || '—')}</strong> · ${esc(s.location || 'Lieu à préciser')}</p>
        </div>
      </div>
      <button class="btn btn-danger btn-xs" type="button" data-session="${esc(s.id)}">Supprimer</button>`;
    item.querySelector('[data-session]').addEventListener('click', () => deleteSession(s.id));
    container.appendChild(item);
  });
}

// ─── Ajout d'un entraîneur ───
$('addCoachForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fn = $('coachFirstname').value.trim();
  const ln = $('coachLastname').value.trim();
  const spec = $('coachSpecialty').value;
  const ph = $('coachPhone').value.trim();
  try {
    const ref = await db.collection('clubs').doc(currentClubId).collection('coaches').add({
      firstname: fn, lastname: ln, specialty: spec, phone: ph,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    coachesList.push({ id: ref.id, firstname: fn, lastname: ln, specialty: spec, phone: ph });
    renderCoachesList();
    closeModal('modalAddCoach');
    $('addCoachForm').reset();
  } catch (err) {
    alert("Erreur lors de l'ajout : " + err.message);
  }
});

async function deleteCoach(coachId) {
  if (!confirm("Retirer cet entraîneur de votre club ?")) return;
  try {
    await db.collection('clubs').doc(currentClubId).collection('coaches').doc(coachId).delete();
    coachesList = coachesList.filter(c => c.id !== coachId);
    renderCoachesList();
  } catch (err) {
    alert("Erreur lors de la suppression : " + err.message);
  }
}

// ─── Ajout d'une séance ───
$('addSessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    title: $('sessionTitle').value.trim(),
    day: $('sessionDay').value,
    time: $('sessionTime').value.trim(),
    coach: $('sessionCoachSelect').value,
    location: $('sessionLocation').value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    const ref = await db.collection('clubs').doc(currentClubId).collection('sessions').add(data);
    sessionsList.unshift({ id: ref.id, ...data });
    renderSessionsList();
    closeModal('modalAddSession');
    $('addSessionForm').reset();
  } catch (err) {
    alert("Erreur lors de la programmation : " + err.message);
  }
});

async function deleteSession(sessionId) {
  if (!confirm("Supprimer cette séance du calendrier ?")) return;
  try {
    await db.collection('clubs').doc(currentClubId).collection('sessions').doc(sessionId).delete();
    sessionsList = sessionsList.filter(s => s.id !== sessionId);
    renderSessionsList();
  } catch (err) {
    alert("Erreur lors de la suppression : " + err.message);
  }
}

// ─── Code club ───
function openEditCodeModal() {
  if (!currentClub) return;
  $('newCustomCode').value = currentClub.clubCode || '';
  hideError($('editCodeError'));
  openModal('modalEditCode');
}

$('editCodeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = $('editCodeError');
  const newCode = $('newCustomCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (newCode.length < 4) { showError(errBox, "Le code doit comporter au moins 4 lettres ou chiffres."); return; }
  try {
    // Unicité : un autre club ne doit pas déjà utiliser ce code
    const dup = await db.collection('clubs').where('clubCode', '==', newCode).limit(1).get();
    if (!dup.empty && dup.docs[0].id !== currentClubId) { showError(errBox, "Ce code est déjà utilisé par un autre club. Choisissez-en un autre."); return; }
    await db.collection('clubs').doc(currentClubId).update({ clubCode: newCode, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    currentClub.clubCode = newCode;
    $('dashClubCodeText').textContent = newCode;
    closeModal('modalEditCode');
  } catch (err) {
    showError(errBox, "Erreur lors de la mise à jour : " + err.message);
  }
});

function copyClubInviteText() {
  const code = currentClub.clubCode || 'CODE';
  const name = currentClub.clubName || 'notre club';
  const msg = `Rejoins les entraînements de ${name} sur l'application RunCrew !\n\n1. Télécharge RunCrew sur Google Play (Android)\n2. Ouvre l'onglet « Club » et entre notre code : ${code}\n3. C'est 100 % gratuit pour tous les licenciés.\n\nÀ très vite sur la piste !`;
  const done = () => alert("Message d'invitation copié. Vous pouvez le coller dans votre groupe WhatsApp ou un email.");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(done).catch(() => prompt("Copiez votre message d'invitation :", msg));
  } else {
    prompt("Copiez votre message d'invitation :", msg);
  }
}

// ─── Coordonnées du club ───
$('clubSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('editClubName').value.trim();
  const city = $('editCity').value.trim();
  const postal = $('editPostalCode').value.trim();
  const contact = $('editContactName').value.trim();
  const phone = $('editPhone').value.trim();
  try {
    await db.collection('clubs').doc(currentClubId).update({
      clubName: name, city, postalCode: postal, contactName: contact, phone,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    Object.assign(currentClub, { clubName: name, city, postalCode: postal, contactName: contact, phone });
    renderDashboard();
    const s = $('editClubSuccess');
    s.style.display = 'block';
    setTimeout(() => { s.style.display = 'none'; }, 3000);
  } catch (err) {
    alert("Erreur lors de la mise à jour : " + err.message);
  }
});

// ─── Inscription ───
$('clubRegisterForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  const btn = $('regSubmitBtn');
  const errBox = $('regErrorBox');
  hideError(errBox);
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Création de votre espace club…";

  const clubName = $('regClubName').value.trim();
  const clubType = $('regClubType').value;
  const memberCount = $('regMemberCount').value;
  const city = $('regCity').value.trim();
  const postalCode = $('regPostalCode').value.trim();
  const contactName = $('regContactName').value.trim();
  const contactRole = $('regContactRole').value;
  const email = $('regEmail').value.trim().toLowerCase();
  const phone = $('regPhone').value.trim();
  const password = $('regPassword').value;
  const firstCoach = $('regFirstCoach').value.trim();

  try {
    // 1. Compte Firebase Auth (ou connexion si le compte existe déjà)
    let userUid = null;
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      userUid = cred.user.uid;
    } catch (authErr) {
      if (authErr.code !== 'auth/email-already-in-use') throw authErr;
      const logCred = await auth.signInWithEmailAndPassword(email, password);
      userUid = logCred.user.uid;
      // Un espace club existe déjà pour ce compte : on l'ouvre au lieu d'en créer un doublon
      const existing = await db.collection('clubs').where('ownerUid', '==', userUid).limit(1).get();
      if (!existing.empty) {
        await loadClubData(userUid);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // 2. Code club généré (5 lettres du nom + 2 chiffres), vérifié unique
    const clean = clubName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    let clubCode = '';
    for (let i = 0; i < 5; i++) {
      clubCode = clean.substring(0, 5).padEnd(5, 'C') + Math.floor(10 + Math.random() * 90);
      const dup = await db.collection('clubs').where('clubCode', '==', clubCode).limit(1).get();
      if (dup.empty) break;
    }

    // 3. Document club
    const clubData = {
      clubName, clubCode, clubType, memberCount, city, postalCode,
      contactName, contactRole, email, phone, coachesRaw: firstCoach,
      ownerUid: userUid, isApproved: true, isActive: true, plan: 'pilot_free_2026',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const clubRef = await db.collection('clubs').add(clubData);
    currentClubId = clubRef.id;
    currentClub = clubData;

    if (firstCoach) {
      await db.collection('clubs').doc(clubRef.id).collection('coaches').add({
        firstname: firstCoach, specialty: 'Entraîneur référent', phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // 4. Tableau de bord
    renderDashboard();
    await fetchCoaches();
    await fetchSessions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error("Erreur inscription :", err);
    showError(errBox, authMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

// ─── Connexion ───
$('clubLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  const btn = $('loginSubmitBtn');
  const errBox = $('loginErrorBox');
  hideError(errBox);
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Connexion en cours…";

  const email = $('loginEmail').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  try {
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    const found = await loadClubData(userCred.user.uid);
    if (!found) showError(errBox, "Ce compte n'est rattaché à aucun espace club. Utilisez l'onglet « Inscrire un nouveau club ».");
  } catch (err) {
    console.error("Erreur connexion :", err);
    showError(errBox, authMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

// ─── Mot de passe oublié ───
async function sendPasswordReset() {
  const errBox = $('loginErrorBox');
  const email = $('loginEmail').value.trim().toLowerCase();
  if (!email) { showError(errBox, "Saisissez d'abord l'email du club, puis cliquez sur « Mot de passe oublié »."); $('loginEmail').focus(); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    showError(errBox, `Un email de réinitialisation a été envoyé à ${email}. Pensez à vérifier vos courriers indésirables.`, true);
  } catch (err) {
    showError(errBox, authMessage(err));
  }
}

// ─── Paramètre ?action=login ───
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'login') {
    showAuthTab('login');
    setTimeout(() => $('acces').scrollIntoView({ block: 'start' }), 50);
  }
});

// ─── Déconnexion ───
async function logoutClub() {
  if (!confirm("Vous déconnecter de votre espace club ?")) return;
  await auth.signOut();
  currentClub = null;
  currentClubId = null;
  window.location.href = '/club';
}

// ─── Onglets du tableau de bord ───
function switchDashTab(tabName) {
  const map = { coaches: 'tabCoaches', sessions: 'tabSessions', stats: 'tabStats', settings: 'tabSettings' };
  const order = Object.keys(map);
  document.querySelectorAll('.dash-tab-btn').forEach((b, i) => b.classList.toggle('active', order[i] === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === map[tabName]));
}

// ─── Modales ───
let lastFocus = null;
function openModal(id) {
  lastFocus = document.activeElement;
  const m = $(id);
  m.classList.add('active');
  const first = m.querySelector('input, select, button:not(.btn-modal-close)');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal(id) {
  $(id).classList.remove('active');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function openAddCoachModal() { openModal('modalAddCoach'); }
function openAddSessionModal() { openModal('modalAddSession'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', (e) => { if (e.target === o) closeModal(o.id); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(o => closeModal(o.id));
});

// ─── Actions déclaratives (data-action / data-arg) ───
// Remplacent les attributs onclick inline, interdits par la Content-Security-Policy (script-src 'self').
const ACTIONS = {
  goToAuth, showAuthTab, logoutClub, sendPasswordReset, switchDashTab,
  openAddCoachModal, openAddSessionModal, openEditCodeModal, closeModal, copyClubInviteText
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (typeof fn !== 'function') return;
  e.preventDefault();
  if ('arg' in el.dataset) fn(el.dataset.arg); else fn();
});
