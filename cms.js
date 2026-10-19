import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Panelle aynı Supabase projesi ve aynı publishable anahtar.
// Yetki tamamen veritabanında: cms_* RPC'leri platform_admins kaydı olmayan
// kullanıcıya hata döndürür. Gizli anahtar burada YOKTUR.
const SUPABASE_URL = 'https://latrcfjexphtnqpnvscr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XQreUBjsc_VwwbtTMoQzZw_C4WXnHpo';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============ Yardımcılar ============ */
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const TL = (n) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits: 0 }).format(Number(n) || 0);
const TL2 = (n) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY' }).format(Number(n) || 0);
const NUM = (n) => new Intl.NumberFormat('tr-TR').format(Number(n) || 0);
const dmy = (v) => v ? new Date(v).toLocaleDateString('tr-TR') : '—';
const dmyhm = (v) => v ? new Date(v).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }
const SCREENS = ['loading', 'login', 'app'];
function showScreen(id) { SCREENS.forEach(s => (s === id ? show(s) : hide(s))); }

let toastTimer;
function toast(msg, isErr) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  show('toast');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide('toast'), 3200);
}

// 'epoch' (hareket yok) değerini boş kabul et
const realDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return d.getFullYear() <= 1970 ? null : d;
};

const STATUS = {
  active:  { label: 'Aktif abone',   cls: 'b-green' },
  trial:   { label: 'Denemede',      cls: 'b-amber' },
  expired: { label: 'Süresi dolmuş', cls: 'b-red'   },
};

const PAY_STATUS = {
  paid:     { label: 'Ödendi',   cls: 'b-green' },
  pending:  { label: 'Bekliyor', cls: 'b-amber' },
  rejected: { label: 'Reddedildi', cls: 'b-red' },
  canceled: { label: 'İptal',    cls: 'b-gray'  },
};

const PAY_METHOD = {
  iyzico: 'iyzico',
  bank_transfer: 'Havale / EFT',
};

/* ============ Durum ============ */
const S = { rows: [], stats: null, view: 'sites', destek: [] };

/* ============ Giriş ============ */
el('toggle-pass').addEventListener('click', () => {
  const p = el('password'); const on = p.type === 'password';
  p.type = on ? 'text' : 'password'; el('toggle-pass').textContent = on ? 'Gizle' : 'Göster';
});

function showLogin(message) {
  showScreen('login');
  if (message) { el('login-error').textContent = message; show('login-error'); } else hide('login-error');
}

el('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide('login-error');
  const btn = el('login-btn'); btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: el('email').value.trim().toLowerCase(),
    password: el('password').value,
  });

  btn.disabled = false; btn.textContent = 'Giriş Yap';
  if (error || !data.user) {
    el('login-error').textContent = 'E-posta veya şifre hatalı.';
    show('login-error');
    return;
  }
  await boot(data.user);
});

el('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

el('refresh-btn').addEventListener('click', () => loadData(true));

/* ============ Açılış ============ */
async function boot(user) {
  showScreen('loading');
  el('top-user').textContent = user.email || '';

  const ok = await loadData(false);
  if (!ok) return;
  showScreen('app');
}

// Veriyi çeker. Yetki hatasında oturumu kapatıp giriş ekranına döner.
async function loadData(isRefresh) {
  const btn = el('refresh-btn');
  if (isRefresh) { btn.disabled = true; btn.textContent = 'Yenileniyor…'; }

  const [statsRes, sitesRes] = await Promise.all([
    supabase.rpc('cms_stats'),
    supabase.rpc('cms_sites'),
  ]);

  if (isRefresh) { btn.disabled = false; btn.textContent = 'Yenile'; }

  const err = statsRes.error || sitesRes.error;
  if (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('platform yöneticisi') || msg.includes('yetki') || err.code === '42501') {
      await supabase.auth.signOut();
      showLogin('Bu hesabın platform yöneticisi yetkisi yok.');
      return false;
    }
    if (msg.includes('could not find') || msg.includes('does not exist') || err.code === 'PGRST202') {
      await supabase.auth.signOut();
      showLogin('Sunucu tarafı kurulumu eksik: 0018_platform_admin.sql migration\'ı henüz uygulanmamış.');
      return false;
    }
    if (isRefresh) { toast('Veri alınamadı: ' + (err.message || 'bilinmeyen hata'), true); return false; }
    await supabase.auth.signOut();
    showLogin('Veri alınamadı: ' + (err.message || 'bilinmeyen hata'));
    return false;
  }

  S.stats = statsRes.data || {};
  S.rows = sitesRes.data || [];
  renderStats();
  renderTable();
  destekSayaci();
  if (S.view === 'destek') loadDestek();
  if (S.view === 'surum') loadSurum();
  if (isRefresh) toast('Veriler güncellendi.');
  return true;
}

/* ============ Özet metrikler ============ */
function renderStats() {
  const s = S.stats;
  const cards = [
    { val: NUM(s.total_sites), lbl: 'Toplam site', sub: `Son 30 günde +${NUM(s.new_sites_30d)}` },
    { val: NUM(s.active_subs), lbl: 'Aktif abone', sub: 'Ücretli aboneliği süren', cls: 'accent-bank' },
    { val: NUM(s.in_trial), lbl: 'Denemede', sub: 'Ücretsiz deneme süresi devam ediyor', cls: 'accent-trial' },
    { val: NUM(s.expired), lbl: 'Süresi dolmuş', sub: 'Deneme bitti, ödeme yok', cls: 'accent-exp' },
    { val: TL(s.mrr), lbl: 'Aylık gelir (MRR)', sub: 'Aktif aboneliklerin aylık karşılığı', cls: 'accent-rev' },
    { val: TL(s.revenue_this_month), lbl: 'Bu ay tahsil edilen', sub: `${NUM(s.payments_total)} ödemede toplam ${TL(s.revenue_total)}`, cls: 'accent-rev' },
  ];
  if (Number(s.pending_payments) > 0) {
    cards.push({ val: NUM(s.pending_payments), lbl: 'Bekleyen ödeme', sub: 'Onay bekliyor', cls: 'accent-trial' });
  }

  el('stats').innerHTML = cards.map(c => `
    <div class="stat ${c.cls || ''}">
      <div class="val">${esc(c.val)}</div>
      <div class="lbl">${esc(c.lbl)}</div>
      <div class="sub">${esc(c.sub)}</div>
    </div>
  `).join('');
}

/* ============ Müşteri tablosu ============ */
function visibleRows() {
  const q = el('search').value.trim().toLocaleLowerCase('tr');
  const status = el('filter-status').value;
  const sort = el('sort-by').value;

  let rows = S.rows.filter(r => {
    if (status && r.status !== status) return false;
    if (!q) return true;
    return [r.site_name, r.admin_name, r.admin_email, r.admin_phone, r.address]
      .some(v => String(v ?? '').toLocaleLowerCase('tr').includes(q));
  });

  const cmp = {
    created_at: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    days_left: (a, b) => (a.days_left ?? 0) - (b.days_left ?? 0),
    total_paid: (a, b) => Number(b.total_paid) - Number(a.total_paid),
    apartment_capacity: (a, b) => Number(b.apartment_capacity) - Number(a.apartment_capacity),
    site_name: (a, b) => String(a.site_name ?? '').localeCompare(String(b.site_name ?? ''), 'tr'),
  }[sort];

  return rows.sort(cmp);
}

function daysPill(r) {
  const d = r.days_left ?? 0;
  if (r.status === 'expired') return '<span class="days-pill danger">Süresi doldu</span>';
  const cls = d <= 7 ? 'danger' : d <= 30 ? 'warn' : '';
  const until = r.status === 'active' ? r.subscription_expiry : r.trial_ends_at;
  return `<span class="days-pill ${cls}">${NUM(d)} gün kaldı · ${esc(dmy(until))}</span>`;
}

function renderTable() {
  const rows = visibleRows();
  const body = el('sites-body');

  const countText = () => rows.length === S.rows.length
    ? `Toplam ${NUM(S.rows.length)} site.`
    : `${NUM(S.rows.length)} sitenin ${NUM(rows.length)} tanesi gösteriliyor.`;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9" class="t-empty">Kayıt bulunamadı.</td></tr>`;
    el('row-count').textContent = countText();
    return;
  }

  body.innerHTML = rows.map(r => {
    const st = STATUS[r.status] || { label: r.status, cls: 'b-gray' };
    const act = realDate(r.last_activity_at);
    return `
      <tr data-id="${esc(r.site_id)}">
        <td>
          <div class="c-title">${esc(r.site_name || '—')}</div>
          <div class="c-meta">${r.site_type === 'site' ? 'Site' : 'Apartman'} · ${esc(dmy(r.created_at))} tarihinde kuruldu</div>
        </td>
        <td>
          <div>${esc(r.admin_name || '—')}</div>
          <div class="c-meta">${esc(r.address || '')}</div>
        </td>
        <td>
          ${r.admin_email ? `<a class="c-mail" href="mailto:${esc(r.admin_email)}">${esc(r.admin_email)}</a>` : '<span class="c-empty">—</span>'}
          <div class="c-meta">${r.admin_phone ? `<a class="c-mail" href="tel:${esc(r.admin_phone)}">${esc(r.admin_phone)}</a>` : 'Telefon yok'}</div>
        </td>
        <td class="t-right">${NUM(r.building_count)}</td>
        <td class="t-right">
          ${NUM(r.apartment_capacity)}
          <div class="c-meta">${NUM(r.apartments_created)} tanımlı</div>
        </td>
        <td class="t-right">${NUM(r.residents_joined)}</td>
        <td class="c-nowrap">
          <span class="badge ${st.cls}">${esc(st.label)}</span>
          <div>${daysPill(r)}</div>
        </td>
        <td class="t-right">
          <strong>${esc(TL(r.total_paid))}</strong>
          <div class="c-meta">${NUM(r.payment_count)} ödeme${r.last_payment_at ? ' · ' + esc(dmy(r.last_payment_at)) : ''}</div>
        </td>
        <td class="c-nowrap">${act ? esc(dmy(act)) : '<span class="c-empty">Hareket yok</span>'}</td>
      </tr>
    `;
  }).join('');

  el('row-count').textContent = countText();
}

el('search').addEventListener('input', renderTable);
el('filter-status').addEventListener('change', renderTable);
el('sort-by').addEventListener('change', renderTable);

/* ============ Detay ============ */
el('modal-close').addEventListener('click', () => hide('modal-overlay'));
el('modal-overlay').addEventListener('click', (e) => { if (e.target === el('modal-overlay')) hide('modal-overlay'); });

el('sites-body').addEventListener('click', async (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  if (e.target.closest('a')) return; // mailto/tel bağlantıları modalı açmasın
  await openDetail(tr.dataset.id);
});

async function openDetail(siteId) {
  const r = S.rows.find(x => x.site_id === siteId);
  if (!r) return;

  el('modal-title').textContent = r.site_name || 'Site detayı';
  el('modal-body').innerHTML = '<p class="c-empty">Yükleniyor…</p>';
  show('modal-overlay');

  const { data, error } = await supabase.rpc('cms_site_detail', { p_site_id: siteId });
  if (error) {
    el('modal-body').innerHTML = `<p class="c-empty">Detay alınamadı: ${esc(error.message || '')}</p>`;
    return;
  }

  const st = STATUS[r.status] || { label: r.status, cls: 'b-gray' };
  const buildings = data?.buildings || [];
  const payments = data?.payments || [];
  const act = realDate(r.last_activity_at);

  el('modal-body').innerHTML = `
    <div class="detail-sec">
      <dl class="detail-kv">
        <dt>Yönetici</dt><dd>${esc(r.admin_name || '—')}</dd>
        <dt>E-posta</dt><dd>${r.admin_email ? `<a class="c-mail" href="mailto:${esc(r.admin_email)}">${esc(r.admin_email)}</a>` : '—'}</dd>
        <dt>Telefon</dt><dd>${r.admin_phone ? `<a class="c-mail" href="tel:${esc(r.admin_phone)}">${esc(r.admin_phone)}</a>` : '—'}</dd>
        <dt>Adres</dt><dd>${esc(r.address || '—')}</dd>
        <dt>Tür</dt><dd>${r.site_type === 'site' ? 'Site (çok bloklu)' : 'Apartman (tek bina)'}</dd>
        <dt>Kuruluş</dt><dd>${esc(dmy(r.created_at))}</dd>
        <dt>Durum</dt><dd><span class="badge ${st.cls}">${esc(st.label)}</span> ${daysPill(r)}</dd>
        <dt>Deneme bitişi</dt><dd>${esc(dmy(r.trial_ends_at))}</dd>
        <dt>Abonelik bitişi</dt><dd>${esc(dmy(r.subscription_expiry))}</dd>
        <dt>Toplam ödeme</dt><dd>${esc(TL2(r.total_paid))} (${NUM(r.payment_count)} işlem)</dd>
        <dt>Son hareket</dt><dd>${act ? esc(dmyhm(act)) : 'Hareket yok'}</dd>
      </dl>
    </div>

    <div class="detail-sec">
      <h4>Binalar (${NUM(buildings.length)})</h4>
      ${buildings.length ? `
        <table class="detail-table">
          <thead><tr><th>Bina</th><th>Davet kodu</th><th class="t-right">Daire</th><th class="t-right">Tanımlı</th><th class="t-right">Katılan</th></tr></thead>
          <tbody>
            ${buildings.map(b => `
              <tr>
                <td>${esc(b.name)}<div class="c-meta">${NUM(b.floor_count)} kat</div></td>
                <td><code>${esc(b.building_code || '—')}</code></td>
                <td class="t-right">${NUM(b.apartment_count)}</td>
                <td class="t-right">${NUM(b.apartments_created)}</td>
                <td class="t-right">${NUM(b.residents_joined)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="c-empty">Bina kaydı yok.</p>'}
    </div>

    <div class="detail-sec">
      <h4>Ödeme geçmişi (${NUM(payments.length)})</h4>
      ${payments.length ? `
        <table class="detail-table">
          <thead><tr><th>Tarih</th><th class="t-right">Tutar</th><th class="t-right">Süre</th><th>Durum</th><th>Yöntem</th></tr></thead>
          <tbody>
            ${payments.map(p => {
              const ps = PAY_STATUS[p.status] || { label: p.status, cls: 'b-gray' };
              return `
              <tr>
                <td>${esc(dmy(p.created_at))}</td>
                <td class="t-right">${esc(TL2(p.amount))}</td>
                <td class="t-right">${NUM(p.months)} ay</td>
                <td><span class="badge ${ps.cls}">${esc(ps.label)}</span></td>
                <td>${esc(PAY_METHOD[p.payment_method] || p.payment_method || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : '<p class="c-empty">Henüz ödeme yok.</p>'}
    </div>

    <div class="detail-sec danger-zone">
      <h4>Tehlikeli bölge</h4>
      <p class="danger-text">
        Bu siteyi silmek <strong>${NUM(buildings.length)} bina</strong>, <strong>${NUM(r.apartments_created)} daire</strong>,
        tüm aidat/kasa/duyuru/belge kayıtlarını, ödeme geçmişini ve siteye bağlı
        <strong>tüm kullanıcı hesaplarını</strong> (yönetici dahil) kalıcı olarak yok eder. Geri alınamaz.
      </p>
      <button type="button" class="btn btn-sm btn-red" id="del-open">Siteyi sil…</button>
      <div id="del-confirm" class="del-confirm hidden">
        <p class="danger-text">Emin misiniz? Onaylamak için site adını yazın: <code>${esc(r.site_name || '')}</code></p>
        <input type="text" id="del-name" class="search" placeholder="Site adını buraya yazın" autocomplete="off" />
        <div class="del-actions">
          <button type="button" class="btn btn-sm btn-ghost" id="del-cancel">Vazgeç</button>
          <button type="button" class="btn btn-sm btn-red" id="del-go" disabled>Evet, kalıcı olarak sil</button>
        </div>
        <div id="del-error" class="error hidden" style="margin-top:12px;"></div>
      </div>
    </div>
  `;

  bindDelete(r);
}

/* ============ Site silme ============ */
// Sunucu tarafı: cms_delete_site RPC (migration 0031). Yalnızca platform
// yöneticisi çalıştırabilir ve site adını birebir ister; istemci de aynı adı
// yazdırmadan düğmeyi açmaz. İki kademeli onay: "Siteyi sil…" → ad yaz → "Evet".
function bindDelete(r) {
  const expected = String(r.site_name || '').trim().toLocaleLowerCase('tr');
  const name = el('del-name'), go = el('del-go');

  el('del-open').addEventListener('click', () => {
    show('del-confirm'); hide('del-open'); hide('del-error');
    name.value = ''; go.disabled = true; name.focus();
  });
  el('del-cancel').addEventListener('click', () => { hide('del-confirm'); show('del-open'); hide('del-error'); });
  name.addEventListener('input', () => { go.disabled = name.value.trim().toLocaleLowerCase('tr') !== expected; });

  go.addEventListener('click', async () => {
    if (!window.confirm(`"${r.site_name}" sitesi, tüm verisi ve kullanıcılarıyla birlikte KALICI olarak silinecek.\n\nBu işlem geri alınamaz. Devam edilsin mi?`)) return;

    hide('del-error');
    go.disabled = true; go.textContent = 'Siliniyor…';
    const { data, error } = await supabase.rpc('cms_delete_site', { p_site_id: r.site_id, p_confirm_name: name.value.trim() });
    if (error) {
      go.disabled = false; go.textContent = 'Evet, kalıcı olarak sil';
      const m = (error.message || '').toLowerCase();
      el('del-error').textContent = (m.includes('could not find') || error.code === 'PGRST202')
        ? 'Sunucu tarafı kurulumu eksik: 0031_cms_site_delete.sql migration\'ı henüz uygulanmamış.'
        : 'Silinemedi: ' + (error.message || 'bilinmeyen hata');
      show('del-error');
      return;
    }

    hide('modal-overlay');
    const d = data || {};
    toast(`"${d.site_name || r.site_name}" silindi · ${NUM(d.buildings)} bina, ${NUM(d.apartments)} daire, ${NUM(d.users_deleted)} kullanıcı.`);
    await loadData(true);
  });
}

/* ============ CSV dışa aktarım ============ */
el('export-btn').addEventListener('click', () => {
  const rows = visibleRows();
  if (!rows.length) return toast('Dışa aktarılacak kayıt yok.', true);

  const head = ['Site','Tür','Adres','Yönetici','E-posta','Telefon','Bina','Daire kapasitesi','Tanımlı daire','Katılan sakin','Durum','Kalan gün','Deneme bitişi','Abonelik bitişi','Toplam ödeme','Ödeme sayısı','Son ödeme','Kuruluş'];
  // Excel'in formül olarak yorumlamasını engelle (CSV injection)
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [head.map(cell).join(';')];
  rows.forEach(r => lines.push([
    r.site_name, r.site_type === 'site' ? 'Site' : 'Apartman', r.address,
    r.admin_name, r.admin_email, r.admin_phone,
    r.building_count, r.apartment_capacity, r.apartments_created, r.residents_joined,
    (STATUS[r.status] || {}).label || r.status, r.days_left,
    dmy(r.trial_ends_at), dmy(r.subscription_expiry),
    Number(r.total_paid || 0).toFixed(2).replace('.', ','), r.payment_count,
    dmy(r.last_payment_at), dmy(r.created_at),
  ].map(cell).join(';')));

  // BOM: Excel'in Türkçe karakterleri doğru okuması için
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yonetivia-musteriler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length} kayıt indirildi.`);
});

/* ============ Bölümler ============ */
el('cms-nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  S.view = b.dataset.view;
  el('cms-nav').querySelectorAll('.seg').forEach(x => x.classList.toggle('active', x === b));
  ['sites', 'destek', 'surum'].forEach(v => (v === S.view ? show('view-' + v) : hide('view-' + v)));
  if (S.view === 'destek') loadDestek();
  if (S.view === 'surum') loadSurum();
});

/* ============ Destek talepleri (0042) ============ */
const DESTEK_DURUM = {
  acik:       { label: 'Yanıt bekliyor', cls: 'b-amber' },
  yanitlandi: { label: 'Yanıtlandı',     cls: 'b-green' },
  kapandi:    { label: 'Kapandı',        cls: 'b-gray'  },
};
const DESTEK_KATEGORI = { genel: 'Soru', hata: 'Hata', odeme: 'Abonelik/ödeme', hesap: 'Hesap/giriş', oneri: 'Öneri' };
const ROL = { admin: 'Yönetici', resident: 'Sakin' };
const kurulumEksik = (err) => /cms_destek|cms_surum|app_versions|could not find|does not exist/i.test(err?.message || '') || err?.code === 'PGRST202';

// Sekmedeki "yanıt bekleyen" sayısı
async function destekSayaci() {
  const { data, error } = await supabase.rpc('cms_destek_talepleri', { p_durum: 'acik' });
  const n = error ? 0 : (data || []).length;
  el('destek-sayac').textContent = n;
  el('destek-sayac').classList.toggle('hidden', !n);
}

async function loadDestek() {
  const body = el('destek-body');
  body.innerHTML = '<tr><td colspan="6" class="c-empty">Yükleniyor…</td></tr>';
  const filtre = el('destek-filtre').value || null;
  const { data, error } = await supabase.rpc('cms_destek_talepleri', { p_durum: filtre });
  if (error) {
    body.innerHTML = `<tr><td colspan="6" class="c-empty">${kurulumEksik(error)
      ? 'Destek sistemi kurulu değil: 0042_destek_talepleri.sql migration\'ını Supabase SQL Editor\'den çalıştırın.'
      : 'Talepler alınamadı: ' + esc(error.message || '')}</td></tr>`;
    return;
  }
  S.destek = data || [];
  if (!S.destek.length) {
    body.innerHTML = '<tr><td colspan="6" class="c-empty">Bu filtrede talep yok.</td></tr>';
    return;
  }
  body.innerHTML = S.destek.map(t => {
    const d = DESTEK_DURUM[t.durum] || { label: t.durum, cls: 'b-gray' };
    return `<tr data-ticket="${t.id}">
      <td><div class="c-title">${esc(t.konu)}</div>
        <div class="c-meta">${esc(DESTEK_KATEGORI[t.kategori] || t.kategori)} · ${NUM(t.mesaj_sayisi)} mesaj</div>
        <div class="c-onizleme">${t.son_yazan_destek ? 'Siz: ' : ''}${esc(t.son_mesaj || '')}</div></td>
      <td><div class="c-title">${esc(t.ad || '—')}</div><div class="c-meta">${esc(ROL[t.rol] || t.rol || '')}</div></td>
      <td>${t.telefon ? `<a class="c-mail" href="tel:${esc(t.telefon)}">${esc(t.telefon)}</a>` : '<span class="c-empty">—</span>'}
        ${t.eposta ? `<div class="c-meta"><a class="c-mail" href="mailto:${esc(t.eposta)}">${esc(t.eposta)}</a></div>` : ''}</td>
      <td>${esc(t.site_adi || '—')}<div class="c-meta">${esc([t.platform, t.uygulama_surumu].filter(Boolean).join(' · '))}</div></td>
      <td><span class="badge ${d.cls}">${d.label}</span></td>
      <td class="c-nowrap">${dmyhm(t.son_mesaj_at)}</td>
    </tr>`;
  }).join('');
}

el('destek-filtre').addEventListener('change', loadDestek);
el('destek-body').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('tr[data-ticket]'); if (!tr) return;
  openTalep(tr.dataset.ticket);
});

async function openTalep(id) {
  const t = S.destek.find(x => x.id === id); if (!t) return;
  el('modal-title').textContent = t.konu;
  el('modal-body').innerHTML = '<p class="c-empty">Yükleniyor…</p>';
  show('modal-overlay');

  const { data, error } = await supabase.rpc('cms_destek_mesajlari', { p_ticket: id });
  if (error) { el('modal-body').innerHTML = `<p class="c-empty">Mesajlar alınamadı: ${esc(error.message || '')}</p>`; return; }
  const d = DESTEK_DURUM[t.durum] || { label: t.durum, cls: 'b-gray' };

  el('modal-body').innerHTML = `
    <div class="detail-sec">
      <dl class="detail-kv">
        <dt>Kişi</dt><dd>${esc(t.ad || '—')} · ${esc(ROL[t.rol] || t.rol || '')}</dd>
        <dt>Telefon</dt><dd>${t.telefon ? `<a class="c-mail" href="tel:${esc(t.telefon)}">${esc(t.telefon)}</a>` : '—'}</dd>
        <dt>E-posta</dt><dd>${t.eposta ? `<a class="c-mail" href="mailto:${esc(t.eposta)}">${esc(t.eposta)}</a>` : '—'}</dd>
        <dt>Site</dt><dd>${esc(t.site_adi || '—')}</dd>
        <dt>Cihaz</dt><dd>${esc([t.platform, t.uygulama_surumu].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>Durum</dt><dd><span class="badge ${d.cls}">${d.label}</span> <span class="c-meta">açılış ${dmyhm(t.created_at)}</span></dd>
      </dl>
    </div>
    <div class="detail-sec">
      <h4>Yazışma</h4>
      <div class="destek-akis">
        ${(data || []).map(m => `<div class="destek-balon ${m.destek_ekibi ? 'ekip' : 'kullanici'}">
          <span class="kim">${m.destek_ekibi ? 'Yönetivia Destek' : esc(t.ad || 'Kullanıcı')}</span>${esc(m.mesaj)}
          <span class="zaman">${dmyhm(m.created_at)}</span></div>`).join('')}
      </div>
      <div class="field destek-yanit"><label for="destek-yanit">Yanıtınız</label>
        <textarea id="destek-yanit" rows="4" placeholder="Kullanıcıya yanıt yazın; telefonuna bildirim gider."></textarea></div>
      <div class="destek-eylem">
        ${t.durum !== 'kapandi'
          ? '<button class="btn btn-sm btn-ghost" id="destek-kapat">Yanıtsız kapat</button>'
          : '<button class="btn btn-sm btn-ghost" id="destek-ac">Yeniden aç</button>'}
        <button class="btn btn-sm btn-ghost" id="destek-gonder-kapat">Gönder ve kapat</button>
        <button class="btn btn-sm" id="destek-gonder">Gönder</button>
      </div>
    </div>`;

  const yanitla = async (kapat) => {
    const mesaj = el('destek-yanit').value.trim();
    if (!mesaj) return toast('Yanıt boş olamaz.', true);
    const { error: e2 } = await supabase.rpc('cms_destek_yanitla', { p_ticket: id, p_mesaj: mesaj, p_kapat: kapat });
    if (e2) return toast('Gönderilemedi: ' + (e2.message || ''), true);
    toast(kapat ? 'Yanıt gönderildi, talep kapandı.' : 'Yanıt gönderildi; kullanıcıya bildirim gitti.');
    hide('modal-overlay');
    await loadDestek(); destekSayaci();
  };
  const durumYap = async (durum) => {
    const { error: e3 } = await supabase.rpc('cms_destek_durum', { p_ticket: id, p_durum: durum });
    if (e3) return toast(e3.message || 'Durum değişmedi', true);
    hide('modal-overlay');
    await loadDestek(); destekSayaci();
  };
  el('destek-gonder').onclick = () => yanitla(false);
  el('destek-gonder-kapat').onclick = () => yanitla(true);
  if (el('destek-kapat')) el('destek-kapat').onclick = () => durumYap('kapandi');
  if (el('destek-ac')) el('destek-ac').onclick = () => durumYap('acik');
}

/* ============ Uygulama sürümü (0043) ============ */
async function loadSurum() {
  const body = el('surum-body');
  body.innerHTML = '<p class="c-empty">Yükleniyor…</p>';
  const { data, error } = await supabase.from('app_versions').select('*').order('platform');
  if (error || !data?.length) {
    body.innerHTML = `<p class="c-empty">${error && !kurulumEksik(error)
      ? 'Alınamadı: ' + esc(error.message || '')
      : 'Sürüm tablosu kurulu değil: 0043_uygulama_surumu.sql migration\'ını çalıştırın.'}</p>`;
    return;
  }
  const AD = { android: 'Android (Google Play)', ios: 'iOS (App Store)' };
  body.innerHTML = `<div class="surum-grid">${data.map(v => `
    <div class="surum-kart" data-platform="${v.platform}">
      <h4>${AD[v.platform] || v.platform}</h4>
      <div class="field"><label>En düşük sürüm (altı kilitlenir)</label><input data-k="min" value="${esc(v.min_surum)}" placeholder="1.3.2" /></div>
      <div class="field"><label>Önerilen sürüm (altına uyarı)</label><input data-k="son" value="${esc(v.son_surum)}" placeholder="1.3.2" /></div>
      <div class="field"><label>Kullanıcıya mesaj (isteğe bağlı)</label><textarea data-k="mesaj" rows="2">${esc(v.mesaj || '')}</textarea></div>
      <p class="c-meta">Son değişiklik ${dmyhm(v.updated_at)}</p>
      <div class="destek-eylem" style="margin-top:10px"><button class="btn btn-sm" data-kaydet="${v.platform}">Kaydet</button></div>
    </div>`).join('')}</div>`;
}

el('surum-body').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-kaydet]'); if (!b) return;
  const kart = b.closest('.surum-kart');
  const deger = (k) => kart.querySelector(`[data-k="${k}"]`).value.trim();
  const platform = b.dataset.kaydet;
  if (!confirm(`${platform === 'ios' ? 'iOS' : 'Android'}: en düşük sürüm ${deger('min')}, önerilen ${deger('son')} olsun mu?\n\nEn düşük sürümün altındaki kullanıcılar uygulamayı güncelleyene kadar kullanamaz.`)) return;
  b.disabled = true;
  const { error } = await supabase.rpc('cms_surum_guncelle', {
    p_platform: platform, p_min: deger('min'), p_son: deger('son'), p_mesaj: deger('mesaj'),
  });
  b.disabled = false;
  if (error) return toast(error.message || 'Kaydedilemedi', true);
  toast('Sürüm ayarı kaydedildi.');
  loadSurum();
});

/* ============ Başlat ============ */
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await boot(session.user);
    else showLogin();
  } catch (err) {
    showLogin('Bağlantı hatası: ' + (err?.message || ''));
  }
})();
