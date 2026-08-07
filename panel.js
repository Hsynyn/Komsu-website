import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initYonetim, yonetimRoutes } from './panel-yonetim.js';

// Mobil uygulamayla AYNI Supabase projesi (publishable key herkese açık, güvenlik RLS'te)
const SUPABASE_URL = 'https://latrcfjexphtnqpnvscr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XQreUBjsc_VwwbtTMoQzZw_C4WXnHpo';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============ Sabitler ============ */
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TX_CATEGORIES = { fee:'Aidat', job:'İş / Bakım', other:'Diğer', fixed_expense:'Sabit Gider', maintenance:'Arıza', emergency:'Acil', late_fee:'Gecikme', rent:'Kira', asset:'Demirbaş' };
const WALLETS = { bank:'Ana Kasa (Banka)', cash:'Küçük Kasa (Nakit)', fund:'Fonlar (Birikim)' };
const MAINT_STATUS = { pending:'Bekliyor', assigned:'Atandı', in_progress:'Devam Ediyor', completed:'Tamamlandı', cancelled:'İptal' };
const JOB_STATUS = { planned:'Planlandı', in_progress:'Devam Ediyor', completed:'Tamamlandı', cancelled:'İptal' };
const PRIORITIES = { low:'Düşük', medium:'Orta', high:'Yüksek' };

/* Mobil uygulamayla birebir aynı kategori/şablon setleri */
const WALLET_CATEGORY_LABELS = {
  fee:'Aidat', job:'İş Ödemesi', fixed_expense:'Sabit Gider', maintenance:'Bakım-Onarım',
  emergency:'Acil Harcama', late_fee:'Gecikme Faizi', rent:'Kira Geliri', asset:'Demirbaş', other:'Diğer',
};
const INCOME_CATEGORIES = [
  { label:'Aidat', value:'fee' },
  { label:'Kira Geliri', value:'rent' },
  { label:'Diğer Gelir', value:'other' },
];
const EXPENSE_CATEGORIES = [
  { label:'Fatura Ödemesi', value:'fixed_expense' },
  { label:'Bakım-Onarım', value:'maintenance' },
  { label:'Acil Harcama', value:'emergency' },
  { label:'İş Ödemesi', value:'job' },
  { label:'Demirbaş', value:'asset' },
  { label:'Diğer Gider', value:'other' },
];

const RULE_CATEGORIES = [
  { id:'silence', name:'Sessizlik', icon:'🔇' },
  { id:'waste', name:'Atık Yönetimi', icon:'🗑️' },
  { id:'parking', name:'Otopark', icon:'🚗' },
  { id:'pets', name:'Evcil Hayvan', icon:'🐾' },
  { id:'common', name:'Ortak Alanlar', icon:'🏢' },
  { id:'other', name:'Diğer', icon:'📋' },
];
const RULE_TEMPLATES = [
  { category:'silence', title:'Sessizlik Saatleri', description:'Hafta içi 22:00\'den sonra yüksek ses yasaktır.', icon:'🔇', priority:'critical' },
  { category:'silence', title:'Hafta Sonu Sessizlik', description:'Hafta sonları 23:00\'den sonra ve 09:00\'dan önce yüksek ses yasaktır.', icon:'🔇', priority:'info' },
  { category:'waste', title:'Çöp Saatleri', description:'Çöpler her akşam 19:30 - 20:30 arası kapı önüne çıkarılmalıdır.', icon:'🗑️', priority:'critical' },
  { category:'waste', title:'Geri Dönüşüm', description:'Cam, plastik ve kağıt atıklar ayrı toplanmalıdır. Geri dönüşüm kutuları zemin katta bulunmaktadır.', icon:'♻️', priority:'info' },
  { category:'waste', title:'Büyük Eşya Atığı', description:'Mobilya ve beyaz eşya gibi büyük atıklar için yönetimle iletişime geçilmelidir.', icon:'🛋️', priority:'info' },
  { category:'parking', title:'Misafir Otoparkı', description:'Misafir araçları için ayrılan alan maksimum 4 saat kullanılabilir.', icon:'🚗', priority:'info' },
  { category:'parking', title:'Park Yeri Kullanımı', description:'Her daire sadece kendine ait park yerini kullanabilir. Başkasının yerine park etmek yasaktır.', icon:'🅿️', priority:'critical' },
  { category:'parking', title:'Araç Yıkama', description:'Otopark alanında araç yıkamak yasaktır.', icon:'🚿', priority:'info' },
  { category:'pets', title:'Evcil Hayvan Kuralları', description:'Ortak alanlarda evcil hayvanlar tasma ile gezdirilmelidir.', icon:'🐾', priority:'critical' },
  { category:'pets', title:'Evcil Hayvan Temizliği', description:'Evcil hayvanların dışkıları sahipleri tarafından temizlenmelidir.', icon:'🧹', priority:'critical' },
  { category:'pets', title:'Asansör Kullanımı', description:'Büyük köpekler asansörde taşıma çantası veya ağızlık ile taşınmalıdır.', icon:'🐕', priority:'info' },
  { category:'common', title:'Ortak Alan Temizliği', description:'Merdiven ve koridor gibi ortak alanlar temiz tutulmalıdır.', icon:'🧼', priority:'info' },
  { category:'common', title:'Asansör Kullanımı', description:'Asansörde sigara içilmesi ve yemek yenmesi yasaktır.', icon:'🛗', priority:'info' },
  { category:'common', title:'Bahçe Kullanımı', description:'Bahçe alanı tüm sakinlerin ortak kullanımına açıktır. Özel eşya bırakılmamalıdır.', icon:'🌳', priority:'info' },
  { category:'common', title:'Çamaşır Asma', description:'Çamaşırlar sadece balkonlarda ve görünmeyecek şekilde asılmalıdır.', icon:'👕', priority:'info' },
  { category:'common', title:'Tadilat Saatleri', description:'Tadilat ve tamirat işleri hafta içi 09:00 - 18:00 arası yapılabilir.', icon:'🔨', priority:'critical' },
  { category:'common', title:'Kapı Güvenliği', description:'Ana giriş kapısı her zaman kapalı tutulmalıdır. Tanımadığınız kişilere kapı açmayınız.', icon:'🚪', priority:'critical' },
  { category:'other', title:'Sigara Kullanımı', description:'Kapalı ortak alanlarda sigara içilmesi yasaktır.', icon:'🚭', priority:'critical' },
  { category:'other', title:'Aidat Ödeme', description:'Aidatlar her ayın 5\'ine kadar ödenmelidir.', icon:'💰', priority:'critical' },
  { category:'other', title:'Ziyaretçi Bildirimi', description:'Uzun süreli misafirler (3 günden fazla) yönetime bildirilmelidir.', icon:'👥', priority:'info' },
  { category:'other', title:'Yangın Güvenliği', description:'Yangın merdivenleri ve acil çıkışlar her zaman açık tutulmalıdır.', icon:'🔥', priority:'critical' },
  { category:'other', title:'Elektrik ve Su Kesintisi', description:'Planlı kesintiler en az 24 saat önceden duyurulacaktır.', icon:'⚡', priority:'info' },
  { category:'other', title:'Kiracı Değişikliği', description:'Kiracı değişikliklerinde yeni kiracı bilgileri yönetime bildirilmelidir.', icon:'📝', priority:'info' },
];

/* ============ Durum ============ */
// SİTE MODELİ: her şeyin üstünde bir site vardır (tek binalık apartman da
// 1 binalık sitedir). Kasa, sohbet, kurallar, duyurular, işler, toplantılar
// SİTE ORTAKTIR — bu modüller bina seçtirmez, sitenin tüm binalarını kapsar.
// Bina (blok) seçimi yalnızca daire/aidat gibi fiziksel olarak bina bazlı
// ekranlarda görünür.
const S = {
  user: null,
  profile: null,
  site: null,          // sites tablosundaki kayıt (kasa bakiyeleri, abonelik burada)
  buildings: [],
  activeBuildingId: null,
  section: 'overview'
};

// Blok seçicinin görüneceği (fiziksel olarak bina bazlı) bölümler
const PER_BUILDING_SECTIONS = ['apartments', 'fees', 'reports'];

/* ============ Yardımcılar ============ */
const el = (id) => document.getElementById(id);
const $content = () => el('content');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const TL = (n) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY' }).format(Number(n) || 0);
const dmy = (v) => v ? new Date(v).toLocaleDateString('tr-TR') : '—';
const dmyhm = (v) => v ? new Date(v).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

/* Daire no'su metin kolonu olduğu için Postgres "1, 10, 11, 2" diye sıralıyor.
   Intl.Collator numeric:true ile "2" < "10" olur; "3A"/"Zemin" gibi karışık
   değerler de doğal sırada kalır. */
const apartmentCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
const byApartmentNo = (a, b) =>
  apartmentCollator.compare(String(a?.apartment_number ?? ''), String(b?.apartment_number ?? ''));
const sortByApartment = (rows) => (rows || []).slice().sort(byApartmentNo);

/* Bina kurulurken daire sayısı kadar YER TUTUCU satır açılır
   (ensure_building_apartments: username='empty-…', user_id=null).
   Bunlar gerçek bir sakine ait değildir; aidat çıkarmak, borç saymak ya da
   işletme projesinde paydaya katmak hayali borç üretir.
   Doluluk ölçütü list_building_apartments RPC'siyle birebir aynı. */
const isOccupied = (a) =>
  !!a && (a.user_id != null || (a.username != null && !String(a.username).startsWith('empty-')));
const occupiedOnly = (rows) => (rows || []).filter(isOccupied);

/* Bugünün tarihi YYYY-MM-DD (input[type=date] için). toISOString() UTC'ye
   çevirdiği için gece yarısına yakın saatlerde bir gün geri kayıyordu. */
const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- Basit zengin metin editörü (karar defteri) ----------
   Word benzeri ama sadece gerçekten kullanılan biçimler: kalın, italik,
   altı çizili, başlık, madde/numaralı liste. Harici kütüphane yok. */

const RICH_ALLOWED = {
  B:[], STRONG:[], I:[], EM:[], U:[], BR:[], P:[], DIV:[],
  H3:[], H4:[], UL:[], OL:[], LI:[], SPAN:[],
};

/* Kaydedilen HTML'i güvenli etikete indirger. Yönetici yazsa bile
   <script>/<img onerror> gibi içerik panele geri basılmamalı. */
const sanitizeRichHTML = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  const walk = (node) => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); return; }
      const allowed = RICH_ALLOWED[child.tagName];
      if (!allowed) {
        // İzinsiz etiket: içeriğini koru, etiketi at
        const text = document.createTextNode(child.textContent || '');
        child.replaceWith(text);
        return;
      }
      [...child.attributes].forEach(a => child.removeAttribute(a.name));
      walk(child);
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
};

const RICH_TOOLS = [
  { cmd:'bold',            label:'B',  title:'Kalın (Ctrl+B)',   style:'font-weight:800' },
  { cmd:'italic',          label:'I',  title:'İtalik (Ctrl+I)',  style:'font-style:italic' },
  { cmd:'underline',       label:'U',  title:'Altı çizili',      style:'text-decoration:underline' },
  { sep:true },
  { cmd:'formatBlock', arg:'<h3>', label:'Başlık',    title:'Başlık yap' },
  { cmd:'formatBlock', arg:'<p>',  label:'Normal',    title:'Normal metne çevir' },
  { sep:true },
  { cmd:'insertUnorderedList', label:'• Liste',  title:'Madde listesi' },
  { cmd:'insertOrderedList',   label:'1. Liste', title:'Numaralı liste' },
  { sep:true },
  { cmd:'removeFormat', label:'✕ Biçimi sil', title:'Seçili metnin biçimini temizle' },
];

const richEditorHTML = (id, initialHTML = '') => `
  <div class="rich-editor">
    <div class="rich-toolbar" data-for="${id}">
      ${RICH_TOOLS.map(t => t.sep
        ? '<span class="rich-sep"></span>'
        : `<button type="button" class="rich-btn" data-cmd="${t.cmd}"${t.arg ? ` data-arg="${esc(t.arg)}"` : ''} title="${esc(t.title)}"${t.style ? ` style="${t.style}"` : ''}>${esc(t.label)}</button>`
      ).join('')}
    </div>
    <div class="rich-area" id="${id}" contenteditable="true"
         data-placeholder="Alınan kararları buraya yazın. Metni seçip yukarıdaki düğmelerle biçimlendirebilirsiniz.">${sanitizeRichHTML(initialHTML)}</div>
  </div>`;

const bindRichEditor = (id) => {
  const area = el(id);
  const bar = document.querySelector(`.rich-toolbar[data-for="${id}"]`);
  if (!area || !bar) return;
  bar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.rich-btn'); if (!btn) return;
    e.preventDefault();              // odak editörden çıkmasın
    area.focus();
    document.execCommand(btn.dataset.cmd, false, btn.dataset.arg || null);
  });
  // Yapıştırmada Word'den gelen devasa biçimlendirmeyi düz metne indir
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
};

/* Editörün içeriğini temizlenmiş olarak döner; boşsa '' verir. */
const richValue = (id) => {
  const area = el(id);
  if (!area) return '';
  const html = sanitizeRichHTML(area.innerHTML);
  return area.textContent.trim() ? html : '';
};

/* Satırları CSV'ye çevirip indirir. Excel'in Türkçe karakterleri doğru
   göstermesi için BOM eklenir; alanlar her zaman tırnaklanır. */
const downloadCSV = (filename, header, rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const bId = () => S.activeBuildingId;
const activeBuilding = () => S.buildings.find(b => b.id === S.activeBuildingId) || null;
const sId = () => S.site?.id || null;
// Ortak (site geneli) sorgular için: sitedeki tüm bina id'leri
const siteBIds = () => (S.buildings.length ? S.buildings.map(b => b.id) : [S.activeBuildingId].filter(Boolean));

// Aktif (ücretli ve süresi geçmemiş) abonelik var mı?
const isSubscribed = () => {
  const s = S.site || activeBuilding();
  if (!s || !s.subscription_type || s.subscription_type === 'free') return false;
  if (!s.subscription_expiry) return false;
  return new Date(s.subscription_expiry).getTime() > Date.now();
};
// Deneme (1 ay ücretsiz) süresi dolmamış mı?
const trialEndsAt = () => {
  const s = S.site;
  return s?.trial_ends_at ? new Date(s.trial_ends_at) : null;
};
const isInTrial = () => {
  const t = trialEndsAt();
  return !isSubscribed() && !!t && t.getTime() > Date.now();
};
// Davet kodları/premium erişimi: ücretli abonelik VEYA aktif deneme.
const hasAccess = () => isSubscribed() || isInTrial();
const trialDaysLeft = () => {
  const t = trialEndsAt();
  return t ? Math.max(0, Math.ceil((t.getTime() - Date.now()) / 86400000)) : 0;
};

/* ============ Abonelik erişim durumu ============
   Mobil uygulamayla AYNI mantık: Komsu/services/subscriptionState.ts.
   Sabitleri değiştirirsen ORAYI DA değiştir; yoksa yönetici burada
   "3 gün kaldı" görürken sakinler mobilde çoktan kilitlenmiş olabilir.

   trial/active → normal · warning → ≤7 gün kaldı · grace → süre doldu ama
   +7 gün çalışmaya devam ediyor · locked → sakinler kilit ekranı görüyor. */
const WARN_DAYS = 7;
const GRACE_DAYS = 7;
const DAY_MS = 86400000;

function getAccessState(now = Date.now()) {
  const s = S.site;
  const none = { kind:'unknown', hasAccess:true, shouldWarn:false, daysLeft:0, graceDaysLeft:0, source:'none', endsAt:null };
  if (!s) return none;

  const paidMs = (s.subscription_type && s.subscription_type !== 'free' && s.subscription_expiry)
    ? new Date(s.subscription_expiry).getTime() : -Infinity;
  const trialMs = s.trial_ends_at ? new Date(s.trial_ends_at).getTime() : -Infinity;
  if (paidMs === -Infinity && trialMs === -Infinity) return none;

  const usingPaid = paidMs >= trialMs;
  const endMs = usingPaid ? paidMs : trialMs;
  const source = usingPaid ? 'paid' : 'trial';
  const daysLeft = Math.ceil((endMs - now) / DAY_MS);

  if (endMs > now) {
    const kind = daysLeft <= WARN_DAYS ? 'warning' : (usingPaid ? 'active' : 'trial');
    return { kind, hasAccess:true, shouldWarn:kind==='warning', daysLeft, graceDaysLeft:0, source, endsAt:new Date(endMs) };
  }
  const graceEnd = endMs + GRACE_DAYS * DAY_MS;
  if (graceEnd > now) {
    return { kind:'grace', hasAccess:true, shouldWarn:true, daysLeft, graceDaysLeft:Math.ceil((graceEnd-now)/DAY_MS), source, endsAt:new Date(endMs) };
  }
  return { kind:'locked', hasAccess:false, shouldWarn:true, daysLeft, graceDaysLeft:0, source, endsAt:new Date(endMs) };
}

/* Her ekranın üstünde görünen kırmızı uyarı şeridi. */
function accessBannerHTML() {
  const a = getAccessState();
  if (!a.shouldWarn) return '';

  const isTrial = a.source === 'trial';
  let icon, head, text, cta;

  if (a.kind === 'warning') {
    icon = '⏳';
    head = isTrial
      ? `Ücretsiz deneme süreniz ${a.daysLeft} gün sonra doluyor`
      : `Aboneliğiniz ${a.daysLeft} gün sonra doluyor`;
    text = 'Süre dolduğunda davet kodlarınız kapanır ve sakinleriniz uygulamayı kullanamaz. Şimdi ödeyerek kesintisiz devam edin.';
    cta  = isTrial ? 'Aboneliği Başlat' : 'Aboneliği Yenile';
  } else if (a.kind === 'grace') {
    icon = '⚠️';
    head = `${isTrial ? 'Deneme süreniz' : 'Aboneliğiniz'} doldu — ${a.graceDaysLeft} gün ek süreniz var`;
    text = `Sisteminiz şu an çalışıyor ama ${a.graceDaysLeft} gün içinde ödeme yapılmazsa sakinleriniz uygulamaya giremeyecek.`;
    cta  = 'Hemen Öde';
  } else {
    icon = '🔒';
    head = 'Sisteminiz kapandı';
    text = 'Aboneliğiniz sona erdi ve sakinleriniz uygulamaya giremiyor. Ödemeyi tamamladığınızda her şey olduğu gibi geri gelir.';
    cta  = 'Ödeme Yap ve Aç';
  }

  return `<div class="access-banner ${a.kind}">
    <span class="ab-icon">${icon}</span>
    <div class="ab-text"><strong>${esc(head)}</strong><span>${esc(text)}</span></div>
    <button class="ab-cta" data-goto-subscription>${esc(cta)}</button>
  </div>`;
}

function toast(msg, isErr) {
  const t = el('toast');
  t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : '');
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2800);
}
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

function openModal(title, bodyHtml, onSave) {
  el('modal-title').textContent = title;
  el('modal-body').innerHTML = bodyHtml;
  show('modal-overlay');
  
  const saveBtn = el('modal').querySelector('#m-save');
  if (saveBtn && onSave) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try {
        await onSave();
        closeModal();
        navigate(S.section);
      } catch (err) {
        toast(err.message, true);
        saveBtn.disabled = false;
      }
    };
  }
}
function closeModal() { hide('modal-overlay'); el('modal-body').innerHTML = ''; }
el('modal-close').addEventListener('click', closeModal);
el('modal-overlay').addEventListener('click', (e) => { if (e.target === el('modal-overlay')) closeModal(); });

/* ============ Giriş / oturum ============ */
let loginType = 'admin'; // 'admin' veya 'security'

// Sekmeler arası geçiş
el('tab-admin').addEventListener('click', () => {
  loginType = 'admin';
  el('tab-admin').classList.add('active');
  el('tab-admin').style.background = '#fff';
  el('tab-admin').style.color = 'var(--ink)';
  el('tab-security').classList.remove('active');
  el('tab-security').style.background = 'transparent';
  el('tab-security').style.color = 'var(--muted)';
  
  el('login-title').textContent = 'Yönetici Girişi';
  el('login-sub').textContent = 'Kayıt sırasında belirlediğiniz e-posta ve şifre ile giriş yapın.';
  el('email-label').textContent = 'E-posta';
  el('email').placeholder = 'ornek@eposta.com';
  el('login-foot').style.display = 'block';
  el('login-alt').style.display = 'block';
});

el('tab-security').addEventListener('click', () => {
  loginType = 'security';
  el('tab-security').classList.add('active');
  el('tab-security').style.background = '#fff';
  el('tab-security').style.color = 'var(--ink)';
  el('tab-admin').classList.remove('active');
  el('tab-admin').style.background = 'transparent';
  el('tab-admin').style.color = 'var(--muted)';
  
  el('login-title').textContent = 'Güvenlik Girişi';
  el('login-sub').textContent = 'Yöneticinizin bu bina için belirlediği güvenlik kullanıcı adı ve şifresi ile giriş yapın.';
  el('email-label').textContent = 'Güvenlik Kullanıcı Adı';
  el('email').placeholder = 'Örn: guvenlik-a-blok';
  el('login-foot').style.display = 'none';
  el('login-alt').style.display = 'none';
});

el('toggle-pass').addEventListener('click', () => {
  const p = el('password'); const on = p.type === 'password';
  p.type = on ? 'text' : 'password'; el('toggle-pass').textContent = on ? 'Gizle' : 'Göster';
});

// Tam ekran görünümler — aynı anda yalnızca biri açık olur
const SCREENS = ['loading', 'login', 'signup', 'verify', 'setup', 'app'];
function showScreen(id) { SCREENS.forEach(s => (s === id ? show(s) : hide(s))); }

function showLogin(message) {
  showScreen('login');
  if (message) { el('login-error').textContent = message; show('login-error'); } else hide('login-error');
}

function showSignup() {
  showScreen('signup');
  hide('signup-error');
}

function showVerify(email) {
  showScreen('verify');
  hide('verify-error');
  el('verify-email').textContent = email;
}

/* ============ Yönetici kaydı ============ */
// Mobildeki akışın web karşılığı: hesap oluştur → (gerekirse e-posta doğrula)
// → kurulum sihirbazıyla siteyi/binaları tanımla → panele gir.
// Mobilde kimlik Apple/Google ile alınır; web'de e-posta + şifre kullanılır.
// İkisi de aynı Supabase Auth kullanıcısına, aynı RPC'ye ve aynı RLS'e bağlanır.

el('go-signup').addEventListener('click', () => showSignup());
el('go-login').addEventListener('click', () => showLogin());
el('verify-to-login').addEventListener('click', () => showLogin());

el('su-toggle-pass').addEventListener('click', () => {
  const p = el('su-pass'); const on = p.type === 'password';
  p.type = on ? 'text' : 'password'; el('su-toggle-pass').textContent = on ? 'Gizle' : 'Göster';
});

function signupError(msg) {
  el('signup-error').textContent = msg;
  show('signup-error');
}

el('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide('signup-error');

  const name = el('su-name').value.trim();
  const surname = el('su-surname').value.trim();
  const email = el('su-email').value.trim().toLowerCase();
  const pass = el('su-pass').value;
  const pass2 = el('su-pass2').value;

  if (!name || !surname) return signupError('Lütfen ad ve soyad alanlarını doldurun.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return signupError('Geçerli bir e-posta adresi girin.');
  if (pass.length < 6) return signupError('Şifre en az 6 karakter olmalı.');
  if (pass !== pass2) return signupError('Şifreler birbiriyle eşleşmiyor.');
  if (!el('su-terms').checked) return signupError('Devam etmek için sözleşmeleri kabul etmelisiniz.');

  const btn = el('signup-btn');
  btn.disabled = true; btn.textContent = 'Hesap oluşturuluyor…';

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { display_name: `${name} ${surname}`, name, surname } },
  });

  btn.disabled = false; btn.textContent = 'Hesap Oluştur';

  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('already registered') || m.includes('already been registered')) {
      return signupError('Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.');
    }
    if (m.includes('password')) return signupError('Şifre çok zayıf (en az 6 karakter olmalı).');
    if (m.includes('rate limit') || m.includes('too many')) {
      return signupError('Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
    }
    return signupError(error.message || 'Kayıt oluşturulamadı.');
  }

  // Kurulum adımında kullanmak üzere ad/soyadı sakla
  S.pendingName = { name, surname };

  // Projede e-posta onayı açıksa signUp oturum döndürmez → doğrulama ekranı.
  // Kapalıysa oturum gelir → doğrudan kurulum sihirbazına geçilir.
  if (data.session && data.user) {
    await boot(data.user);
  } else {
    S.pendingEmail = email;
    showVerify(email);
  }
});

el('verify-resend').addEventListener('click', async () => {
  const btn = el('verify-resend');
  hide('verify-error');
  btn.disabled = true; btn.textContent = 'Gönderiliyor…';
  const { error } = await supabase.auth.resend({ type: 'signup', email: S.pendingEmail || '' });
  btn.disabled = false; btn.textContent = 'Doğrulama E-postasını Tekrar Gönder';
  if (error) {
    el('verify-error').textContent = 'E-posta gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.';
    show('verify-error');
  } else {
    toast('Doğrulama e-postası tekrar gönderildi.');
  }
});

/* ============ Kurulum sihirbazı ============ */
// Mobildeki app/register/admin.tsx ekranının birebir karşılığı:
// site tipi, ad, adres ve bina bilgileri → create_site_with_buildings RPC.

const BLOCK_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVYZ';
const defaultBlockName = (i) => `${BLOCK_LETTERS[i % BLOCK_LETTERS.length]} Blok`;

const SETUP = {
  siteType: 'apartment',
  blocks: [
    { name: defaultBlockName(0), apartmentCount: '', floorCount: '' },
    { name: defaultBlockName(1), apartmentCount: '', floorCount: '' },
  ],
};

function renderBlocks() {
  el('blocks-list').innerHTML = SETUP.blocks.map((b, i) => `
    <div class="block-row" data-i="${i}">
      <input class="b-name" type="text" placeholder="${esc(defaultBlockName(i))}" value="${esc(b.name)}" data-f="name" />
      <input class="b-num" type="number" min="1" inputmode="numeric" placeholder="Daire" value="${esc(b.apartmentCount)}" data-f="apartmentCount" />
      <input class="b-num" type="number" min="0" inputmode="numeric" placeholder="Kat" value="${esc(b.floorCount)}" data-f="floorCount" />
      <button type="button" class="b-del" data-i="${i}" ${SETUP.blocks.length <= 2 ? 'disabled' : ''} title="Binayı kaldır">✕</button>
    </div>
  `).join('');
}

el('blocks-list').addEventListener('input', (e) => {
  const input = e.target.closest('input[data-f]');
  if (!input) return;
  const i = Number(input.closest('.block-row').dataset.i);
  SETUP.blocks[i][input.dataset.f] = input.value;
});

el('blocks-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.b-del');
  if (!btn || btn.disabled) return;
  SETUP.blocks.splice(Number(btn.dataset.i), 1);
  renderBlocks();
});

el('add-block').addEventListener('click', () => {
  if (SETUP.blocks.length >= 20) return toast('En fazla 20 bina tanımlayabilirsiniz.', true);
  SETUP.blocks.push({ name: defaultBlockName(SETUP.blocks.length), apartmentCount: '', floorCount: '' });
  renderBlocks();
});

function setSiteType(type) {
  SETUP.siteType = type;
  const isSite = type === 'site';
  el('seg-site').classList.toggle('active', isSite);
  el('seg-apartment').classList.toggle('active', !isSite);
  el('setup-blocks').classList.toggle('hidden', !isSite);
  el('setup-single').classList.toggle('hidden', isSite);
  el('st-name-label').textContent = isSite ? 'Site Adı' : 'Apartman Adı';
  el('st-name').placeholder = isSite ? 'Site adını girin' : 'Apartman adını girin';
  if (isSite) renderBlocks();
}

el('seg-apartment').addEventListener('click', () => setSiteType('apartment'));
el('seg-site').addEventListener('click', () => setSiteType('site'));

el('setup-logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

function showSetup() {
  showScreen('setup');
  hide('setup-error');
  setSiteType(SETUP.siteType);
  renderBlocks();
}

function setupError(msg) {
  el('setup-error').textContent = msg;
  show('setup-error');
  el('setup').querySelector('.setup-card')?.scrollTo({ top: 0, behavior: 'smooth' });
}

el('setup-btn').addEventListener('click', async () => {
  hide('setup-error');

  const name = el('st-name').value.trim();
  const address = el('st-address').value.trim();
  const isSite = SETUP.siteType === 'site';

  if (!name) return setupError(isSite ? 'Lütfen site adını girin.' : 'Lütfen apartman adını girin.');
  if (!address) return setupError('Lütfen adresi girin.');

  let buildings;
  if (isSite) {
    buildings = [];
    for (let i = 0; i < SETUP.blocks.length; i++) {
      const b = SETUP.blocks[i];
      const bName = (b.name || '').trim();
      if (!bName) return setupError(`${i + 1}. binanın adını girin.`);
      const apt = parseInt(b.apartmentCount, 10);
      if (isNaN(apt) || apt <= 0) return setupError(`${bName} için geçerli bir daire sayısı girin.`);
      buildings.push({ name: bName, apartment_count: apt, floor_count: parseInt(b.floorCount, 10) || 0 });
    }
  } else {
    const apt = parseInt(el('st-apt').value, 10);
    const flr = parseInt(el('st-floor').value, 10);
    if (isNaN(apt) || apt <= 0) return setupError('Geçerli bir daire sayısı girin.');
    if (isNaN(flr) || flr <= 0) return setupError('Geçerli bir kat sayısı girin.');
    buildings = [{ name, apartment_count: apt, floor_count: flr }];
  }

  const btn = el('setup-btn');
  btn.disabled = true; btn.textContent = 'Kuruluyor…';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showLogin('Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.'); return; }

    // 1) Siteyi binalarıyla birlikte kur (mobildekiyle aynı RPC)
    const { data, error } = await supabase.rpc('create_site_with_buildings', {
      p_name: name,
      p_site_type: SETUP.siteType,
      p_address: address,
      p_buildings: buildings,
    });
    if (error) throw new Error(error.message || 'Site oluşturulamadı');

    const firstBuildingId = data?.buildings?.[0]?.id || null;

    // 2) Yönetici profilini oluştur (mobildeki createAdmin ile aynı)
    const meta = user.user_metadata || {};
    const pName = S.pendingName?.name || meta.name || (meta.display_name || '').split(' ')[0] || '';
    const pSurname = S.pendingName?.surname || meta.surname || (meta.display_name || '').split(' ').slice(1).join(' ') || '';

    const { error: pErr } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'admin',
      name: pName,
      surname: pSurname,
      phone: null,
      email: user.email || null,
      building_id: firstBuildingId,
    });
    if (pErr) throw new Error(pErr.message || 'Yönetici profili kaydedilemedi');

    S.pendingName = null;
    await boot(user);
    toast('🎉 Kurulum tamamlandı! 1 aylık ücretsiz denemeniz başladı.');
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Kurulumu Tamamla';
    setupError(err.message || 'Kurulum tamamlanamadı. Lütfen tekrar deneyin.');
    return;
  }
  btn.disabled = false; btn.textContent = 'Kurulumu Tamamla';
});

el('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide('login-error');
  const btn = el('login-btn'); btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
  
  if (loginType === 'admin') {
    // Standart Yönetici Girişi (Supabase Auth)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: el('email').value.trim().toLowerCase(), password: el('password').value,
    });
    btn.disabled = false; btn.textContent = 'Giriş Yap';
    if (error || !data.user) { el('login-error').textContent = 'E-posta veya şifre hatalı.'; show('login-error'); return; }
    showScreen('loading'); await boot(data.user);
  } else {
    // Güvenlik Görevlisi Girişi (şifre doğrulamalı RPC — bina satırı istemciye açılmaz)
    try {
      const username = el('email').value.trim();
      const password = el('password').value;

      const { data: rows, error } = await supabase.rpc('security_login', {
        p_username: username, p_password: password,
      });
      const building = rows && rows[0];

      btn.disabled = false;
      btn.textContent = 'Giriş Yap';

      if (error || !building) {
        el('login-error').textContent = 'Kullanıcı adı veya şifre hatalı.';
        show('login-error');
        return;
      }

      // Güvenlik oturumunu durum değişkenlerine kaydet
      S.user = { id: 'security-' + building.building_id };
      S.profile = { role: 'security', name: 'Güvenlik Görevlisi', building_id: building.building_id };
      S.securityCreds = { username, password };
      S.buildings = [{ id: building.building_id, name: building.building_name, address: '' }];
      S.activeBuildingId = building.building_id;
      
      showScreen('app');
      el('top-user').textContent = 'Güvenlik Görevlisi';
      
      // Güvenlik moduna yönlendir
      navigate('security_mode');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Giriş Yap';
      el('login-error').textContent = 'Bağlantı hatası oluştu.';
      show('login-error');
    }
  }
});

el('logout-btn').addEventListener('click', async () => {
  if (S.profile && S.profile.role === 'security') {
    // Güvenlik çıkışı (Supabase signout yapmaya gerek yok)
    S.user = null; S.profile = null; S.securityCreds = null; S.buildings = []; S.activeBuildingId = null;
    showLogin();
  } else {
    await supabase.auth.signOut();
    showLogin();
  }
});

async function boot(user) {
  S.user = user;
  const { data: profile } = await supabase.from('profiles').select('name, surname, building_id, role').eq('id', user.id).maybeSingle();

  // Web'den yeni kaydolan yöneticinin henüz profili yoktur → kurulum sihirbazı.
  if (!profile) { showSetup(); return; }

  if (profile.role !== 'admin') {
    await supabase.auth.signOut();
    showLogin('Bu panel yalnızca bina yöneticileri içindir. Daire hesabıyla giriş yapılamaz.');
    return;
  }
  S.profile = profile;

  // Binaları önce doğrudan admin_id ile çek — kaydı yarım kalmış (binasız site
  // oluşmuş) hesaplarda site-önce yaklaşımı boş sonuç döndürüp kurulum
  // ekranında sonsuz döngüye sokuyordu.
  let { data: buildings } = await supabase.from('buildings').select('*')
    .eq('admin_id', user.id).order('created_at', { ascending: true });

  // Geriye dönük uyumluluk: binalar boşsa profildeki building_id'yi dene
  if ((!buildings || buildings.length === 0) && profile.building_id) {
    const { data: building } = await supabase.from('buildings').select('*').eq('id', profile.building_id).maybeSingle();
    if (building) buildings = [building];
  }

  // Binası olmayan yönetici (kayıt yarıda kalmış) → kurulumu tamamlasın
  if (!buildings || buildings.length === 0) { showSetup(); return; }

  // Binanın bağlı olduğu siteyi ve o sitedeki TÜM binaları çek
  const siteId = buildings.find(b => b.site_id)?.site_id || null;
  if (siteId) {
    try {
      const { data: site } = await supabase.from('sites').select('*').eq('id', siteId).maybeSingle();
      S.site = site || null;
    } catch { S.site = null; }

    const { data: siteBuildings } = await supabase.from('buildings').select('*')
      .eq('site_id', siteId).order('created_at', { ascending: true });
    if (siteBuildings && siteBuildings.length) buildings = siteBuildings;
  } else {
    S.site = null;
  }

  S.buildings = buildings;
  S.activeBuildingId = S.buildings[0].id;

  showScreen('app');
  el('top-user').textContent = `${profile.name || ''} ${profile.surname || ''}`.trim();

  renderBuildingSelector();

  // iyzico ödeme dönüşü: callback panele ?payment=... ile yönlendirir
  const payResult = new URLSearchParams(location.search).get('payment');
  if (payResult) {
    // URL'i temizle (yenilemede tekrar tetiklenmesin)
    history.replaceState(null, '', location.pathname);
    if (payResult === 'success') {
      toast('✅ Ödeme alındı! Aboneliğiniz aktif, davet kodlarınız açıldı.');
      navigate('subscription');
      return;
    }
    if (payResult === 'failed') toast('Ödeme tamamlanmadı veya iptal edildi.', true);
    else toast('Ödeme sırasında bir sorun oluştu.', true);
    navigate('subscription');
    return;
  }

  navigate('overview');
}

/* ============ Üst Çubuk: Site Bilgisi + Blok Seçici ============ */
// Üst çubukta SİTE adı görünür (site tek bütün olarak yönetilir).
// Blok açılır menüsü yalnızca fiziksel olarak bina bazlı bölümlerde
// (daireler, aidatlar, raporlar) ve sitede birden çok bina varsa görünür.
function renderBuildingSelector() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  let selectorWrapper = topbar.querySelector('.topbar-selector');
  if (!selectorWrapper) {
    const oldInfo = topbar.querySelector('.top-building');
    if (oldInfo) oldInfo.remove();

    selectorWrapper = document.createElement('div');
    selectorWrapper.className = 'topbar-selector';
    topbar.insertBefore(selectorWrapper, el('top-user'));
  }

  const ab = activeBuilding();

  if (S.buildings.length === 0) {
    selectorWrapper.innerHTML = `<div class="top-building-info"><span class="top-name">Bina Tanımsız</span></div>`;
    return;
  }

  const siteName = S.site?.name || ab?.name || '';
  const siteSub = S.site
    ? (S.site.site_type === 'site' ? `${S.buildings.length} binalı site` : (S.site.address || 'Apartman'))
    : (ab?.address || '');

  const options = S.buildings.map(b => `<option value="${b.id}" ${b.id === S.activeBuildingId ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const showSelector = S.buildings.length > 1 && PER_BUILDING_SECTIONS.includes(S.section);

  selectorWrapper.innerHTML = `
    <div class="top-building-info" style="margin-right: 12px;">
      <span class="top-name" id="top-building-name">${esc(siteName)}</span>
      <span class="top-addr" id="top-building-addr">${esc(siteSub)}</span>
    </div>
    <select class="building-dropdown" id="building-select" title="Blok seçin" style="${showSelector ? '' : 'display:none;'}">${options}</select>
  `;

  const sel = el('building-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      S.activeBuildingId = e.target.value;
      const newActive = activeBuilding();
      toast(`${newActive.name} bloğuna geçildi.`);
      navigate(S.section);
    });
  }
}

/* ============ Navigasyon ============ */
el('side-nav').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-section]'); if (!a) return;
  navigate(a.dataset.section);
  el('sidebar').classList.remove('open');
  const bd = document.querySelector('.backdrop'); if (bd) bd.remove();
});
el('hamburger').addEventListener('click', () => {
  el('sidebar').classList.add('open');
  const bd = document.createElement('div'); bd.className = 'backdrop';
  bd.addEventListener('click', () => { el('sidebar').classList.remove('open'); bd.remove(); });
  document.body.appendChild(bd);
});

/* Yönetim modülüne bağımlılıkları geçir. panel.js'i refactor etmemek için
   fonksiyonlar bir bağlam nesnesiyle aktarılıyor; modül bunları C.* ile kullanır. */
initYonetim({
  supabase, S, el, $content, esc, TL, dmy, dmyhm, toast, openModal,
  bId, sId, siteBIds, needBuilding, navigate,
  richEditorHTML, bindRichEditor, richValue,
  todayISO, downloadCSV, sortByApartment, occupiedOnly, isOccupied, notifyBuilding,
});

function navigate(section) {
  S.section = section;
  document.querySelectorAll('#side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.section === section));

  // Blok seçici yalnızca bina bazlı bölümlerde görünür
  renderBuildingSelector();
  
  // Güvenlik modunda sidebar'ı gizle
  if (section === 'security_mode') {
    el('sidebar').classList.add('hidden');
    document.querySelector('.main').style.marginLeft = '0';
  } else {
    el('sidebar').classList.remove('hidden');
    document.querySelector('.main').style.marginLeft = '';
  }
  
  const routes = { 
    overview: renderOverview, 
    apartments: renderApartments, 
    fees: renderFees, 
    transactions: renderTransactions,
    announcements: renderAnnouncements, 
    maintenance: renderMaintenance, 
    jobs: renderJobs, 
    meetings: renderMeetings, 
    rules: renderRules, 
    settings: renderSettings, 
    reports: renderReports,
    assets: renderAssets,
    decisions: renderDecisions,
    subscription: renderSubscription,
    security_mode: renderSecurityPanel,
    ...yonetimRoutes,          // tasks, budget, board, assembly, debts, archive
  };
  $content().innerHTML = '<p class="muted">Yükleniyor…</p>';

  // Erişim kapandıysa (süre + ek süre doldu) yönetici yalnızca abonelik
  // ekranını görebilir; oradan ödeyip sistemi geri açar. Güvenlik modu
  // ayrı bir oturum olduğu için bu kısıttan muaf.
  const access = getAccessState();
  const allowedWhenLocked = section === 'subscription' || section === 'security_mode';
  if (!access.hasAccess && !allowedWhenLocked) {
    S.section = 'subscription';
    document.querySelectorAll('#side-nav a').forEach((a) =>
      a.classList.toggle('active', a.dataset.section === 'subscription'));
    renderSubscription();
    return;
  }

  watchAccessBanner();
  Promise.resolve((routes[section] || renderOverview)()).finally(mountAccessBanner);
}

/* Uyarı şeridini içeriğin en üstüne yerleştirir ve butonunu bağlar.
   Her render'dan sonra çağrılır; böylece banner tüm ekranlarda görünür. */
function mountAccessBanner() {
  const host = $content();
  if (!host || host.querySelector('.access-banner')) return;
  const html = accessBannerHTML();
  if (!html) return;
  host.insertAdjacentHTML('afterbegin', html);
  const btn = host.querySelector('[data-goto-subscription]');
  if (btn) btn.addEventListener('click', () => navigate('subscription'));
}

/* Ekranların çoğu kendi içinde innerHTML'i baştan yazıyor (ör. renderFees
   bir işlemden sonra kendini yeniden çiziyor) ve bu bannerı siliyor.
   Gözlemci, içerik her değiştiğinde bannerı geri koyar. */
let accessBannerObserver = null;
function watchAccessBanner() {
  if (accessBannerObserver) return;
  const host = $content();
  if (!host || typeof MutationObserver === 'undefined') return;
  accessBannerObserver = new MutationObserver(() => mountAccessBanner());
  accessBannerObserver.observe(host, { childList: true });
}

// Site ve binalar YALNIZCA mobil kayıt sırasında oluşturulur; panelden
// sonradan bina eklenemez. Kaydı olmayan yönetici mobil uygulamaya yönlendirilir.
function needBuilding() {
  if (!bId()) {
    $content().innerHTML = `
      <div class="card" style="text-align: center; padding: 40px;">
        <h3>Henüz Tanımlı Bir Siteniz Yok</h3>
        <p class="muted" style="margin: 12px 0 0;">Site/apartman kaydı mobil uygulamadaki yönetici kayıt akışında yapılır.
        Lütfen Komşu mobil uygulamasından yönetici kaydınızı tamamlayın; siteniz ve binalarınız otomatik olarak burada görünecektir.</p>
      </div>`;
    return false;
  }
  return true;
}

/* ============ Mali yardımcılar (mobil ile aynı davranış) ============ */
async function adjustBalance({ amount, operation, description, category='other', walletType='bank', relatedId=null }) {
  // Kasa SİTE ortaktır: adjust_building_balance sunucuda site kasasını günceller
  // ve tüm binalara yansıtır. Onay eşiği site kaydından okunur.
  const ab = activeBuilding();
  const threshold = Number(S.site?.approval_threshold ?? ab?.approval_threshold ?? 5000);
  // Onay eşiği HARCAMALAR için vardır. Aidat iptali bir harcama değil, daha
  // önce girmiş bir gelirin geri alınmasıdır; onaya takılırsa kasadan hiç
  // düşülmez ve bakiye yanlış kalırdı. Bu yüzden 'fee' kategorisi muaf.
  const needsApproval = operation === 'subtract'
    && category !== 'fee'
    && (amount >= threshold || category === 'job');
  const status = needsApproval ? 'pending' : 'completed';
  if (operation === 'add' || !needsApproval) {
    const delta = operation === 'add' ? amount : -amount;
    const { error } = await supabase.rpc('adjust_building_balance', { p_building_id: bId(), p_wallet: walletType, p_delta: delta });
    if (error) throw new Error(error.message);
  }
  const { error: e2 } = await supabase.from('transactions').insert({
    building_id: bId(), type: operation === 'add' ? 'income' : 'expense', amount, description, category,
    wallet_type: walletType, related_id: relatedId, status,
    approved_by: needsApproval ? null : S.user.id, approved_at: needsApproval ? null : new Date().toISOString(), created_by: S.user.id,
  });
  if (e2) throw new Error(e2.message);
  await refreshBuilding();
  return { needsApproval };
}
async function refreshBuilding() {
  const [{ data }, siteRes] = await Promise.all([
    supabase.from('buildings').select('*').eq('id', bId()).maybeSingle(),
    sId() ? supabase.from('sites').select('*').eq('id', sId()).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (siteRes?.data) S.site = siteRes.data;
  if (data) {
    // S.buildings içindeki veriyi güncelle
    const idx = S.buildings.findIndex(b => b.id === bId());
    if (idx !== -1) S.buildings[idx] = data;
    renderBuildingSelector();
  }
}

/* ============ Push bildirimleri ============ */
// Expo push API'si tarayıcıdan çağrılamadığı için (CORS) bildirimler veritabanı
// içinden pg_net ile gönderilir (migration 0010'daki notify_* RPC'leri).
// Başarısızlık paneli durdurmaz; sadece konsola yazılır.
async function notifyBuilding(title, body) {
  try {
    const { error } = await supabase.rpc('notify_building', {
      p_building_id: bId(), p_title: title, p_body: body,
      p_data: { screen: 'chat' }, p_exclude_user: S.user.id,
    });
    if (error) console.error('Bina bildirimi gönderilemedi:', error.message);
  } catch (e) { console.error('Bina bildirimi gönderilemedi:', e); }
}
async function notifyUser(userId, title, body) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc('notify_user', {
      p_user_id: userId, p_title: title, p_body: body, p_data: { screen: 'chat' },
    });
    if (error) console.error('Kullanıcı bildirimi gönderilemedi:', error.message);
  } catch (e) { console.error('Kullanıcı bildirimi gönderilemedi:', e); }
}


/* ============ 1) GENEL BAKIŞ (3D SAHNE & ÇOKLU BİNA) ============ */
let threeScene, threeCamera, threeRenderer, threeControls;
let buildingMeshes = [];

async function renderOverview() {
  if (!needBuilding()) return;
  
  $content().innerHTML = `
    <div class="page-head">
      <h2>Sanal Site Maketi</h2>
    </div>

    <!-- Üst Şerit: Seçili Bina Detayları (yatay) -->
    <div id="overview-details" class="overview-details-strip">
      <div class="loading" style="padding: 24px;">Yükleniyor…</div>
    </div>

    <!-- Tam Genişlik 3D Sahne -->
    <div class="canvas-card canvas-card-wide">
      <div class="canvas-overlay-ui">
        <div class="site-toolbar" id="site-toolbar">
          <button class="btn btn-sm" id="edit-layout-btn">🔧 Yerleşimi Düzenle</button>
          <div id="edit-tools" class="hidden site-edit-tools">
            <button class="btn btn-sm btn-ghost" data-add="pool">🏊 Havuz</button>
            <button class="btn btn-sm btn-ghost" data-add="guard">🛡️ Kulübe</button>
            <button class="btn btn-sm btn-ghost" data-add="parking">🅿️ Otopark</button>
            <button class="btn btn-sm btn-ghost" data-add="playground">🛝 Oyun Parkı</button>
            <button class="btn btn-sm btn-ghost" data-add="tree">🌳 Ağaç</button>
            <button class="btn btn-sm btn-ghost" data-add="lamp">💡 Lamba</button>
            <button class="btn btn-sm btn-ghost" data-add="bench">🪑 Bank</button>
            <button class="btn btn-sm btn-ghost" id="rotate-btn">↻ Döndür</button>
            <button class="btn btn-sm btn-outline-red" id="delete-item-btn">🗑 Sil</button>
            <button class="btn btn-sm btn-green" id="save-layout-btn">💾 Kaydet</button>
          </div>
        </div>
        <p class="muted site-hint" id="site-hint">
          🖱 Sol Tık + Sürükle: Döndür · Sağ Tık: Kaydır · Scroll: Yakınlaş
        </p>
      </div>
      <div class="canvas-legend" id="canvas-legend">
        <span>🏢 Bina</span><span>🏊 Havuz</span><span>🛡️ Güvenlik</span><span>🅿️ Otopark</span><span>🛝 Oyun Parkı</span>
      </div>
      <div id="canvas-container"></div>
    </div>
  `;

  // Detay şeridini render et (varsayılan olarak aktif seçili bina)
  await updateOverviewDetails(S.activeBuildingId);

  // Kayıtlı yerleşimi yükle, sonra 3D sahneyi başlat
  await loadSiteLayout();
  init3DScene();
}

/* ---- Yerleşim kalıcılığı (migration 0012 — site_layouts) ---- */
let siteLayout = { buildings: {}, items: [] };
let siteLayoutAvailable = true;

async function loadSiteLayout() {
  siteLayout = { buildings: {}, items: [] };
  try {
    const { data, error } = await supabase.from('site_layouts').select('layout').eq('admin_id', S.user.id).maybeSingle();
    if (error) { siteLayoutAvailable = false; return; }
    siteLayoutAvailable = true;
    if (data?.layout) {
      siteLayout = {
        buildings: data.layout.buildings || {},
        items: Array.isArray(data.layout.items) ? data.layout.items : [],
      };
    }
  } catch { siteLayoutAvailable = false; }
}

async function saveSiteLayout() {
  const { error } = await supabase.from('site_layouts')
    .upsert({ admin_id: S.user.id, layout: siteLayout }, { onConflict: 'admin_id' });
  if (error) throw new Error(error.message);
}

// Seçilen binanın finansal ve idari durumunu üst yatay şeritte günceller
async function updateOverviewDetails(buildingId) {
  const detailsContainer = el('overview-details');
  if (!detailsContainer) return;

  const b = S.buildings.find(x => x.id === buildingId);
  if (!b) {
    detailsContainer.innerHTML = '<p class="muted" style="padding:20px;">Bina detayları için maketten veya üst menüden bir bina seçin.</p>';
    return;
  }

  detailsContainer.innerHTML = '<div class="loading" style="padding: 24px;">Yükleniyor…</div>';

  try {
    const [aptRes, feeRes, maintRes] = await Promise.all([
      supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('building_id', b.id),
      supabase.from('monthly_fees').select('id', { count: 'exact', head: true }).eq('building_id', b.id).eq('is_paid', false),
      supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).eq('building_id', b.id).eq('status', 'pending'),
    ]);

    const isCurrent = b.id === S.activeBuildingId;
    const totalBalance = Number(b.bank_balance || 0) + Number(b.cash_balance || 0) + Number(b.fund_balance || 0);

    detailsContainer.innerHTML = `
      <div class="detail-card ${isCurrent ? 'active-building' : ''}">
        <div class="detail-identity">
          <div class="building-icon-3d">🏢</div>
          <div class="detail-identity-text">
            <h3>${esc(b.name)}</h3>
            <span class="muted detail-addr">${esc(b.address || 'Adres belirtilmemiş')}</span>
            <div class="detail-tags">
              <span class="detail-tag">${hasAccess() ? `🔑 ${esc(b.building_code || '—')}` : '🔒 Kod ödemeyle açılır'}</span>
              <span class="detail-tag">🏗 ${b.floor_count || 5} Kat</span>
            </div>
          </div>
        </div>

        <div class="detail-stats-row">
          <div class="detail-stat-box"><div class="val">${b.apartment_count ?? aptRes.count ?? 0}</div><div class="lbl">Daire</div></div>
          <div class="detail-stat-box"><div class="val" style="color: var(--red);">${maintRes.count ?? 0}</div><div class="lbl">Açık Arıza</div></div>
          <div class="detail-stat-box"><div class="val" style="color: var(--amber);">${feeRes.count ?? 0}</div><div class="lbl">Bekleyen Borç</div></div>
          <div class="detail-stat-box detail-stat-balance"><div class="val" style="color: var(--green);">${TL(totalBalance)}</div><div class="lbl">Site Kasası (ortak)</div></div>
        </div>

        <div class="detail-action">
          <button class="btn btn-sm btn-ghost" id="rename-building-btn" data-id="${b.id}">✏️ Adını Değiştir</button>
          ${isCurrent
            ? `<span class="detail-managed-badge">✓ Seçili Blok</span>`
            : `<button class="btn" id="manage-building-btn" data-id="${b.id}">Bu Bloğu Seç →</button>`
          }
        </div>
      </div>
    `;

    const manageBtn = el('manage-building-btn');
    if (manageBtn) {
      manageBtn.onclick = () => {
        S.activeBuildingId = buildingId;
        renderBuildingSelector();
        navigate('overview');
      };
    }

    // 3D maketten binaya tıklayıp adını değiştirme (site kurulumu sonrası blok adlandırma)
    const renameBtn = el('rename-building-btn');
    if (renameBtn) {
      renameBtn.onclick = async () => {
        const newName = prompt('Binanın yeni adı:', b.name || '');
        if (!newName || !newName.trim() || newName.trim() === b.name) return;
        const { error } = await supabase.from('buildings').update({ name: newName.trim() }).eq('id', b.id);
        if (error) return toast(error.message, true);
        const idx = S.buildings.findIndex(x => x.id === b.id);
        if (idx !== -1) S.buildings[idx].name = newName.trim();
        toast('Bina adı güncellendi');
        renderBuildingSelector();
        navigate('overview');
      };
    }
  } catch (err) {
    detailsContainer.innerHTML = `<div class="error">Hata: ${esc(err.message)}</div>`;
  }
}

// Three.js ile 3D Site Maketi — isimli bina kapıları, çevre çiti + giriş kapısı,
// sürükle-bırak yerleşim, eklenebilir havuz / güvenlik kulübesi / ağaç / otopark.
let editMode = false;
let selectedObject = null;   // seçili bina veya eklenti (Group)
let itemMeshes = [];         // eklenti Group'ları
let selectionRing = null;

const SITE_HALF = 34;        // çitle çevrili alanın yarı genişliği

function makeTextTexture(text, bg = '#2B2620', color = '#FFF6E9') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = 'rgba(255,246,233,0.4)'; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = color; ctx.font = 'bold 56px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let t = String(text || '');
  if (t.length > 16) t = t.slice(0, 15) + '…';
  ctx.fillText(t, 256, 68);
  return new THREE.CanvasTexture(canvas);
}

// Cephe renk paleti — her bina id'sine göre tutarlı bir renk seçilir (çeşitlilik için)
const FACADE_COLORS = [0xe8dcc6, 0xdcc9a8, 0xe6d3c0, 0xd8cdb8, 0xece0cd, 0xd9c3a3];
function facadeColorFor(id) {
  let h = 0; const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FACADE_COLORS[h % FACADE_COLORS.length];
}

// Bina: sıvalı cephe + kat silmeleri + çerçeveli/ışıklı pencereler + ön cephede
// balkonlar + saçaklı giriş + çatı korkuluğu + su deposu + kapı üstü blok tabelası
function buildBuildingGroup(b) {
  const floors = Math.max(1, Number(b.floor_count || 5));
  const hUnit = 1.75;
  const h = floors * hUnit;
  const w = 6, d = 6;
  const group = new THREE.Group();
  const isActive = b.id === S.activeBuildingId;
  const baseColor = isActive ? 0xe9724c : facadeColorFor(b.id);

  // Gövde
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.72 })
  );
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // Zemin kat kaplaması (taş sokle)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.14, hUnit * 0.9, d + 0.14),
    new THREE.MeshStandardMaterial({ color: 0xb9ac95, roughness: 0.9 })
  );
  plinth.position.y = hUnit * 0.45;
  group.add(plinth);

  // Kat silmeleri (yatay şeritler)
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  for (let f = 1; f < floors; f++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, d + 0.1), bandMat);
    band.position.y = f * hUnit; group.add(band);
  }

  // Çatı + korkuluk (parapet)
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x9a8468, roughness: 0.85 })
  );
  roof.position.y = h + 0.15; roof.castShadow = true; group.add(roof);
  const parapetMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8 });
  [[0, h + 0.55, d / 2 + 0.2, w + 0.5, 0.5, 0.12], [0, h + 0.55, -d / 2 - 0.2, w + 0.5, 0.5, 0.12],
   [w / 2 + 0.2, h + 0.55, 0, 0.12, 0.5, d + 0.5], [-w / 2 - 0.2, h + 0.55, 0, 0.12, 0.5, d + 0.5]]
    .forEach(([x, y, z, sx, sy, sz]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), parapetMat);
      p.position.set(x, y, z); group.add(p);
    });
  // Çatıda su deposu + baca
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0xcf5b3a, roughness: 0.6 }));
  tank.position.set(-1.4, h + 0.75, -1.2); tank.castShadow = true; group.add(tank);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8a7a63 }));
  chimney.position.set(1.5, h + 0.7, 1.3); group.add(chimney);

  // Pencereler: cam + beyaz çerçeve; bazıları sıcak ışıkla "yanıyor"
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.7 });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x2b3a45, roughness: 0.2, metalness: 0.4 });
  const glassLit = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 0.7, roughness: 0.3 });
  const frameGeo = new THREE.PlaneGeometry(1.08, 0.9);
  const glassGeo = new THREE.PlaneGeometry(0.9, 0.74);
  let seed = 0; for (const ch of String(b.id || 'x')) seed += ch.charCodeAt(0);
  const lit = (f, i) => ((f * 7 + i * 13 + seed) % 5 === 0);

  const addWindow = (x, y, z, ry, key) => {
    const fr = new THREE.Mesh(frameGeo, frameMat); fr.position.set(x, y, z); fr.rotation.y = ry; group.add(fr);
    const gl = new THREE.Mesh(glassGeo, lit(key[0], key[1]) ? glassLit : glassDark);
    const off = 0.015;
    gl.position.set(x + Math.sin(ry) * off, y, z + Math.cos(ry) * off);
    gl.rotation.y = ry; group.add(gl);
  };

  for (let f = 0; f < floors; f++) {
    const y = f * hUnit + hUnit * 0.6;
    [-1.9, 0, 1.9].forEach((x, i) => {
      if (!(f === 0 && x === 0)) addWindow(x, y, d / 2 + 0.03, 0, [f, i]);
      addWindow(x, y, -d / 2 - 0.03, Math.PI, [f, i + 3]);
    });
    [-1.9, 1.9].forEach((z, i) => {
      addWindow(-w / 2 - 0.03, y, z, -Math.PI / 2, [f, i + 6]);
      addWindow(w / 2 + 0.03, y, z, Math.PI / 2, [f, i + 8]);
    });
  }

  // Ön cephe balkonları (üst katlar) — taban + korkuluk
  const balMat = new THREE.MeshStandardMaterial({ color: 0xece3d3, roughness: 0.85 });
  const railBalMat = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.7 });
  for (let f = 1; f < floors; f++) {
    for (const x of [-1.9, 1.9]) {
      const y = f * hUnit + hUnit * 0.28;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.8), balMat);
      slab.position.set(x, y, d / 2 + 0.42); slab.castShadow = true; group.add(slab);
      const railF = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.06), railBalMat);
      railF.position.set(x, y + 0.33, d / 2 + 0.8); group.add(railF);
      for (const sx of [-0.85, 0.85]) {
        const railS = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.8), railBalMat);
        railS.position.set(x + sx, y + 0.33, d / 2 + 0.42); group.add(railS);
      }
    }
  }

  // Giriş: saçak + kapı + basamak
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.7 }));
  canopy.position.set(0, hUnit * 0.98, d / 2 + 0.7); canopy.castShadow = true; group.add(canopy);
  for (const sx of [-1.2, 1.2]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, hUnit * 0.98, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b5b45 }));
    pole.position.set(sx, hUnit * 0.49, d / 2 + 1.3); group.add(pole);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3f2c1c, roughness: 0.5, metalness: 0.2 }));
  door.position.set(0, 1.1, d / 2 + 0.07); group.add(door);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x9fc8d8, roughness: 0.2, metalness: 0.3 }));
  doorGlass.position.set(0, 1.5, d / 2 + 0.14); group.add(doorGlass);
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xd2c9b4 }));
  step.position.set(0, 0.09, d / 2 + 0.75); step.receiveShadow = true; group.add(step);

  // Kapı üstü blok adı tabelası (iki yüz)
  const signTex = makeTextTexture(b.name);
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: signTex }));
  signFront.position.set(0, hUnit * 1.12, d / 2 + 0.05); group.add(signFront);

  group.userData = { kind: 'building', id: b.id, name: b.name, body };
  return group;
}

// Basit araba modeli (otoparkta ve yolda kullanılır)
function makeCar(color) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.9), bodyMat);
  lower.position.y = 0.42; lower.castShadow = true; car.add(lower);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x2b3a45, roughness: 0.25, metalness: 0.4 }));
  cabin.position.set(-0.1, 0.82, 0); car.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12);
  [[-0.55, -0.42], [0.55, -0.42], [-0.55, 0.42], [0.55, 0.42]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.22, z); car.add(wheel);
  });
  return car;
}

// Eklentiler: havuz, güvenlik kulübesi, otopark, oyun parkı, ağaç, lamba, bank
function buildItemGroup(item) {
  const group = new THREE.Group();
  const t = item.type;

  if (t === 'pool') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0xe5ddca, roughness: 0.9 }));
    deck.position.y = 0.09; deck.receiveShadow = true; group.add(deck);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.24, 6.6),
      new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.8 }));
    rim.position.y = 0.14; group.add(rim);
    const water = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.16, 5.8),
      new THREE.MeshStandardMaterial({ color: 0x33a5d6, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9 }));
    water.position.y = 0.2; group.add(water);
    // Şezlonglar + şemsiye
    const loungeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7 });
    for (const x of [-4.3, 4.3]) {
      const lounge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.6), loungeMat);
      lounge.position.set(x, 0.3, 2.6); lounge.castShadow = true; group.add(lounge);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a7a63 }));
    pole.position.set(4.3, 0.9, 2.6); group.add(pole);
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xe9724c, roughness: 0.7 }));
    umbrella.position.set(4.3, 1.75, 2.6); umbrella.castShadow = true; group.add(umbrella);
    // Merdiven korkulukları
    const ladMat = new THREE.MeshStandardMaterial({ color: 0xcfd6da, metalness: 0.6, roughness: 0.3 });
    for (const x of [-0.5, 0.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), ladMat);
      bar.position.set(x, 0.5, -3); group.add(bar);
    }
  } else if (t === 'guard') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3),
      new THREE.MeshStandardMaterial({ color: 0xcfc6b3 }));
    base.position.y = 0.1; base.receiveShadow = true; group.add(base);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.5, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xf4ead6, roughness: 0.75 }));
    hut.position.y = 1.45; hut.castShadow = true; group.add(hut);
    const hroof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.1, 4),
      new THREE.MeshStandardMaterial({ color: 0xb23a2e }));
    hroof.position.y = 3.25; hroof.rotation.y = Math.PI / 4; hroof.castShadow = true; group.add(hroof);
    const gwin = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x9fc8d8, roughness: 0.2, metalness: 0.35 }));
    gwin.position.set(0, 1.7, 1.32); group.add(gwin);
    const gsign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55),
      new THREE.MeshBasicMaterial({ map: makeTextTexture('GÜVENLİK', '#B23A2E') }));
    gsign.position.set(0, 2.55, 1.33); group.add(gsign);
    // Bariyer kolu
    const barPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.4 }));
    barPost.position.set(2, 0.55, 0); group.add(barPost);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xe23b2e }));
    arm.position.set(4, 1.05, 0); group.add(arm);
    const armStripe = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xffffff }));
    armStripe.position.set(4, 1.05, 0.09); group.add(armStripe);
  } else if (t === 'parking') {
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(13, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.95 }));
    asphalt.position.y = 0.05; asphalt.receiveShadow = true; group.add(asphalt);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 6), lineMat);
      line.position.set(i * 2.5, 0.06, -0.5); group.add(line);
    }
    // Bazı yerlere park etmiş arabalar
    const carColors = [0x4d7cc7, 0xd04a3a, 0x3a3f45, 0xe0e0e0];
    [-3.75, -1.25, 1.25, 3.75].forEach((x, i) => {
      if (i === 2) return; // bir yer boş
      const car = makeCar(carColors[i % carColors.length]);
      car.position.set(x, 0.1, -0.5); car.rotation.y = Math.PI / 2; group.add(car);
    });
  } else if (t === 'playground') {
    const mat = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0xd98b5b, roughness: 0.95 }));
    mat.position.y = 0.06; mat.receiveShadow = true; group.add(mat);
    // Kaydırak
    const slideMat = new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.5 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x4d7cc7, roughness: 0.6 }));
    tower.position.set(-2, 0.9, 0); tower.castShadow = true; group.add(tower);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 2.4), slideMat);
    slide.position.set(-0.8, 0.85, 0); slide.rotation.x = 0.5; slide.castShadow = true; group.add(slide);
    // Salıncak
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe23b2e, metalness: 0.3, roughness: 0.5 });
    for (const x of [1.6, 3.4]) {
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), frameMat);
      leg1.position.set(x, 1, -0.6); leg1.rotation.x = 0.25; group.add(leg1);
      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), frameMat);
      leg2.position.set(x, 1, 0.6); leg2.rotation.x = -0.25; group.add(leg2);
    }
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), frameMat);
    topBar.position.set(2.5, 1.95, 0); topBar.rotation.z = Math.PI / 2; group.add(topBar);
    for (const x of [2.1, 2.9]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x333333 }));
      seat.position.set(x, 0.7, 0); group.add(seat);
    }
  } else if (t === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
    trunk.position.y = 0.8; trunk.castShadow = true; group.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d7c3f, roughness: 0.85 });
    [[0, 2.4, 0, 1.3], [0.7, 1.9, 0.35, 0.85], [-0.65, 1.95, -0.3, 0.8], [0.2, 2.9, -0.2, 0.7]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), leafMat);
      s.position.set(x, y, z); s.castShadow = true; group.add(s);
    });
  } else if (t === 'lamp') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.4, roughness: 0.5 }));
    pole.position.y = 1.7; pole.castShadow = true; group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45 }));
    arm.position.set(0.4, 3.35, 0); group.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd166, emissiveIntensity: 0.9 }));
    bulb.position.set(0.85, 3.25, 0); group.add(bulb);
    const light = new THREE.PointLight(0xffd98a, 0.5, 12);
    light.position.set(0.85, 3.1, 0); group.add(light);
  } else if (t === 'bench') {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), woodMat);
    seat.position.y = 0.5; seat.castShadow = true; group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.12), woodMat);
    back.position.set(0, 0.78, -0.24); group.add(back);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.4 });
    for (const x of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.5), legMat);
      leg.position.set(x, 0.25, 0); group.add(leg);
    }
  }

  group.position.set(item.x || 0, 0, item.z || 0);
  group.rotation.y = item.rot || 0;
  group.userData = { kind: 'item', id: item.id, type: t };
  return group;
}

// Çevre: alçak taş duvar + üstünde korkuluk + tuğla direkler + giriş kapısı (sürgülü kanatlar + tabela)
function buildFencePerimeter(scene) {
  const half = SITE_HALF;
  const gateGap = 5; // ön cephede kapı açıklığı yarısı
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcabfa6, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6f6355, metalness: 0.35, roughness: 0.5 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.85 });

  // Bir duvar segmenti: alçak dolu duvar + üst kapak + dikey korkuluk çubukları
  const addWallSeg = (cx, cz, len, horizontal) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : 0.3, 0.9, horizontal ? 0.3 : len), wallMat);
    wall.position.set(cx, 0.45, cz); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : 0.42, 0.12, horizontal ? 0.42 : len), capMat);
    cap.position.set(cx, 0.96, cz); scene.add(cap);
    // Korkuluk çubukları
    const count = Math.floor(len / 0.7);
    for (let i = 0; i <= count; i++) {
      const t = -len / 2 + (i / count) * len;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), railMat);
      bar.position.set(horizontal ? cx + t : cx, 1.35, horizontal ? cz : cz + t);
      scene.add(bar);
    }
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : 0.08, 0.08, horizontal ? 0.08 : len), railMat);
    topRail.position.set(cx, 1.72, cz); scene.add(topRail);
  };

  // Tuğla köşe/ara direkleri
  const addPillar = (x, z) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.6), pillarMat);
    p.position.set(x, 1, z); p.castShadow = true; scene.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.78), capMat);
    cap.position.set(x, 2.05, z); scene.add(cap);
  };

  // Ön cephe (kapı açıklığı hariç, iki yana)
  addWallSeg(-(half + gateGap) / 2, half, half - gateGap, true);
  addWallSeg((half + gateGap) / 2, half, half - gateGap, true);
  addWallSeg(0, -half, half * 2, true);       // arka
  addWallSeg(half, 0, half * 2, false);       // sağ
  addWallSeg(-half, 0, half * 2, false);      // sol
  // Köşe direkleri + kapı direkleri
  [[-half, half], [half, half], [-half, -half], [half, -half], [-gateGap, half], [gateGap, half]].forEach(([x, z]) => addPillar(x, z));

  // Giriş kapısı: iki kolon + üst kemer tabelası + iki demir kanat
  const colMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.7 });
  for (const x of [-gateGap, gateGap]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1, 3.6, 1), colMat);
    col.position.set(x, 1.8, half); col.castShadow = true; scene.add(col);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd166, emissiveIntensity: 0.8 }));
    lamp.position.set(x, 3.8, half); scene.add(lamp);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(gateGap * 2 + 1, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.7 }));
  lintel.position.set(0, 3.9, half); scene.add(lintel);
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(gateGap * 2 - 0.5, 1.1),
    new THREE.MeshBasicMaterial({ map: makeTextTexture('KOMŞU SİTESİ', '#7A5C3A'), side: THREE.DoubleSide }));
  gateSign.position.set(0, 3.9, half + 0.36); scene.add(gateSign);
  // Yarı açık demir kanatlar
  const gateWingMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, metalness: 0.4, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(gateGap - 0.4, 2, 0.1), gateWingMat);
    frame.position.set((gateGap - 0.4) / 2 * -side, 1.1, 0);
    wing.add(frame);
    for (let i = 1; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), gateWingMat);
      bar.position.set((-side) * (i / 6) * (gateGap - 0.4), 1.1, 0.02); wing.add(bar);
    }
    wing.position.set(side * gateGap, 0, half);
    wing.rotation.y = side * 0.5; // içeri doğru yarı açık
    scene.add(wing);
  }

  // Dış kaldırım (duvarın dışını çevreleyen ince şerit)
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.9 });
  const walk = new THREE.Mesh(new THREE.BoxGeometry((half + 2) * 2, 0.04, (half + 2) * 2), walkMat);
  walk.position.y = 0.005; walk.receiveShadow = true;
  // yalnızca kenar görünmesi için çimden biraz büyük; çim üstüne biner, sorun değil
  scene.add(walk);
}

function init3DScene() {
  const container = el('canvas-container');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  editMode = false;
  selectedObject = null;
  buildingMeshes = [];
  itemMeshes = [];

  // Sahne / kamera / renderer
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0xcfe3f0);
  threeScene.fog = new THREE.FogExp2(0xcfe3f0, 0.006);

  threeCamera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
  threeCamera.position.set(0, 46, 66);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding !== undefined) threeRenderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(threeRenderer.domElement);

  threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;
  threeControls.maxPolarAngle = Math.PI / 2.15;
  threeControls.minDistance = 12;
  threeControls.maxDistance = 150;
  threeControls.target.set(0, 2, 0);

  // Işıklar: gökyüzü/yer yumuşak ışığı + güneş
  threeScene.add(new THREE.HemisphereLight(0xdff0ff, 0x9ebf7d, 0.75));
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.28));
  const dirLight = new THREE.DirectionalLight(0xfff2d8, 0.95);
  dirLight.position.set(32, 52, 26);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0004;
  const dd = 58;
  dirLight.shadow.camera.left = -dd; dirLight.shadow.camera.right = dd;
  dirLight.shadow.camera.top = dd; dirLight.shadow.camera.bottom = -dd;
  dirLight.shadow.camera.far = 180;
  threeScene.add(dirLight);

  // Zemin: dış alan + site içi çim + bahçe yamaları
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0xbfc7c2, roughness: 0.98 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; outer.receiveShadow = true;
  threeScene.add(outer);

  const grass = new THREE.Mesh(new THREE.BoxGeometry(SITE_HALF * 2, 0.06, SITE_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x8fb86a, roughness: 0.98 }));
  grass.position.y = 0.01; grass.receiveShadow = true;
  threeScene.add(grass);
  // Çim üstünde daha koyu yeşil "peyzaj" yamaları
  const patchMat = new THREE.MeshStandardMaterial({ color: 0x7ba659, roughness: 1 });
  [[-SITE_HALF + 8, -SITE_HALF + 8, 8, 6], [SITE_HALF - 9, -SITE_HALF + 7, 7, 5],
   [-SITE_HALF + 7, SITE_HALF - 9, 6, 6]].forEach(([x, z, sx, sz]) => {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.02, sz), patchMat);
    patch.position.set(x, 0.05, z); threeScene.add(patch);
  });

  // Yollar: girişten içeri ana yol + yatay bağlantı yolu (şerit çizgili)
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x51555b, roughness: 0.92 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xf0e9c0 });
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, SITE_HALF + 8), roadMat);
  mainRoad.position.set(0, 0.05, SITE_HALF / 2 - 2); mainRoad.receiveShadow = true;
  threeScene.add(mainRoad);
  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(SITE_HALF * 2 - 8, 0.08, 3.6), roadMat);
  crossRoad.position.set(0, 0.05, 2); crossRoad.receiveShadow = true;
  threeScene.add(crossRoad);
  for (let z = -SITE_HALF + 4; z < SITE_HALF; z += 3) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 1.3), laneMat);
    dash.position.set(0, 0.06, z); threeScene.add(dash);
  }

  buildFencePerimeter(threeScene);

  // Varsayılan dekor: ana yol boyunca sokak lambaları (kullanıcı ayrıca ekleyebilir)
  [[-3, SITE_HALF - 6], [3, SITE_HALF - 16], [-3, SITE_HALF - 26], [3, 4]].forEach(([x, z]) => {
    const lamp = buildItemGroup({ id: 'deco', type: 'lamp', x, z, rot: 0 });
    threeScene.add(lamp);
  });

  // Binalar: kayıtlı konum varsa oradan, yoksa yol boyunca dizilir
  S.buildings.forEach((b, idx) => {
    const group = buildBuildingGroup(b);
    const saved = siteLayout.buildings[b.id];
    if (saved) {
      group.position.set(saved.x || 0, 0, saved.z || 0);
      group.rotation.y = saved.rot || 0;
    } else {
      const xPos = (idx - (S.buildings.length - 1) / 2) * 13;
      group.position.set(Math.max(-SITE_HALF + 5, Math.min(SITE_HALF - 5, xPos)), 0, -7);
    }
    threeScene.add(group);
    buildingMeshes.push(group);
  });

  // Kayıtlı eklentiler
  for (const item of siteLayout.items) {
    const g = buildItemGroup(item);
    threeScene.add(g);
    itemMeshes.push(g);
  }

  // Seçim halkası
  selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 5, 40),
    new THREE.MeshBasicMaterial({ color: 0xe9724c, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.06;
  selectionRing.visible = false;
  threeScene.add(selectionRing);

  const setSelection = (obj) => {
    selectedObject = obj;
    if (obj) {
      selectionRing.visible = true;
      selectionRing.position.x = obj.position.x;
      selectionRing.position.z = obj.position.z;
    } else {
      selectionRing.visible = false;
    }
  };

  const highlightActiveBuilding = () => {
    buildingMeshes.forEach(g => {
      g.userData.body.material.color.setHex(g.userData.id === S.activeBuildingId ? 0xe9724c : 0xe4d5bc);
    });
  };

  // Raycast yardımcıları
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planePoint = new THREE.Vector3();

  const setMouse = (event) => {
    const rect = threeRenderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };
  const rootOf = (obj) => {
    let cur = obj;
    while (cur && !(cur.userData && cur.userData.kind)) cur = cur.parent;
    return cur;
  };
  const pickObject = (event) => {
    setMouse(event);
    raycaster.setFromCamera(mouse, threeCamera);
    const targets = editMode ? [...buildingMeshes, ...itemMeshes] : buildingMeshes;
    const hits = raycaster.intersectObjects(targets, true);
    return hits.length ? rootOf(hits[0].object) : null;
  };

  // Sürükleme (yalnızca düzenleme modunda)
  let dragging = null;
  let dragMoved = false;
  const dragOffset = new THREE.Vector3();

  threeRenderer.domElement.addEventListener('pointerdown', (event) => {
    const obj = pickObject(event);
    dragMoved = false;
    if (!obj) return;
    setSelection(obj);
    if (editMode) {
      dragging = obj;
      threeControls.enabled = false;
      raycaster.ray.intersectPlane(groundPlane, planePoint);
      dragOffset.copy(planePoint).sub(obj.position);
    }
  });

  threeRenderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragMoved = true;
    setMouse(event);
    raycaster.setFromCamera(mouse, threeCamera);
    if (raycaster.ray.intersectPlane(groundPlane, planePoint)) {
      const lim = SITE_HALF - 4;
      dragging.position.x = Math.max(-lim, Math.min(lim, planePoint.x - dragOffset.x));
      dragging.position.z = Math.max(-lim, Math.min(lim, planePoint.z - dragOffset.z));
      selectionRing.position.x = dragging.position.x;
      selectionRing.position.z = dragging.position.z;
    }
  });

  threeRenderer.domElement.addEventListener('pointerup', () => {
    dragging = null;
    threeControls.enabled = true;
  });

  // Tıklama: bina seçimi sağ paneli günceller (sürükleme değilse)
  threeRenderer.domElement.addEventListener('click', (event) => {
    if (dragMoved) return;
    const obj = pickObject(event);
    if (obj && obj.userData.kind === 'building') {
      updateOverviewDetails(obj.userData.id);
      buildingMeshes.forEach(g => {
        g.userData.body.material.color.setHex(
          g.userData.id === obj.userData.id ? 0xe9724c : 0xe4d5bc
        );
      });
    }
  });

  /* ---- Düzenleme araç çubuğu ---- */
  const toolsEl = el('edit-tools');
  const hintEl = el('site-hint');
  const editBtn = el('edit-layout-btn');

  editBtn.onclick = () => {
    editMode = !editMode;
    toolsEl.classList.toggle('hidden', !editMode);
    editBtn.textContent = editMode ? '✖ Düzenlemeyi Kapat' : '🔧 Yerleşimi Düzenle';
    hintEl.textContent = editMode
      ? '🖐 Bina/eklentiyi sürükleyerek gerçek yerine taşıyın · Döndür/Sil için önce üzerine tıklayın · Kaydet\'meden çıkarsanız değişiklikler kaybolur'
      : '🖱 Sol Tık + Sürükle: Döndür · Sağ Tık: Kaydır · Scroll: Yakınlaş';
    if (!editMode) setSelection(null);
  };

  el('site-toolbar').addEventListener('click', (e) => {
    const addBtn = e.target.closest('button[data-add]');
    if (!addBtn) return;
    const type = addBtn.dataset.add;
    if (type === 'guard' && !activeBuilding()?.security_username) {
      toast('İpucu: Güvenlik girişini Site Ayarları\'ndan tanımlayabilirsiniz', false);
    }
    const item = { id: 'itm-' + Date.now().toString(36), type, x: 0, z: 16, rot: 0 };
    const g = buildItemGroup(item);
    threeScene.add(g);
    itemMeshes.push(g);
    setSelection(g);
  });

  el('rotate-btn').onclick = () => {
    if (!selectedObject) return toast('Önce bir bina veya eklenti seçin', true);
    selectedObject.rotation.y += Math.PI / 2;
  };

  el('delete-item-btn').onclick = () => {
    if (!selectedObject) return toast('Önce silinecek eklentiyi seçin', true);
    if (selectedObject.userData.kind !== 'item') return toast('Binalar buradan silinemez; yalnızca taşınabilir', true);
    threeScene.remove(selectedObject);
    itemMeshes = itemMeshes.filter(g => g !== selectedObject);
    setSelection(null);
  };

  el('save-layout-btn').onclick = async () => {
    // Sahnedeki güncel konumları topla ve kalıcı yaz
    siteLayout = {
      buildings: Object.fromEntries(buildingMeshes.map(g => [
        g.userData.id,
        { x: +g.position.x.toFixed(2), z: +g.position.z.toFixed(2), rot: +g.rotation.y.toFixed(3) },
      ])),
      items: itemMeshes.map(g => ({
        id: g.userData.id, type: g.userData.type,
        x: +g.position.x.toFixed(2), z: +g.position.z.toFixed(2), rot: +g.rotation.y.toFixed(3),
      })),
    };
    try {
      await saveSiteLayout();
      toast('Site yerleşimi kaydedildi 🏘');
    } catch (err) {
      toast(siteLayoutAvailable ? err.message : 'Kayıt için veritabanı güncellemesi (0012) gerekli', true);
    }
  };

  highlightActiveBuilding();

  // Animasyon döngüsü
  let animationFrameId;
  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    threeControls.update();
    threeRenderer.render(threeScene, threeCamera);
  }
  animate();

  // Resize dinleyicisi
  const resizeObserver = new ResizeObserver(() => {
    if (!container || !threeRenderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    threeCamera.aspect = w / h;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // Bölüm değişince döngüyü ve resize'ı temizle
  const cleanInterval = setInterval(() => {
    if (!document.getElementById('canvas-container')) {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      clearInterval(cleanInterval);
    }
  }, 1000);
}

/* Bina ekleme kaldırıldı: site ve binalar yalnızca mobil kayıt akışında
   (create_site_with_buildings RPC) oluşturulur. */


/* ============ 2) DAİRELER (ekleme yok — sakinler kendi ekler) ============ */
async function renderApartments() {
  if (!needBuilding()) return;
  const { data } = await supabase.from('apartments').select('*').eq('building_id', bId());
  const list = sortByApartment(data);
  const rows = (filter='') => list
    .filter(a => !filter || `${a.apartment_number} ${a.owner_name||''} ${a.username||''} ${a.vehicle_plate_number||''}`.toLowerCase().includes(filter.toLowerCase()))
    .map(a => `<tr>
      <td><strong>${esc(a.apartment_number)}</strong></td>
      <td>${esc(a.owner_name||'—')}</td>
      <td>${esc(a.owner_phone||'—')}</td>
      <td>${esc(a.vehicle_plate_number||'—')}</td>
      <td><input class="share-input" data-share="${a.id}" inputmode="decimal" placeholder="—"
           value="${a.land_share != null ? Number(a.land_share) : ''}" title="Arsa payı (KMK m.20)"></td>
      <td>${isOccupied(a)
        ? `<button class="badge chip-toggle ${a.is_active?'b-green':'b-red'}" data-act="toggle" data-id="${a.id}" data-on="${a.is_active}">${a.is_active?'Aktif':'Pasif'}</button>`
        : '<span class="badge b-gray" title="Sakin katılmamış — aidat ve borç hesabına girmez">Boş</span>'}</td>
      <td class="t-right"><button class="btn btn-sm btn-outline-red" data-act="del" data-id="${a.id}" data-no="${esc(a.apartment_number)}">Sil</button></td>
    </tr>`).join('');

  $content().innerHTML = `
    <div class="page-head"><h2>Daireler &amp; Sakinler</h2>
      <div class="tools"><input class="search" id="apt-search" placeholder="Daire, sahip, plaka ara…"></div>
    </div>
    <div class="info-banner">Daireler, sakinlerin mobil uygulamada <strong>bina kodu</strong> ile kendilerini eklemesiyle otomatik oluşur. Buradan yeni daire eklenmez; mevcut daireleri yönetebilirsiniz.
      <br><strong>Arsa payı</strong> alanını doldurursanız işletme projesi giderleri ve genel kurul yeter sayısı KMK m.20/m.30'a uygun hesaplanır. Boş bırakılırsa eşit dağıtım yapılır.</div>
    <div class="card"><table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th>Telefon</th><th>Plaka</th><th>Arsa Payı</th><th>Durum</th><th></th></tr></thead>
      <tbody id="apt-body">${list.length ? rows() : '<tr><td colspan="7" class="t-empty">Henüz sakin kaydı yok</td></tr>'}</tbody></table></div>`;

  el('apt-search')?.addEventListener('input', (e) => {
    el('apt-body').innerHTML = rows(e.target.value) || '<tr><td colspan="7" class="t-empty">Eşleşen daire yok</td></tr>';
  });
  // Arsa payı: alandan çıkınca kaydet. Boş bırakılırsa null yazılır.
  el('apt-body').addEventListener('change', async (e) => {
    const inp = e.target.closest('input[data-share]'); if (!inp) return;
    const raw = inp.value.trim().replace(',', '.');
    const val = raw === '' ? null : Number(raw);
    if (val !== null && (!isFinite(val) || val < 0)) return toast('Geçersiz arsa payı', true);
    const { error } = await supabase.from('apartments').update({ land_share: val }).eq('id', inp.dataset.share);
    if (error) return toast(error.message, true);
    inp.classList.add('saved');
    setTimeout(() => inp.classList.remove('saved'), 900);
  });

  el('apt-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    if (btn.dataset.act === 'toggle') {
      const on = btn.dataset.on === 'true';
      const { error } = await supabase.from('apartments').update({ is_active: !on }).eq('id', btn.dataset.id);
      if (error) return toast(error.message, true);
      toast(!on ? 'Daire aktifleştirildi' : 'Daire pasifleştirildi'); renderApartments();
    } else if (btn.dataset.act === 'del') {
      if (!confirm(`${btn.dataset.no} dairesini silmek istediğinize emin misiniz?`)) return;
      const { error } = await supabase.from('apartments').delete().eq('id', btn.dataset.id);
      if (error) return toast(error.message, true);
      toast('Daire silindi'); renderApartments();
    }
  }, { once: true });
}

/* ============ 3) AİDAT ============ */
let feeState = { year: new Date().getFullYear(), month: new Date().getMonth()+1 };
async function renderFees() {
  if (!needBuilding()) return;
  const { year, month } = feeState;
  const [aptRes, feeRes] = await Promise.all([
    supabase.from('apartments').select('id, apartment_number, owner_name, user_id, username').eq('building_id', bId()),
    supabase.from('monthly_fees').select('*').eq('building_id', bId()).eq('year', year).eq('month', month),
  ]);
  // Yer tutucu (boş) daireler aidat hesabına GİRMEZ; sahibi bilinmeyen
  // daireye borç yazmak hayali alacak üretir.
  const allApts = sortByApartment(aptRes.data);
  const apts = occupiedOnly(allApts);
  const emptyCount = allApts.length - apts.length;
  const fees = feeRes.data || [];
  const feeByApt = new Map(fees.map(f => [f.apartment_id, f]));
  const paid = fees.filter(f => f.is_paid); const totalPaid = paid.reduce((s,f)=>s+Number(f.amount),0);
  const totalExpected = fees.reduce((s,f)=>s+Number(f.amount),0);

  const monthOpts = MONTHS.map((m,i)=>`<option value="${i+1}" ${i+1===month?'selected':''}>${m}</option>`).join('');
  const years = [year-2,year-1,year,year+1].filter((v,i,a)=>a.indexOf(v)===i);
  const yearOpts = years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('');

  const rows = apts.map(a => {
    const f = feeByApt.get(a.id);
    // Ödeme kontrolü onay kutusu: dolu yeşil buton "zaten ödenmiş" izlenimi
    // veriyordu. Kutu boşsa ödenmemiş, işaretlenince ödenmiş — tek bakışta belli.
    const payCell = !f
      ? `<button class="btn btn-sm btn-ghost" data-act="mk" data-apt="${a.id}" data-no="${esc(a.apartment_number)}">Aidat Gir</button>`
      : `<label class="pay-check${f.is_paid ? ' is-paid' : ''}">
           <input type="checkbox" data-act="toggle" data-id="${f.id}" data-on="${f.is_paid}"
                  data-amt="${f.amount}" data-no="${esc(a.apartment_number)}"
                  data-uid="${a.user_id||''}" ${f.is_paid ? 'checked' : ''}>
           <span>${f.is_paid ? 'Ödendi' : 'Ödendi olarak işaretle'}</span>
         </label>`;
    return `<tr>
      <td><strong>${esc(a.apartment_number)}</strong></td>
      <td>${esc(a.owner_name || '—')}</td>
      <td>${f ? TL(f.amount) : '—'}</td>
      <td>${f ? `<span class="badge ${f.is_paid?'b-green':'b-amber'}">${f.is_paid?'Ödendi':'Bekliyor'}</span>` : '<span class="badge b-gray">Kayıt yok</span>'}</td>
      <td>${f?.paid_date ? dmy(f.paid_date) : '—'}</td>
      <td class="t-right">${payCell}</td>
    </tr>`;
  }).join('');

  $content().innerHTML = `
    <div class="page-head"><h2>Aidat Takibi</h2>
      <div class="tools">
        <select class="mini" id="fee-month">${monthOpts}</select>
        <select class="mini" id="fee-year">${yearOpts}</select>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat"><div class="val">${paid.length}/${apts.length}</div><div class="lbl">Ödeyen Daire</div></div>
      <div class="stat"><div class="val">${TL(totalPaid)}</div><div class="lbl">Toplanan</div></div>
      <div class="stat"><div class="val">${TL(totalExpected-totalPaid)}</div><div class="lbl">Bekleyen</div></div>
    </div>
    <div class="card">
      <h3>Tüm Dairelere ${MONTHS[month-1]} ${year} Aidatı Uygula</h3>
      <div class="grid-2">
        <div class="field" style="margin:0"><input id="bulk-amt" inputmode="decimal" placeholder="Örn: 1500"></div>
        <button class="btn" id="bulk-apply">Uygula</button>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Kaydı olmayan dairelere aidat oluşturur; ödenmemiş kayıtların tutarını günceller (ödenmiş olanlara dokunmaz).
      ${emptyCount ? `<br><strong>${emptyCount} boş daire</strong> hesaba katılmaz — sakin katılınca otomatik dahil olur.` : ''}</p>
    </div>
    <div class="card"><table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th>Tutar</th><th>Durum</th><th>Ödeme Tarihi</th><th></th></tr></thead>
      <tbody id="fee-body">${apts.length ? rows : '<tr><td colspan="6" class="t-empty">Önce sakinler daire eklemeli</td></tr>'}</tbody></table></div>`;

  el('fee-month').addEventListener('change', e => { feeState.month = +e.target.value; renderFees(); });
  el('fee-year').addEventListener('change', e => { feeState.year = +e.target.value; renderFees(); });

  el('bulk-apply').addEventListener('click', async () => {
    const amt = parseFloat(String(el('bulk-amt').value).replace(',','.'));
    if (isNaN(amt) || amt <= 0) return toast('Geçerli bir tutar girin', true);
    el('bulk-apply').disabled = true;
    try {
      for (const a of apts) {
        const f = feeByApt.get(a.id);
        if (!f) await supabase.from('monthly_fees').insert({ apartment_id:a.id, building_id:bId(), year, month, amount:amt, is_paid:false });
        else if (!f.is_paid) await supabase.from('monthly_fees').update({ amount:amt }).eq('id', f.id);
      }
      notifyBuilding('💰 Yeni Aidat', `${MONTHS[month-1]} ${year} aidatı ${TL(amt)} olarak tanımlandı.`);
      toast('Aidatlar uygulandı'); renderFees();
    } catch (err) { toast(err.message, true); el('bulk-apply').disabled = false; }
  });

  el('fee-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="mk"]'); if (!btn) return;
    btn.disabled = true;
    try {
      const amtStr = prompt(`${btn.dataset.no} için aidat tutarı (₺):`); if (!amtStr) { btn.disabled=false; return; }
      const amt = parseFloat(amtStr.replace(',','.')); if (isNaN(amt)||amt<=0) return toast('Geçersiz tutar', true);
      await supabase.from('monthly_fees').insert({ apartment_id:btn.dataset.apt, building_id:bId(), year, month, amount:amt, is_paid:false });
      renderFees();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });

  // Ödeme onay kutusu: işaretlemek ödemeyi kaydeder, kaldırmak geri alır.
  el('fee-body').addEventListener('change', async (e) => {
    const box = e.target.closest('input[type="checkbox"][data-act="toggle"]'); if (!box) return;
    const on = box.dataset.on === 'true';
    const amt = Number(box.dataset.amt);
    if (on && !confirm(`Daire ${box.dataset.no} için ödemeyi geri almak istediğinize emin misiniz? Tutar kasadan düşülecek.`)) {
      box.checked = true; return;
    }
    box.disabled = true;
    try {
      await supabase.from('monthly_fees').update({ is_paid: !on, paid_by: !on ? S.user.id : null, paid_date: !on ? new Date().toISOString() : null }).eq('id', box.dataset.id);
      await adjustBalance({ amount: amt, operation: !on ? 'add' : 'subtract',
        description: `${!on?'Aidat ödemesi':'Aidat iptali'} - Daire ${box.dataset.no} - ${year}/${month}`, category:'fee', walletType:'bank', relatedId: box.dataset.id });
      if (!on && box.dataset.uid) {
        notifyUser(box.dataset.uid, '✅ Aidat Onaylandı', `${MONTHS[month-1]} ${year} ayı aidatınız ödendi olarak işaretlendi.`);
      }
      toast(!on ? 'Ödendi işaretlendi, kasaya eklendi' : 'Ödeme geri alındı'); renderFees();
    } catch (err) {
      toast(err.message, true);
      box.checked = on; box.disabled = false; // hata: kutuyu eski haline döndür
    }
  });
}

/* ============ 4) KASA (mobil "Kasa Yönetimi" ekranıyla birebir aynı akış) ============ */
let walletState = { year: new Date().getFullYear(), month: new Date().getMonth() + 1, tab: 'all' };

async function renderTransactions() {
  if (!needBuilding()) return;
  await refreshBuilding();
  const b = activeBuilding();
  if (!b) return;
  const { data } = await supabase.from('transactions').select('*').in('building_id', siteBIds()).order('created_at', { ascending:false }).limit(400);
  const txs = data || [];
  const pending = txs.filter(t => t.status === 'pending');
  const { year, month, tab } = walletState;

  const inMonth = txs.filter(t => {
    const d = new Date(t.created_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const filtered = inMonth.filter(t => tab === 'all' ? t.status !== 'pending' : (t.type === tab && t.status !== 'pending'));

  // Kasa SİTE ortak: bakiye site kaydından okunur (bina kayıtları aynadır)
  const bank = Number((S.site ?? b).bank_balance || 0);
  const isNeg = bank < 0;

  // MUTABAKAT: bakiye ayrı bir alanda saklanıyor, işlem kaydı ayrı yazılıyor.
  // İkisi tek transaction olmadığı için (RPC + insert) ayrışabilirler.
  // Onaylanmış banka hareketlerinden beklenen bakiyeyi hesaplayıp farkı gösteriyoruz.
  const bankTxs = txs.filter(t => (t.wallet_type || 'bank') === 'bank' && t.status !== 'pending' && t.status !== 'rejected');
  const expectedBank = bankTxs.reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * Number(t.amount || 0), 0);
  // 400 kayıt sınırı var; tam liste çekilmediyse mutabakat anlamsız olur.
  const txListComplete = txs.length < 400;
  const drift = Math.round((bank - expectedBank) * 100) / 100;
  const showDrift = txListComplete && Math.abs(drift) >= 0.01;
  const statusBadge = (s) =>
    s === 'pending' ? '<span class="badge b-amber">Onay Bekliyor</span>' :
    s === 'approved' ? '<span class="badge b-green">Onaylandı</span>' :
    s === 'rejected' ? '<span class="badge b-red">Reddedildi</span>' : '';

  const txCard = (t) => `
    <div class="tx-card">
      <div class="tx-icon ${t.type}">${t.type === 'income' ? '↙' : '↗'}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.description)}</div>
        <div class="tx-cat">${WALLET_CATEGORY_LABELS[t.category] || t.category}</div>
        <div class="tx-date">${dmyhm(t.created_at)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${TL(t.amount)}</div>
        ${statusBadge(t.status)}
        ${t.receipt_url ? `<button class="btn btn-sm btn-ghost" onclick="window.showReceiptModal('${esc(t.receipt_url)}')">📄 Makbuz</button>` : ''}
      </div>
    </div>`;

  $content().innerHTML = `
    <div class="page-head"><h2>Kasa Yönetimi</h2>
      <div class="tools"><button class="btn" id="tx-add">+ İşlem Ekle</button></div>
    </div>

    <div class="wallet-card ${isNeg ? 'neg' : ''}">
      <div class="wallet-head">💼 <span>Ana Kasa</span></div>
      <div class="wallet-amount">${isNeg ? '-' : ''}${TL(Math.abs(bank)).replace('₺','').trim()} ₺</div>
      ${isNeg ? '<div class="wallet-warn">⚠️ Kasa ekside - Borçlanma durumu</div>' : ''}
    </div>

    ${showDrift ? `<div class="drift-card">
      <div class="drift-head">⚖️ Kasa mutabakatsızlığı</div>
      <p class="muted" style="font-size:13px;margin:8px 0 12px;">Kayıtlı bakiye ile işlem hareketlerinin toplamı uyuşmuyor.
        Bir işlem yazılırken kaydedilememiş ya da bakiye elle değiştirilmiş olabilir.</p>
      <div class="drift-rows">
        <div><span>Görünen bakiye</span><strong>${TL(bank)}</strong></div>
        <div><span>Hareketlerden hesaplanan</span><strong>${TL(expectedBank)}</strong></div>
        <div><span>Fark</span><strong style="color:var(--red)">${drift > 0 ? '+' : ''}${TL(drift)}</strong></div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:10px;">Farkı kapatmak için eksik kalan gelir/gideri
        Kasa &amp; Harcamalar'dan elle ekleyin; kayıt eklendiğinde bu uyarı kaybolur.</p>
    </div>` : ''}

    ${pending.length ? `<div class="pending-alert-card">
      <div class="pending-alert-head">⏳ ${pending.length} işlem onay bekliyor</div>
      <div id="pending-body">${pending.map(t => `
        <div class="pending-row">
          <div style="flex:1"><strong>${esc(t.description)}</strong>
            <div class="muted" style="font-size:12px">${dmy(t.created_at)} · ${WALLET_CATEGORY_LABELS[t.category]||t.category}</div></div>
          <div class="tx-amount expense" style="margin-right:12px">${TL(t.amount)}</div>
          <button class="btn btn-sm btn-green" data-act="ok" data-id="${t.id}">Onayla</button>
          <button class="btn btn-sm btn-outline-red" data-act="no" data-id="${t.id}">Reddet</button>
        </div>`).join('')}</div>
    </div>` : ''}

    <div class="month-nav">
      <span class="muted" style="font-size:13px;font-weight:600;">Dönem Seçin:</span>
      <div class="month-nav-inner">
        <button class="month-btn" id="month-prev">‹</button>
        <span class="month-label">${MONTHS[month-1]} ${year}</span>
        <button class="month-btn" id="month-next">›</button>
      </div>
    </div>

    <div class="seg-tabs" id="tx-tabs">
      <button class="seg ${tab==='all'?'active':''}" data-tab="all">Tümü</button>
      <button class="seg ${tab==='income'?'active':''}" data-tab="income">Gelir</button>
      <button class="seg ${tab==='expense'?'active':''}" data-tab="expense">Gider</button>
    </div>

    <div id="tx-list">${filtered.length ? filtered.map(txCard).join('')
      : `<div class="card"><p class="t-empty">${MONTHS[month-1]} ${year} için ${tab==='income'?'gelir':tab==='expense'?'gider':'işlem'} yok</p></div>`}</div>

    <button class="btn btn-block" id="share-report" style="margin-top:16px;">📊 ${MONTHS[month-1]} ${year} Raporunu Paylaş</button>
    <p class="muted" style="font-size:12.5px;margin-top:8px;text-align:center;">Rapor, sohbet ekranına gönderilir; tüm sakinler görebilir.</p>`;

  el('tx-add').addEventListener('click', openTxModal);
  el('month-prev').addEventListener('click', () => {
    if (walletState.month === 1) { walletState.month = 12; walletState.year--; } else walletState.month--;
    renderTransactions();
  });
  el('month-next').addEventListener('click', () => {
    if (walletState.month === 12) { walletState.month = 1; walletState.year++; } else walletState.month++;
    renderTransactions();
  });
  el('tx-tabs').addEventListener('click', (e) => {
    const seg = e.target.closest('button[data-tab]'); if (!seg) return;
    walletState.tab = seg.dataset.tab; renderTransactions();
  });
  el('pending-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return; btn.disabled = true;
    try { await approveTx(btn.dataset.id, btn.dataset.act === 'ok'); toast(btn.dataset.act==='ok'?'Onaylandı':'Reddedildi'); renderTransactions(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  el('share-report').addEventListener('click', () => shareMonthlyReport(inMonth, bank));
}

// Aylık finansal raporu sohbete gönder — mobil generateMonthlyReport ile aynı format
async function shareMonthlyReport(monthTxs, bankBalance) {
  const btn = el('share-report'); btn.disabled = true; btn.textContent = 'Rapor hazırlanıyor…';
  try {
    const { year, month } = walletState;
    const completed = monthTxs.filter(t => t.status === 'completed' || t.status === 'approved');
    const incomeByCat = {}, expenseByCat = {};
    for (const t of completed) {
      const label = t.type === 'income' && t.category === 'fee' ? 'Aidat Geliri' : (WALLET_CATEGORY_LABELS[t.category] || t.category);
      const bucket = t.type === 'income' ? incomeByCat : expenseByCat;
      bucket[label] = (bucket[label] || 0) + Number(t.amount);
    }
    const totalIncome = Object.values(incomeByCat).reduce((s,v)=>s+v, 0);
    const totalExpense = Object.values(expenseByCat).reduce((s,v)=>s+v, 0);
    const net = totalIncome - totalExpense;
    const line = '─────────────────────────────\n';
    const dline = '═════════════════════════════\n';
    const table = (obj) => Object.entries(obj).sort(([,a],[,b])=>b-a)
      .map(([c,a]) => `${c}${' '.repeat(Math.max(1, 18-c.length))}${a.toLocaleString('tr-TR')} ₺`).join('\n') || 'Kayıt yok';
    const monthName = MONTHS[month-1];
    const reportMessage = `📊 ${monthName} ${year} Finansal Raporu\n\n`
      + `📥 GELİRLER\n${line}${table(incomeByCat)}\n${line}TOPLAM${' '.repeat(12)}${totalIncome.toLocaleString('tr-TR')} ₺\n`
      + `\n📤 GİDERLER\n${line}${table(expenseByCat)}\n${line}TOPLAM${' '.repeat(12)}${totalExpense.toLocaleString('tr-TR')} ₺\n`
      + `\n📊 ÖZET\n${dline}Net Durum${' '.repeat(9)}${net >= 0 ? '+' : ''}${net.toLocaleString('tr-TR')} ₺\nKasa Bakiyesi${' '.repeat(5)}${bankBalance.toLocaleString('tr-TR')} ₺\n${dline}`
      + `\nDetaylı dökümü 'Kasa Yönetimi' sayfasından inceleyebilirsiniz.`;

    const adminName = `${S.profile?.name || ''} ${S.profile?.surname || ''}`.trim() || 'Yönetici';
    const expiresAt = new Date(Date.now() + 10080 * 60 * 1000); // 7 gün
    const { error } = await supabase.from('help_requests').insert({
      building_id: bId(), sender_id: S.user.id, sender_name: adminName, sender_type: 'admin',
      title: `📊 ${monthName} ${year} Finansal Raporu`, message: reportMessage,
      priority: 'medium', duration_minutes: 10080, expires_at: expiresAt.toISOString(),
      status: 'active', is_auto_generated: true, type: 'report',
      report_month: month, report_year: year,
    });
    if (error) throw new Error(error.message);
    toast('Aylık rapor sohbete gönderildi');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = `📊 ${MONTHS[walletState.month-1]} ${walletState.year} Raporunu Paylaş`;
  }
}

// Makbuz Görselini Modalda Göster
window.showReceiptModal = function(url) {
  openModal('Makbuz / Fatura Görseli', `
    <div style="text-align: center; max-height: 70vh; overflow: auto;">
      <img src="${esc(url)}" alt="Makbuz Fatura" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
    </div>
    <div style="margin-top: 14px; text-align: center;">
      <a href="${esc(url)}" target="_blank" class="btn btn-sm btn-ghost">Yeni Sekmede Aç</a>
    </div>
  `);
};

async function approveTx(id, approved) {
  const { data: tx } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
  if (!tx || tx.status !== 'pending') throw new Error('İşlem zaten sonuçlanmış');
  await supabase.from('transactions').update({ status: approved?'approved':'rejected', approved_by:S.user.id, approved_at:new Date().toISOString() }).eq('id', id);
  if (approved && tx.type === 'expense') {
    const { error } = await supabase.rpc('adjust_building_balance', { p_building_id: bId(), p_wallet: tx.wallet_type, p_delta: -Number(tx.amount) });
    if (error) throw new Error(error.message);
  }
  await refreshBuilding();
}
// İşlem ekleme — mobil add-transaction ekranıyla aynı: tür anahtarı,
// türe göre kategori çipleri, tutar, açıklama, not. Kasa: Ana Kasa (bank).
function openTxModal() {
  const ab = activeBuilding();
  const state = { type: 'expense', category: '' };

  const catChips = () => (state.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)
    .map(c => `<button type="button" class="cat-chip ${state.category===c.value?'active':''}" data-cat="${c.value}">${c.label}</button>`).join('');

  openModal('Yeni İşlem', `
    <div class="field"><label>İşlem Türü</label>
      <div class="seg-tabs" id="m-types" style="margin:0;">
        <button type="button" class="seg" data-type="income">📥 Gelir</button>
        <button type="button" class="seg active" data-type="expense">📤 Gider</button>
      </div>
    </div>
    <div class="field"><label>Tutar (₺)</label><input id="m-amt" inputmode="decimal" placeholder="0,00"></div>
    <div class="field"><label>Kategori</label><div class="cat-grid" id="m-cats">${catChips()}</div></div>
    <div class="field"><label>Açıklama</label><input id="m-desc" placeholder="Örn: Asansör bakımı"></div>
    <div class="field"><label>Not (opsiyonel)</label><textarea id="m-notes" rows="2" placeholder="Ek bilgi"></textarea></div>
    <p class="muted" style="font-size:12.5px;margin-bottom:14px">Onay limitinin (${TL(ab?.approval_threshold||5000)}) üstündeki giderler ve "İş Ödemesi" kategorisi önce onaya düşer.</p>
    <button class="btn btn-block" id="m-save">Kaydet</button>`);

  el('m-types').addEventListener('click', (e) => {
    const seg = e.target.closest('button[data-type]'); if (!seg) return;
    state.type = seg.dataset.type; state.category = '';
    el('m-types').querySelectorAll('.seg').forEach(s => s.classList.toggle('active', s === seg));
    el('m-cats').innerHTML = catChips();
  });
  el('m-cats').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-cat]'); if (!chip) return;
    state.category = chip.dataset.cat;
    el('m-cats').querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c === chip));
  });

  el('m-save').addEventListener('click', async () => {
    const amt = parseFloat(String(el('m-amt').value).replace(',','.'));
    if (isNaN(amt)||amt<=0) return toast('Lütfen geçerli bir tutar girin', true);
    if (!state.category) return toast('Lütfen bir kategori seçin', true);
    const desc = el('m-desc').value.trim(); if (!desc) return toast('Lütfen açıklama girin', true);
    el('m-save').disabled = true;
    try {
      const { needsApproval } = await adjustBalance({ amount:amt, operation: state.type==='income'?'add':'subtract',
        description:desc, category:state.category, walletType:'bank' });
      const notes = el('m-notes').value.trim();
      if (notes) {
        // Son eklenen işleme notu iliştir (adjustBalance not alanını yazmıyor)
        const { data: lastTx } = await supabase.from('transactions').select('id')
          .in('building_id', siteBIds()).eq('created_by', S.user.id)
          .order('created_at', { ascending:false }).limit(1).maybeSingle();
        if (lastTx) await supabase.from('transactions').update({ notes }).eq('id', lastTx.id);
      }
      closeModal(); toast(needsApproval ? 'İşlem onaya gönderildi' : 'İşlem kaydedildi'); renderTransactions();
    } catch (err) { toast(err.message, true); el('m-save').disabled = false; }
  });
}

/* ============ 5) DUYURULAR (mobil pano mantığı + sürükle-bırak sıralama) ============ */
async function renderAnnouncements() {
  if (!needBuilding()) return;
  // Pano sırası: board_order küçük olan üstte, eşitlikte en yeni önce (mobil ile aynı).
  // board_order kolonu henüz yoksa (migration 0009 öncesi) tarihe göre düş.
  let { data, error } = await supabase.from('announcements').select('*').in('building_id', siteBIds())
    .order('board_order', { ascending:true }).order('created_at', { ascending:false });
  let orderingAvailable = true;
  if (error) {
    orderingAvailable = false;
    ({ data } = await supabase.from('announcements').select('*').in('building_id', siteBIds()).order('created_at', { ascending:false }));
  }
  const list = data || [];
  const isNew = (d) => (Date.now() - new Date(d).getTime()) / 86400000 <= 7; // mobil: son 7 gün "YENİ"

  $content().innerHTML = `
    <div class="page-head"><h2>Duyurular</h2><div class="tools"><button class="btn" id="ann-add">+ Duyuru</button></div></div>
    <div class="info-banner">İlk <strong>4 duyuru panoda</strong> görünür (mobil ana ekran). ${orderingAvailable ? 'Kartları <strong>sürükleyip bırakarak</strong> pano sırasını değiştirebilirsiniz.' : ''}</div>
    <div id="ann-list">${list.length ? list.map((a, i) => `
      <div class="ann-card" draggable="${orderingAvailable}" data-id="${a.id}">
        ${orderingAvailable ? '<div class="drag-handle" title="Sürükleyerek sırala">⠿</div>' : ''}
        <div class="ann-icon">🔔</div>
        <div class="lr-body" style="flex:1">
          <div class="lr-title">${esc(a.title)}</div>
          <div class="lr-meta">
            ${dmy(a.created_at)}
            ${isNew(a.created_at) ? '<span class="badge b-green">YENİ</span>' : ''}
            <span class="board-badge ${i < 4 ? '' : 'off'}">${i < 4 ? '📍 Panoda' : 'Panoda değil'}</span>
          </div>
          <div class="lr-text">${esc(a.detail)}</div>
        </div>
        <button class="btn btn-sm btn-outline-red" data-del="${a.id}">Sil</button>
      </div>`).join('') : '<div class="card"><p class="t-empty">Henüz duyuru yok</p></div>'}</div>`;

  el('ann-add').addEventListener('click', () => {
    openModal('Yeni Duyuru', `
      <div class="field"><label>Başlık</label><input id="a-title"></div>
      <div class="field"><label>Detay</label><textarea id="a-detail" rows="4"></textarea></div>
      <p class="muted" style="font-size:12.5px;margin-bottom:14px;">Yeni duyuru panonun en üstünde yayınlanır ve mobil sohbete düşer.</p>
      <button class="btn btn-block" id="a-save">Yayınla</button>`);
    el('a-save').addEventListener('click', async () => {
      const title = el('a-title').value.trim(), detail = el('a-detail').value.trim();
      if (!title || !detail) return toast('Başlık ve detay girin', true);
      el('a-save').disabled = true;
      const { error } = await supabase.from('announcements').insert({ building_id:bId(), admin_id:S.user.id, title, detail, is_active:true });
      if (error) { toast(error.message, true); el('a-save').disabled=false; return; }
      await postAnnouncementToChat(title, detail); // mobil sohbete de düşsün
      notifyBuilding(`📢 ${title}`, detail); // sakinlere push
      closeModal(); toast('Duyuru yayınlandı'); renderAnnouncements();
    });
  });

  el('ann-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-del]'); if (!btn) return;
    if (!confirm('Duyuru silinsin mi?')) return;
    await supabase.from('announcements').delete().eq('id', btn.dataset.del);
    toast('Duyuru silindi'); renderAnnouncements();
  });

  if (orderingAvailable && list.length > 1) setupAnnouncementDrag();
}

// Duyuru kartlarını HTML5 drag&drop ile sırala; bırakınca board_order kalıcı yazılır
function setupAnnouncementDrag() {
  const container = el('ann-list');
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    dragged = e.target.closest('.ann-card');
    if (dragged) setTimeout(() => dragged.classList.add('dragging'), 0);
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragged) return;
    const cards = [...container.querySelectorAll('.ann-card:not(.dragging)')];
    const after = cards.find(card => e.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2);
    if (after) container.insertBefore(dragged, after);
    else container.appendChild(dragged);
  });
  container.addEventListener('dragend', async () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    // Yeni sırayı kalıcı yaz: üstteki kart board_order=1 olacak şekilde
    const ids = [...container.querySelectorAll('.ann-card')].map(c => c.dataset.id);
    try {
      await Promise.all(ids.map((id, i) =>
        supabase.from('announcements').update({ board_order: i + 1 }).eq('id', id)
      ));
      toast('Pano sırası güncellendi');
      renderAnnouncements(); // Panoda rozetlerini tazele
    } catch (err) {
      toast('Sıralama kaydedilemedi', true);
    }
  });
}

/* ============ 6) ARIZALAR (mobil ile aynı akış: İş Olarak Tanımla / Kapat) ============ */
async function renderMaintenance() {
  if (!needBuilding()) return;
  const { data } = await supabase.from('maintenance_requests').select('*, apartments:apartment_id(apartment_number)').in('building_id', siteBIds()).order('created_at', { ascending:false });
  // Mobil davranış: bu sayfa gelen arızaların bekleme alanıdır; iş olarak
  // tanımlanan (completed) veya kapatılan (cancelled) arızalar listeden kalkar.
  const open = (data || []).filter(r => r.status !== 'completed' && r.status !== 'cancelled');

  $content().innerHTML = `
    <div class="page-head"><h2>Arıza Bildirimleri</h2></div>
    <div class="info-banner">Gelen arızaların bekleme alanı. Bir arızayı <strong>iş olarak tanımladığınızda</strong> İş Takibi'ne düşer ve buradan kalkar; işlem gerektirmeyenleri kapatabilirsiniz.</div>
    <div id="maint-list">${open.length ? open.map(r => `
      <div class="fault-card">
        <div class="fault-head">
          <div>
            <div class="lr-title">${esc(r.title)}
              <span class="badge ${r.priority==='high'?'b-red':r.priority==='medium'?'b-amber':'b-green'}">${PRIORITIES[r.priority]||r.priority}</span>
              <span class="badge b-gray">${MAINT_STATUS[r.status]||r.status}</span>
            </div>
            <div class="lr-meta">🏠 Daire ${esc(r.apartments?.apartment_number||'—')} · ${dmyhm(r.created_at)}</div>
          </div>
        </div>
        <div class="lr-text">${esc(r.description || '')}</div>
        <div class="fault-actions">
          <button class="btn btn-sm" data-job="${r.id}">🔧 İş Olarak Tanımla</button>
          <button class="btn btn-sm btn-outline-red" data-close="${r.id}">Kapat</button>
        </div>
      </div>`).join('') : '<div class="card"><p class="t-empty">Bekleyen arıza bildirimi yok 🎉</p></div>'}</div>`;

  el('maint-list').addEventListener('click', async (e) => {
    const jobBtn = e.target.closest('button[data-job]');
    if (jobBtn) {
      const r = open.find(x => x.id === jobBtn.dataset.job);
      if (r) openFaultToJobModal(r);
      return;
    }
    const closeBtn = e.target.closest('button[data-close]'); if (!closeBtn) return;
    if (!confirm('Bu arızayı iş oluşturmadan kapatmak istediğinize emin misiniz?')) return;
    const { error } = await supabase.from('maintenance_requests').update({ status:'cancelled' }).eq('id', closeBtn.dataset.close);
    if (error) return toast(error.message, true);
    toast('Arıza kapatıldı'); renderMaintenance();
  });
}

// Arızayı işe dönüştürme — mobil fault-detail ekranıyla aynı: sorumlu + ücret + vade,
// iş oluşturulur ve arıza tamamlandı olarak işaretlenir.
function openFaultToJobModal(r) {
  openModal('İş Olarak Tanımla', `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">Bu arızayı iş olarak tanımlayın. İş, İş Takibi listesine eklenecek ve arıza tamamlandı olarak işaretlenecek.</p>
    <div class="field"><label>Arıza</label><input value="${esc(r.title)}" disabled></div>
    <div class="field"><label>Sorumlu Kişi / Firma *</label><input id="fj-assignee" placeholder="Örn: Usta Mehmet, X Asansör Ltd."></div>
    <div class="grid-2">
      <div class="field"><label>Ücret (₺)</label><input id="fj-price" inputmode="decimal" value="0"></div>
      <div class="field"><label>Vade Tarihi (opsiyonel)</label><input id="fj-due" type="date"></div>
    </div>
    <button class="btn btn-block" id="fj-save">İşi Oluştur</button>`);

  el('fj-save').addEventListener('click', async () => {
    const assignee = el('fj-assignee').value.trim();
    if (!assignee) return toast('Lütfen sorumlu kişiyi girin', true);
    const price = parseFloat(String(el('fj-price').value).replace(',','.')) || 0;
    const due = el('fj-due').value;
    el('fj-save').disabled = true;
    try {
      const aptNo = r.apartments?.apartment_number || 'Bilinmiyor';
      const description = `Bu arıza Daire ${aptNo} tarafından bildirildi.\n\n${r.description || ''}`.trim();
      const { error: jobError } = await supabase.from('building_jobs').insert({
        building_id: bId(), title: r.title, description,
        interval: 'custom', interval_days: 0, assigned_to: assignee, price,
        next_due_date: due ? new Date(due).toISOString() : null,
        is_active: true, status: 'planned', created_by: S.user.id,
      });
      if (jobError) throw new Error(jobError.message);

      const { error: maintError } = await supabase.from('maintenance_requests')
        .update({ status: 'completed', assigned_to: S.user.id, completed_at: new Date().toISOString() })
        .eq('id', r.id);
      if (maintError) throw new Error(maintError.message);

      notifyBuilding('🔧 Yeni İş Oluşturuldu', `"${r.title}" arızası için iş oluşturuldu.`);
      closeModal(); toast('İş oluşturuldu ve arıza tamamlandı olarak işaretlendi'); renderMaintenance();
    } catch (err) {
      toast(err.message, true); el('fj-save').disabled = false;
    }
  });
}

/* ============ 7) İŞLER ============ */
async function renderJobs() {
  if (!needBuilding()) return;
  const { data } = await supabase.from('building_jobs').select('*').in('building_id', siteBIds()).order('created_at', { ascending:false });
  const list = data || [];
  const badge = (j) => { const s = j.status || (j.is_active?'planned':'completed'); const cls = s==='completed'?'b-green':s==='cancelled'?'b-red':s==='in_progress'?'b-blue':'b-amber'; return `<span class="badge ${cls}">${JOB_STATUS[s]||s}</span>`; };
  $content().innerHTML = `
    <div class="page-head"><h2>İş Takibi</h2><div class="tools"><button class="btn" id="job-add">+ İş Ekle</button></div></div>
    <div class="card"><table><thead><tr><th>İş</th><th>Sorumlu</th><th>Ücret</th><th>Durum</th><th></th></tr></thead>
      <tbody id="job-body">${list.length ? list.map(j=>`<tr>
        <td><strong>${esc(j.title)}</strong><div class="muted" style="font-size:12px">${esc(j.description||'')}</div></td>
        <td>${esc(j.assigned_to||'—')}</td><td>${TL(j.price)}</td><td>${badge(j)}</td>
        <td class="t-right" style="white-space:nowrap">
          <select class="mini" data-status="${j.id}"><option value="">Durum…</option><option value="in_progress">Başlat</option><option value="completed">Tamamla</option><option value="cancelled">İptal</option></select>
          <button class="btn btn-sm btn-outline-red" data-del="${j.id}">Sil</button>
        </td></tr>`).join('') : '<tr><td colspan="5" class="t-empty">Henüz iş yok</td></tr>'}</tbody></table></div>`;
  el('job-add').addEventListener('click', () => {
    openModal('Yeni İş', `
      <div class="field"><label>İş Adı</label><input id="j-title" placeholder="Örn: Asansör bakımı"></div>
      <div class="field"><label>Açıklama</label><textarea id="j-desc" rows="2"></textarea></div>
      <div class="grid-2">
        <div class="field"><label>Sorumlu Kişi/Firma</label><input id="j-assignee"></div>
        <div class="field"><label>Ücret (₺)</label><input id="j-price" inputmode="decimal" value="0"></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin-bottom:14px">Buradaki ücret plandır; iş <strong>tamamlanırken</strong> gerçekte ödenen tutar sorulur ve kasaya o tutar işlenir.</p>
      <button class="btn btn-block" id="j-save">Kaydet</button>`);
    el('j-save').addEventListener('click', async () => {
      const title = el('j-title').value.trim(); if (!title) return toast('İş adı girin', true);
      const price = parseFloat(String(el('j-price').value).replace(',','.'))||0;
      el('j-save').disabled = true;
      try {
        const { error } = await supabase.from('building_jobs').insert({ building_id:bId(), title,
          description: el('j-desc').value.trim()||null, interval:'monthly', assigned_to: el('j-assignee').value.trim()||'',
          price, is_active:true, status:'planned', created_by:S.user.id }).select().single();
        if (error) throw new Error(error.message);
        // NOT: Kasa kaydı iş tamamlanınca gerçekleşen tutarla açılır (mobil ile aynı model)
        notifyBuilding('🔧 Yeni İş', `"${title}" işi planlandı.`);
        closeModal(); toast('İş oluşturuldu'); renderJobs();
      } catch (err) { toast(err.message, true); el('j-save').disabled=false; }
    });
  });
  el('job-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-status]'); if (!sel || !sel.value) return;
    const status = sel.value;
    const job = list.find(j => j.id === sel.dataset.status);
    if (status === 'completed' && job) {
      sel.value = '';
      openJobPaymentModal(job); // Ödeme sorusu: gerçekleşen tutar kasaya işlenir
      return;
    }
    const payload = { status, is_active: status==='in_progress' };
    const { error } = await supabase.from('building_jobs').update(payload).eq('id', sel.dataset.status);
    if (error) return toast(error.message, true);
    if (status === 'cancelled') {
      // İptal edilen işin (eski modelden kalma) onay bekleyen ödemesi varsa reddet
      await supabase.from('transactions').update({ status:'rejected', approved_by:S.user.id, approved_at:new Date().toISOString() })
        .eq('related_id', sel.dataset.status).eq('status', 'pending').eq('category', 'job');
      await supabase.from('help_requests').delete().in('building_id', siteBIds()).eq('related_id', sel.dataset.status);
    }
    toast('İş durumu güncellendi'); renderJobs();
  });
  el('job-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-del]'); if (!btn) return;
    if (!confirm('İş silinsin mi? Onay bekleyen ödemesi varsa iptal edilir.')) return;
    // Bekleyen ödemesini reddet, sohbetteki iş kartını kaldır, sonra işi sil
    await supabase.from('transactions').update({ status:'rejected', approved_by:S.user.id, approved_at:new Date().toISOString() })
      .eq('related_id', btn.dataset.del).eq('status', 'pending').eq('category', 'job');
    await supabase.from('help_requests').delete().in('building_id', siteBIds()).eq('related_id', btn.dataset.del);
    await supabase.from('building_jobs').delete().eq('id', btn.dataset.del);
    toast('İş silindi'); renderJobs();
  });
}

// İş tamamlama + ödeme mutabakatı — mobil ile aynı model:
// planlanan ücret bilgidir; burada GERÇEKTE ödenen tutar sorulur ve kasa o tutarla güncellenir.
function openJobPaymentModal(job) {
  const state = { paid: Number(job.price) > 0 };
  openModal('✅ İşi Tamamla', `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">
      <strong>${esc(job.title)}</strong><br>Planlanan ücret: ${TL(job.price)}
    </p>
    <div class="field"><label>Ücret ödendi mi?</label>
      <div class="seg-tabs" id="jp-toggle" style="margin:0;">
        <button type="button" class="seg ${state.paid?'active':''}" data-paid="1">Evet, Ödendi</button>
        <button type="button" class="seg ${state.paid?'':'active'}" data-paid="0">Hayır</button>
      </div>
    </div>
    <div class="field" id="jp-amount-field" style="${state.paid?'':'display:none'}">
      <label>Gerçekte ödenen tutar (₺)</label>
      <input id="jp-amount" inputmode="decimal" value="${Number(job.price) > 0 ? job.price : ''}" placeholder="Örn: 6000">
      <p class="muted" style="font-size:12px;margin-top:6px;">Planlanandan farklıysa gerçek tutarı yazın; kasa ve işin ücreti bu tutarla güncellenir.</p>
    </div>
    <button class="btn btn-block" id="jp-save">Tamamla</button>`);

  el('jp-toggle').addEventListener('click', (e) => {
    const seg = e.target.closest('button[data-paid]'); if (!seg) return;
    state.paid = seg.dataset.paid === '1';
    el('jp-toggle').querySelectorAll('.seg').forEach(s => s.classList.toggle('active', s === seg));
    el('jp-amount-field').style.display = state.paid ? '' : 'none';
  });

  el('jp-save').addEventListener('click', async () => {
    let amount = 0;
    if (state.paid) {
      amount = parseFloat(String(el('jp-amount').value).replace(',','.'));
      if (isNaN(amount) || amount <= 0) return toast('Lütfen ödenen tutarı girin', true);
    }
    el('jp-save').disabled = true;
    try {
      // 1) İşi tamamla
      const { error: statusError } = await supabase.from('building_jobs').update({
        status: 'completed', is_active: false,
        completed_at: new Date().toISOString(), last_performed_date: new Date().toISOString(),
      }).eq('id', job.id);
      if (statusError) throw new Error(statusError.message);

      // 2) Ödeme mutabakatı
      if (state.paid && amount > 0) {
        const { data: pendingTx } = await supabase.from('transactions').select('id')
          .eq('related_id', job.id).eq('status', 'pending').eq('category', 'job').limit(1).maybeSingle();

        const { error: rpcError } = await supabase.rpc('adjust_building_balance', {
          p_building_id: bId(), p_wallet: 'bank', p_delta: -amount,
        });
        if (rpcError) throw new Error(rpcError.message);

        if (pendingTx) {
          // Eski modelden kalan bekleyen kaydı gerçekleşen tutarla onayla (çift kayıt olmasın)
          await supabase.from('transactions').update({
            amount, description: `İş ödemesi - ${job.title}`,
            status: 'approved', approved_by: S.user.id, approved_at: new Date().toISOString(),
          }).eq('id', pendingTx.id);
        } else {
          const { error: txError } = await supabase.from('transactions').insert({
            building_id: bId(), type: 'expense', amount,
            description: `İş ödemesi - ${job.title}`, category: 'job', wallet_type: 'bank',
            related_id: job.id, status: 'completed',
            approved_by: S.user.id, approved_at: new Date().toISOString(), created_by: S.user.id,
          });
          if (txError) throw new Error(txError.message);
        }
        // İşin ücretini gerçekleşenle güncelle
        await supabase.from('building_jobs').update({ price: amount }).eq('id', job.id);
      } else {
        // Ödeme yapılmadıysa bekleyen (varsa) eski kaydı reddet
        await supabase.from('transactions').update({ status:'rejected', approved_by:S.user.id, approved_at:new Date().toISOString() })
          .eq('related_id', job.id).eq('status', 'pending').eq('category', 'job');
      }

      // 3) Sohbetteki iş kartını kaldır + sakinlere bildirim
      await supabase.from('help_requests').delete().in('building_id', siteBIds()).eq('related_id', job.id);
      notifyBuilding('✅ İş Tamamlandı', state.paid && amount > 0
        ? `"${job.title}" tamamlandı. Ödenen tutar: ${TL(amount)}`
        : `"${job.title}" tamamlandı.`);

      await refreshBuilding();
      closeModal();
      toast(state.paid && amount > 0 ? `İş tamamlandı, ${TL(amount)} kasadan düşüldü` : 'İş tamamlandı');
      renderJobs();
    } catch (err) {
      toast(err.message, true); el('jp-save').disabled = false;
    }
  });
}

/* ============ 8) TOPLANTILAR ============ */
async function renderMeetings() {
  if (!needBuilding()) return;
  const [{ data }, rsvpRes] = await Promise.all([
    supabase.from('meetings').select('*').in('building_id', siteBIds()).order('meeting_date', { ascending:false }),
    supabase.from('meeting_rsvps').select('*').in('building_id', siteBIds()),
  ]);
  const list = data || [];
  // Katılım yanıtlarını toplantıya göre grupla (tablo henüz yoksa boş geç)
  const rsvpsByMeeting = new Map();
  for (const r of (rsvpRes.data || [])) {
    const arr = rsvpsByMeeting.get(r.meeting_id) || [];
    arr.push(r); rsvpsByMeeting.set(r.meeting_id, arr);
  }
  const RSVP_ICON = { attending:'✅', declined:'❌', proxy:'🤝' };
  const rsvpBlock = (m) => {
    const rs = rsvpsByMeeting.get(m.id) || [];
    const att = rs.filter(r=>r.status==='attending'), dec = rs.filter(r=>r.status==='declined'), prx = rs.filter(r=>r.status==='proxy');
    const rows = [...att, ...prx, ...dec].map(r => `<div style="font-size:12.5px;padding:2px 0;">
      ${RSVP_ICON[r.status]||''} ${esc(r.name)}${r.apartment?` · Daire ${esc(r.apartment)}`:''}${r.status==='proxy'&&r.proxy_name?` → <strong style="color:var(--amber,#D97706)">Vekil: ${esc(r.proxy_name)}</strong>`:''}
    </div>`).join('');
    return `<div style="margin-top:8px;font-size:13px;">
      <strong>Katılım:</strong> ✅ ${att.length} Katılıyor · ❌ ${dec.length} Katılmıyor · 🤝 ${prx.length} Vekil
      ${rows ? `<details style="margin-top:4px;"><summary style="cursor:pointer;color:var(--muted);font-size:12.5px;">Listeyi göster</summary>${rows}</details>` : ''}
    </div>`;
  };
  $content().innerHTML = `
    <div class="page-head"><h2>Toplantılar</h2><div class="tools"><button class="btn" id="mt-add">+ Toplantı</button></div></div>
    <div class="card" id="mt-list">${list.length ? list.map(m=>`
      <div class="list-row"><div class="lr-body">
        <div class="lr-title">${esc(m.title)}</div>
        <div class="lr-meta">📅 ${dmyhm(m.meeting_date)}${m.location?` · 📍 ${esc(m.location)}`:''}</div>
        ${m.description?`<div class="lr-text">${esc(m.description)}</div>`:''}
        ${rsvpBlock(m)}
      </div><button class="btn btn-sm btn-outline-red" data-del="${m.id}">Sil</button></div>`).join('') : '<p class="t-empty">Henüz toplantı yok</p>'}</div>`;
  el('mt-add').addEventListener('click', () => {
    openModal('Yeni Toplantı', `
      <div class="field"><label>Başlık</label><input id="mt-title"></div>
      <div class="field"><label>Tarih &amp; Saat</label><input id="mt-date" type="datetime-local"></div>
      <div class="field"><label>Konum</label><input id="mt-loc" placeholder="Örn: Bina girişi"></div>
      <div class="field"><label>Açıklama</label><textarea id="mt-desc" rows="2"></textarea></div>
      <button class="btn btn-block" id="mt-save">Kaydet</button>`);
    el('mt-save').addEventListener('click', async () => {
      const title = el('mt-title').value.trim(), date = el('mt-date').value;
      if (!title || !date) return toast('Başlık ve tarih girin', true);
      el('mt-save').disabled = true;
      const meetingDate = new Date(date);
      const { data: meeting, error } = await supabase.from('meetings').insert({ building_id:bId(), admin_id:S.user.id, title,
        meeting_date:meetingDate.toISOString(), location: el('mt-loc').value.trim()||null, description: el('mt-desc').value.trim()||null, is_active:true })
        .select().single();
      if (error) { toast(error.message, true); el('mt-save').disabled=false; return; }
      // Mobil sohbete RSVP'li toplantı kartı düşür (toplantıdan 24 saat sonrasına kadar görünür)
      await postMeetingToChat(meeting, meetingDate);
      notifyBuilding('📅 Yeni Toplantı', `${title} — ${meetingDate.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}. Katılım durumunu sohbetten bildirin.`);
      closeModal(); toast('Toplantı oluşturuldu ve sohbete eklendi'); renderMeetings();
    });
  });
  el('mt-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-del]'); if (!btn) return;
    if (!confirm('Toplantı silinsin mi?')) return;
    await supabase.from('meetings').delete().eq('id', btn.dataset.del);
    toast('Toplantı silindi'); renderMeetings();
  });
}

// Web'den oluşturulan toplantıyı mobil sohbet akışına 'meeting' kartı olarak düşürür
async function postMeetingToChat(meeting, meetingDate) {
  try {
    const adminName = `${S.profile?.name || ''} ${S.profile?.surname || ''}`.trim() || 'Yönetici';
    const dateStr = meetingDate.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const message = `${meeting.description || ''}\n\n📅 Tarih: ${dateStr}${meeting.location ? `\n📍 Konum: ${meeting.location}` : ''}`.trim();
    const expiresAt = new Date(Math.max(Date.now() + 48*60*60*1000, meetingDate.getTime() + 24*60*60*1000));
    const { error } = await supabase.from('help_requests').insert({
      building_id: bId(), sender_id: S.user.id, sender_name: adminName, sender_type: 'admin',
      title: `📅 ${meeting.title}`, message, priority: 'high',
      duration_minutes: Math.ceil((expiresAt.getTime() - Date.now()) / 60000),
      expires_at: expiresAt.toISOString(), status: 'active',
      is_auto_generated: true, type: 'meeting', related_id: meeting.id,
    });
    if (error) console.error('Toplantı sohbete eklenemedi:', error.message);
  } catch (e) { console.error('Toplantı sohbete eklenemedi:', e); }
}

// Web'den yayınlanan duyuruyu mobil sohbet akışına düşürür (24 saat görünür)
async function postAnnouncementToChat(title, detail) {
  try {
    const adminName = `${S.profile?.name || ''} ${S.profile?.surname || ''}`.trim() || 'Yönetici';
    const expiresAt = new Date(Date.now() + 24*60*60*1000);
    const { error } = await supabase.from('help_requests').insert({
      building_id: bId(), sender_id: S.user.id, sender_name: adminName, sender_type: 'admin',
      title: `📢 ${title}`, message: detail, priority: 'medium',
      duration_minutes: 1440, expires_at: expiresAt.toISOString(), status: 'active',
      is_auto_generated: true, type: 'standard',
    });
    if (error) console.error('Duyuru sohbete eklenemedi:', error.message);
  } catch (e) { console.error('Duyuru sohbete eklenemedi:', e); }
}

/* ============ 9) KURALLAR (mobil ile aynı akış: kategoriler + hazır şablonlar) ============ */
async function renderRules() {
  if (!needBuilding()) return;
  const { data } = await supabase.from('building_rules').select('*').in('building_id', siteBIds()).order('created_at', { ascending:false });
  const list = data || [];
  const catOf = (id) => RULE_CATEGORIES.find(c => c.id === id);
  const catLabel = (id) => { const c = catOf(id); return c ? `${c.icon} ${c.name}` : esc(id || 'Diğer'); };

  const ruleCards = list.map(r => `
    <div class="rule-card">
      <div class="rule-icon">${esc(r.icon || (catOf(r.category)?.icon ?? '📋'))}</div>
      <div class="lr-body" style="flex:1">
        <div class="lr-title">${esc(r.title)} ${r.priority==='critical'?'<span class="badge b-red">Kritik</span>':'<span class="badge b-blue">Bilgi</span>'}</div>
        <div class="lr-meta">${catLabel(r.category)}</div>
        <div class="lr-text">${esc(r.description)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-sm btn-ghost" data-edit="${r.id}">Düzenle</button>
        <button class="btn btn-sm btn-outline-red" data-del="${r.id}">Sil</button>
      </div>
    </div>`).join('');

  // Hızlı Şablonlar — mobil uygulamadaki 23 hazır kural, kategoriye göre gruplu
  const templateGroups = RULE_CATEGORIES.map(cat => {
    const tpls = RULE_TEMPLATES.filter(t => t.category === cat.id);
    if (!tpls.length) return '';
    return `
      <div class="tpl-group">
        <div class="tpl-group-title">${cat.icon} ${cat.name}</div>
        <div class="tpl-chips">${tpls.map((t) => `
          <button class="tpl-chip" data-tpl="${RULE_TEMPLATES.indexOf(t)}" title="${esc(t.description)}">
            ${esc(t.icon)} ${esc(t.title)} ${t.priority==='critical'?'<span class="tpl-crit">!</span>':''}
          </button>`).join('')}</div>
      </div>`;
  }).join('');

  $content().innerHTML = `
    <div class="page-head"><h2>Site Kuralları</h2><div class="tools"><button class="btn" id="rule-add">+ Yeni Kural</button></div></div>
    <div class="card" id="rule-list">${list.length ? ruleCards : '<p class="t-empty">Henüz kural yok — aşağıdaki hazır şablonlardan seçerek başlayabilirsiniz</p>'}</div>
    <div class="card" id="tpl-list">
      <h3>⚡ Hızlı Şablonlar <span class="muted" style="font-weight:600;font-size:13px;">(${RULE_TEMPLATES.length} hazır kural — seçip düzenleyebilirsiniz)</span></h3>
      ${templateGroups}
    </div>`;

  el('rule-add').addEventListener('click', () => openRuleModal(null));

  el('tpl-list').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-tpl]'); if (!chip) return;
    const t = RULE_TEMPLATES[Number(chip.dataset.tpl)];
    if (t) openRuleModal({ ...t });
  });

  el('rule-list').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('button[data-edit]');
    if (editBtn) {
      const r = list.find(x => x.id === editBtn.dataset.edit);
      if (r) openRuleModal({ id:r.id, category:r.category, title:r.title, description:r.description, icon:r.icon, priority:r.priority });
      return;
    }
    const btn = e.target.closest('button[data-del]'); if (!btn) return;
    if (!confirm('Kural silinsin mi?')) return;
    await supabase.from('building_rules').delete().eq('id', btn.dataset.del);
    toast('Kural silindi'); renderRules();
  });
}

// Kural ekleme/düzenleme modalı — mobil add-rule ekranıyla aynı alanlar
function openRuleModal(rule) {
  const isEdit = !!(rule && rule.id);
  const state = {
    category: rule?.category || 'other',
    icon: rule?.icon || (RULE_CATEGORIES.find(c => c.id === (rule?.category || 'other'))?.icon ?? '📋'),
    priority: rule?.priority || 'info',
  };

  openModal(isEdit ? 'Kuralı Düzenle' : (rule ? 'Şablondan Kural Ekle' : 'Yeni Kural Ekle'), `
    <div class="field"><label>Kategori</label>
      <div class="cat-grid" id="r-cats">${RULE_CATEGORIES.map(c => `
        <button type="button" class="cat-chip ${c.id===state.category?'active':''}" data-cat="${c.id}" data-icon="${c.icon}">${c.icon} ${c.name}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Önem Derecesi</label>
      <div class="prio-row" id="r-prios">
        <button type="button" class="prio-chip ${state.priority==='info'?'active':''}" data-prio="info">ℹ️ Bilgi</button>
        <button type="button" class="prio-chip ${state.priority==='critical'?'active':''}" data-prio="critical">⚠️ Kritik</button>
      </div>
    </div>
    <div class="field"><label>Başlık</label><input id="r-title" value="${esc(rule?.title || '')}" placeholder="Örn: Sessizlik Saatleri"></div>
    <div class="field"><label>Açıklama</label><textarea id="r-desc" rows="4" placeholder="Kuralın detaylı açıklaması...">${esc(rule?.description || '')}</textarea></div>
    <button class="btn btn-block" id="r-save">${isEdit ? 'Güncelle' : 'Kaydet'}</button>`);

  el('r-cats').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-cat]'); if (!chip) return;
    state.category = chip.dataset.cat; state.icon = chip.dataset.icon;
    el('r-cats').querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c === chip));
  });
  el('r-prios').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-prio]'); if (!chip) return;
    state.priority = chip.dataset.prio;
    el('r-prios').querySelectorAll('.prio-chip').forEach(c => c.classList.toggle('active', c === chip));
  });

  el('r-save').addEventListener('click', async () => {
    const title = el('r-title').value.trim(), desc = el('r-desc').value.trim();
    if (!title || !desc) return toast('Başlık ve açıklama girin', true);
    el('r-save').disabled = true;
    const payload = { category: state.category, title, description: desc, icon: state.icon, priority: state.priority };
    const { error } = isEdit
      ? await supabase.from('building_rules').update(payload).eq('id', rule.id)
      : await supabase.from('building_rules').insert({ building_id: bId(), ...payload });
    if (error) { toast(error.message, true); el('r-save').disabled = false; return; }
    notifyBuilding(isEdit ? 'Site Kuralları Güncellendi' : 'Yeni Site Kuralı', `"${title}" kuralı ${isEdit ? 'güncellendi' : 'eklendi'}. Lütfen göz atın.`);
    closeModal(); toast(isEdit ? 'Kural güncellendi' : 'Kural eklendi'); renderRules();
  });
}

/* ============ 10) SİTE AYARLARI ============ */
// Genel bilgiler, onay limiti ve banka bilgileri SİTE bazlıdır (tüm binalar
// için ortak). Güvenlik girişi ve varsayılan aidat bina (blok) bazlı kalır.
async function renderSettings() {
  if (!needBuilding()) return;
  const b = activeBuilding();
  if (!b) return;
  const s = S.site || b; // site kaydı yoksa (eski veri) binaya düş
  const { data: feeSettings } = await supabase.from('building_monthly_fee_settings').select('*').eq('building_id', bId()).maybeSingle();
  const blockOptions = S.buildings.map(x => `<option value="${x.id}" ${x.id === bId() ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  $content().innerHTML = `
    <div class="page-head"><h2>${S.site ? 'Site Ayarları' : 'Bina Ayarları'}</h2></div>
    <div class="card">
      <h3>Genel Bilgiler ${S.site && S.site.site_type === 'site' ? '<span class="muted" style="font-size:12px;font-weight:400;">(tüm site için ortak)</span>' : ''}</h3>
      <div class="grid-2">
        <div class="field"><label>${S.site ? 'Site Adı' : 'Bina Adı'}</label><input id="s-name" value="${esc(s.name||'')}"></div>
        <div class="field"><label>Adres</label><input id="s-addr" value="${esc(s.address||'')}"></div>
        <div class="field"><label>Onay Gerektiren Harcama Limiti (₺)</label><input id="s-threshold" inputmode="decimal" value="${s.approval_threshold||5000}"></div>
        <div class="field"><label>Varsayılan Aidat Tutarı (₺)${S.buildings.length > 1 ? ' — seçili blok' : ''}</label><input id="s-fee" inputmode="decimal" value="${feeSettings?.default_amount||0}"></div>
      </div>
      <button class="btn" id="s-save-general">Kaydet</button>
    </div>

    ${S.buildings.length > 1 ? `<div class="card">
      <h3>🏢 Blok Seçimi</h3>
      <p class="muted" style="margin-top:-8px;margin-bottom:12px;font-size:13px;">Güvenlik girişi ve varsayılan aidat blok bazlıdır; düzenlemek istediğiniz bloğu seçin. Blok adlarını Genel Bakış'taki maketten değiştirebilirsiniz.</p>
      <select class="building-dropdown" id="s-block-select" style="max-width:280px;">${blockOptions}</select>
    </div>` : ''}

    <div class="card">
      <h3>🛡️ Güvenlik Görevlisi Giriş Bilgileri${S.buildings.length > 1 ? ` — ${esc(b.name)}` : ''}</h3>
      <p class="muted" style="margin-top: -8px; margin-bottom: 16px; font-size: 13px;">Sitenizde/binanızda çalışan güvenlik görevlilerinin panele girmesi için kullanıcı adı ve şifre belirleyin.</p>
      <div class="grid-2">
        <div class="field"><label>Güvenlik Kullanıcı Adı</label><input id="s-sec-user" value="${esc(b.security_username||'')}" placeholder="Örn: guvenlik-a-blok"></div>
        <div class="field"><label>Güvenlik Şifresi</label><input id="s-sec-pass" type="text" value="${esc(b.security_password||'')}" placeholder="En az 6 karakterli bir şifre"></div>
      </div>
      <button class="btn" id="s-save-security">Güvenlik Bilgilerini Kaydet</button>
    </div>

    <div class="card">
      <h3>Banka / IBAN Bilgileri ${S.site && S.site.site_type === 'site' ? '<span class="muted" style="font-size:12px;font-weight:400;">(tüm site için ortak)</span>' : ''}</h3>
      <div class="grid-2">
        <div class="field"><label>IBAN</label><input id="s-iban" value="${esc(s.iban||'')}"></div>
        <div class="field"><label>Banka Adı</label><input id="s-bank" value="${esc(s.bank_name||'')}"></div>
        <div class="field"><label>Hesap Sahibi</label><input id="s-holder" value="${esc(s.account_holder||'')}"></div>
      </div>
      <button class="btn" id="s-save-bank">Kaydet</button>
    </div>`;

  const blockSel = el('s-block-select');
  if (blockSel) {
    blockSel.addEventListener('change', (e) => {
      S.activeBuildingId = e.target.value;
      renderSettings();
    });
  }

  el('s-save-general').addEventListener('click', async () => {
    el('s-save-general').disabled = true;
    const name = el('s-name').value.trim();
    const addr = el('s-addr').value.trim();
    const threshold = parseFloat(String(el('s-threshold').value).replace(',','.'))||5000;

    let error = null;
    if (S.site) {
      // Site kaydına yaz; onay limiti tüm binalara da yansıtılır (mobil uyumluluk)
      ({ error } = await supabase.from('sites').update({
        name, address: addr || null, approval_threshold: threshold,
      }).eq('id', S.site.id));
      if (!error) {
        await supabase.from('buildings').update({ approval_threshold: threshold }).in('id', siteBIds());
        if (S.site.site_type !== 'site') {
          // Tek binalık apartmanda bina adı/adresi site ile aynı tutulur
          await supabase.from('buildings').update({ name, address: addr }).eq('id', bId());
        }
      }
    } else {
      ({ error } = await supabase.from('buildings').update({
        name, address: addr, approval_threshold: threshold,
      }).eq('id', bId()));
    }

    const feeAmt = parseFloat(String(el('s-fee').value).replace(',','.'))||0;
    await supabase.from('building_monthly_fee_settings').upsert({ building_id:bId(), default_amount:feeAmt }, { onConflict:'building_id' });
    if (error) { toast(error.message, true); el('s-save-general').disabled=false; return; }
    await refreshBuilding();
    renderBuildingSelector();
    toast('Ayarlar kaydedildi'); el('s-save-general').disabled=false;
  });

  el('s-save-security').addEventListener('click', async () => {
    const secUser = el('s-sec-user').value.trim() || null;
    const secPass = el('s-sec-pass').value.trim() || null;

    if (secUser && secUser.length < 3) return toast('Güvenlik kullanıcı adı en az 3 karakter olmalıdır.', true);
    if (secPass && secPass.length < 4) return toast('Güvenlik şifresi en az 4 karakter olmalıdır.', true);
    if ((secUser && !secPass) || (!secUser && secPass)) return toast('Kullanıcı adı ve şifre birlikte doldurulmalı veya her ikisi de boş bırakılmalıdır.', true);

    el('s-save-security').disabled = true;
    const { error } = await supabase.from('buildings').update({
      security_username: secUser,
      security_password: secPass
    }).eq('id', bId());

    await refreshBuilding();
    toast(error ? error.message : 'Güvenlik giriş bilgileri güncellendi', !!error);
    el('s-save-security').disabled = false;
  });

  el('s-save-bank').addEventListener('click', async () => {
    el('s-save-bank').disabled = true;
    const payload = {
      iban: el('s-iban').value.trim()||null, bank_name: el('s-bank').value.trim()||null, account_holder: el('s-holder').value.trim()||null,
    };
    let error = null;
    if (S.site) {
      // Banka bilgileri site ortak; mobil uyumluluk için binalara da yansıtılır
      ({ error } = await supabase.from('sites').update(payload).eq('id', S.site.id));
      if (!error) await supabase.from('buildings').update(payload).in('id', siteBIds());
    } else {
      ({ error } = await supabase.from('buildings').update(payload).eq('id', bId()));
    }
    await refreshBuilding();
    toast(error ? error.message : 'Banka bilgileri kaydedildi', !!error); el('s-save-bank').disabled=false;
  });
}

/* ============ 11) RAPORLAR (PDF AKTARIM) ============ */
async function renderReports() {
  if (!needBuilding()) return;
  const b = activeBuilding();
  if (!b) return;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  $content().innerHTML = `
    <div class="page-head"><h2>Finansal Raporlar</h2></div>
    
    <div class="grid-2">
      <!-- Kasa Raporu Kartı -->
      <div class="card">
        <h3 style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">📊 Kasa Gelir / Gider Raporu</h3>
        <p class="muted" style="font-size: 13px; margin-bottom: 18px;">Belirleyeceğiniz tarih aralığındaki tüm kasa hareketlerini, gelir-gider dağılımını tablo olarak PDF formatında indirir.</p>
        
        <div class="grid-2" style="margin-bottom: 16px;">
          <div class="field" style="margin: 0;">
            <label>Başlangıç Tarihi</label>
            <input type="date" id="rep-cash-start" value="${currentYear}-01-01" />
          </div>
          <div class="field" style="margin: 0;">
            <label>Bitiş Tarihi</label>
            <input type="date" id="rep-cash-end" value="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>
        
        <button class="btn btn-block" id="btn-pdf-cash">Kasa Raporu PDF İndir</button>
      </div>

      <!-- Aidat Borç Raporu Kartı -->
      <div class="card">
        <h3 style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">₺ Aidat Takip Raporu</h3>
        <p class="muted" style="font-size: 13px; margin-bottom: 18px;">Seçeceğiniz ay ve yıla ait tüm dairelerin aidat borç durumlarını, ödeyen/ödemeyen listesini tablo olarak PDF formatında indirir.</p>
        
        <div class="grid-2" style="margin-bottom: 16px;">
          <div class="field" style="margin: 0;">
            <label>Ay</label>
            <select id="rep-fee-month">
              ${MONTHS.map((m, i) => `<option value="${i+1}" ${i+1 === currentMonth ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin: 0;">
            <label>Yıl</label>
            <select id="rep-fee-year">
              ${[currentYear-1, currentYear, currentYear+1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
        
        <button class="btn btn-block" id="btn-pdf-fees">Aidat Durum PDF İndir</button>
      </div>
    </div>
  `;

  el('btn-pdf-cash').onclick = downloadCashReportPDF;
  el('btn-pdf-fees').onclick = downloadFeesReportPDF;
}

// Türkçe karakterleri standart PDF fontları için güvenli hale getiren veya normalize eden yardımcı
function cleanTR(str) {
  return String(str || '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

// 1. Kasa Raporu PDF İndirme
async function downloadCashReportPDF() {
  const start = el('rep-cash-start').value;
  const end = el('rep-cash-end').value;
  if (!start || !end) return toast('Lütfen tarih aralığı seçin', true);

  const b = activeBuilding();
  const btn = el('btn-pdf-cash');
  btn.disabled = true;
  btn.textContent = 'PDF Hazırlanıyor…';

  try {
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('*')
      .in('building_id', siteBIds())
      .gte('created_at', start + 'T00:00:00Z')
      .lte('created_at', end + 'T23:59:59Z')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Başlık ve Bilgiler
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(cleanTR(b.name) + " - Kasa Raporu", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Tarih Araligi: ${start} / ${end}`, 14, 28);
    doc.text(`Olusturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 34);

    let totalIncome = 0;
    let totalExpense = 0;

    const rows = (txs || []).map(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') totalIncome += amt;
      else totalExpense += amt;

      return [
        new Date(t.created_at).toLocaleDateString('tr-TR'),
        cleanTR(t.description),
        cleanTR(TX_CATEGORIES[t.category] || t.category),
        t.type === 'income' ? `+${amt.toFixed(2)} TL` : `-${amt.toFixed(2)} TL`,
        cleanTR(t.status === 'completed' || t.status === 'approved' ? 'Tamamlandi' : 'Onay Bekliyor')
      ];
    });

    // Özet Tablosu
    doc.autoTable({
      startY: 40,
      head: [['Toplam Gelir', 'Toplam Gider', 'Net Durum']],
      body: [[
        `${totalIncome.toFixed(2)} TL`,
        `${totalExpense.toFixed(2)} TL`,
        `${(totalIncome - totalExpense).toFixed(2)} TL`
      ]],
      theme: 'grid',
      styles: { font: 'helvetica' }
    });

    // Detay Tablosu
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Tarih', 'Aciklama', 'Kategori', 'Tutar', 'Durum']],
      body: rows,
      theme: 'striped',
      styles: { font: 'helvetica' },
      headStyles: { fillColor: [43, 38, 32] }
    });

    doc.save(`kasa_raporu_${start}_${end}.pdf`);
    toast('PDF başarıyla indirildi');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kasa Raporu PDF İndir';
  }
}

// 2. Aidat Raporu PDF İndirme
async function downloadFeesReportPDF() {
  const month = parseInt(el('rep-fee-month').value);
  const year = parseInt(el('rep-fee-year').value);
  const b = activeBuilding();
  
  const btn = el('btn-pdf-fees');
  btn.disabled = true;
  btn.textContent = 'PDF Hazırlanıyor…';

  try {
    const [aptRes, feeRes] = await Promise.all([
      supabase.from('apartments').select('id, apartment_number, owner_name, user_id, username').eq('building_id', bId()),
      supabase.from('monthly_fees').select('*').eq('building_id', bId()).eq('year', year).eq('month', month)
    ]);

    if (aptRes.error) throw new Error(aptRes.error.message);
    if (feeRes.error) throw new Error(feeRes.error.message);

    const apts = occupiedOnly(sortByApartment(aptRes.data));  // boş daireler rapora girmez
    const fees = feeRes.data || [];
    const feeByApt = new Map(fees.map(f => [f.apartment_id, f]));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Başlık ve Bilgiler
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(cleanTR(b.name) + " - Aidat Raporu", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Donem: ${MONTHS[month-1]} ${year}`, 14, 28);
    doc.text(`Olusturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 34);

    let paidCount = 0;
    let totalExpected = 0;
    let totalCollected = 0;

    const rows = apts.map(a => {
      const f = feeByApt.get(a.id);
      const isPaid = f ? f.is_paid : false;
      const amt = f ? Number(f.amount || 0) : 0;

      totalExpected += amt;
      if (isPaid) {
        paidCount++;
        totalCollected += amt;
      }

      return [
        cleanTR(a.apartment_number),
        cleanTR(a.owner_name || '—'),
        f ? `${amt.toFixed(2)} TL` : '—',
        isPaid ? 'Odedi' : 'Bekliyor',
        f?.paid_date ? new Date(f.paid_date).toLocaleDateString('tr-TR') : '—'
      ];
    });

    // Özet Tablosu
    doc.autoTable({
      startY: 40,
      head: [['Katilim Orani', 'Beklenen Tutar', 'Toplanan Tutar', 'Kalan Borc']],
      body: [[
        `${paidCount} / ${apts.length} Daire`,
        `${totalExpected.toFixed(2)} TL`,
        `${totalCollected.toFixed(2)} TL`,
        `${(totalExpected - totalCollected).toFixed(2)} TL`
      ]],
      theme: 'grid',
      styles: { font: 'helvetica' }
    });

    // Detay Tablosu
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Daire', 'Ev Sahibi / Sakin', 'Aidat Tutari', 'Durum', 'Odeme Tarihi']],
      body: rows,
      theme: 'striped',
      styles: { font: 'helvetica' },
      headStyles: { fillColor: [43, 38, 32] }
    });

    doc.save(`aidat_raporu_${month}_${year}.pdf`);
    toast('PDF başarıyla indirildi');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Aidat Durum PDF İndir';
  }
}

/* ============ 11b) ABONELİK (SİTE bazlı, web tabanlı ödeme) ============ */
// Abonelik site bazlıdır: tek ödeme sitedeki TÜM binaları kapsar.
// Fiyat = sabit ücret + sitedeki toplam daire sayısı × daire ücreti.
async function renderSubscription() {
  if (!needBuilding()) return;
  await refreshBuilding();
  const b = S.site || activeBuilding();
  if (!b) return;

  const paymentsQuery = sId()
    ? supabase.from('subscription_payments').select('*').eq('site_id', sId()).order('created_at', { ascending: false })
    : supabase.from('subscription_payments').select('*').in('building_id', siteBIds()).order('created_at', { ascending: false });

  const [priceRes, payRes] = await Promise.all([
    supabase.from('app_pricing').select('*').eq('id', 1).maybeSingle(),
    paymentsQuery,
  ]);

  if (priceRes.error) {
    $content().innerHTML = `
      <div class="page-head"><h2>💳 Abonelik</h2></div>
      <div class="card"><p class="t-empty">Abonelik altyapısı henüz aktif değil (veritabanı güncellemesi bekleniyor).</p></div>`;
    return;
  }

  const pricing = priceRes.data || { base_fee: 250, per_apartment_fee: 10 };
  // Ücret, sitedeki BİLDİRİLEN toplam daire sayısına göre hesaplanır
  // (buildings.apartment_count). Fiziksel apartments satırları kayıtta
  // oluşmadığı için satır saymak yanlış (0) sonuç veriyordu.
  const aptCount = S.buildings.reduce((sum, x) => sum + (Number(x.apartment_count) || 0), 0);
  const payments = payRes.data || [];
  const monthly = Number(pricing.base_fee) + Number(pricing.per_apartment_fee) * aptCount;

  const expiry = b.subscription_expiry ? new Date(b.subscription_expiry) : null;
  const isActive = b.subscription_type && b.subscription_type !== 'free' && expiry && expiry.getTime() > Date.now();
  const inTrial = isInTrial();
  const access = isActive || inTrial;   // kodlar/erişim: ödeme ya da deneme
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : 0;

  // Ödeme doğrudan iyzico'dan alınıyor; yönetici onayı diye bir adım yok.
  // 'pending' artık "banka dönüşü bekleniyor" demek, "onay bekliyor" değil.
  const PAY_STATUS = { pending: '<span class="badge b-amber">İşleniyor</span>', paid: '<span class="badge b-green">Ödendi</span>', rejected: '<span class="badge b-red">Başarısız</span>', canceled: '<span class="badge b-gray">İptal</span>' };
  const state = { months: 1 };
  const total = () => monthly * state.months;

  $content().innerHTML = `
    <div class="page-head"><h2>💳 Abonelik</h2></div>

    <div class="wallet-card ${access ? '' : 'neg'}">
      <div class="wallet-head">${isActive ? '✅' : inTrial ? '🎁' : '⚠️'} <span>${esc(b.name)}${S.site && S.site.site_type === 'site' ? ` (${S.buildings.length} bina)` : ''} — Abonelik Durumu</span></div>
      <div class="wallet-amount" style="font-size:26px;">${isActive ? 'Aktif' : inTrial ? 'Ücretsiz Deneme' : (b.subscription_type === 'free' || !expiry ? 'Ücretsiz Plan' : 'Süresi Doldu')}</div>
      ${inTrial
        ? `<div class="muted" style="margin-top:6px;font-size:13.5px;">Deneme süreniz <strong>${trialDaysLeft()} gün</strong> sonra doluyor. Kesintisiz devam için aşağıdan kart ile ödeyin.</div>`
        : (expiry ? `<div class="muted" style="margin-top:6px;font-size:13.5px;">Bitiş: <strong>${dmy(expiry)}</strong>${isActive ? ` · ${daysLeft} gün kaldı` : ''}</div>` : '')}
    </div>

    <div class="card">
      <h3>🔑 Bina Davet Kodları</h3>
      ${access
        ? `<p class="muted" style="font-size:12.5px;margin-top:-4px;margin-bottom:12px;">${inTrial ? '🎁 Deneme sürümünüz aktif — ' : ''}Bu kodları sakinlerinizle paylaşın; her sakin kendi binasının koduyla uygulamaya katılır.</p>
           <table><thead><tr><th>Bina</th><th>Daire</th><th>Davet Kodu</th></tr></thead>
           <tbody>${S.buildings.map(x => `<tr>
             <td>${esc(x.name)}</td>
             <td>${x.apartment_count || 0}</td>
             <td><strong style="letter-spacing:1px;">${esc(x.building_code || '—')}</strong>
               <button class="btn btn-sm btn-ghost copy-code" data-code="${esc(x.building_code || '')}" style="margin-left:8px;">Kopyala</button></td>
           </tr>`).join('')}</tbody></table>`
        : `<div class="info-banner" style="margin:0;">
             🔒 Deneme süreniz doldu. Davet kodları <strong>ödeme yapıldıktan sonra</strong> yeniden görünür.
           </div>`}
    </div>

    <div class="card">
      <h3>Aboneliği Uzat</h3>

      <div class="sub-breakdown">
        <div class="sub-line"><span>İşletim ücreti (sabit)</span><span>${TL(pricing.base_fee)}</span></div>
        <div class="sub-line"><span>Daire başına ücret × ${aptCount} daire</span><span>${TL(Number(pricing.per_apartment_fee) * aptCount)}</span></div>
        <div class="sub-line sub-line-total"><span>Aylık toplam</span><span>${TL(monthly)}</span></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 18px;">Abonelik SİTE bazlıdır: tek ödeme sitedeki tüm binaları kapsar. Daire sayınız değişirse sonraki ödemede yeni sayı üzerinden hesaplanır.</p>

      <div class="field"><label>Kaç ay ödemek istersiniz?</label>
        <div class="cat-grid" id="sub-months">
          ${[1,3,6,12].map(m => `<button type="button" class="cat-chip ${m===1?'active':''}" data-m="${m}">${m} Ay</button>`).join('')}
        </div>
      </div>

      <div class="sub-total-row">
        <span>Ödenecek tutar</span>
        <strong id="sub-total">${TL(total())}</strong>
      </div>
      <button class="btn btn-block" id="sub-pay">💳 Kart ile Öde</button>
      <div class="info-banner" style="margin-top:14px;margin-bottom:0;">
        Ödeme güvenli iyzico altyapısıyla alınır; kart bilgileriniz bize iletilmez.
        Ödeme tamamlandığı anda aboneliğiniz uzar ve davet kodlarınız açılır — ayrıca onay beklemezsiniz.
      </div>
      <!-- iyzico Checkout Form buraya yüklenir -->
      <div id="iyzico-form" style="margin-top:16px;"></div>
    </div>

    <div class="card">
      <h3>Ödeme Geçmişi</h3>
      <table><thead><tr><th>Tarih</th><th>Süre</th><th>Daire</th><th>Tutar</th><th>Dönem</th><th>Durum</th></tr></thead>
      <tbody>${payments.length ? payments.map(p => `<tr>
        <td>${dmy(p.created_at)}</td><td>${p.months} ay</td><td>${p.apartment_count}</td>
        <td>${TL(p.amount)}</td>
        <td>${p.period_start ? `${dmy(p.period_start)} → ${dmy(p.period_end)}` : '—'}</td>
        <td>${PAY_STATUS[p.status] || p.status}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="t-empty">Henüz ödeme kaydı yok</td></tr>'}</tbody></table>
    </div>`;

  // Davet kodu kopyalama
  $content().querySelectorAll('.copy-code').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code || '';
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        toast(`Kod kopyalandı: ${code}`);
      } catch {
        toast('Kopyalanamadı, kodu elle seçin', true);
      }
    });
  });

  el('sub-months').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-m]'); if (!chip) return;
    state.months = Number(chip.dataset.m);
    el('sub-months').querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c === chip));
    el('sub-total').textContent = TL(total());
  });

  // Kart ile öde: iyzico-init Edge Function'ını çağır, dönen Checkout Form'u göm.
  el('sub-pay').addEventListener('click', async () => {
    if (!sId()) { toast('Site bulunamadı; migration 0013/0015 uygulanmalı', true); return; }
    const btn = el('sub-pay');
    btn.disabled = true; btn.textContent = 'Hazırlanıyor…';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Oturum bulunamadı');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/iyzico-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({ siteId: sId(), months: state.months }),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error || 'Ödeme başlatılamadı');

      // iyzico Checkout Form'unu göm ve içindeki script'leri çalıştır
      const container = el('iyzico-form');
      container.innerHTML = out.checkoutFormContent || '';
      container.querySelectorAll('script').forEach((old) => {
        const s = document.createElement('script');
        if (old.src) s.src = old.src; else s.textContent = old.textContent;
        document.body.appendChild(s);
      });
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.textContent = '💳 Kart ile Öde';
      btn.disabled = false;
    } catch (err) {
      // iyzico anahtarları henüz eklenmemişse buraya düşer
      toast(err.message || 'Ödeme başlatılamadı', true);
      btn.textContent = '💳 Kart ile Öde'; btn.disabled = false;
    }
  });
}

/* ============ 12) DEMİRBAŞLAR (building_assets) ============ */
async function renderAssets() {
  if (!needBuilding()) return;
  const { data: assets, error } = await supabase
    .from('building_assets')
    .select('*')
    .in('building_id', siteBIds())
    .order('created_at', { ascending: false });

  if (error) {
    $content().innerHTML = `<div class="error">Demirbaşlar yüklenemedi: ${esc(error.message)}</div>`;
    return;
  }

  const rows = (assets || []).map(a => {
    // Garanti kalan gün hesabı
    let warrantyText = 'Belirtilmemiş';
    if (a.warranty_expiry) {
      const diff = new Date(a.warranty_expiry).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      warrantyText = days > 0 ? `${days} gün kaldı` : 'Süresi Bitti';
    }

    // Son bakım tarihi
    const lastMaint = a.last_maintenance_at ? dmy(a.last_maintenance_at) : 'Bakım yapılmadı';

    return `
      <div class="asset-card">
        <span class="badge ${warrantyText.includes('Bitti') ? 'b-red' : 'b-green'} asset-badge">${warrantyText}</span>
        <h3 style="margin-top: 0; margin-bottom: 8px;">${esc(a.name)}</h3>
        <p class="muted" style="font-size: 13px;">Marka/Model: <strong>${esc(a.brand || '—')} ${esc(a.model || '—')}</strong></p>
        <p class="muted" style="font-size: 13px;">Seri No: <strong>${esc(a.serial_number || '—')}</strong></p>
        <p class="muted" style="font-size: 13px; margin-top: 10px;">Son Bakım: <strong>${lastMaint}</strong></p>
        <p class="muted" style="font-size: 13px;">Bakım Aralığı: <strong>${a.maintenance_interval_months || '—'} ayda bir</strong></p>
        
        <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-sm btn-ghost" onclick="window.editAssetMaintenance('${a.id}')">🔧 Bakım Yapıldı</button>
          <button class="btn btn-sm btn-outline-red" onclick="window.deleteAsset('${a.id}')">Sil</button>
        </div>
      </div>
    `;
  }).join('');

  $content().innerHTML = `
    <div class="page-head">
      <h2>Bina Demirbaşları</h2>
      <div class="tools"><button class="btn" id="asset-add">+ Yeni Demirbaş</button></div>
    </div>
    
    <div class="asset-grid">
      ${rows || '<div class="card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">Bina için kayıtlı demirbaş bulunamadı.</div>'}
    </div>
  `;

  el('asset-add').onclick = openAddAssetModal;
}

// Demirbaş Bakım Tarihi Güncelleme
window.editAssetMaintenance = async function(id) {
  if (!confirm('Bu demirbaş için bugün bakım yapıldığını onaylıyor musunuz?')) return;
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('building_assets').update({ last_maintenance_at: today }).eq('id', id);
  if (error) toast(error.message, true);
  else { toast('Bakım kaydı güncellendi'); renderAssets(); }
};

// Demirbaş Silme
window.deleteAsset = async function(id) {
  if (!confirm('Bu demirbaşı silmek istediğinize emin misiniz?')) return;
  const { error } = await supabase.from('building_assets').delete().eq('id', id);
  if (error) toast(error.message, true);
  else { toast('Demirbaş silindi'); renderAssets(); }
};

// Demirbaş Ekleme Modalı
function openAddAssetModal() {
  openModal('Yeni Demirbaş Ekle', `
    <div class="field"><label>Demirbaş Adı *</label><input id="a-name" placeholder="Örn: Asansör A Blok" required /></div>
    <div class="grid-2">
      <div class="field"><label>Marka</label><input id="a-brand" placeholder="Örn: Otis" /></div>
      <div class="field"><label>Model</label><input id="a-model" placeholder="Örn: Gen2" /></div>
    </div>
    <div class="field"><label>Seri Numarası</label><input id="a-serial" placeholder="Seri no veya parça no" /></div>
    <div class="grid-2">
      <div class="field"><label>Garanti Bitiş Tarihi</label><input id="a-warranty" type="date" /></div>
      <div class="field"><label>Bakım Aralığı (Ay)</label><input id="a-interval" type="number" min="1" max="24" value="6" /></div>
    </div>
    <button class="btn btn-block" id="m-save">Kaydet</button>
  `, async () => {
    const name = el('a-name').value.trim();
    const brand = el('a-brand').value.trim() || null;
    const model = el('a-model').value.trim() || null;
    const serial = el('a-serial').value.trim() || null;
    const warranty = el('a-warranty').value || null;
    const interval = parseInt(el('a-interval').value) || null;

    if (!name) throw new Error('Demirbaş adı zorunludur.');

    const { error } = await supabase.from('building_assets').insert({
      building_id: bId(),
      name, brand, model, serial_number: serial,
      warranty_expiry: warranty,
      maintenance_interval_months: interval
    });

    if (error) throw new Error(error.message);
    toast('Demirbaş başarıyla eklendi');
  });
}


/* ============ 13) KARAR DEFTERİ (building_decisions) ============ */
async function renderDecisions() {
  if (!needBuilding()) return;
  const { data: decisions, error } = await supabase
    .from('building_decisions')
    .select('*')
    .in('building_id', siteBIds())
    .order('decision_date', { ascending: false });

  if (error) {
    $content().innerHTML = `<div class="error">Kararlar yüklenemedi: ${esc(error.message)}</div>`;
    return;
  }

  const list = decisions || [];

  // description eskiden düz metindi, artık sınırlı HTML. İçinde etiket yoksa
  // eski kayıttır; satır sonlarını koruyarak göster.
  const body = (text) => {
    const raw = String(text || '');
    return /<[a-z][\s\S]*>/i.test(raw)
      ? sanitizeRichHTML(raw)
      : esc(raw).replace(/\n/g, '<br>');
  };

  const items = list.map(d => `
    <article class="decision-card">
      <div class="decision-top">
        <div class="decision-date">
          <span class="dd-day">${new Date(d.decision_date).getDate()}</span>
          <span class="dd-mon">${MONTHS[new Date(d.decision_date).getMonth()]?.slice(0,3) || ''}</span>
          <span class="dd-year">${new Date(d.decision_date).getFullYear()}</span>
        </div>
        <div class="decision-head">
          <h3>${esc(d.title)}</h3>
          ${d.content_url ? `<a class="decision-doc" href="${esc(d.content_url)}" target="_blank" rel="noopener">📄 Belgeyi aç</a>` : ''}
        </div>
        <div class="decision-actions">
          <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${d.id}">Düzenle</button>
          <button class="btn btn-sm btn-outline-red" data-act="del" data-id="${d.id}">Sil</button>
        </div>
      </div>
      <div class="decision-body rich-content">${body(d.description)}</div>
    </article>
  `).join('');

  $content().innerHTML = `
    <div class="page-head">
      <h2>Karar Defteri</h2>
      <div class="tools"><button class="btn" id="decision-add">+ Yeni Karar Yaz</button></div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      Toplantılarda alınan kararları buraya işleyin. Metni kalınlaştırabilir, başlık ve
      madde listesi ekleyebilirsiniz — yönetici değişse bile kayıtlar burada kalır.
    </p>

    <div class="decision-list" id="decision-list">
      ${items || `<div class="card decision-empty">
        <div style="font-size:38px;line-height:1">📜</div>
        <h3 style="margin:10px 0 6px;">Karar defteriniz henüz boş</h3>
        <p class="muted" style="font-size:13.5px;max-width:380px;margin:0 auto 16px;">
          İlk kararınızı yazarak başlayın. Genel kurul kararları, aidat artışı,
          site kuralı değişikliği — hepsi tarihiyle birlikte burada saklanır.
        </p>
        <button class="btn" id="decision-add-empty">+ İlk Kararı Yaz</button>
      </div>`}
    </div>
  `;

  el('decision-add').onclick = () => openDecisionModal(null);
  if (el('decision-add-empty')) el('decision-add-empty').onclick = () => openDecisionModal(null);

  el('decision-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const rec = list.find(x => x.id === btn.dataset.id); if (!rec) return;
    if (btn.dataset.act === 'edit') openDecisionModal(rec);
    else window.deleteDecision(rec.id);
  });
}

// Karar Silme
window.deleteDecision = async function(id) {
  if (!confirm('Bu kararı silmek istediğinize emin misiniz?')) return;
  const { error } = await supabase.from('building_decisions').delete().eq('id', id);
  if (error) toast(error.message, true);
  else { toast('Karar kaydı silindi'); renderDecisions(); }
};

// Karar Ekleme / Düzenleme Modalı (rec === null ise yeni kayıt)
function openDecisionModal(rec) {
  const isEdit = !!rec;
  openModal(isEdit ? 'Kararı Düzenle' : 'Yeni Karar Yaz', `
    <div class="field"><label>Karar Başlığı *</label>
      <input id="d-title" placeholder="Örn: 2026 Olağan Genel Kurul Kararları" value="${isEdit ? esc(rec.title) : ''}" required /></div>
    <div class="field"><label>Karar Tarihi</label>
      <input id="d-date" type="date" value="${isEdit ? esc(rec.decision_date) : todayISO()}" /></div>
    <div class="field"><label>Karar Metni *</label>
      ${richEditorHTML('d-desc', isEdit ? rec.description : '')}</div>
    <div class="field"><label>İlgili Belge Bağlantısı (opsiyonel)</label>
      <input id="d-url" placeholder="Varsa imzalı karar tutanağının bağlantısı" value="${isEdit ? esc(rec.content_url || '') : ''}" /></div>
    <button class="btn btn-block" id="m-save">${isEdit ? 'Değişiklikleri Kaydet' : 'Deftere İşle'}</button>
  `, async () => {
    const title = el('d-title').value.trim();
    const date = el('d-date').value;
    const desc = richValue('d-desc');
    const url = el('d-url').value.trim() || null;

    if (!title || !desc) throw new Error('Başlık ve karar metni zorunludur.');

    const payload = { title, description: desc, content_url: url, decision_date: date };
    const { error } = isEdit
      ? await supabase.from('building_decisions').update(payload).eq('id', rec.id)
      : await supabase.from('building_decisions').insert({ building_id: bId(), ...payload });

    if (error) throw new Error(error.message);
    toast(isEdit ? 'Karar güncellendi' : 'Karar başarıyla deftere işlendi');
  });

  bindRichEditor('d-desc');
}


/* ============ 14) GÜVENLİK / ZİYARETÇİ PANELİ (visitor_logs) ============ */
async function renderSecurityPanel() {
  if (!needBuilding()) return;
  const b = activeBuilding();
  if (!b) return;

  // Aktif (içerideki) ziyaretçileri çek
  // Güvenlik görevlisinin auth oturumu yok; RLS yerine şifre doğrulamalı RPC kullanılır.
  const secMode = S.profile && S.profile.role === 'security';
  const { data: activeVisitors, error } = secMode
    ? await supabase.rpc('security_active_visitors', {
        p_username: S.securityCreds.username, p_password: S.securityCreds.password,
      })
    : await supabase
        .from('visitor_logs')
        .select('*')
        .in('building_id', siteBIds())
        .is('exit_at', null)
        .order('entry_at', { ascending: false });

  if (error) {
    $content().innerHTML = `<div class="error">Ziyaretçi verileri alınamadı: ${esc(error.message)}</div>`;
    return;
  }

  const visitorList = (activeVisitors || []).map(v => `
    <div class="active-visitor-row">
      <div class="visitor-info-left">
        <span style="font-weight: 800; font-size: 15px; color: var(--ink);">${esc(v.visitor_name)}</span>
        <span style="font-size: 13px; color: var(--muted); margin-top: 3px;">
          <span class="visitor-badge">${esc(v.purpose || 'Ziyaret')}</span>
          Daire: <strong>${esc(v.destination_apartment)}</strong> · Plaka: <strong>${esc(v.plate_number || 'YAYAN')}</strong>
        </span>
        <span style="font-size: 11px; color: var(--muted); margin-top: 2px;">Giriş: ${dmyhm(v.entry_at)}</span>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-red" onclick="window.markVisitorExit('${v.id}')">Çıkış Yap</button>
      </div>
    </div>
  `).join('');

  const isSecurity = S.profile && S.profile.role === 'security';

  // Güvenlik Modu HTML (Sol bar gizlendiği için üstte geri dön butonu var)
  $content().innerHTML = `
    <div class="security-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">🛡️</span>
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">KOMŞU — GÜVENLİK PANELİ</h2>
          <span style="font-size: 12px; opacity: 0.85;">${esc(b.name)} · Giriş-Çıkış Kontrol Noktası</span>
        </div>
      </div>
      <button class="security-back-btn" id="exit-security">${isSecurity ? 'Oturumu Kapat' : 'Yönetici Paneline Dön'}</button>
    </div>
    
    <div class="security-grid">
      <!-- Sol Taraf: Hızlı Ziyaretçi Giriş Formu -->
      <div class="security-box">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-weight: 800;">📥 Yeni Ziyaretçi Girişi</h3>
        
        <div class="quick-action-grid">
          <div class="action-card" onclick="window.fillVisitorType('Su Kuryesi')">💧 Su</div>
          <div class="action-card" onclick="window.fillVisitorType('Kargo Kuryesi')">📦 Kargo</div>
          <div class="action-card" onclick="window.fillVisitorType('Yemek Kuryesi')">🍔 Yemek</div>
          <div class="action-card" onclick="window.fillVisitorType('Misafir')">👥 Misafir</div>
        </div>
        
        <div class="field"><label>Ziyaretçi Adı / Firma *</label><input id="v-name" placeholder="Örn: Getir Yemek, Yurtiçi Kargo, Ahmet Bey" /></div>
        <div class="grid-2">
          <div class="field"><label>Araç Plakası</label><input id="v-plate" placeholder="Örn: 34ABC123" oninput="this.value = this.value.toUpperCase()" /></div>
          <div class="field"><label>Hedef Daire *</label><input id="v-apt" placeholder="Örn: Daire 12" /></div>
        </div>
        <div class="field"><label>Ziyaret Nedeni</label><input id="v-purpose" placeholder="Örn: Kargo Teslimatı" /></div>
        
        <button class="btn btn-block" style="margin-top: 10px; background: var(--green); color: #fff;" id="btn-save-visitor">Ziyaretçi Girişini Kaydet</button>
      </div>
      
      <!-- Sağ Taraf: İçerideki Aktif Ziyaretçiler -->
      <div class="security-box">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-weight: 800;">🚪 İçerideki Ziyaretçiler (${activeVisitors.length})</h3>
        <div style="max-height: 480px; overflow-y: auto;">
          ${visitorList || '<div style="text-align: center; padding: 40px; color: var(--muted);">İçeride aktif ziyaretçi bulunmuyor.</div>'}
        </div>
      </div>
    </div>

    <!-- Günlük giriş-çıkış raporu -->
    <div class="security-box" style="margin-top: 18px;">
      <div class="sec-report-head">
        <h3 style="margin: 0; font-weight: 800;">📋 Günlük Giriş-Çıkış Raporu</h3>
        <div class="sec-report-tools">
          <input type="date" id="sec-rep-date" value="${todayISO()}" />
          <button class="btn btn-sm btn-ghost" id="sec-rep-load">Göster</button>
          <button class="btn btn-sm" id="sec-rep-csv" disabled>⬇ CSV İndir</button>
        </div>
      </div>
      <div id="sec-rep-body"><div class="t-empty">Bir gün seçip "Göster"e basın.</div></div>
    </div>
  `;

  el('exit-security').onclick = () => {
    if (isSecurity) {
      S.user = null; S.profile = null; S.securityCreds = null; S.buildings = []; S.activeBuildingId = null;
      showLogin();
    } else {
      navigate('overview');
    }
  };

  el('btn-save-visitor').onclick = saveVisitorEntry;

  /* --- Günlük giriş-çıkış raporu --- */
  let repRows = [];   // CSV indirmesi için son gösterilen kayıtlar
  let repDay = '';

  const loadDayReport = async () => {
    const day = el('sec-rep-date').value;
    if (!day) return toast('Önce bir gün seçin', true);
    const btn = el('sec-rep-load');
    btn.disabled = true; btn.textContent = 'Yükleniyor…';
    try {
      let rows;
      if (isSecurity) {
        // Güvenlik görevlisinin auth oturumu yok → şifre doğrulamalı RPC
        const { data, error } = await supabase.rpc('security_day_logs', {
          p_username: S.securityCreds.username,
          p_password: S.securityCreds.password,
          p_day: day,
        });
        if (error) throw new Error(error.message);
        rows = data || [];
      } else {
        // Yönetici RLS ile visitor_logs'u doğrudan okuyabiliyor
        const start = new Date(`${day}T00:00:00`);
        const end = new Date(`${day}T00:00:00`);
        end.setDate(end.getDate() + 1);
        const { data, error } = await supabase
          .from('visitor_logs')
          .select('*')
          .in('building_id', siteBIds())
          .or(`and(entry_at.gte.${start.toISOString()},entry_at.lt.${end.toISOString()}),and(exit_at.gte.${start.toISOString()},exit_at.lt.${end.toISOString()})`)
          .order('entry_at', { ascending: true });
        if (error) throw new Error(error.message);
        rows = data || [];
      }

      repRows = rows; repDay = day;
      el('sec-rep-csv').disabled = rows.length === 0;

      const stillIn = rows.filter(r => !r.exit_at).length;
      el('sec-rep-body').innerHTML = rows.length ? `
        <div class="sec-report-summary">
          <div><strong>${rows.length}</strong><span>Toplam hareket</span></div>
          <div><strong>${rows.length - stillIn}</strong><span>Çıkış yapan</span></div>
          <div><strong>${stillIn}</strong><span>Hâlâ içeride</span></div>
        </div>
        <table><thead><tr>
          <th>Ziyaretçi</th><th>Neden</th><th>Daire</th><th>Plaka</th><th>Giriş</th><th>Çıkış</th><th>Süre</th>
        </tr></thead><tbody>
        ${rows.map(r => {
          const mins = r.exit_at ? Math.round((new Date(r.exit_at) - new Date(r.entry_at)) / 60000) : null;
          return `<tr>
            <td><strong>${esc(r.visitor_name)}</strong></td>
            <td>${esc(r.purpose || '—')}</td>
            <td>${esc(r.destination_apartment || '—')}</td>
            <td>${esc(r.plate_number || 'YAYAN')}</td>
            <td>${dmyhm(r.entry_at)}</td>
            <td>${r.exit_at ? dmyhm(r.exit_at) : '<span class="badge b-amber">İçeride</span>'}</td>
            <td>${mins === null ? '—' : `${Math.floor(mins / 60)}s ${mins % 60}dk`}</td>
          </tr>`;
        }).join('')}
        </tbody></table>`
        : '<div class="t-empty">Bu güne ait giriş-çıkış kaydı yok.</div>';
    } catch (err) {
      toast(err.message, true);
      el('sec-rep-body').innerHTML = `<div class="error">Rapor alınamadı: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Göster';
    }
  };

  el('sec-rep-load').onclick = loadDayReport;
  el('sec-rep-date').onchange = loadDayReport;

  el('sec-rep-csv').onclick = () => {
    if (!repRows.length) return;
    downloadCSV(
      `komsu-giris-cikis-${repDay}.csv`,
      ['Ziyaretçi', 'Neden', 'Hedef Daire', 'Plaka', 'Giriş', 'Çıkış', 'Süre (dk)'],
      repRows.map(r => {
        const mins = r.exit_at ? Math.round((new Date(r.exit_at) - new Date(r.entry_at)) / 60000) : '';
        return [
          r.visitor_name, r.purpose || '', r.destination_apartment || '',
          r.plate_number || 'YAYAN', dmyhm(r.entry_at),
          r.exit_at ? dmyhm(r.exit_at) : 'İçeride', mins,
        ];
      })
    );
    toast('Rapor indirildi');
  };

  loadDayReport();   // açılışta bugünü göster

  // Plaka yazıldığında daire eşleştirmesini hızlıca algılayan mini tetikleyici (Opsiyonel Plaka Sorgu Entegrasyonu)
  el('v-plate').onblur = async (e) => {
    const plate = e.target.value.trim().replace(/\s+/g, '').toUpperCase();
    if (plate.length >= 5) {
      let apt = null;
      if (S.profile && S.profile.role === 'security') {
        const { data } = await supabase.rpc('security_find_plate', {
          p_username: S.securityCreds.username, p_password: S.securityCreds.password, p_plate: plate,
        });
        apt = data && data[0];
      } else {
        const { data } = await supabase
          .from('apartments')
          .select('apartment_number, owner_name')
          .in('building_id', siteBIds())
          .eq('vehicle_plate_number', plate)
          .limit(1)
          .maybeSingle();
        apt = data;
      }

      if (apt) {
        el('v-apt').value = apt.apartment_number;
        toast(`Araç tanındı: ${apt.owner_name || ''} (Daire ${apt.apartment_number})`);
      }
    }
  };
}

// Ziyaretçi Tipi Hızlı Doldurma
window.fillVisitorType = function(type) {
  el('v-name').value = type;
  el('v-purpose').value = type + ' Teslimatı';
  toast(`${type} seçildi.`);
};

// Ziyaretçi Çıkış İşleme
window.markVisitorExit = async function(id) {
  const { error } = (S.profile && S.profile.role === 'security')
    ? await supabase.rpc('security_mark_exit', {
        p_username: S.securityCreds.username, p_password: S.securityCreds.password, p_log_id: id,
      })
    : await supabase
        .from('visitor_logs')
        .update({ exit_at: new Date().toISOString() })
        .eq('id', id);

  if (error) toast(error.message, true);
  else {
    toast('Ziyaretçi çıkışı kaydedildi');
    renderSecurityPanel();
  }
};

// Ziyaretçi Giriş Kaydetme
async function saveVisitorEntry() {
  const name = el('v-name').value.trim();
  const plate = el('v-plate').value.trim().replace(/\s+/g, '').toUpperCase();
  const apt = el('v-apt').value.trim();
  const purpose = el('v-purpose').value.trim();

  if (!name || !apt) return toast('Ziyaretçi adı ve daire numarası zorunludur.', true);

  const btn = el('btn-save-visitor');
  btn.disabled = true;

  try {
    const { error } = (S.profile && S.profile.role === 'security')
      ? await supabase.rpc('security_add_visitor', {
          p_username: S.securityCreds.username, p_password: S.securityCreds.password,
          p_visitor_name: name, p_plate: plate, p_apartment: apt, p_purpose: purpose,
        })
      : await supabase.from('visitor_logs').insert({
          building_id: bId(),
          visitor_name: name,
          plate_number: plate || null,
          destination_apartment: apt,
          purpose: purpose || null
        });

    if (error) throw new Error(error.message);

    toast('Ziyaretçi girişi kaydedildi');
    renderSecurityPanel();
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
  }
}


/* ============ Açılış ============ */
(async () => {
  // Hata Yakalama (Remote Debugger)
  window.onerror = function(message, source, lineno, colno, error) {
    const loadEl = document.getElementById('loading');
    if (loadEl) {
      loadEl.style.display = 'flex';
      loadEl.style.justifyContent = 'center';
      loadEl.style.alignItems = 'center';
      loadEl.style.background = '#FFF6E9';
      loadEl.innerHTML = `<div style="padding:30px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.08);color:#d9534f;text-align:center;font-family:sans-serif;max-width:500px;border:1px solid #f2dede;">
        <h3 style="margin-top:0;font-size:20px;font-weight:800;">Sistem Yükleme Hatası</h3>
        <p style="font-size:14.5px;color:#555;margin:12px 0;line-height:1.5;">${message}</p>
        <p style="font-size:12px;color:#999;margin-bottom:0;">Satır: ${lineno} · Sütun: ${colno}<br/>Dosya: ${source}</p>
      </div>`;
    }
    return false;
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await boot(session.user);
    // Ana sayfadaki "Ücretsiz Başla" bağlantısı ?signup=1 ile gelir
    else if (new URLSearchParams(location.search).get('signup') === '1') showSignup();
    else showLogin();
  } catch (err) {
    window.onerror(err.message, 'panel.js', 0, 0, err);
  }
})();
