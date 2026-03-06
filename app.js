/* ══════════════════════════════════════════════════════
   PORTAL SISCTE — app.js
   Firebase Storage (archivos hasta 5 GB) + Firestore
   + EmailJS (notificación PDF al usuario)
   + Panel Admin con filtros y exportación filtrada
══════════════════════════════════════════════════════ */

/* ── FIREBASE CONFIG ── */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCwOn3AxANGK1PtIEsJsM28YJv9UEqDu5U",
  authDomain:        "siscte-30f1b.firebaseapp.com",
  projectId:         "siscte-30f1b",
  storageBucket:     "siscte-30f1b.firebasestorage.app",
  messagingSenderId: "270864419518",
  appId:             "1:270864419518:web:93ed773c0bc1ad5b6b6cef"
};

/* ── EMAILJS CONFIG ─────────────────────────────────────
   1. Regístrate en https://www.emailjs.com (gratis hasta 200/mes)
   2. Crea un Service (Gmail) → copia el Service ID
   3. Crea un Template con variables:
      {{to_email}}, {{to_name}}, {{area}}, {{archivo}},
      {{fecha}}, {{hora}}, {{tamano}}
   4. Copia Public Key desde Account → API Keys
   Reemplaza los valores de abajo:
──────────────────────────────────────────────────────── */
const EMAILJS_CONFIG = {
  publicKey:  "TU_PUBLIC_KEY_EMAILJS",   // ← reemplazar
  serviceId:  "TU_SERVICE_ID",           // ← reemplazar
  templateId: "TU_TEMPLATE_ID"           // ← reemplazar
};

/* ── ADMINISTRADORES ── */
const ADMIN_EMAILS = [
  "parametrosp.cte@gmail.com",
  "iastudillol@unemi.edu.ec"
];

/* ── ÁREAS DISPONIBLES ── */
const AREAS = [
  "ZONA 5", "ZONA 6",
  "CEBAF TULCAN", "CEBAF NUEVA LOJA", "CEBAF HUAQUILLAS",
  "CEBAF MACARA", "CEBAF AREA COMPUTO NACIONAL",
  "PROV_PICHINCHA", "PROV_MANABI", "PROV_SANTO DOMINGO",
  "PROV_LOS RIOS", "PROV_BOLIVAR", "PROV_SANTA ELENA",
  "PROV_AZUAY", "PROV_EL ORO",
  "UREM", "OIAT", "EDU_VIAL", "CRV", "ECU-911"
];

/* ── Estado global ── */
let db, auth, storage, usuario = null;
let archivoSeleccionado = null;
let docsAdmin = [];           // cache para filtros
let filtroActivo = {};        // filtros aplicados

/* ══════════════════════════════════
   FIREBASE INIT (con Storage)
══════════════════════════════════ */
async function initFirebase() {
  const { initializeApp }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getFirestore, collection, addDoc, getDocs, orderBy, query, doc, getDoc }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getStorage, ref, uploadBytesResumable, getDownloadURL }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");

  const app = initializeApp(FIREBASE_CONFIG);
  db      = getFirestore(app);
  auth    = getAuth(app);
  storage = getStorage(app);

  window._fb = {
    collection, addDoc, getDocs, orderBy, query, doc, getDoc,
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
    ref, uploadBytesResumable, getDownloadURL
  };

  onAuthStateChanged(auth, u => {
    if (u) {
      usuario = { uid: u.uid, nombre: u.displayName, email: u.email, foto: u.photoURL };
      actualizarNav();
      if (esAdmin()) show('nb-admin'); else hide('nb-admin');
      irSubir();
    } else {
      usuario = null;
      actualizarNav();
      ir('vista-login');
    }
  });
}

/* ══════════════════════════════════
   AUTH
══════════════════════════════════ */
async function login() {
  try {
    const provider = new window._fb.GoogleAuthProvider();
    await window._fb.signInWithPopup(auth, provider);
  } catch(e) { toast('Error al iniciar sesión: ' + e.message, 'err'); }
}

async function logout() {
  try { await window._fb.signOut(auth); } catch(e) {}
}

const esAdmin = () =>
  usuario && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(usuario.email.toLowerCase());

/* ══════════════════════════════════
   DOM HELPERS
══════════════════════════════════ */
const $       = id => document.getElementById(id);
const show    = id => { const e=$(id); if(e) e.style.display='block'; };
const hide    = id => { const e=$(id); if(e) e.style.display='none';  };
const hideAll = () => ['vista-login','vista-subir','vista-exito','vista-admin'].forEach(hide);

function ir(v) {
  hideAll(); show(v);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (v==='vista-subir'||v==='vista-exito') $('nb-subir')?.classList.add('active');
  if (v==='vista-admin') $('nb-admin')?.classList.add('active');
}

function toast(msg, tipo='ok') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast--${tipo} toast--on`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 4000);
}

function actualizarNav() {
  if (usuario) {
    $('nav-foto').src = usuario.foto || '';
    $('nav-nombre').textContent = usuario.nombre?.split(' ')[0] || usuario.email;
    show('nav-sesion'); hide('nav-guest');
  } else {
    hide('nav-sesion'); show('nav-guest'); hide('nb-admin');
  }
}

function resetBtn() {
  const btn = $('btn-enviar');
  btn.disabled = false;
  btn.textContent = 'Enviar archivo';
}

/* ══════════════════════════════════
   POBLAR SELECT DE ÁREAS
══════════════════════════════════ */
function poblarAreas(selectId) {
  const sel = $(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecciona tu área —</option>`;
  AREAS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  });
}

/* ══════════════════════════════════
   VISTA SUBIR
══════════════════════════════════ */
function irSubir() {
  archivoSeleccionado = null;
  $('dropzone').style.display = 'flex';
  $('file-preview').style.display = 'none';
  $('progress-wrap').style.display = 'none';
  $('area-select').value = '';
  resetBtn();
  $('up-foto').src           = usuario.foto || '';
  $('up-nombre').textContent = usuario.nombre || '';
  $('up-email').textContent  = usuario.email  || '';
  ir('vista-subir');
}

document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  poblarAreas('area-select');
  poblarAreas('filtro-area');

  $('btn-google').addEventListener('click', login);
  document.querySelectorAll('.btn-logout').forEach(b => b.addEventListener('click', logout));
  $('nb-subir').addEventListener('click', () => usuario ? irSubir() : ir('vista-login'));
  $('nb-admin').addEventListener('click', () => { if (esAdmin()) { ir('vista-admin'); cargarAdmin(); } });
  $('btn-enviar-otro').addEventListener('click', irSubir);

  const dz = $('dropzone');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dz-over'); });
  dz.addEventListener('dragleave', ()  => dz.classList.remove('dz-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dz-over');
    if (e.dataTransfer.files[0]) seleccionar(e.dataTransfer.files[0]);
  });
  dz.addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', () => {
    if ($('file-input').files[0]) seleccionar($('file-input').files[0]);
  });
  $('btn-cambiar').addEventListener('click', () => {
    archivoSeleccionado = null;
    $('file-preview').style.display = 'none';
    $('dropzone').style.display = 'flex';
  });
  $('btn-enviar').addEventListener('click', enviarArchivo);

  // Filtros admin
  $('btn-filtrar').addEventListener('click', aplicarFiltros);
  $('btn-limpiar').addEventListener('click', limpiarFiltros);
  $('btn-excel').addEventListener('click', () => exportarExcel(docsAdmin));
  $('btn-excel-filtrado').addEventListener('click', exportarFiltrado);
});

/* ── VALIDACIÓN ── */
function seleccionar(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) {
    toast('Solo se aceptan archivos Excel (.xlsx o .xls)', 'err'); return;
  }
  // Firebase Storage soporta hasta 5 GB; solo avisamos si pasa de 10 MB por cortesía
  if (f.size > 10 * 1024 * 1024) {
    toast('El archivo supera 10 MB. ¿Continuar?', 'err');
  }
  archivoSeleccionado = f;
  $('fp-nombre').textContent = f.name;
  $('fp-peso').textContent   = formatSize(f.size);
  $('dropzone').style.display     = 'none';
  $('file-preview').style.display = 'flex';
}

function formatSize(bytes) {
  if (bytes >= 1024*1024) return (bytes/(1024*1024)).toFixed(2) + ' MB';
  return (bytes/1024).toFixed(1) + ' KB';
}

/* ══════════════════════════════════
   ENVÍO A FIREBASE STORAGE + FIRESTORE
══════════════════════════════════ */
async function enviarArchivo() {
  if (!archivoSeleccionado) { toast('Selecciona un archivo primero', 'err'); return; }

  const areaVal = $('area-select').value;
  if (!areaVal) { toast('Debes seleccionar tu área antes de enviar', 'err'); return; }

  const btn = $('btn-enviar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Subiendo...';

  $('progress-wrap').style.display = 'block';
  $('progress-bar').style.width = '0%';
  $('progress-txt').textContent = '0%';

  try {
    const ahora      = new Date();
    const fechaTexto = ahora.toLocaleDateString('es-EC', { timeZone:'America/Guayaquil', day:'2-digit', month:'long', year:'numeric' });
    const horaTexto  = ahora.toLocaleTimeString('es-EC', { timeZone:'America/Guayaquil', hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const storPath   = `entregas/${usuario.uid}/${ahora.getTime()}_${archivoSeleccionado.name}`;

    // ── Subir a Firebase Storage con progreso real ──
    const storRef    = window._fb.ref(storage, storPath);
    const uploadTask = window._fb.uploadBytesResumable(storRef, archivoSeleccionado);

    const downloadURL = await new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 85);
          $('progress-bar').style.width = pct + '%';
          $('progress-txt').textContent = pct + '%';
        },
        reject,
        async () => {
          const url = await window._fb.getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });

    $('progress-bar').style.width = '90%';
    $('progress-txt').textContent = '90%';

    // ── Guardar metadatos en Firestore ──
    const docRef = await window._fb.addDoc(window._fb.collection(db, "entregas"), {
      uid:           usuario.uid,
      nombre:        usuario.nombre,
      email:         usuario.email,
      foto:          usuario.foto,
      area:          areaVal,
      nombreArchivo: archivoSeleccionado.name,
      tamanoBytes:   archivoSeleccionado.size,
      tamanoTexto:   formatSize(archivoSeleccionado.size),
      storageURL:    downloadURL,
      storagePath:   storPath,
      mimeType:      archivoSeleccionado.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fechaTexto,
      horaTexto,
      timestamp:     ahora.toISOString()
    });

    $('progress-bar').style.width = '100%';
    $('progress-txt').textContent = '100%';

    // ── Mostrar vista éxito ──
    $('ex-nombre').textContent  = usuario.nombre;
    $('ex-email').textContent   = usuario.email;
    $('ex-area').textContent    = areaVal;
    $('ex-archivo').textContent = archivoSeleccionado.name;
    $('ex-fecha').textContent   = fechaTexto;
    $('ex-hora').textContent    = horaTexto;

    // ── Enviar correo de notificación ──
    await enviarCorreoNotificacion({
      nombre: usuario.nombre,
      email:  usuario.email,
      area:   areaVal,
      archivo: archivoSeleccionado.name,
      tamano: formatSize(archivoSeleccionado.size),
      fecha:  fechaTexto,
      hora:   horaTexto
    });

    setTimeout(() => ir('vista-exito'), 400);

  } catch(err) {
    console.error(err);
    toast('Error al subir: ' + err.message, 'err');
    $('progress-wrap').style.display = 'none';
    resetBtn();
  }
}

/* ══════════════════════════════════
   CORREO VÍA EMAILJS
   El template debe tener {{to_email}}, {{to_name}},
   {{area}}, {{archivo}}, {{fecha}}, {{hora}}, {{tamano}}
══════════════════════════════════ */
async function enviarCorreoNotificacion(datos) {
  try {
    // Cargar EmailJS dinámicamente
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      emailjs.init(EMAILJS_CONFIG.publicKey);
    }

    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      to_email: datos.email,
      to_name:  datos.nombre,
      area:     datos.area,
      archivo:  datos.archivo,
      tamano:   datos.tamano,
      fecha:    datos.fecha,
      hora:     datos.hora
    });

    toast('Correo de confirmación enviado ✓');
  } catch(e) {
    console.warn('EmailJS no configurado o error:', e);
    // No bloqueamos el flujo si el correo falla
  }
}

/* ══════════════════════════════════
   PANEL ADMIN
══════════════════════════════════ */
async function cargarAdmin() {
  $('tabla-body').innerHTML     = `<tr><td colspan="7" class="td-vacio">Cargando desde Firestore...</td></tr>`;
  $('admin-personas').innerHTML = `<p class="cargando-txt">Cargando...</p>`;

  try {
    const q    = window._fb.query(
      window._fb.collection(db, "entregas"),
      window._fb.orderBy("timestamp", "desc")
    );
    const snap = await window._fb.getDocs(q);
    docsAdmin  = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderAdmin(docsAdmin);
  } catch(e) {
    console.error(e);
    toast('Error al cargar: ' + e.message, 'err');
  }
}

function renderAdmin(docs) {
  const unicos = [...new Set(docs.map(d => d.email))];
  $('st-total').textContent  = docs.length;
  $('st-unicos').textContent = unicos.length;
  $('st-ultimo').textContent = docs.length
    ? `${docs[0].fechaTexto} · ${docs[0].horaTexto}`
    : 'Sin entregas aún';

  // Tarjetas personas
  const porPersona = {};
  docs.forEach(d => {
    if (!porPersona[d.email]) porPersona[d.email] = { ...d, cant: 0, areas: new Set() };
    porPersona[d.email].cant++;
    if (d.area) porPersona[d.email].areas.add(d.area);
  });

  $('admin-personas').innerHTML = Object.values(porPersona)
    .sort((a,b) => b.cant - a.cant)
    .map(p => `
      <div class="persona-row">
        <img class="persona-foto" src="${p.foto || avatar(p.nombre)}" alt="">
        <div class="persona-info">
          <div class="persona-nombre">${p.nombre || '—'}</div>
          <div class="persona-email">${p.email}</div>
          <div class="persona-ultima">Área(s): ${[...p.areas].join(', ') || '—'} · Último: ${p.fechaTexto} · ${p.horaTexto}</div>
        </div>
        <span class="persona-badge">${p.cant} archivo${p.cant>1?'s':''}</span>
      </div>`).join('') || '<p class="cargando-txt">Sin entregas aún</p>';

  // Tabla
  $('tabla-body').innerHTML = docs.length === 0
    ? `<tr><td colspan="7" class="td-vacio">No hay entregas para los filtros aplicados</td></tr>`
    : docs.map((d,i) => `
        <tr>
          <td class="td-n">${i+1}</td>
          <td>
            <div class="td-user">
              <img class="td-foto" src="${d.foto || avatar(d.nombre)}" alt="">
              <div>
                <div class="td-nombre">${d.nombre || '—'}</div>
                <div class="td-email">${d.email}</div>
              </div>
            </div>
          </td>
          <td><span class="badge-area">${d.area || '—'}</span></td>
          <td class="td-arch">
            <a href="${d.storageURL}" target="_blank" download="${d.nombreArchivo}" class="link-archivo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${d.nombreArchivo}
            </a>
          </td>
          <td class="td-peso">${d.tamanoTexto || (d.tamanoKB ? d.tamanoKB+' KB' : '—')}</td>
          <td class="td-fecha">${d.fechaTexto}</td>
          <td class="td-hora">${d.horaTexto}</td>
        </tr>`).join('');

  // Contar resultados filtrados
  $('filtro-resultado').textContent = `${docs.length} registro${docs.length!==1?'s':''} encontrado${docs.length!==1?'s':''}`;
}

/* ── FILTROS ── */
function aplicarFiltros() {
  const area    = $('filtro-area').value.toLowerCase();
  const nombre  = $('filtro-nombre').value.trim().toLowerCase();
  const email   = $('filtro-email').value.trim().toLowerCase();
  const fechaD  = $('filtro-fecha-desde').value;
  const fechaH  = $('filtro-fecha-hasta').value;

  let resultado = [...docsAdmin];

  if (area)   resultado = resultado.filter(d => (d.area||'').toLowerCase().includes(area));
  if (nombre) resultado = resultado.filter(d => (d.nombre||'').toLowerCase().includes(nombre));
  if (email)  resultado = resultado.filter(d => (d.email||'').toLowerCase().includes(email));
  if (fechaD) resultado = resultado.filter(d => d.timestamp >= new Date(fechaD).toISOString());
  if (fechaH) {
    const hasta = new Date(fechaH); hasta.setHours(23,59,59);
    resultado = resultado.filter(d => d.timestamp <= hasta.toISOString());
  }

  filtroActivo = { area, nombre, email, fechaD, fechaH };
  renderAdmin(resultado);
}

function limpiarFiltros() {
  $('filtro-area').value         = '';
  $('filtro-nombre').value       = '';
  $('filtro-email').value        = '';
  $('filtro-fecha-desde').value  = '';
  $('filtro-fecha-hasta').value  = '';
  filtroActivo = {};
  renderAdmin(docsAdmin);
}

/* ── Exportar solo lo que se ve en pantalla ── */
function exportarFiltrado() {
  // Re-aplica el filtro y exporta el resultado
  const area    = $('filtro-area').value.toLowerCase();
  const nombre  = $('filtro-nombre').value.trim().toLowerCase();
  const email   = $('filtro-email').value.trim().toLowerCase();
  const fechaD  = $('filtro-fecha-desde').value;
  const fechaH  = $('filtro-fecha-hasta').value;

  let resultado = [...docsAdmin];
  if (area)   resultado = resultado.filter(d => (d.area||'').toLowerCase().includes(area));
  if (nombre) resultado = resultado.filter(d => (d.nombre||'').toLowerCase().includes(nombre));
  if (email)  resultado = resultado.filter(d => (d.email||'').toLowerCase().includes(email));
  if (fechaD) resultado = resultado.filter(d => d.timestamp >= new Date(fechaD).toISOString());
  if (fechaH) {
    const hasta = new Date(fechaH); hasta.setHours(23,59,59);
    resultado = resultado.filter(d => d.timestamp <= hasta.toISOString());
  }

  exportarExcel(resultado, true);
}

const avatar = nombre =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=1d4ed8&color=fff`;

async function exportarExcel(docs, filtrado = false) {
  if (!window.XLSX) {
    await new Promise((res,rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const filas = docs.map((d,i) => ({
    '#': i+1,
    'Nombre': d.nombre||'—',
    'Correo': d.email,
    'Área': d.area||'—',
    'Archivo': d.nombreArchivo,
    'Tamaño': d.tamanoTexto || (d.tamanoKB ? d.tamanoKB+' KB' : '—'),
    'URL Descarga': d.storageURL || '—',
    'Fecha': d.fechaTexto,
    'Hora': d.horaTexto
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = [{wch:4},{wch:26},{wch:32},{wch:20},{wch:36},{wch:12},{wch:60},{wch:22},{wch:12}];
  const sufijo = filtrado ? '_filtrado' : '_completo';
  XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
  XLSX.writeFile(wb, `informe_SISCTE${sufijo}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Informe Excel${filtrado?' (filtrado)':''} descargado ✓`);
}
