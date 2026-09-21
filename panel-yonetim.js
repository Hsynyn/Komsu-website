/* ============================================================
   Yönetim Modülü — panel.js'in bölüm eklentisi
   ============================================================
   panel.js 3.900 satıra ulaştığı için yeni bölümler buraya yazıldı.
   Bağımlılıklar panel.js'ten initYonetim(ctx) ile geçirilir; böylece
   mevcut kodu refactor etmeden ayrı dosyada çalışabiliyoruz.

   Veri modeli: supabase/migrations/0020_yonetim_modulu.sql
   Yasal dayanaklar 634 sayılı Kat Mülkiyeti Kanunu'na aittir; her binada
   yönetim planı kanunun tamamlayıcı hükümlerini ezebilir, bu yüzden
   süreler/oranlar ekranlarda "varsayılan" olarak sunulur.
============================================================ */

import { belgeUret, belgeButonu, belgeBaglantisi, htmlDuzMetin, para } from './panel-belge.js';

let C = null;   // panel.js'ten gelen bağlam

export function initYonetim(ctx) { C = ctx; }

/* Resmî belgelerin ortak imza bloğu. */
const YONETICI_IMZA = ['Yönetici', 'Denetçi'];

/* ---------- ortak küçük yardımcılar ---------- */
const DAY = 86400000;
const daysUntil = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / DAY);
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

/** Site kaydı yoksa bölümleri açma — hepsi site_id'ye bağlı. */
function needSite() {
  if (C.sId()) return true;
  C.$content().innerHTML = `<div class="card" style="text-align:center;padding:40px;">
    <h3>Site kaydınız bulunamadı</h3>
    <p class="muted" style="margin-top:10px;">Yönetim modülü site bazlı çalışır. Site kaydınız oluşturulduktan sonra bu bölümler kullanılabilir.</p>
  </div>`;
  return false;
}

/** Tablo yoksa (migration uygulanmamış) anlaşılır mesaj göster. */
function migrationUyarisi(err) {
  const m = String(err?.message || err || '');
  if (/relation .* does not exist|schema cache|Could not find the table/i.test(m)) {
    C.$content().innerHTML = `<div class="card" style="padding:32px;">
      <h3>Yönetim modülü henüz kurulmamış</h3>
      <p class="muted" style="margin:12px 0;">Bu bölümün tabloları veritabanında yok. Supabase Studio → SQL Editor'den
      <strong>0020_yonetim_modulu.sql</strong> dosyasını çalıştırın, sonra sayfayı yenileyin.</p>
      <pre class="muted" style="font-size:12px;white-space:pre-wrap;">${C.esc(m)}</pre>
    </div>`;
    return true;
  }
  return false;
}

/* ============================================================
   1) YÖNETİM TAKVİMİ
   ============================================================
   Veri modeli (0029_takvim_serisi.sql): her yükümlülük bir SERİ
   (series_id), her tekrar ayrı satır. Bekleyen satır "sıradaki",
   tamamlanmış satırlar geçmiştir (done_date, performed_by, cost,
   transaction_id). Yıllık döküm bu satırlardan hesaplanır; ayrı bir
   geçmiş tablosu yoktur.

   Ekran iki görünüm sunar:
     • Yıllık plan — her seri bir satır, 12 ay birer hücre: yapıldı /
       planlı / gecikti. "Bu yıl ne yapıldı, ne kaldı" tek bakışta.
     • Liste — tek tek kayıtlar, filtreli.
   Seriye tıklayınca zaman çizgisi: kim yaptı, kaça, kasadan ödendi mi.
   ============================================================ */
const TASK_CATEGORIES = {
  yasal: { label: 'Yasal', icon: '⚖️' },
  bakim: { label: 'Bakım', icon: '🔧' },
  sozlesme: { label: 'Sözleşme', icon: '📄' },
  finans: { label: 'Finans', icon: '₺' },
  diger: { label: 'Diğer', icon: '•' },
};

/* 0029 seed_management_tasks ile birebir aynı liste. Yeni şablon eklerken
   iki yeri birden güncelleyin; SQL tarafı tanımadığı başlığı sessizce atlar. */
const SABLONLAR = [
  { title: 'Olağan genel kurul toplantısı', category: 'yasal', legal: 'KMK m.29', months: 12, ipucu: 'Her yıl. Yönetim planınızda ay yazıyorsa ona göre tarih verin.' },
  { title: 'Hesap denetimi',                category: 'yasal', legal: 'KMK m.41', months: 3,  ipucu: 'Denetçi üç ayda bir hesapları inceler.' },
  { title: 'Yıl sonu hesap verme',          category: 'yasal', legal: 'KMK m.39', months: 12, ipucu: 'Yöneticinin yıllık hesap raporu.' },
  { title: 'Bina sigortası yenileme',       category: 'yasal', legal: 'KMK m.35', months: 12, ipucu: 'Poliçe bitiş tarihinden bir ay önce hatırlatır.' },
  { title: 'Asansör periyodik kontrolü',    category: 'bakim', legal: 'Asansör İşletme ve Bakım Yönetmeliği', months: 12, ipucu: 'Yıllık A tipi muayene; kırmızı etiket riskine karşı.' },
  { title: 'Yangın tüpü kontrol ve dolum',  category: 'bakim', legal: 'Binaların Yangından Korunması Yönetmeliği', months: 12 },
  { title: 'Su deposu temizliği',           category: 'bakim', legal: null, months: 6 },
  { title: 'Kazan/kalorifer sezon bakımı',  category: 'bakim', legal: null, months: 12, ipucu: 'Sezon öncesi, genellikle Eylül–Ekim.' },
  { title: 'Hidrofor bakımı',               category: 'bakim', legal: null, months: 12 },
  { title: 'Baca temizliği',                category: 'bakim', legal: null, months: 12 },
  { title: 'Genel ilaçlama',                category: 'bakim', legal: null, months: 6 },
  { title: 'Jeneratör bakımı',              category: 'bakim', legal: null, months: 12 },
];

const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const KASA_ADI = { bank: 'Banka', cash: 'Nakit kasa', fund: 'Yedek akçe' };

let takvimGorunum = 'plan';                   // 'plan' | 'liste'
let takvimYil = new Date().getFullYear();
let taskFilter = 'pending';
let sonSeriler = [];                           // son render'daki seriler (detay modalı için)

const yilAy = (d) => { const x = new Date(d); return { y: x.getFullYear(), m: x.getMonth() }; };
const kimYapti = (t) => t.self_done ? 'Kendimiz' : (t.performed_by || t.assigned_to || '');
const takvimRpcYok = (err) => /complete_management_task|log_task_history|p_secim|schema cache|does not exist/i.test(String(err?.message || err || ''));
const rpcHata = (err, islem) => new Error(takvimRpcYok(err)
  ? `${islem} için 0029_takvim_serisi.sql migrasyonu gerekli. Supabase Studio → SQL Editor'den çalıştırın.`
  : (err?.message || String(err)));

/** Sonraki vadeyi SQL ile aynı kuralla hesaplar (önizleme için). */
function sonrakiVade(t, yapildi) {
  if (!t.recurrence_months) return null;
  const taban = (t.asset_id || t.due_estimated) ? yapildi : t.due_date;
  let d = addMonths(taban, t.recurrence_months);
  const bugun = C.todayISO();
  let guard = 0;
  while (d < bugun && guard++ < 120) d = addMonths(d, t.recurrence_months);
  return d;
}

/** Satırları seriye toplar; her seri için sıradaki, geçmiş ve maliyet özeti. */
function serileriKur(all) {
  const map = new Map();
  for (const t of all) {
    const k = t.series_id || t.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }
  const seriler = [];
  for (const [id, satirlar] of map) {
    const bekleyen = satirlar.filter(t => t.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date));
    const yapilan = satirlar.filter(t => t.status === 'done')
      .sort((a, b) => String(b.done_date || b.completed_at || '').localeCompare(String(a.done_date || a.completed_at || '')));
    const temsil = bekleyen[0] || yapilan[0] || satirlar[0];
    const maliyetli = yapilan.filter(t => t.cost != null && t.cost !== '');
    const toplam = maliyetli.reduce((a, t) => a + Number(t.cost || 0), 0);
    const sonFirma = yapilan.find(t => t.performed_by)?.performed_by;
    seriler.push({
      id, temsil, bekleyen, yapilan, satirlar,
      siradaki: bekleyen[0] || null, son: yapilan[0] || null,
      toplam, ortalama: maliyetli.length ? toplam / maliyetli.length : null,
      beklenen: temsil.expected_cost ?? (maliyetli[0]?.cost ?? null),
      kim: bekleyen[0]?.assigned_to || sonFirma || (yapilan[0]?.self_done ? 'Kendimiz' : ''),
    });
  }
  seriler.sort((a, b) => {
    const da = a.siradaki ? daysUntil(a.siradaki.due_date) : 1e9;
    const db = b.siradaki ? daysUntil(b.siradaki.due_date) : 1e9;
    return da - db;
  });
  return seriler;
}

const vadeRozeti = (t) => {
  const d = daysUntil(t.due_date);
  const r = d < 0 ? `<span class="badge b-red">${Math.abs(d)} gün gecikti</span>`
    : d <= 30 ? `<span class="badge b-amber">${d} gün kaldı</span>`
    : `<span class="badge b-gray">${d} gün</span>`;
  return r + (t.due_estimated ? ' <span class="badge b-amber" title="Şablon yüklenirken son yapılma tarihi girilmedi; vade tahminî">📅 tahminî</span>' : '');
};

const seriBasligi = (s) => {
  const t = s.temsil;
  const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.diger;
  return `<strong>${cat.icon} ${C.esc(t.title)}</strong>
    ${C.kapsamRozeti(t.scope, t.building_id)}
    ${t.source === 'asset' ? '<span class="badge b-gray" title="Demirbaş kaydından otomatik oluştu">📦 Demirbaş</span>' : ''}
    ${s.siradaki?.job_id ? '<span class="badge b-blue" title="Bu dönem için iş kaydı açıldı">🛠 İşte</span>' : ''}
    <div class="muted" style="font-size:12px">${[t.legal_basis, t.recurrence_months ? `${t.recurrence_months} ayda bir` : 'Tek seferlik'].filter(Boolean).map(C.esc).join(' · ')}</div>`;
};

export async function renderTasks() {
  if (!needSite()) return;
  const { data, error } = await C.supabase
    .from('management_tasks')
    .select('*')
    .eq('site_id', C.sId())
    .order('due_date', { ascending: true });

  if (error) {
    if (migrationUyarisi(error)) return;
    C.$content().innerHTML = `<div class="error">${C.esc(error.message)}</div>`;
    return;
  }

  const all = data || [];
  const seriler = serileriKur(all);
  sonSeriler = seriler;
  const pending = all.filter(t => t.status === 'pending');
  const overdue = pending.filter(t => daysUntil(t.due_date) < 0);
  const soon = pending.filter(t => { const d = daysUntil(t.due_date); return d >= 0 && d <= 30; });
  const buYilYapilan = all.filter(t => t.status === 'done' && t.done_date && yilAy(t.done_date).y === takvimYil);
  const buYilHarcanan = buYilYapilan.reduce((a, t) => a + Number(t.cost || 0), 0);
  const tahmini = seriler.filter(s => s.siradaki?.due_estimated);
  const bugun = new Date();

  /* ---------- Yıllık plan satırı ---------- */
  const planSatir = (s) => {
    const hucreler = AYLAR_KISA.map((_, m) => {
      const yapilanlar = s.yapilan.filter(x => x.done_date && yilAy(x.done_date).y === takvimYil && yilAy(x.done_date).m === m);
      const planli = s.bekleyen.filter(x => yilAy(x.due_date).y === takvimYil && yilAy(x.due_date).m === m);
      let cls = 'ay-bos', ic = '', tip = '';
      if (yapilanlar.length) {
        cls = 'ay-yapildi'; ic = '✓';
        tip = yapilanlar.map(x => `${C.dmy(x.done_date)} · ${kimYapti(x) || 'kim yaptığı girilmedi'}${x.cost != null ? ' · ' + C.TL(x.cost) : ''}`).join('\n');
      } else if (planli.length) {
        const d = daysUntil(planli[0].due_date);
        cls = d < 0 ? 'ay-gecikti' : 'ay-planli'; ic = d < 0 ? '!' : '●';
        tip = `Planlı: ${C.dmy(planli[0].due_date)}${d < 0 ? ` — ${-d} gün gecikti` : ''}`;
      }
      const simdi = takvimYil === bugun.getFullYear() && m === bugun.getMonth() ? ' ay-simdi' : '';
      return `<td class="ay-hucre${simdi}" data-seri="${s.id}"><span class="ay-nokta ${cls}" title="${C.esc(tip)}">${ic}</span></td>`;
    }).join('');

    const sira = s.siradaki
      ? `<div>${C.dmy(s.siradaki.due_date)}</div><div style="margin-top:4px">${vadeRozeti(s.siradaki)}</div>`
      : '<span class="muted">—</span>';
    const kimSatir = s.kim ? C.esc(s.kim) : '<span class="muted">Belirtilmedi</span>';
    const maliyet = s.beklenen != null ? C.TL(s.beklenen) : '<span class="muted">—</span>';
    const gecmis = s.yapilan.length
      ? `${s.yapilan.length} kez · toplam ${C.TL(s.toplam)}`
      : 'Henüz kayıt yok';

    return `<tr class="seri-satir" data-seri="${s.id}">
      <td class="seri-ad">${seriBasligi(s)}</td>
      <td class="seri-kim"><div>${kimSatir}</div><div class="muted" style="font-size:12px">${maliyet} · ${C.esc(gecmis)}</div></td>
      ${hucreler}
      <td class="seri-sira">${sira}</td>
      <td class="t-right" style="white-space:nowrap">
        ${s.siradaki ? `<button class="btn btn-sm btn-green" data-act="done" data-id="${s.siradaki.id}">Yapıldı</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-act="detay" data-seri="${s.id}" title="Geçmiş ve maliyet">›</button>
      </td>
    </tr>`;
  };

  /* ---------- Liste satırı ---------- */
  const listeSatir = (t) => {
    const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.diger;
    const seri = seriler.find(s => s.id === (t.series_id || t.id));
    const durum = t.status === 'done'
      ? '<span class="badge b-green">Yapıldı</span>'
      : t.status === 'skipped' ? '<span class="badge b-gray">Atlandı</span>'
      : vadeRozeti(t);
    const tarih = t.status === 'done' ? C.dmy(t.done_date || t.completed_at) : C.dmy(t.due_date);
    const kim = t.status === 'done' ? (kimYapti(t) || '<span class="muted">—</span>') : (t.assigned_to ? C.esc(t.assigned_to) : '<span class="muted">—</span>');
    const maliyet = t.status === 'done'
      ? (t.cost != null ? `${C.TL(t.cost)}${t.transaction_id ? ' <span class="badge b-gray" title="Kasaya gider olarak işlendi">kasa</span>' : ''}` : '<span class="muted">—</span>')
      : (t.expected_cost != null ? `<span class="muted">~${C.TL(t.expected_cost)}</span>` : '<span class="muted">—</span>');
    return `<tr>
      <td><strong>${cat.icon} ${C.esc(t.title)}</strong>
        ${C.kapsamRozeti(t.scope, t.building_id)}
        ${t.source === 'asset' ? '<span class="badge b-gray">📦 Demirbaş</span>' : ''}
        ${t.job_id ? '<span class="badge b-blue">🛠 İşe dönüştürüldü</span>' : ''}
        ${t.legal_basis ? `<div class="muted" style="font-size:12px">${C.esc(t.legal_basis)}</div>` : ''}
        ${t.evidence_url ? `<div style="font-size:12px"><a href="${C.esc(t.evidence_url)}" target="_blank" rel="noopener">📎 Belge</a></div>` : ''}
        ${t.notes ? `<div class="muted" style="font-size:12px">${C.esc(t.notes)}</div>` : ''}</td>
      <td>${tarih}</td>
      <td>${kim}</td>
      <td>${maliyet}</td>
      <td>${durum}</td>
      <td class="t-right" style="white-space:nowrap">
        ${t.status === 'pending' ? `<button class="btn btn-sm btn-green" data-act="done" data-id="${t.id}">Yapıldı</button>` : ''}
        ${t.status === 'pending' && !t.job_id ? `<button class="btn btn-sm" data-act="job" data-id="${t.id}">🛠 İşe Dönüştür</button>` : ''}
        ${seri ? `<button class="btn btn-sm btn-ghost" data-act="detay" data-seri="${seri.id}">Detay</button>` : ''}
        ${t.status === 'pending' ? `<button class="btn btn-sm btn-ghost" data-act="edit" data-id="${t.id}">Düzenle</button>` : ''}
        <button class="btn btn-sm btn-outline-red" data-act="del" data-id="${t.id}">Sil</button>
      </td>
    </tr>`;
  };

  const shown = taskFilter === 'all' ? all : all.filter(t => t.status === taskFilter);
  const bosTakvim = all.length === 0;

  const planHTML = `
    <div class="card">
      <div class="plan-ust">
        <div class="yil-secici">
          <button type="button" class="btn btn-sm btn-ghost" id="yil-geri">‹</button>
          <strong>${takvimYil}</strong>
          <button type="button" class="btn btn-sm btn-ghost" id="yil-ileri">›</button>
        </div>
        <div class="plan-legend">
          <span><i class="ay-nokta ay-yapildi">✓</i> yapıldı</span>
          <span><i class="ay-nokta ay-planli">●</i> planlı</span>
          <span><i class="ay-nokta ay-gecikti">!</i> gecikti</span>
          <span class="muted">Hücreye gelince tarih, kim, tutar görünür; satıra tıklayınca geçmiş açılır.</span>
        </div>
      </div>
      <div class="plan-scroll">
      <table class="plan-table"><thead><tr>
        <th>Görev</th><th>Kim yapıyor · maliyet</th>
        ${AYLAR_KISA.map((a, m) => `<th class="ay${takvimYil === bugun.getFullYear() && m === bugun.getMonth() ? ' ay-simdi' : ''}">${a}</th>`).join('')}
        <th>Sıradaki</th><th></th></tr></thead>
      <tbody id="task-body">${seriler.length ? seriler.map(planSatir).join('')
        : '<tr><td colspan="16" class="t-empty">Takvim boş.</td></tr>'}</tbody></table>
      </div>
    </div>`;

  const listeHTML = `
    <div class="card">
      <div class="cat-grid" id="task-filter" style="margin-bottom:14px;">
        ${[['pending', 'Bekleyen'], ['done', 'Yapılan'], ['skipped', 'Atlanan'], ['all', 'Tümü']]
          .map(([v, l]) => `<button type="button" class="cat-chip ${taskFilter === v ? 'active' : ''}" data-f="${v}">${l}</button>`).join('')}
      </div>
      <table><thead><tr><th>Görev</th><th>Tarih</th><th>Kim</th><th>Maliyet</th><th>Durum</th><th></th></tr></thead>
      <tbody id="task-body">${shown.length ? shown.map(listeSatir).join('')
        : '<tr><td colspan="6" class="t-empty">Bu filtrede kayıt yok.</td></tr>'}</tbody></table>
    </div>`;

  const bosHTML = `
    <div class="card" style="text-align:center;padding:40px 24px">
      <div style="font-size:40px">📅</div>
      <h3 style="margin:10px 0 6px">Takviminiz henüz boş</h3>
      <p class="muted" style="max-width:560px;margin:0 auto 18px;font-size:14px">
        Genel kurul, hesap denetimi, sigorta, asansör muayenesi, su deposu, ilaçlama… Hazır şablonları yüklerken
        her biri için <strong>"en son ne zaman yapıldı"</strong> sorulur; sıradaki tarih ona göre hesaplanır.
        Böylece takvim binanızın gerçek düzenine oturur, kimse tahmin etmek zorunda kalmaz.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn" id="task-seed-bos">Hazır Şablonları Yükle</button>
        <button class="btn btn-ghost" id="task-add-bos">+ Kendi Görevimi Ekle</button>
      </div>
    </div>`;

  C.$content().innerHTML = `
    <div class="page-head"><h2>Yönetim Takvimi</h2>
      <div class="tools">
        <div class="seg-tabs" id="takvim-gorunum" style="margin:0">
          <button type="button" class="seg ${takvimGorunum === 'plan' ? 'active' : ''}" data-g="plan">Yıllık Plan</button>
          <button type="button" class="seg ${takvimGorunum === 'liste' ? 'active' : ''}" data-g="liste">Liste</button>
        </div>
        <button class="btn btn-ghost" id="task-seed">Hazır Şablonları Yükle</button>
        <button class="btn" id="task-add">+ Görev Ekle</button>
      </div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      Yasal süreler ve periyodik bakımlar tek yerde. "Yapıldı" derken kimin yaptığını ve tutarı yazarsınız;
      kasadan ödendiyse gider otomatik işlenir, sonraki dönem takvime kendiliğinden düşer.
    </p>

    <div class="stat-grid">
      <div class="stat"><div class="val" style="color:var(--red)">${overdue.length}</div><div class="lbl">Gecikmiş</div></div>
      <div class="stat"><div class="val" style="color:var(--amber)">${soon.length}</div><div class="lbl">30 gün içinde</div></div>
      <div class="stat"><div class="val" style="color:var(--green)">${buYilYapilan.length}</div><div class="lbl">${takvimYil} içinde yapılan</div></div>
      <div class="stat"><div class="val">${C.TL(buYilHarcanan)}</div><div class="lbl">${takvimYil} içinde harcanan</div></div>
    </div>

    ${tahmini.length ? `<div class="info-banner" style="background:var(--amber-bg);border-color:#EAD3A2;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:260px"><strong>${tahmini.length} görevin sıradaki tarihi tahminî.</strong>
        Binanız bunları daha önce yaptıysa son yapılma tarihlerini girin; takvim gerçek periyoda otursun ve boşuna "gecikti" demesin.</div>
      <button class="btn btn-sm" id="tahmin-duzelt">Son tarihleri gir</button>
    </div>` : ''}

    ${bosTakvim ? bosHTML : (takvimGorunum === 'plan' ? planHTML : listeHTML)}`;

  /* ---------- olaylar ---------- */
  C.el('takvim-gorunum').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    takvimGorunum = b.dataset.g; renderTasks();
  });
  C.el('task-filter')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    taskFilter = b.dataset.f; renderTasks();
  });
  C.el('yil-geri')?.addEventListener('click', () => { takvimYil--; renderTasks(); });
  C.el('yil-ileri')?.addEventListener('click', () => { takvimYil++; renderTasks(); });

  C.el('task-seed').onclick = () => openSablonModal(all);
  C.el('task-seed-bos')?.addEventListener('click', () => openSablonModal(all));
  C.el('task-add').onclick = () => openTaskModal(null);
  C.el('task-add-bos')?.addEventListener('click', () => openTaskModal(null));
  C.el('tahmin-duzelt')?.addEventListener('click', () => openTahminModal(tahmini));

  C.el('task-body')?.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) {
      // Satıra tıklama → seri detayı (düğmeler hariç)
      const tr = e.target.closest('tr[data-seri]');
      if (tr) acSeri(tr.dataset.seri);
      return;
    }
    if (b.dataset.act === 'detay') return acSeri(b.dataset.seri);

    const rec = all.find(x => x.id === b.dataset.id); if (!rec) return;
    if (b.dataset.act === 'edit') return openTaskModal(rec);
    if (b.dataset.act === 'done') return openTamamlaModal(rec);
    /* Görevi iş kaydına çevir — büyük işlerde İş Takibi "iş emri / teslim
       tutanağı" belgeleri üretir. İş tamamlanınca buradaki görev de kapanır. */
    if (b.dataset.act === 'job') return openTaskToJobModal(rec);
    if (b.dataset.act === 'del') return gorevSil(rec);
  });
}

async function gorevSil(rec) {
  const soru = rec.status === 'done'
    ? 'Bu geçmiş kayıt silinsin mi? Kasaya işlenmiş gider varsa kasada kalır.'
    : 'Bu görev silinsin mi? Geçmiş kayıtları kalır.';
  if (!confirm(soru)) return;
  const { error } = await C.supabase.from('management_tasks').delete().eq('id', rec.id);
  if (error) return C.toast(error.message, true);
  C.toast('Silindi'); renderTasks();
}

const acSeri = (id) => { const s = sonSeriler.find(x => x.id === id); if (s) openSeriDetay(s); };

/* ---------- Seri detayı: zaman çizgisi ---------- */
function openSeriDetay(s) {
  const t = s.temsil;
  const sira = s.siradaki;
  const zaman = [
    ...s.bekleyen.map(x => ({ tip: daysUntil(x.due_date) < 0 ? 'gecikti' : 'planli', tarih: x.due_date, kayit: x })),
    ...s.yapilan.map(x => ({ tip: 'yapildi', tarih: x.done_date || x.completed_at, kayit: x })),
  ];
  const satir = (z) => {
    const x = z.kayit;
    if (z.tip !== 'yapildi') {
      return `<li class="z-${z.tip}"><strong>${C.dmy(x.due_date)}</strong> — planlı ${vadeRozeti(x)}
        ${x.assigned_to ? `<div class="muted" style="font-size:12.5px">Sorumlu: ${C.esc(x.assigned_to)}${x.expected_cost != null ? ` · beklenen ${C.TL(x.expected_cost)}` : ''}</div>` : (x.expected_cost != null ? `<div class="muted" style="font-size:12.5px">Beklenen ${C.TL(x.expected_cost)}</div>` : '')}
      </li>`;
    }
    const kim = kimYapti(x);
    return `<li class="z-yapildi"><strong>${C.dmy(z.tarih)}</strong>
        ${x.cost != null ? ` · <strong>${C.TL(x.cost)}</strong>` : ''}
        ${x.transaction_id ? ' <span class="badge b-gray" title="Kasaya gider olarak işlendi">kasadan ödendi</span>' : ''}
        <button class="btn btn-xs btn-outline-red" data-sil="${x.id}" style="float:right">Sil</button>
      <div class="muted" style="font-size:12.5px">
        ${kim ? `${x.self_done ? '🏠 Kendimiz yaptık' : '🏢 ' + C.esc(kim)}` : 'Kim yaptığı girilmedi'}
        ${x.evidence_url ? ` · <a href="${C.esc(x.evidence_url)}" target="_blank" rel="noopener">📎 Belge</a>` : ''}
        ${x.notes ? `<div>${C.esc(x.notes)}</div>` : ''}
      </div></li>`;
  };

  C.el('modal').classList.add('genis');
  C.openModal(t.title, `
    <div class="muted" style="font-size:13px;margin-bottom:12px">
      ${[TASK_CATEGORIES[t.category]?.label, t.legal_basis, t.recurrence_months ? `${t.recurrence_months} ayda bir` : 'Tek seferlik', C.kapsamEtiketi ? C.kapsamEtiketi(t.scope, t.building_id) : ''].filter(Boolean).map(C.esc).join(' · ')}
      ${t.description ? `<div>${C.esc(t.description)}</div>` : ''}
    </div>
    <div class="seri-ozet">
      <div><div class="v">${s.yapilan.length}</div><div class="l">kez yapıldı</div></div>
      <div><div class="v">${C.TL(s.toplam)}</div><div class="l">toplam harcama</div></div>
      <div><div class="v">${s.ortalama != null ? C.TL(s.ortalama) : '—'}</div><div class="l">ortalama tutar</div></div>
      <div><div class="v" style="font-size:14px">${s.kim ? C.esc(s.kim) : '—'}</div><div class="l">kim yapıyor</div></div>
      <div><div class="v" style="font-size:14px">${s.son ? C.dmy(s.son.done_date || s.son.completed_at) : '—'}</div><div class="l">son yapılma</div></div>
    </div>

    ${sira ? `<div class="todo-row ${daysUntil(sira.due_date) < 0 ? 't-kirmizi' : 't-bekle'}" style="margin-bottom:14px">
      <div class="todo-text" style="flex:1"><strong>Sıradaki: ${C.dmy(sira.due_date)}</strong> ${vadeRozeti(sira)}
        ${sira.due_estimated ? '<div class="muted" style="font-size:12.5px">Bu tarih tahminî. Aşağıdan geçmiş kayıt ekleyince gerçek periyoda göre düzelir.</div>' : ''}</div>
      <button class="btn btn-sm btn-green" data-done="${sira.id}">Yapıldı</button>
      ${!sira.job_id ? `<button class="btn btn-sm" data-job="${sira.id}">🛠 İşe Dönüştür</button>` : ''}
      <button class="btn btn-sm btn-ghost" data-edit="${sira.id}">Düzenle</button>
    </div>` : `<div class="info-banner">Bu serinin bekleyen görevi yok. Yeniden başlatmak için "Görev Ekle" ile aynı başlıkla yeni görev açın; geçmişi buraya bağlanır.</div>`}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h3 style="margin:0;font-size:15px">Zaman çizgisi</h3>
      <button class="btn btn-sm btn-ghost" id="sd-gecmis">+ Geçmiş kayıt ekle</button>
    </div>
    ${zaman.length ? `<ul class="zaman">${zaman.map(satir).join('')}</ul>`
      : '<p class="muted" style="font-size:13px;padding:10px 0">Henüz kayıt yok.</p>'}
    <p class="muted" style="font-size:12px;margin-top:10px">
      Geçmiş kayıt: "bu iş geçen yıl da yapılmıştı" — takvime yazın, yıllık dökümde görünsün, ortalama maliyet hesaplansın.</p>
    <div style="margin-top:14px;text-align:right">
      <button class="btn btn-sm btn-outline-red" id="sd-hepsini-sil">Seriyi tümüyle sil</button>
    </div>
  `);

  const body = C.el('modal-body');
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const bul = (id) => s.satirlar.find(x => x.id === id);
    if (b.dataset.done) return openTamamlaModal(bul(b.dataset.done), s.id);
    if (b.dataset.job) return openTaskToJobModal(bul(b.dataset.job));
    if (b.dataset.edit) return openTaskModal(bul(b.dataset.edit), s.id);
    if (b.id === 'sd-gecmis') return openGecmisModal(s);
    if (b.dataset.sil) {
      if (!confirm('Bu geçmiş kayıt silinsin mi? Kasaya işlenmiş gider varsa kasada kalır.')) return;
      const { error } = await C.supabase.from('management_tasks').delete().eq('id', b.dataset.sil);
      if (error) return C.toast(error.message, true);
      C.toast('Kayıt silindi'); await renderTasks(); acSeri(s.id);
    }
    if (b.id === 'sd-hepsini-sil') {
      if (!confirm(`"${t.title}" serisi, ${s.satirlar.length} kayıtla birlikte silinsin mi? Kasa kayıtları kalır.`)) return;
      const { error } = await C.supabase.from('management_tasks').delete().in('id', s.satirlar.map(x => x.id));
      if (error) return C.toast(error.message, true);
      C.closeModal(); C.toast('Seri silindi'); renderTasks();
    }
  });
}

/* "Kim yaptı" seçici: firma/kişi ya da kendimiz. Ortak parça. */
const kimHTML = (id, varsayilan, kendimiz = false) => `
  <div class="field"><label>Kim yaptı?</label>
    <div class="seg-tabs" id="${id}-seg" style="margin:0 0 8px">
      <button type="button" class="seg ${kendimiz ? '' : 'active'}" data-k="firma">Firma / kişi</button>
      <button type="button" class="seg ${kendimiz ? 'active' : ''}" data-k="biz">Kendimiz yaptık</button>
    </div>
    <input id="${id}-who" placeholder="Örn: Öz Asansör Ltd." value="${C.esc(varsayilan || '')}" style="${kendimiz ? 'display:none' : ''}" />
  </div>`;
function bindKim(id) {
  const st = { kendimiz: C.el(`${id}-seg`).querySelector('.seg.active')?.dataset.k === 'biz' };
  C.el(`${id}-seg`).addEventListener('click', (e) => {
    const seg = e.target.closest('[data-k]'); if (!seg) return;
    st.kendimiz = seg.dataset.k === 'biz';
    C.el(`${id}-seg`).querySelectorAll('.seg').forEach(x => x.classList.toggle('active', x === seg));
    C.el(`${id}-who`).style.display = st.kendimiz ? 'none' : '';
  });
  return () => ({ kendimiz: st.kendimiz, kim: st.kendimiz ? null : C.el(`${id}-who`).value.trim() || null });
}

/* Ortak kaydet düğmesi: openModal'ın onSave'i sayfayı yeniden çizer ama
   detay modalına dönmez; burada bitince seriye geri açılır. */
function kaydetBagla(fn, seriId) {
  const btn = C.el('m-save');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      await fn();
      C.closeModal();
      await renderTasks();
      if (seriId) acSeri(seriId);
    } catch (err) { C.toast(err.message, true); btn.disabled = false; }
  };
}

/* ---------- Yapıldı ---------- */
function openTamamlaModal(rec, seriId = null) {
  if (!rec) return;
  const seri = sonSeriler.find(s => s.id === (rec.series_id || rec.id));
  const beklenen = rec.expected_cost ?? seri?.beklenen ?? null;
  const seriKim = seri?.kim && seri.kim !== 'Kendimiz' ? seri.kim : '';
  const kimVars = rec.assigned_to || seriKim;
  const kendimizVars = !rec.assigned_to && !!seri?.son?.self_done;
  const bugun = C.todayISO();

  C.openModal('✅ Yapıldı', `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">
      <strong>${C.esc(rec.title)}</strong><br>Vade: ${C.dmy(rec.due_date)}${rec.legal_basis ? ` · ${C.esc(rec.legal_basis)}` : ''}
    </p>
    <div class="field"><label>Yapılma tarihi *</label>
      <input id="tm-date" type="date" value="${bugun}" max="${bugun}" /></div>
    ${kimHTML('tm', kimVars, kendimizVars)}
    <div class="grid-2">
      <div class="field"><label>Tutar (₺)</label>
        <input id="tm-cost" inputmode="decimal" placeholder="0" value="${beklenen != null ? beklenen : ''}" /></div>
      <div class="field"><label>Ödeme</label>
        <select id="tm-wallet">
          <option value="">Kasaya işleme</option>
          <option value="bank" selected>Banka hesabından ödendi</option>
          <option value="cash">Nakit kasadan ödendi</option>
          <option value="fund">Yedek akçeden ödendi</option>
        </select></div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:-6px 0 14px">Kasadan ödendiyse tutar gider olarak işlenir ve bakiyeden düşer. Ücretsiz ya da kayıt dışıysa tutarı boş bırakın.</p>
    <div class="field"><label>Belge / fatura bağlantısı</label>
      <input id="tm-url" placeholder="Rapor, fatura ya da etiket fotoğrafı" value="${C.esc(rec.evidence_url || '')}" /></div>
    <div class="field"><label>Not</label><input id="tm-notes" placeholder="Örn: kırmızı etiket kaldırıldı" /></div>
    <p class="muted" id="tm-sonraki" style="font-size:12.5px;margin-bottom:14px"></p>
    <button class="btn btn-block" id="m-save">Kaydet</button>
  `);

  const oku = bindKim('tm');
  const sonrakiYaz = () => {
    const d = C.el('tm-date').value || bugun;
    const n = sonrakiVade(rec, d);
    C.el('tm-sonraki').textContent = n
      ? `Tekrarlı görev: sonraki dönem ${C.dmy(n)} tarihine açılır.`
      : 'Tek seferlik görev; sonraki dönem açılmaz.';
  };
  C.el('tm-date').addEventListener('change', sonrakiYaz); sonrakiYaz();

  kaydetBagla(async () => {
    const tarih = C.el('tm-date').value;
    if (!tarih) throw new Error('Yapılma tarihi zorunludur.');
    if (tarih > bugun) throw new Error('Yapılma tarihi ileri bir tarih olamaz.');
    const { kendimiz, kim } = oku();
    const tutarStr = C.el('tm-cost').value.trim();
    const tutar = tutarStr ? num(tutarStr) : null;
    const kasa = tutar && tutar > 0 ? (C.el('tm-wallet').value || null) : null;

    const { data: sonraki, error } = await C.supabase.rpc('complete_management_task', {
      p_task_id: rec.id, p_done_date: tarih, p_performed_by: kim, p_self_done: kendimiz,
      p_cost: tutar, p_wallet: kasa,
      p_evidence_url: C.el('tm-url').value.trim() || null,
      p_notes: C.el('tm-notes').value.trim() || null,
    });
    if (error) throw rpcHata(error, 'Görev kapatma');

    if (kasa && C.refreshBuilding) await C.refreshBuilding();
    const parca = [];
    if (kasa) parca.push(`${C.TL(tutar)} kasadan düşüldü`);
    if (sonraki) parca.push(`sonraki dönem ${C.dmy(sonrakiVade(rec, tarih))}`);
    C.toast('Kaydedildi' + (parca.length ? ' — ' + parca.join(', ') : ''));
  }, seriId);
}

/* ---------- Geçmişe kayıt ---------- */
function openGecmisModal(s) {
  const t = s.temsil;
  const bugun = C.todayISO();
  const tekrarli = !!t.recurrence_months;
  C.openModal('Geçmiş kayıt ekle', `
    <p class="muted" style="font-size:13px;margin-bottom:14px;"><strong>${C.esc(t.title)}</strong><br>
      Daha önce yapılmış bir dönemi takvime işler. Yıllık dökümde ✓ olarak görünür, ortalama maliyete katılır.</p>
    <div class="field"><label>Yapılma tarihi *</label>
      <input id="gm-date" type="date" max="${bugun}" /></div>
    ${kimHTML('gm', s.kim !== 'Kendimiz' ? s.kim : '', s.kim === 'Kendimiz')}
    <div class="field"><label>Tutar (₺) <span class="muted" style="font-weight:400">— biliyorsanız</span></label>
      <input id="gm-cost" inputmode="decimal" placeholder="Boş bırakılabilir" /></div>
    <div class="field"><label>Not</label><input id="gm-notes" /></div>
    ${tekrarli ? `<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px;margin-bottom:14px;cursor:pointer">
      <input type="checkbox" id="gm-due" ${s.siradaki?.due_estimated ? 'checked' : ''} style="margin-top:3px">
      <span><strong>Sıradaki tarihi buna göre güncelle</strong><br>
      <span class="muted">Vade = serideki son yapılma + ${t.recurrence_months} ay olur. ${s.siradaki?.due_estimated ? 'Şu anki vade tahminî olduğu için önerilir.' : ''}</span></span>
    </label>` : ''}
    <p class="muted" style="font-size:12.5px;margin-bottom:14px">Bu kayıt kasaya işlenmez; o dönemin gideri zaten defterinizdeyse çift kayıt olmaz.</p>
    <button class="btn btn-block" id="m-save">Kaydet</button>
  `);
  const oku = bindKim('gm');
  kaydetBagla(async () => {
    const tarih = C.el('gm-date').value;
    if (!tarih) throw new Error('Yapılma tarihi zorunludur.');
    if (tarih > bugun) throw new Error('Geçmiş kayıt ileri tarihli olamaz.');
    const { kendimiz, kim } = oku();
    const tutarStr = C.el('gm-cost').value.trim();
    const { error } = await C.supabase.rpc('log_task_history', {
      p_task_id: t.id, p_done_date: tarih, p_performed_by: kim, p_self_done: kendimiz,
      p_cost: tutarStr ? num(tutarStr) : null,
      p_notes: C.el('gm-notes').value.trim() || null,
      p_update_due: !!C.el('gm-due')?.checked,
    });
    if (error) throw rpcHata(error, 'Geçmiş kayıt');
    C.toast('Geçmiş kayıt eklendi');
  }, s.id);
}

/* ---------- Tahminî tarihleri toplu düzelt ---------- */
function openTahminModal(seriler) {
  const bugun = C.todayISO();
  C.el('modal').classList.add('genis');
  C.openModal('Son yapılma tarihleri', `
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      Şablon yüklenirken bu görevlerin son yapılma tarihi girilmemişti. Bildiklerinizi yazın;
      sıradaki vade <strong>son yapılma + periyot</strong> olarak yeniden hesaplanır. Bilmediklerinizi boş bırakın.</p>
    <div id="th-list">
      ${seriler.map(s => `<div class="sablon-satir">
        <div></div>
        <div><strong>${C.esc(s.temsil.title)}</strong>
          <div class="muted" style="font-size:12px">${s.temsil.recurrence_months} ayda bir · şu anki vade ${C.dmy(s.siradaki.due_date)}</div></div>
        <input type="date" max="${bugun}" data-seri="${s.id}" />
      </div>`).join('')}
    </div>
    <button class="btn btn-block" id="m-save" style="margin-top:16px">Kaydet</button>
  `);
  kaydetBagla(async () => {
    const girisler = [...C.el('th-list').querySelectorAll('input[data-seri]')]
      .map(i => ({ seri: seriler.find(s => s.id === i.dataset.seri), tarih: i.value }))
      .filter(x => x.tarih);
    if (!girisler.length) throw new Error('En az bir tarih girin.');
    for (const g of girisler) {
      const { error } = await C.supabase.rpc('log_task_history', {
        p_task_id: g.seri.temsil.id, p_done_date: g.tarih, p_performed_by: null, p_self_done: false,
        p_cost: null, p_notes: null, p_update_due: true,
      });
      if (error) throw rpcHata(error, 'Tarih güncelleme');
    }
    C.toast(`${girisler.length} görevin vadesi gerçek tarihe göre güncellendi`);
  });
}

/* ---------- Şablon yükleme: "en son ne zaman yapıldı?" ---------- */
function openSablonModal(all) {
  const bugun = C.todayISO();
  const mevcut = new Set(all.filter(t => t.status === 'pending').map(t => t.title));
  C.el('modal').classList.add('genis');
  C.openModal('Hazır şablonlar', `
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      Binanız için geçerli olanları seçin. <strong>En son ne zaman yapıldı</strong> sütununu doldurursanız sıradaki
      tarih ondan hesaplanır (ör. Mart'ta yapılan yıllık bakım gelecek Mart'a düşer). Boş bırakırsanız tarih tahminî
      atanır ve sonradan düzeltmeniz istenir.</p>
    <div class="sablon-satir" style="font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:700">
      <div></div><div>Görev</div><div>En son ne zaman?</div></div>
    <div id="sb-list">
      ${SABLONLAR.map((s, i) => {
        const var_ = mevcut.has(s.title);
        return `<div class="sablon-satir ${var_ ? 'pasif' : ''}">
          <input type="checkbox" data-i="${i}" ${var_ ? 'disabled' : 'checked'} />
          <div><strong>${TASK_CATEGORIES[s.category].icon} ${C.esc(s.title)}</strong>
            ${var_ ? '<span class="badge b-gray">zaten takvimde</span>' : ''}
            <div class="muted" style="font-size:12px">${[s.legal, `${s.months} ayda bir`, s.ipucu].filter(Boolean).map(C.esc).join(' · ')}</div></div>
          <input type="date" max="${bugun}" data-d="${i}" ${var_ ? 'disabled' : ''} />
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-block" id="m-save" style="margin-top:16px">Seçilenleri Takvime Ekle</button>
  `);
  kaydetBagla(async () => {
    const secim = [];
    C.el('sb-list').querySelectorAll('input[type=checkbox][data-i]').forEach(cb => {
      if (!cb.checked || cb.disabled) return;
      const s = SABLONLAR[Number(cb.dataset.i)];
      const d = C.el('sb-list').querySelector(`input[data-d="${cb.dataset.i}"]`).value;
      secim.push({ title: s.title, last_done: d || null });
    });
    if (!secim.length) throw new Error('En az bir şablon seçin.');
    const { data: n, error } = await C.supabase.rpc('seed_management_tasks', { p_site_id: C.sId(), p_secim: secim });
    if (error) throw rpcHata(error, 'Şablon yükleme');
    const tarihli = secim.filter(s => s.last_done).length;
    C.toast(`${n} görev eklendi${tarihli ? `, ${tarihli} tanesinin vadesi son yapılma tarihinden hesaplandı` : ''}`);
  });
}

/* Takvimdeki görevi İş Takibi kaydına bağlar. building_jobs.task_id sayesinde
   iş tamamlandığında görev de kapanır (panel.js → openJobPaymentModal). */
function openTaskToJobModal(rec) {
  C.openModal('İşe Dönüştür', `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">
      <strong>${C.esc(rec.title)}</strong><br>
      Son tarih: ${C.dmy(rec.due_date)}${rec.legal_basis ? ` · ${C.esc(rec.legal_basis)}` : ''}
    </p>
    <div class="info-banner" style="font-size:12.5px">Küçük işleri doğrudan <strong>Yapıldı</strong> ile kapatabilirsiniz. İşe dönüştürmek,
      firmaya <strong>iş emri</strong> ve bitince <strong>teslim tutanağı</strong> üretmek istediğiniz büyük işler içindir.</div>
    <div class="field"><label>Sorumlu Kişi / Firma *</label>
      <input id="tj-assignee" placeholder="Örn: Öz Asansör Ltd." value="${C.esc(rec.assigned_to || '')}" /></div>
    <div class="grid-2">
      <div class="field"><label>Planlanan Ücret (₺)</label><input id="tj-price" inputmode="decimal" value="${rec.expected_cost ?? 0}" /></div>
      <div class="field"><label>Termin Tarihi</label><input id="tj-due" type="date" value="${C.esc(rec.due_date || C.todayISO())}" /></div>
    </div>
    <p class="muted" style="font-size:12.5px;margin-bottom:14px;">
      Buradaki ücret plandır. İş tamamlanırken gerçekte ödenen tutar sorulur, kasaya o tutar işlenir
      ve bu takvim görevi otomatik kapanır.</p>
    <button class="btn btn-block" id="m-save">İşi Oluştur</button>
  `, async () => {
    const assignee = C.el('tj-assignee').value.trim();
    if (!assignee) throw new Error('Sorumlu kişi zorunludur.');
    const price = num(C.el('tj-price').value);
    const due = C.el('tj-due').value;

    const { data: isKaydi, error } = await C.supabase.from('building_jobs').insert({
      building_id: rec.building_id || C.bId(),
      scope: rec.scope || 'site',
      title: rec.title,
      description: [rec.legal_basis, rec.description].filter(Boolean).join(' — ') || null,
      interval: 'custom', interval_days: 0,
      assigned_to: assignee, price,
      next_due_date: due ? new Date(due).toISOString() : null,
      is_active: true, status: 'planned', created_by: C.S.user.id,
      task_id: rec.id,
    }).select().single();
    if (error) throw new Error(error.message);

    const { error: bagErr } = await C.supabase.from('management_tasks')
      .update({ job_id: isKaydi.id, assigned_to: assignee, expected_cost: price || null }).eq('id', rec.id);
    if (bagErr) console.warn('Görev–iş bağı kurulamadı:', bagErr.message);

    if (C.notifyBuilding) C.notifyBuilding('🔧 Yeni İş', `"${rec.title}" işi planlandı.`);
    C.toast('İş oluşturuldu, İş Takibi ekranına eklendi');
    C.navigate('jobs');
  });
}

function openTaskModal(rec, seriId = null) {
  const isEdit = !!rec;
  C.openModal(isEdit ? 'Görevi Düzenle' : 'Yeni Görev', `
    <div class="field"><label>Görev Adı *</label>
      <input id="t-title" placeholder="Örn: Asansör periyodik kontrolü" value="${isEdit ? C.esc(rec.title) : ''}" /></div>
    <div class="grid-2">
      <div class="field"><label>Tür</label>
        <select id="t-cat">${Object.entries(TASK_CATEGORIES).map(([v, o]) =>
          `<option value="${v}" ${isEdit && rec.category === v ? 'selected' : ''}>${o.icon} ${o.label}</option>`).join('')}</select></div>
      <div class="field"><label>${isEdit ? 'Sıradaki tarih' : 'İlk tarih'} *</label>
        <input id="t-due" type="date" value="${isEdit ? C.esc(rec.due_date) : C.todayISO()}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Tekrar</label>
        <select id="t-rec">
          <option value="">Tek seferlik</option>
          ${[1, 2, 3, 4, 6, 12, 24].map(m => `<option value="${m}" ${isEdit && rec.recurrence_months === m ? 'selected' : ''}>${m} ayda bir</option>`).join('')}
        </select></div>
      <div class="field"><label>Kim yapıyor?</label>
        <input id="t-who" placeholder="Firma adı ya da 'Yönetici'" value="${isEdit ? C.esc(rec.assigned_to || '') : ''}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Beklenen tutar (₺)</label>
        <input id="t-cost" inputmode="decimal" placeholder="Her seferinde yaklaşık" value="${isEdit && rec.expected_cost != null ? rec.expected_cost : ''}" /></div>
      <div class="field"><label>Yasal Dayanak</label>
        <input id="t-legal" placeholder="Örn: KMK m.41" value="${isEdit ? C.esc(rec.legal_basis || '') : ''}" /></div>
    </div>
    ${!C.cokBloklu() ? '' : `<div class="field"><label>Bu yükümlülük hangi kapsamda?</label>
      <select id="t-scope">
        <option value="">Tüm Site (sigorta, yönetim planı gibi)</option>
        ${C.S.buildings.map(b => `<option value="${b.id}" ${isEdit && rec.scope === 'building' && rec.building_id === b.id ? 'selected' : ''}>${C.esc(b.name)}</option>`).join('')}
      </select>
      <p class="muted" style="font-size:12.5px;margin-top:6px">
        Bloğa özel yükümlülükler (asansör muayenesi gibi) yalnızca o bloğun listesinde sayılır;
        site geneli olanlar her blokta görünür.</p></div>`}
    <div class="field"><label>Açıklama</label>
      <textarea id="t-desc" rows="2">${isEdit ? C.esc(rec.description || '') : ''}</textarea></div>
    ${isEdit && rec.due_estimated ? '<p class="muted" style="font-size:12.5px;margin-bottom:14px">Bu vade tahminîydi; tarihi değiştirdiğinizde işaret kalkar.</p>' : ''}
    ${!isEdit ? '<p class="muted" style="font-size:12.5px;margin-bottom:14px">Daha önce yapılmış dönemleri eklemek için görevi kaydettikten sonra <strong>Detay → Geçmiş kayıt ekle</strong> kullanın.</p>' : ''}
    <button class="btn btn-block" id="m-save">${isEdit ? 'Kaydet' : 'Görevi Ekle'}</button>
  `);
  kaydetBagla(async () => {
    const title = C.el('t-title').value.trim();
    const due = C.el('t-due').value;
    if (!title || !due) throw new Error('Görev adı ve tarih zorunludur.');
    const hedefBlok = C.el('t-scope')?.value || null;
    const costStr = C.el('t-cost').value.trim();
    const payload = {
      title,
      category: C.el('t-cat').value,
      due_date: due,
      recurrence_months: C.el('t-rec').value ? Number(C.el('t-rec').value) : null,
      assigned_to: C.el('t-who').value.trim() || null,
      expected_cost: costStr ? num(costStr) : null,
      legal_basis: C.el('t-legal').value.trim() || null,
      description: C.el('t-desc').value.trim() || null,
      building_id: hedefBlok || C.bId(),
      scope: hedefBlok ? 'building' : 'site',
    };
    const { error } = isEdit
      ? await C.supabase.from('management_tasks').update(payload).eq('id', rec.id)
      : await C.supabase.from('management_tasks').insert({ site_id: C.sId(), source: 'manual', ...payload });
    if (error) throw new Error(error.message);
    C.toast(isEdit ? 'Görev güncellendi' : 'Görev eklendi');
  }, seriId);
}

/* ============================================================
   2) EK ÖDEMELER
   ============================================================
   Aidat dışı, işe bağlı ortak giderler (çatı tamiri, asansör bakımı...).
   İşletme projesinin yerini aldı: orada tüm yıllık kalemler toplanıp 12'ye
   bölünüyor ve tek aidat tutarına gömülüyordu; sakin parasının nereye
   gittiğini göremiyordu. Burada her gider kendi başlığıyla ayrı durur.

   Tutar binanın TÜM dairelerine eşit bölünür (boş daireler dahil) — ortak
   gider kat malikinin borcudur. Boş dairelerin payı ayrıca gösterilir ki
   yönetici maliklerden tahsilat yapması gerektiğini bilsin.
   ============================================================ */

export async function renderExtraCharges() {
  if (!needSite()) return;

  const { data: charges, error } = await C.supabase
    .from('extra_charges').select('*')
    .eq('building_id', C.bId())
    .order('created_at', { ascending: false });

  if (error) { if (migrationUyarisi(error)) return; return C.toast(error.message, true); }
  const list = charges || [];

  // Her ek ödemenin tahsilat durumu
  const ozetler = {};
  for (const c of list) {
    const { data: o } = await C.supabase.rpc('extra_charge_summary', { p_charge_id: c.id });
    ozetler[c.id] = (o && o[0]) || null;
  }

  const kart = (c) => {
    const o = ozetler[c.id];
    const tahsil = Number(o?.tahsil_edilen || 0);
    const bekleyen = Number(o?.bekleyen || 0);
    const oran = (tahsil + bekleyen) > 0 ? Math.round(tahsil / (tahsil + bekleyen) * 100) : 0;
    return `<div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0">${C.esc(c.title)}</h3>
          <p class="muted" style="margin:4px 0 0;font-size:13px;">
            Toplam ${C.TL(c.total_amount)} ·
            ${c.installments > 1 ? `${c.installments} taksit` : 'tek seferlik'} ·
            ${C.MONTHS[c.start_month - 1]} ${c.start_year}'den itibaren
            ${c.note ? `<br>${C.esc(c.note)}` : ''}
          </p>
        </div>
        <div style="text-align:right;white-space:nowrap;">
          <div style="font-size:20px;font-weight:800;">${oran}%</div>
          <div class="muted" style="font-size:12px;">tahsil edildi</div>
        </div>
      </div>

      ${o ? `<div class="info-banner" style="margin:14px 0 0;">
        <strong>${o.daire_sayisi} daireye bölündü</strong> — daire başına ${C.TL(o.daire_payi)}.
        ${Number(o.bos_daire) > 0
          ? `<br>⚠️ <strong>${o.bos_daire} daire boş.</strong> Bu dairelerin toplam
             <strong>${C.TL(o.bos_daire_payi_toplami)}</strong> tutarındaki payı için
             kat maliklerinden tahsilat yapmanız gerekir; uygulamada sakini olmadığı için
             kimseye bildirim gitmez.`
          : ''}
      </div>` : ''}

      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-ghost" data-detay="${c.id}">Daire Dökümü</button>
        <button class="btn btn-sm btn-outline-red" data-sil="${c.id}" data-baslik="${C.esc(c.title)}">Sil</button>
      </div>
      <div id="detay-${c.id}" hidden style="margin-top:14px;"></div>
    </div>`;
  };

  C.$content().innerHTML = `
    <div class="page-head"><h2>Ek Ödemeler</h2></div>
    <div class="info-banner">Aidat dışı, bir işe bağlı ortak giderler buraya girilir (çatı tamiri, asansör bakımı…).
      Tutar tüm dairelere eşit bölünür ve sakinlere <strong>aidattan ayrı bir kalem</strong> olarak görünür.</div>

    <div class="card">
      <h3>Yeni Ek Ödeme</h3>
      <div class="grid-2">
        <div class="field"><label>Başlık</label><input id="ec-title" placeholder="Örn: Çatı tamiri"></div>
        <div class="field"><label>Toplam Tutar (₺)</label><input id="ec-total" inputmode="decimal" placeholder="Örn: 3000"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Taksit Sayısı</label>
          <select id="ec-inst">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}">${n === 1 ? 'Tek seferlik' : n + ' taksit'}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Başlangıç Ayı</label>
          <select id="ec-month">${C.MONTHS.map((m,i)=>`<option value="${i+1}" ${i+1 === new Date().getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Açıklama (isteğe bağlı)</label><input id="ec-note" placeholder="Sakinlerin göreceği kısa not"></div>
      <button class="btn" id="ec-create">Ek Ödeme Oluştur</button>
      <p class="muted" style="font-size:12.5px;margin-top:10px;">
        Tutar tüm dairelere eşit bölünür, taksit sayısına göre aylara dağıtılır.
        Sakinler uygulamada "Aidatlarım" ekranında ayrı bir satır olarak görür.
      </p>
    </div>

    ${list.length ? list.map(kart).join('') : `<div class="card"><p class="t-empty"><strong>Henüz ek ödeme yok.</strong><br>
      Çatı tamiri, asansör bakımı gibi bir iş için para toplayacaksanız yukarıdaki formu doldurun;
      tutar dairelere bölünür ve sakinler aidatından ayrı bir satır olarak görür.</p></div>`}`;

  C.el('ec-create').onclick = async () => {
    const title = String(C.el('ec-title').value || '').trim();
    const total = num(C.el('ec-total').value);
    const inst = Number(C.el('ec-inst').value) || 1;
    const month = Number(C.el('ec-month').value);
    if (!title) return C.toast('Başlık girin', true);
    if (!(total > 0)) return C.toast('Geçerli bir tutar girin', true);

    C.el('ec-create').disabled = true;
    const { error: err } = await C.supabase.rpc('create_extra_charge', {
      p_building_id: C.bId(), p_title: title, p_total: total,
      p_installments: inst, p_start_year: new Date().getFullYear(),
      p_start_month: month, p_note: String(C.el('ec-note').value || '').trim() || null,
    });
    if (err) { C.el('ec-create').disabled = false; return C.toast(err.message, true); }
    C.toast('Ek ödeme oluşturuldu');
    renderExtraCharges();
  };

  C.$content().addEventListener('click', async (e) => {
    const sil = e.target.closest('[data-sil]');
    if (sil) {
      if (!confirm(`"${sil.dataset.baslik}" ek ödemesi silinsin mi?\n\nTüm dairelerdeki payları ve ödeme kayıtları da silinir.`)) return;
      const { error: err } = await C.supabase.from('extra_charges').delete().eq('id', sil.dataset.sil);
      if (err) return C.toast(err.message, true);
      C.toast('Silindi'); return renderExtraCharges();
    }

    const det = e.target.closest('[data-detay]');
    if (det) {
      const host = C.el(`detay-${det.dataset.detay}`);
      if (!host) return;
      if (!host.hidden) { host.hidden = true; return; }
      host.hidden = false;
      host.innerHTML = '<p class="muted">Yükleniyor…</p>';

      const [{ data: items }, { data: apts }, { data: mem }] = await Promise.all([
        C.supabase.from('extra_charge_items').select('*').eq('charge_id', det.dataset.detay),
        C.supabase.from('apartments').select('id, apartment_number').eq('building_id', C.bId()),
        C.supabase.from('apartment_members').select('apartment_id, user_id'),
      ]);
      const aptNo = new Map((apts || []).map(a => [a.id, a.apartment_number]));
      const doluSet = new Set((mem || []).map(m => m.apartment_id));
      const sirali = (items || []).sort((x, y) =>
        String(aptNo.get(x.apartment_id)).localeCompare(String(aptNo.get(y.apartment_id)), 'tr', { numeric: true })
        || x.year - y.year || x.month - y.month);

      host.innerHTML = `<table><thead><tr>
          <th>Daire</th><th>Dönem</th><th class="t-right">Tutar</th><th>Durum</th>
        </tr></thead><tbody>${sirali.map(i => `<tr>
          <td><strong>${C.esc(aptNo.get(i.apartment_id) || '—')}</strong>${doluSet.has(i.apartment_id) ? '' : ' <span class="badge b-gray" title="Sakini yok — malikten tahsil edilmeli">Boş</span>'}</td>
          <td>${C.MONTHS[i.month - 1]} ${i.year}</td>
          <td class="t-right">${C.TL(i.amount)}</td>
          <td><label class="pay-check${i.is_paid ? ' is-paid' : ''}">
            <input type="checkbox" data-ec-pay="${i.id}" data-amt="${i.amount}" data-no="${C.esc(aptNo.get(i.apartment_id) || '')}" ${i.is_paid ? 'checked' : ''}>
            <span>${i.is_paid ? 'Ödendi' : 'Ödendi işaretle'}</span>
          </label></td>
        </tr>`).join('')}</tbody></table>`;
    }
  });

  C.$content().addEventListener('change', async (e) => {
    const box = e.target.closest('input[data-ec-pay]');
    if (!box) return;
    const odendi = box.checked;
    const { error: err } = await C.supabase.from('extra_charge_items')
      .update({ is_paid: odendi, paid_date: odendi ? new Date().toISOString() : null })
      .eq('id', box.dataset.ecPay);
    if (err) { box.checked = !odendi; return C.toast(err.message, true); }

    // Kasaya yaz — aidat tahsilatıyla aynı desen
    await C.adjustBalance({
      amount: Number(box.dataset.amt), operation: odendi ? 'add' : 'subtract',
      description: `${odendi ? 'Ek ödeme tahsilatı' : 'Ek ödeme iptali'} - Daire ${box.dataset.no}`,
      category: 'other', walletType: 'bank', relatedId: box.dataset.ecPay,
      buildingId: C.bId(), scope: 'building',
    });
    C.toast(odendi ? 'Tahsil edildi, kasaya eklendi' : 'Tahsilat geri alındı');
  });
}

/* ============================================================
   3) KURUL & DENETİM
   ============================================================ */
const BOARD_ROLES = {
  yonetici: 'Yönetici',
  yonetici_yardimcisi: 'Yönetici Yardımcısı',
  kurul_uyesi: 'Yönetim Kurulu Üyesi',
  denetci: 'Denetçi',
  blok_temsilcisi: 'Blok Temsilcisi',
};
const AUDIT_RESULTS = {
  uygun: '<span class="badge b-green">Uygun</span>',
  uyari: '<span class="badge b-amber">Uyarı</span>',
  aykirilik: '<span class="badge b-red">Aykırılık</span>',
};

export async function renderBoard() {
  if (!needSite()) return;
  const [bRes, aRes] = await Promise.all([
    C.supabase.from('management_board').select('*').eq('site_id', C.sId()).order('term_start', { ascending: false }),
    C.supabase.from('audit_reports').select('*').eq('site_id', C.sId()).order('period_end', { ascending: false }),
  ]);
  if (bRes.error && migrationUyarisi(bRes.error)) return;

  const members = bRes.data || [];
  const audits = aRes.data || [];
  const active = members.filter(m => m.is_active);
  const hasYonetici = active.some(m => m.role === 'yonetici');
  const hasDenetci = active.some(m => m.role === 'denetci');

  // KMK m.41: yönetim planında süre yoksa denetim 3 ayda bir
  const lastAudit = audits[0];
  const auditOverdue = !lastAudit || daysUntil(addMonths(lastAudit.period_end, 3)) < 0;
  // Yeni kaydolmuş sitede "yönetici yok, denetçi yok, denetim gecikmiş" üçü
  // birden yanıyordu — bina bunları yapmış, sisteme yeni girmiş olabilir.
  const yeniSite = (C.siteYasiGun ? C.siteYasiGun() : Infinity) < (C.YENI_SITE_GUN ?? 90);

  C.$content().innerHTML = `
    <div class="page-head"><h2>Kurul & Denetim</h2>
      <div class="tools">
        <button class="btn btn-ghost" id="board-belge">📄 Kurul Belgesi</button>
        <button class="btn btn-ghost" id="audit-add">+ Denetim Raporu</button>
        <button class="btn" id="board-add">+ Kurul Üyesi</button>
      </div>
    </div>

    ${(!yeniSite && (!hasYonetici || !hasDenetci || auditOverdue)) ? `<div class="info-banner" style="margin-bottom:18px;">
      ${!hasYonetici ? '⚠️ Kayıtlı bir <strong>yönetici</strong> yok. KMK m.34: 8 veya daha fazla bağımsız bölümü olan yapılarda yönetici atanması zorunludur.<br>' : ''}
      ${!hasDenetci ? '⚠️ Kayıtlı bir <strong>denetçi</strong> yok (KMK m.41).<br>' : ''}
      ${auditOverdue ? '⚠️ Son denetimin üzerinden 3 aydan fazla geçmiş. KMK m.41: yönetim planında süre yoksa denetim <strong>3 ayda bir</strong> yapılır.' : ''}
    </div>` : ''}

    <div class="card">
      <h3>Yönetim ve Denetim Kurulu</h3>
      <table><thead><tr><th>Ad Soyad</th><th>Görev</th><th>Daire</th><th>İletişim</th><th>Görev Süresi</th><th>Durum</th><th></th></tr></thead>
      <tbody id="board-body">${members.length ? members.map(m => `<tr>
        <td><strong>${C.esc(m.person_name)}</strong></td>
        <td>${BOARD_ROLES[m.role] || m.role}</td>
        <td>${C.esc(m.apartment_no || '—')}</td>
        <td>${C.esc(m.phone || m.email || '—')}</td>
        <td>${C.dmy(m.term_start)} → ${m.term_end ? C.dmy(m.term_end) : 'devam ediyor'}</td>
        <td>${m.is_active ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-gray">Görevi bitti</span>'}</td>
        <td class="t-right">
          <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${m.id}">Düzenle</button>
          <button class="btn btn-sm btn-outline-red" data-act="del" data-id="${m.id}">Sil</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="7" class="t-empty"><strong>Henüz kurul üyesi yok.</strong><br>
        Yönetici ve denetçiyi <strong>+ Kurul Üyesi</strong> ile kaydedin; kurul belgesi ve ihtarnameler bu isimleri kullanır.</td></tr>`}</tbody></table>
    </div>

    <div class="card">
      <h3>Denetim Raporları</h3>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 12px;">KMK m.41 — Kat malikleri kurulu yöneticinin işlerini denetler.
      Yönetim planında süre belirtilmemişse hesap denetimi <strong>üç ayda bir</strong> yapılır.</p>
      <div id="audit-list">${audits.length ? audits.map(a => `
        <div class="decision-card" style="margin-bottom:12px;">
          <div class="decision-top">
            <div class="decision-head">
              <h3>${C.dmy(a.period_start)} — ${C.dmy(a.period_end)} dönemi</h3>
              <div class="muted" style="font-size:12.5px;">Denetçi: ${C.esc(a.auditor_name || '—')}</div>
            </div>
            <div class="decision-actions">
              ${AUDIT_RESULTS[a.result] || ''}
              <button class="btn btn-sm" data-audit-belge="${a.id}">📄 Belge</button>
              <button class="btn btn-sm btn-outline-red" data-audit-del="${a.id}">Sil</button>
            </div>
          </div>
          ${a.findings ? `<div class="decision-body rich-content">${a.findings}</div>` : ''}
        </div>`).join('') : `<div class="t-empty"><strong>Henüz denetim raporu yok.</strong><br>
          Geçmiş bir denetiminiz varsa sağ üstteki <strong>+ Denetim Raporu</strong> ile tarihini işleyin;
          sistem bir daha "denetim yapılmamış" diye uyarmaz.</div>`}</div>
    </div>`;

  C.el('board-belge').onclick = (e) => belgeButonu(e.currentTarget, () => belgeUret({
    tur: 'kurul_belgesi', modul: 'board', kategori: 'tutanak',
    baslik: 'Yönetim ve Denetim Kurulu Görev Belgesi',
    donem: `${C.dmy(new Date())} itibarıyla`,
    dosyaAdi: `kurul-belgesi-${C.todayISO()}`,
    ozet: [
      { etiket: 'Aktif Üye', deger: String(active.length) },
      { etiket: 'Yönetici', deger: hasYonetici ? 'Atanmış' : 'Yok', renk: hasYonetici ? 'yesil' : 'kirmizi' },
      { etiket: 'Denetçi', deger: hasDenetci ? 'Atanmış' : 'Yok', renk: hasDenetci ? 'yesil' : 'kirmizi' },
    ],
    bolumler: [
      { tip: 'tablo', baslik: 'Görevli Kurul Üyeleri',
        kolonlar: [
          { baslik: 'Ad Soyad' }, { baslik: 'Görev', genislik: 40 },
          { baslik: 'Daire', genislik: 18 }, { baslik: 'Görev Süresi', genislik: 46 },
        ],
        satirlar: members.map(m => [
          m.person_name, BOARD_ROLES[m.role] || m.role, m.apartment_no || '—',
          `${C.dmy(m.term_start)} → ${m.term_end ? C.dmy(m.term_end) : 'devam ediyor'}${m.is_active ? '' : ' (sona erdi)'}`,
        ]) },
      { tip: 'kutu', baslik: 'Yasal dayanak — KMK m.34 ve m.41',
        icerik: 'Kat malikleri, ana gayrimenkulün yönetimini kendi aralarından veya dışarıdan seçecekleri bir kimseye '
          + 'veya üç kişilik bir kurula verebilirler. Sekiz veya daha fazla bağımsız bölümü olan ana gayrimenkullerde '
          + 'yönetici atanması mecburidir. Yöneticinin hesapları, kat malikleri kurulunca veya seçilecek denetçi '
          + 'tarafından denetlenir.' },
    ],
    imzalar: YONETICI_IMZA,
  }));

  C.el('board-add').onclick = () => openBoardModal(null);
  C.el('audit-add').onclick = () => openAuditModal();

  C.el('board-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const rec = members.find(x => x.id === b.dataset.id); if (!rec) return;
    if (b.dataset.act === 'edit') return openBoardModal(rec);
    if (!confirm('Kayıt silinsin mi?')) return;
    const { error } = await C.supabase.from('management_board').delete().eq('id', rec.id);
    if (error) return C.toast(error.message, true);
    C.toast('Silindi'); renderBoard();
  });

  C.el('audit-list').addEventListener('click', async (e) => {
    const bl = e.target.closest('[data-audit-belge]');
    if (bl) {
      const a = audits.find(x => x.id === bl.dataset.auditBelge); if (!a) return;
      return belgeButonu(bl, () => belgeUret({
        tur: 'denetim_raporu', modul: 'board', kategori: 'rapor',
        baslik: 'Denetim Raporu',
        altBaslik: `${C.dmy(a.period_start)} – ${C.dmy(a.period_end)} dönemi`,
        donem: `${C.dmy(a.period_start)} – ${C.dmy(a.period_end)}`,
        dosyaAdi: `denetim-raporu-${String(a.period_end).slice(0, 10)}`,
        iliskiliId: a.id,
        bolumler: [
          { tip: 'kv', baslik: 'Denetim Bilgileri', satirlar: [
            ['Denetim dönemi', `${C.dmy(a.period_start)} – ${C.dmy(a.period_end)}`],
            ['Denetçi', a.auditor_name || '—'],
            ['Sonuç', a.result || '—'],
          ] },
          { tip: 'kutu', baslik: 'Yasal dayanak — KMK m.41',
            icerik: 'Kat malikleri kurulu, yöneticinin bu görevdeki tutumunu her zaman denetleyebilir ve haklı bir '
              + 'sebebin çıkması hâlinde onu her zaman değiştirebilir. Hesapların denetlenmesi için yönetim planında '
              + 'belli bir zaman konulmamışsa, bu denetim her üç ayda bir yapılır.' },
          a.findings && { tip: 'metin', baslik: 'Denetim Bulguları', icerik: htmlDuzMetin(a.findings) },
        ].filter(Boolean),
        imzalar: [{ unvan: 'Denetçi', ad: a.auditor_name || '' }, { unvan: 'Yönetici' }],
      }));
    }

    const b = e.target.closest('[data-audit-del]'); if (!b) return;
    if (!confirm('Denetim raporu silinsin mi?')) return;
    const { error } = await C.supabase.from('audit_reports').delete().eq('id', b.dataset.auditDel);
    if (error) return C.toast(error.message, true);
    C.toast('Silindi'); renderBoard();
  });
}

function openBoardModal(rec) {
  const isEdit = !!rec;
  C.openModal(isEdit ? 'Kurul Üyesini Düzenle' : 'Kurul Üyesi Ekle', `
    <div class="field"><label>Ad Soyad *</label>
      <input id="b-name" value="${isEdit ? C.esc(rec.person_name) : ''}" /></div>
    <div class="grid-2">
      <div class="field"><label>Görev *</label>
        <select id="b-role">${Object.entries(BOARD_ROLES).map(([v, l]) =>
          `<option value="${v}" ${isEdit && rec.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Daire No</label>
        <input id="b-apt" value="${isEdit ? C.esc(rec.apartment_no || '') : ''}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Telefon</label><input id="b-phone" value="${isEdit ? C.esc(rec.phone || '') : ''}" /></div>
      <div class="field"><label>E-posta</label><input id="b-mail" value="${isEdit ? C.esc(rec.email || '') : ''}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Göreve Başlangıç *</label>
        <input id="b-start" type="date" value="${isEdit ? C.esc(rec.term_start) : C.todayISO()}" /></div>
      <div class="field"><label>Görev Bitişi</label>
        <input id="b-end" type="date" value="${isEdit ? C.esc(rec.term_end || '') : ''}" /></div>
    </div>
    <label class="check-row"><input type="checkbox" id="b-active" ${!isEdit || rec.is_active ? 'checked' : ''}> Görevi aktif olarak devam ediyor</label>
    <button class="btn btn-block" id="m-save">${isEdit ? 'Kaydet' : 'Ekle'}</button>
  `, async () => {
    const name = C.el('b-name').value.trim();
    const start = C.el('b-start').value;
    if (!name || !start) throw new Error('Ad soyad ve başlangıç tarihi zorunludur.');
    const payload = {
      person_name: name, role: C.el('b-role').value,
      apartment_no: C.el('b-apt').value.trim() || null,
      phone: C.el('b-phone').value.trim() || null,
      email: C.el('b-mail').value.trim() || null,
      term_start: start, term_end: C.el('b-end').value || null,
      is_active: C.el('b-active').checked,
    };
    const { error } = isEdit
      ? await C.supabase.from('management_board').update(payload).eq('id', rec.id)
      : await C.supabase.from('management_board').insert({ site_id: C.sId(), ...payload });
    if (error) throw new Error(error.message);
    C.toast(isEdit ? 'Güncellendi' : 'Eklendi');
  });
}

function openAuditModal() {
  const today = C.todayISO();
  C.openModal('Denetim Raporu', `
    <div class="grid-2">
      <div class="field"><label>Dönem Başlangıcı *</label><input id="a-start" type="date" value="${addMonths(today, -3)}" /></div>
      <div class="field"><label>Dönem Bitişi *</label><input id="a-end" type="date" value="${today}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Denetçi</label><input id="a-who" placeholder="Denetçinin adı" /></div>
      <div class="field"><label>Sonuç</label>
        <select id="a-res"><option value="uygun">Uygun</option><option value="uyari">Uyarı</option><option value="aykirilik">Aykırılık</option></select></div>
    </div>
    <div class="field"><label>Tespitler *</label>${C.richEditorHTML('a-find', '')}</div>
    <div class="field"><label>Belge Bağlantısı</label><input id="a-url" placeholder="İmzalı rapor bağlantısı" /></div>
    <button class="btn btn-block" id="m-save">Raporu Kaydet</button>
  `, async () => {
    const s = C.el('a-start').value, e = C.el('a-end').value;
    const findings = C.richValue('a-find');
    if (!s || !e || !findings) throw new Error('Dönem ve tespitler zorunludur.');
    const { error } = await C.supabase.from('audit_reports').insert({
      site_id: C.sId(), period_start: s, period_end: e,
      auditor_name: C.el('a-who').value.trim() || null,
      result: C.el('a-res').value, findings,
      document_url: C.el('a-url').value.trim() || null,
    });
    if (error) throw new Error(error.message);
    C.toast('Denetim raporu kaydedildi');
  });
  C.bindRichEditor('a-find');
}

/* ============================================================
   4) GENEL KURUL (hazirun + yeter sayı + tutanak)
   ============================================================ */
export async function renderAssembly() {
  if (!C.needBuilding()) return;
  const { data, error } = await C.supabase
    .from('meetings').select('*').in('building_id', C.siteBIds())
    .order('meeting_date', { ascending: false });
  if (error) { C.$content().innerHTML = `<div class="error">${C.esc(error.message)}</div>`; return; }
  const list = data || [];

  const KIND = { olagan: 'Olağan Genel Kurul', olaganustu: 'Olağanüstü Genel Kurul', bilgilendirme: 'Bilgilendirme Toplantısı' };
  const MON = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  C.$content().innerHTML = `
    <div class="page-head"><h2>Genel Kurul</h2>
      <div class="tools"><button class="btn" id="gk-add">+ Toplantı Oluştur</button></div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      KMK m.29 — Olağan toplantı yılda bir, yönetim planında belirtilen ayda yapılır.
      KMK m.30 — Toplantı yeter sayısı: kat maliklerinin <strong>yarıdan fazlası</strong>.
      İlk toplantıda yeter sayı sağlanamazsa ikinci toplantı, katılanların salt çoğunluğuyla karar alır.
    </p>
    <div class="decision-list" id="gk-list">
      ${list.length ? list.map(m => `
        <article class="decision-card">
          <div class="decision-top">
            <div class="decision-date">
              <span class="dd-day">${new Date(m.meeting_date).getDate()}</span>
              <span class="dd-mon">${MON[new Date(m.meeting_date).getMonth()]}</span>
              <span class="dd-year">${new Date(m.meeting_date).getFullYear()}</span>
            </div>
            <div class="decision-head">
              <h3>${C.esc(m.title)}</h3>
              <div class="muted" style="font-size:12.5px;">
                ${KIND[m.meeting_kind] || 'Toplantı'}${m.is_second_call ? ' · 2. toplantı' : ''}
                ${m.location ? ` · ${C.esc(m.location)}` : ''}
              </div>
            </div>
            <div class="decision-actions">
              <button class="btn btn-sm btn-ghost" data-act="hazirun" data-id="${m.id}">Hazirun</button>
              <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${m.id}">Düzenle</button>
              <button class="btn btn-sm" data-act="cagri" data-id="${m.id}">📄 Çağrı</button>
              ${m.minutes ? `<button class="btn btn-sm" data-act="tutanak" data-id="${m.id}">📄 Tutanak</button>` : ''}
              ${m.announced_at
                ? `<span class="badge b-green" title="${C.dmyhm(m.announced_at)}">Duyuruldu</span>`
                : `<button class="btn btn-sm btn-ghost" data-act="duyur" data-id="${m.id}">📢 Sakinlere Duyur</button>`}
              ${m.minutes ? `<button class="btn btn-sm btn-ghost" data-act="karar" data-id="${m.id}">📜 Karar Defterine İşle</button>` : ''}
            </div>
          </div>
          ${m.agenda ? `<div class="decision-body"><strong style="font-size:13px;">Gündem</strong>
            <div class="rich-content" style="margin-top:6px;">${m.agenda}</div></div>` : ''}
        </article>`).join('')
        : `<div class="card decision-empty"><div style="font-size:38px;">📅</div>
           <h3 style="margin:10px 0 6px;">Henüz toplantı yok</h3>
           <p class="muted" style="font-size:13.5px;">İlk genel kurulunuzu oluşturarak gündem ve hazirun cetveli hazırlayın.</p></div>`}
    </div>`;

  C.el('gk-add').onclick = () => openMeetingModal(null);
  C.el('gk-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const rec = list.find(x => x.id === b.dataset.id); if (!rec) return;
    const act = b.dataset.act;

    if (act === 'edit') return openMeetingModal(rec);
    if (act === 'hazirun') return openAttendance(rec);
    if (act === 'cagri') return belgeButonu(b, () => toplantiCagrisiBelgesi(rec));
    if (act === 'tutanak') return belgeButonu(b, () => tutanakBelgesi(rec));
    if (act === 'duyur') return toplantiyiDuyur(rec, b);
    if (act === 'karar') return tutanagiKararDefterineIsle(rec, b);
  });
}

/* Toplantı çağrısı — KMK m.29'a göre gündemi ve yeri bildiren, kat maliklerine
   önceden ulaştırılması gereken yazı. */
async function toplantiCagrisiBelgesi(m) {
  const KIND = { olagan: 'Olağan Genel Kurul', olaganustu: 'Olağanüstü Genel Kurul', bilgilendirme: 'Bilgilendirme Toplantısı' };
  return belgeUret({
    tur: 'toplanti_cagrisi', modul: 'assembly', kategori: 'tutanak',
    baslik: 'Genel Kurul Toplantı Çağrısı',
    altBaslik: m.title,
    donem: C.dmyhm(m.meeting_date),
    dosyaAdi: `toplanti-cagrisi-${String(m.meeting_date).slice(0, 10)}`,
    iliskiliId: m.id, binaId: m.building_id,
    bolumler: [
      { tip: 'kv', baslik: 'Toplantı Bilgileri', satirlar: [
        ['Toplantı türü', KIND[m.meeting_kind] || 'Toplantı'],
        ['Tarih ve saat', C.dmyhm(m.meeting_date)],
        ['Yer', m.location || '—'],
        ['Çağrı sırası', m.is_second_call ? 'İkinci toplantı' : 'İlk toplantı'],
      ] },
      { tip: 'metin', icerik:
        `Sayın Kat Maliki, sitemizin ${KIND[m.meeting_kind] || 'toplantısı'} yukarıda belirtilen tarih, saat ve `
        + 'yerde yapılacaktır. Toplantıya katılımınızı, katılamamanız hâlinde vekâletname ile temsilci '
        + 'göndermenizi rica ederiz.' },
      m.agenda && { tip: 'metin', baslik: 'Gündem', icerik: htmlDuzMetin(m.agenda) },
      { tip: 'kutu', baslik: 'Toplantı ve karar yeter sayısı — KMK m.30',
        icerik: m.is_second_call
          ? 'İlk toplantıda yeter sayı sağlanamadığından işbu ikinci toplantı yapılmaktadır. İkinci toplantıda '
            + 'yeter sayı aranmaz; kararlar, toplantıya katılan kat maliklerinin salt çoğunluğuyla alınır.'
          : 'Kat malikleri kurulu, kat maliklerinin yarıdan fazlasıyla toplanır ve '
            + 'oy çokluğuyla karar verir. İlk toplantıda yeter sayı sağlanamazsa ikinci toplantı, en geç on beş gün '
            + 'sonra yapılır ve katılanların salt çoğunluğuyla karar alınır.' },
    ].filter(Boolean),
    imzalar: [{ unvan: 'Site Yönetimi' }],
  });
}

/* Tutanak — toplantıda alınan kararların resmî kaydı; hazirun cetveli
   üzerinden yeter sayı bilgisi de belgeye işlenir. */
async function tutanakBelgesi(m) {
  const [aptRes, attRes] = await Promise.all([
    C.supabase.from('apartments').select('id, apartment_number, owner_name, user_id, username').in('building_id', C.siteBIds()),
    C.supabase.from('meeting_attendance').select('*').eq('meeting_id', m.id),
  ]);
  const apts = C.occupiedOnly(C.sortByApartment(aptRes.data));
  const katilim = (attRes.data || []).filter(a => a.attended);
  // Yeter sayı daire sayısına göre hesaplanır. Arsa payı kaldırıldı: hedef
  // kitle küçük binalar, daireler pratikte eşit.
  const toplamPay = apts.length;
  const katilanPay = katilim.length;
  const yeterli = m.is_second_call
    || (apts.length > 0 && katilim.length > apts.length / 2
        && (toplamPay > 0 ? katilanPay > toplamPay / 2 : true));

  return belgeUret({
    tur: 'toplanti_tutanagi', modul: 'assembly', kategori: 'tutanak',
    baslik: 'Genel Kurul Toplantı Tutanağı',
    altBaslik: m.title,
    donem: C.dmyhm(m.meeting_date),
    dosyaAdi: `tutanak-${String(m.meeting_date).slice(0, 10)}`,
    iliskiliId: m.id, binaId: m.building_id,
    ozet: [
      { etiket: 'Toplam Daire', deger: String(apts.length) },
      { etiket: 'Katılan', deger: String(katilim.length) },
      { etiket: 'Yeter Sayı Oranı', deger: toplamPay > 0 ? `${katilanPay} / ${toplamPay} daire` : '—' },
      { etiket: 'Yeter Sayı', deger: yeterli ? 'Sağlandı' : 'Sağlanamadı', renk: yeterli ? 'yesil' : 'kirmizi' },
    ],
    bolumler: [
      { tip: 'kv', baslik: 'Toplantı Bilgileri', satirlar: [
        ['Tarih ve saat', C.dmyhm(m.meeting_date)],
        ['Yer', m.location || '—'],
        ['Çağrı sırası', m.is_second_call ? 'İkinci toplantı' : 'İlk toplantı'],
      ] },
      m.agenda && { tip: 'metin', baslik: 'Gündem', icerik: htmlDuzMetin(m.agenda) },
      { tip: 'metin', baslik: 'Alınan Kararlar', icerik: htmlDuzMetin(m.minutes) || 'Tutanak metni girilmemiştir.' },
      katilim.length && { tip: 'tablo', baslik: 'Hazirun (Katılanlar)',
        kolonlar: [
          { baslik: 'Daire', genislik: 20 }, { baslik: 'Kat Maliki' },
          { baslik: 'Vekâleten', genislik: 40 },
        ],
        satirlar: katilim.map(a => [a.apartment_no, a.owner_name || '—',
          a.proxy_name || '—']) },
      !yeterli && { tip: 'kutu', renk: 'kirmizi', baslik: 'Yeter sayı sağlanamadı',
        icerik: 'KMK m.30 uyarınca ilk toplantıda kat maliklerinin yarıdan fazlasının '
          + 'katılımı aranır. Yeter sayı sağlanamadığından ikinci toplantı çağrısı yapılmalıdır.' },
    ].filter(Boolean),
    imzalar: ['Divan Başkanı', 'Kâtip Üye', 'Yönetici'],
  });
}

/* Toplantıyı sakinlerin sohbet akışına duyurur. Bu özellik eskiden hiçbir
   menüden erişilemeyen ölü "Toplantılar" ekranındaydı; Genel Kurul'a taşındı. */
async function toplantiyiDuyur(m, btn) {
  if (!confirm('Toplantı, sakinlerin sohbet akışına duyurulacak ve bildirim gönderilecek. Onaylıyor musunuz?')) return;
  btn.disabled = true;
  try {
    const adminName = `${C.S.profile?.name || ''} ${C.S.profile?.surname || ''}`.trim() || 'Yönetici';
    const mesaj = `\u{1F4C5} ${C.dmyhm(m.meeting_date)}\n`
      + (m.location ? `\u{1F4CD} ${m.location}\n` : '')
      + (m.agenda ? `\nGündem:\n${htmlDuzMetin(m.agenda)}` : '');
    const { error } = await C.supabase.from('help_requests').insert({
      building_id: C.bId(), sender_id: C.S.user.id, sender_name: adminName, sender_type: 'admin',
      title: `\u{1F4C5} ${m.title}`, message: mesaj, priority: 'medium',
      duration_minutes: 10080, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active', is_auto_generated: true, type: 'standard',
    });
    if (error) throw new Error(error.message);
    await C.supabase.from('meetings').update({ announced_at: new Date().toISOString() }).eq('id', m.id);
    if (C.notifyBuilding) C.notifyBuilding('\u{1F4C5} Genel Kurul', `${m.title} — ${C.dmyhm(m.meeting_date)}`);
    C.toast('Toplantı sakinlere duyuruldu');
    renderAssembly();
  } catch (err) { C.toast(err.message, true); btn.disabled = false; }
}

/* Tutanaktaki kararları Karar Defteri'ne aktarır. İki ekran aynı kararı ayrı
   ayrı tutuyordu; artık tutanak kaynak, karar defteri kaydı ona bağlanıyor. */
async function tutanagiKararDefterineIsle(m, btn) {
  const { data: mevcut } = await C.supabase.from('building_decisions')
    .select('id').eq('meeting_id', m.id).maybeSingle();
  if (mevcut) return C.toast('Bu toplantının kararı zaten karar defterinde kayıtlı', true);
  if (!confirm('Toplantı tutanağı Karar Defteri\u2019ne yeni bir karar kaydı olarak işlenecek. Devam edilsin mi?')) return;

  btn.disabled = true;
  try {
    const { error } = await C.supabase.from('building_decisions').insert({
      building_id: m.building_id || C.bId(),
      meeting_id: m.id,
      title: m.title,
      description: m.minutes,
      decision_date: String(m.meeting_date).slice(0, 10),
      created_by: C.S.user.id,
    });
    if (error) throw new Error(error.message);
    C.toast('Karar defterine işlendi');
    C.navigate('decisions');
  } catch (err) { C.toast(err.message, true); btn.disabled = false; }
}

function openMeetingModal(rec) {
  const isEdit = !!rec;
  const dt = isEdit ? new Date(rec.meeting_date).toISOString().slice(0, 16) : '';
  C.openModal(isEdit ? 'Toplantıyı Düzenle' : 'Genel Kurul Oluştur', `
    <div class="field"><label>Başlık *</label>
      <input id="gk-title" placeholder="Örn: 2026 Olağan Genel Kurul" value="${isEdit ? C.esc(rec.title) : ''}" /></div>
    <div class="grid-2">
      <div class="field"><label>Tür</label>
        <select id="gk-kind">
          <option value="olagan" ${isEdit && rec.meeting_kind === 'olagan' ? 'selected' : ''}>Olağan Genel Kurul</option>
          <option value="olaganustu" ${isEdit && rec.meeting_kind === 'olaganustu' ? 'selected' : ''}>Olağanüstü Genel Kurul</option>
          <option value="bilgilendirme" ${isEdit && rec.meeting_kind === 'bilgilendirme' ? 'selected' : ''}>Bilgilendirme</option>
        </select></div>
      <div class="field"><label>Tarih ve Saat *</label>
        <input id="gk-date" type="datetime-local" value="${dt}" /></div>
    </div>
    <div class="field"><label>Yer</label>
      <input id="gk-loc" placeholder="Örn: Site sosyal tesisi" value="${isEdit ? C.esc(rec.location || '') : ''}" /></div>
    <label class="check-row"><input type="checkbox" id="gk-second" ${isEdit && rec.is_second_call ? 'checked' : ''}>
      Bu bir <strong>ikinci toplantı</strong> (ilk toplantıda yeter sayı sağlanamadı)</label>
    <div class="field"><label>Gündem</label>${C.richEditorHTML('gk-agenda', isEdit ? rec.agenda || '' : '')}</div>
    <div class="field"><label>Tutanak (toplantıdan sonra)</label>${C.richEditorHTML('gk-min', isEdit ? rec.minutes || '' : '')}</div>
    <button class="btn btn-block" id="m-save">${isEdit ? 'Kaydet' : 'Oluştur'}</button>
  `, async () => {
    const title = C.el('gk-title').value.trim();
    const date = C.el('gk-date').value;
    if (!title || !date) throw new Error('Başlık ve tarih zorunludur.');
    const payload = {
      title, meeting_date: new Date(date).toISOString(),
      meeting_kind: C.el('gk-kind').value,
      location: C.el('gk-loc').value.trim() || null,
      is_second_call: C.el('gk-second').checked,
      agenda: C.richValue('gk-agenda') || null,
      minutes: C.richValue('gk-min') || null,
    };
    const { error } = isEdit
      ? await C.supabase.from('meetings').update(payload).eq('id', rec.id)
      : await C.supabase.from('meetings').insert({ building_id: C.bId(), site_id: C.sId(), admin_id: C.S.user.id, ...payload });
    if (error) throw new Error(error.message);
    C.toast(isEdit ? 'Güncellendi' : 'Toplantı oluşturuldu');
  });
  C.bindRichEditor('gk-agenda');
  C.bindRichEditor('gk-min');
}

/** Hazirun cetveli: daireleri çeker, katılım ve vekaleti işaretler, yeter sayıyı hesaplar. */
async function openAttendance(meeting) {
  const [aptRes, attRes] = await Promise.all([
    C.supabase.from('apartments').select('id, apartment_number, owner_name, user_id, username').in('building_id', C.siteBIds()),
    C.supabase.from('meeting_attendance').select('*').eq('meeting_id', meeting.id),
  ]);
  if (attRes.error && /does not exist|schema cache/i.test(attRes.error.message || '')) {
    return C.toast("Hazirun tablosu yok — 0020 migration'ını uygulayın", true);
  }

  const apts = C.occupiedOnly(C.sortByApartment(aptRes.data));
  const byNo = new Map((attRes.data || []).map(a => [a.apartment_no, a]));

  const rows = apts.map(a => {
    const rec = byNo.get(a.apartment_number);
    return `<tr>
      <td><strong>${C.esc(a.apartment_number)}</strong></td>
      <td>${C.esc(a.owner_name || '—')}</td>

      <td><label class="pay-check"><input type="checkbox" data-apt="${C.esc(a.apartment_number)}" ${rec?.attended ? 'checked' : ''}><span>Katıldı</span></label></td>
      <td><input data-proxy="${C.esc(a.apartment_number)}" placeholder="Vekil (varsa)" value="${C.esc(rec?.proxy_name || '')}" style="width:100%;padding:7px 10px;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:13px;" /></td>
    </tr>`;
  }).join('');

  C.openModal(`Hazirun Cetveli — ${meeting.title}`, `
    <div id="quorum-box" class="info-banner" style="margin:0 0 14px;"></div>
    <div style="max-height:52vh;overflow-y:auto;">
      <table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th>Katılım</th><th>Vekalet</th></tr></thead>
      <tbody id="haz-body">${rows || '<tr><td colspan="5" class="t-empty">Daire kaydı yok</td></tr>'}</tbody></table>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn" id="m-save" style="flex:1">Hazirun Cetvelini Kaydet</button>
      <button class="btn btn-ghost" id="haz-belge" type="button">📄 Cetveli Belgele</button>
    </div>
  `, async () => {
    const rowsOut = apts.map(a => {
      const box = document.querySelector(`input[data-apt="${CSS.escape(a.apartment_number)}"]`);
      const proxy = document.querySelector(`input[data-proxy="${CSS.escape(a.apartment_number)}"]`);
      return {
        meeting_id: meeting.id, apartment_id: a.id, apartment_no: a.apartment_number,
        owner_name: a.owner_name || null,
        attended: !!box?.checked, proxy_name: proxy?.value.trim() || null,
      };
    });
    const { error } = await C.supabase.from('meeting_attendance')
      .upsert(rowsOut, { onConflict: 'meeting_id,apartment_no' });
    if (error) throw new Error(error.message);
    C.toast('Hazirun cetveli kaydedildi');
  });

  // KMK m.30 yeter sayısı: daire sayısı bakımından yarıdan fazla
  const updateQuorum = () => {
    const total = apts.length;
    let cnt = 0;
    apts.forEach(a => {
      const box = document.querySelector(`input[data-apt="${CSS.escape(a.apartment_number)}"]`);
      if (box?.checked) cnt++;
    });
    const ok = total > 0 && cnt > total / 2;
    const box = C.el('quorum-box');
    if (!box) return;
    box.innerHTML = meeting.is_second_call
      ? `<strong>İkinci toplantı</strong> — Katılım: ${cnt}/${total} daire.
         KMK m.30: ikinci toplantıda yeter sayı aranmaz, katılanların salt çoğunluğuyla karar alınır.`
      : `${ok ? '✅ <strong>Yeter sayı sağlandı</strong>' : '⚠️ <strong>Yeter sayı sağlanamadı</strong>'} —
         Katılım: ${cnt}/${total} daire.
         ${!ok ? 'İkinci toplantı çağrısı yapılabilir.' : ''}`;
  };
  const host = C.el('haz-body');
  if (host) { host.addEventListener('change', updateQuorum); updateQuorum(); }

  /* Cetveli belgeye dökerken ekrandaki işaretlerin son hâli kullanılır;
     böylece kaydetmeden önce de çıktı alınabilir. */
  const hazBtn = C.el('haz-belge');
  if (hazBtn) hazBtn.onclick = () => belgeButonu(hazBtn, () => {
    const satirlar = apts.map(a => {
      const box = document.querySelector(`input[data-apt="${CSS.escape(a.apartment_number)}"]`);
      const proxy = document.querySelector(`input[data-proxy="${CSS.escape(a.apartment_number)}"]`);
      return [a.apartment_number, a.owner_name || '—',
        box?.checked ? 'Katıldı' : 'Katılmadı',
        proxy?.value.trim() || '—'];
    });
    const katilan = satirlar.filter(r => r[2] === 'Katıldı').length;
    // Yeter sayı daire sayısına göre: arsa payı kaldırıldı.
    const yeterli = meeting.is_second_call || (apts.length > 0 && katilan > apts.length / 2);

    return belgeUret({
      tur: 'hazirun_cetveli', modul: 'assembly', kategori: 'tutanak',
      baslik: 'Hazirun Cetveli',
      altBaslik: meeting.title,
      donem: C.dmyhm(meeting.meeting_date),
      dosyaAdi: `hazirun-${String(meeting.meeting_date).slice(0, 10)}`,
      iliskiliId: meeting.id, binaId: meeting.building_id,
      ozet: [
        { etiket: 'Toplam Daire', deger: String(apts.length) },
        { etiket: 'Katılan', deger: String(katilan) },
        { etiket: 'Yeter Sayı', deger: yeterli ? 'Sağlandı' : 'Sağlanamadı', renk: yeterli ? 'yesil' : 'kirmizi' },
      ],
      bolumler: [
        { tip: 'tablo', baslik: 'Katılım Listesi',
          kolonlar: [
            { baslik: 'Daire', genislik: 20 }, { baslik: 'Kat Maliki' },
            { baslik: 'Katılım', genislik: 26 }, { baslik: 'Vekâleten', genislik: 36 },
          ],
          satirlar,
          not: 'İmza sütunu için bu cetvel çıktı alınarak toplantıda kat maliklerine imzalatılır.' },
        { tip: 'kutu', baslik: 'Yeter sayı — KMK m.30',
          icerik: meeting.is_second_call
            ? 'İkinci toplantıda yeter sayı aranmaz; kararlar katılanların salt çoğunluğuyla alınır.'
            : 'Kat malikleri kurulu, kat maliklerinin yarıdan fazlasıyla toplanır.' },
      ],
      imzalar: ['Divan Başkanı', 'Kâtip Üye', 'Yönetici'],
    });
  });
}

/* ============================================================
   5) BORÇ TAKİBİ — borç = vadesi geçmiş ödenmemiş aidat
   ============================================================ */
const DEBT_STAGES = {
  reminder: '<span class="badge b-gray">Hatırlatma</span>',
  ihtar: '<span class="badge b-amber">İhtar</span>',
  icra: '<span class="badge b-red">İcra Takibi</span>',
  closed: '<span class="badge b-green">Kapandı</span>',
};
const STAGE_LABELS = { reminder: 'Hatırlatma', ihtar: 'İhtar', icra: 'İcra', closed: 'Kapandı' };

export async function renderDebts() {
  if (!needSite()) return;

  const [feeRes, aptRes, noticeRes] = await Promise.all([
    C.supabase.from('monthly_fees').select('*').in('building_id', C.siteBIds()).eq('is_paid', false),
    C.supabase.from('apartments').select('id, apartment_number, owner_name, building_id, user_id, username').in('building_id', C.siteBIds()),
    C.supabase.from('debt_notices').select('*').eq('site_id', C.sId()).order('created_at', { ascending: false }),
  ]);
  if (noticeRes.error && migrationUyarisi(noticeRes.error)) return;

  // Boş daireler borç listesine girmez
  const apts = C.occupiedOnly(C.sortByApartment(aptRes.data));
  const aptById = new Map(apts.map(a => [a.id, a]));
  const notices = noticeRes.data || [];

  // Borç = vadesi geçmiş ödenmemiş aidat. Vade ilgili ayın SON günüdür:
  // yönetici ay boyunca tahsilat yapar. Yıllık tahakkukta ileri aylar borç
  // sayılmaz. Gecikme tazminatı uygulanmıyor.
  const vadesiGecti = (y, m) => Date.now() >= new Date(y, m, 1).getTime();
  const debts = new Map();
  (feeRes.data || []).forEach(f => {
    const a = aptById.get(f.apartment_id); if (!a) return;
    const cur = debts.get(a.id) || { apt: a, principal: 0, late: 0, months: 0, future: 0 };
    if (!vadesiGecti(f.year, f.month)) { cur.future += 1; debts.set(a.id, cur); return; }
    cur.principal += Number(f.amount);
    cur.months += 1;
    debts.set(a.id, cur);
  });

  const list = [...debts.values()].filter(d => d.months > 0).sort((x, y) => y.principal - x.principal);
  const totalPrincipal = list.reduce((s, d) => s + d.principal, 0);

  C.$content().innerHTML = `
    <div class="page-head"><h2>Borç Takibi</h2>
      <div class="tools">
        <button class="btn btn-ghost" id="debt-csv">⬇ CSV İndir</button>
        <button class="btn" id="debt-belge">📄 Borç Raporu</button>
      </div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      Borç, <strong>vadesi geçmiş</strong> ödenmemiş aidatların toplamıdır. Vade ilgili ayın son günüdür;
      henüz vadesi gelmemiş tahakkuklar burada borç olarak gösterilmez.
    </p>

    <div class="stat-grid">
      <div class="stat"><div class="val">${list.length}</div><div class="lbl">Borçlu Daire</div></div>
      <div class="stat"><div class="val" style="color:${totalPrincipal ? 'var(--red)' : 'var(--green)'}">${C.TL(totalPrincipal)}</div><div class="lbl">Toplam Borç</div></div>
    </div>

    <div class="card">
      <h3>Borçlu Daireler</h3>
      <table><thead><tr><th>Daire</th><th>Sakinler</th><th class="t-right">Ay</th><th class="t-right">Toplam Borç</th><th></th></tr></thead>
      <tbody id="debt-body">${list.length ? list.map(d => `<tr>
        <td><strong>${C.esc(d.apt.apartment_number)}</strong>${C.blokRozeti(d.apt.building_id)}</td>
        <td>${C.esc(d.apt.owner_name || '—')}</td>
        <td class="t-right">${d.months}</td>
        <td class="t-right"><strong>${C.TL(d.principal)}</strong></td>
        <td class="t-right" style="white-space:nowrap">
          <button class="btn btn-sm btn-green" data-tahsil="${d.apt.id}">💰 Tahsilat</button>
          <button class="btn btn-sm btn-ghost" data-notice="${d.apt.id}">İhtar Kaydı Aç</button>
          <button class="btn btn-sm" data-ihtarname="${d.apt.id}">📄 İhtarname</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="5" class="t-empty">Vadesi geçmiş borç yok 🎉</td></tr>'}</tbody></table>
    </div>

    <div class="card">
      <h3>İhtar ve Takip Kayıtları</h3>
      <table><thead><tr><th>Daire</th><th>Kişi</th><th class="t-right">Tutar</th><th>Aşama</th><th>Tarih</th><th></th></tr></thead>
      <tbody id="notice-body">${notices.length ? notices.map(n => `<tr>
        <td><strong>${C.esc(n.apartment_no)}</strong></td>
        <td>${C.esc(n.owner_name || '—')}</td>
        <td class="t-right">${C.TL(Number(n.principal) + Number(n.late_fee))}</td>
        <td>${DEBT_STAGES[n.stage] || n.stage}</td>
        <td>${C.dmy(n.created_at)}</td>
        <td class="t-right">
          <select class="mini" data-stage="${n.id}">
            ${['reminder','ihtar','icra','closed'].map(s =>
              `<option value="${s}" ${n.stage===s?'selected':''}>${STAGE_LABELS[s]}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-outline-red" data-notice-del="${n.id}">Sil</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="6" class="t-empty">Henüz takip kaydı yok</td></tr>'}</tbody></table>
    </div>`;

  C.el('debt-belge').onclick = (e) => belgeButonu(e.currentTarget, () => belgeUret({
    tur: 'borc_raporu', modul: 'debts', kategori: 'rapor',
    baslik: 'Ortak Gider Borç Raporu',
    donem: `${C.dmy(new Date())} itibarıyla`,
    dosyaAdi: `borc-raporu-${C.todayISO()}`,
    ozet: [
      { etiket: 'Borçlu Daire', deger: String(list.length), renk: list.length ? 'kirmizi' : 'yesil' },
      { etiket: 'Toplam Borç', deger: para(totalPrincipal), renk: totalPrincipal ? 'kirmizi' : 'yesil' },
    ],
    bolumler: [{
      tip: 'tablo', baslik: 'Borçlu Daireler',
      kolonlar: [
        { baslik: 'Daire', genislik: 18 }, { baslik: 'Kat Maliki' },
        { baslik: 'Ay', hiza: 'center', genislik: 14 },
        { baslik: 'Toplam Borç', hiza: 'right', genislik: 30 },
      ],
      satirlar: list.map(d => [d.apt.apartment_number, d.apt.owner_name || '—', String(d.months),
        para(d.principal)]),
      toplamSatiri: ['TOPLAM', `${list.length} daire`, '', para(totalPrincipal)],
    }],
    imzalar: YONETICI_IMZA,
  }));

  C.el('debt-csv').onclick = () => {
    C.downloadCSV(`borc-listesi-${C.todayISO()}.csv`,
      ['Daire', 'Ev Sahibi', 'Ay Sayısı', 'Toplam Borç'],
      list.map(d => [d.apt.apartment_number, d.apt.owner_name || '', d.months,
        d.principal.toFixed(2)]));
    C.toast('İndirildi');
  };

  /* İhtarname — icra takibine dayanak olacak resmî yazı. Belge üretilirken
     takip kaydı yoksa açılır, varsa aşaması 'ihtar'a çekilir; böylece
     ekrandaki liste ile üretilen evrak birbirini tutar. */
  C.el('debt-body').addEventListener('click', async (e) => {
    const th = e.target.closest('[data-tahsil]');
    if (th) {
      const d = debts.get(th.dataset.tahsil); if (!d) return;
      return openTahsilatModal(d);
    }

    const ih = e.target.closest('[data-ihtarname]');
    if (ih) {
      const d = debts.get(ih.dataset.ihtarname); if (!d) return;
      return belgeButonu(ih, async () => {
        let kayit = notices.find(n => n.apartment_id === d.apt.id && n.stage !== 'closed');
        if (!kayit) {
          const { data, error } = await C.supabase.from('debt_notices').insert({
            site_id: C.sId(), building_id: d.apt.building_id, apartment_id: d.apt.id,
            apartment_no: d.apt.apartment_number, owner_name: d.apt.owner_name,
            principal: d.principal, late_fee: d.late, stage: 'ihtar',
            sent_at: new Date().toISOString(),
          }).select().single();
          if (error) throw new Error(error.message);
          kayit = data;
        } else if (kayit.stage === 'reminder') {
          await C.supabase.from('debt_notices')
            .update({ stage: 'ihtar', principal: d.principal, late_fee: d.late, sent_at: new Date().toISOString() })
            .eq('id', kayit.id);
        }

        const sonuc = await belgeUret({
          tur: 'ihtarname', modul: 'debts', kategori: 'ihtar',
          baslik: 'İhtarname',
          altBaslik: `Daire ${d.apt.apartment_number} — ${d.apt.owner_name || 'Kat Maliki'}`,
          donem: `${C.dmy(new Date())} itibarıyla`,
          dosyaAdi: `ihtarname-daire-${d.apt.apartment_number}`,
          iliskiliId: kayit.id, binaId: d.apt.building_id,
          ozet: [
            { etiket: 'Ödenmemiş Ay', deger: String(d.months) },
            { etiket: 'Toplam Borç', deger: para(d.principal), renk: 'kirmizi' },
          ],
          bolumler: [
            { tip: 'kv', baslik: 'Muhatap', satirlar: [
              ['Bağımsız bölüm', `Daire ${d.apt.apartment_number}`],
              ['Kat maliki / sakin', d.apt.owner_name || '—'],
            ] },
            { tip: 'metin', baslik: 'Konu', icerik:
              'Yukarıda bilgileri yazılı bağımsız bölüme ait ortak gider (aidat) borcunuz, işbu ihtarnamenin '
              + `düzenlendiği tarih itibarıyla ${d.months} aydır ödenmemiştir. Toplam borcunuz `
              + `${para(d.principal)} tutarındadır.` },
            { tip: 'kutu', renk: 'kirmizi', baslik: 'Yasal dayanak — KMK m.20',
              icerik: 'Ortak gider borcunun ödenmemesi hâlinde yönetici, kat malikleri kurulu kararına gerek '
                + 'olmaksızın icra takibi yapabilir ve dava açabilir. Ayrıca ödenmeyen ortak gider alacağı, '
                + 'bağımsız bölüm üzerinde kanuni ipotek hakkı doğurur.' },
            { tip: 'tablo', baslik: 'Borcun Dökümü',
              kolonlar: [{ baslik: 'Kalem' }, { baslik: 'Tutar', hiza: 'right', genislik: 44 }],
              satirlar: [
                ['Ödenmemiş aidat', para(d.principal)],
              ],
              toplamSatiri: ['GENEL TOPLAM', para(d.principal)] },
            { tip: 'metin', baslik: 'İhtar', icerik:
              'İşbu ihtarnamenin tarafınıza tebliğinden itibaren yedi (7) gün içinde yukarıda dökümü verilen borcun '
              + 'tamamının site yönetimi hesabına ödenmesini, aksi hâlde hakkınızda yasal yollara başvurulacağını, '
              + 'doğacak icra masrafları ve vekâlet ücretinin tarafınıza ait olacağını ihtaren bildiririz.' },
          ],
          imzalar: [{ unvan: 'Site Yönetimi' }],
        });
        renderDebts();
        return sonuc;
      });
    }

    const b = e.target.closest('[data-notice]'); if (!b) return;
    const d = debts.get(b.dataset.notice); if (!d) return;
    const { error } = await C.supabase.from('debt_notices').insert({
      site_id: C.sId(), building_id: d.apt.building_id, apartment_id: d.apt.id,
      apartment_no: d.apt.apartment_number, owner_name: d.apt.owner_name,
      principal: d.principal, late_fee: d.late,
    });
    if (error) return C.toast(error.message, true);
    C.toast('Takip kaydı açıldı'); renderDebts();
  });

  C.el('notice-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-stage]'); if (!sel) return;
    const { error } = await C.supabase.from('debt_notices')
      .update({ stage: sel.value, sent_at: new Date().toISOString() }).eq('id', sel.dataset.stage);
    if (error) return C.toast(error.message, true);
    C.toast('Aşama güncellendi'); renderDebts();
  });

  C.el('notice-body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-notice-del]'); if (!b) return;
    if (!confirm('Takip kaydı silinsin mi?')) return;
    const { error } = await C.supabase.from('debt_notices').delete().eq('id', b.dataset.noticeDel);
    if (error) return C.toast(error.message, true);
    C.toast('Silindi'); renderDebts();
  });
}

/* Borçlu dairenin ödenmemiş aylarını tek ekranda tahsil eder.
   Önceden bunun için Aidat Takibi'nde ay ay gezip tek tek işaretlemek
   gerekiyordu; iki ekran da aynı monthly_fees satırlarına bakıyor. */
async function openTahsilatModal(d) {
  const { data, error } = await C.supabase.from('monthly_fees').select('*')
    .eq('apartment_id', d.apt.id).eq('is_paid', false)
    .order('year').order('month');
  if (error) return C.toast(error.message, true);
  const aylar = data || [];
  if (!aylar.length) return C.toast('Bu daireye ait ödenmemiş aidat kaydı yok');

  C.openModal(`Tahsilat — ${C.daireEtiketi(d.apt.building_id, d.apt.apartment_number)}`, `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">
      ${C.esc(d.apt.owner_name || 'Kat maliki')} · Ödemesi alınan ayları işaretleyin.
      İşaretlenen tutar <strong>site kasasına gelir olarak</strong> işlenir${
        C.cokBloklu() ? ` ve <strong>${C.esc(C.blokAdi(d.apt.building_id))}</strong> defterine yazılır` : ''}.
    </p>
    <div style="max-height:44vh;overflow-y:auto;margin-bottom:14px;">
      <table><thead><tr><th></th><th>Dönem</th><th class="t-right">Tutar</th></tr></thead>
      <tbody id="th-body">${aylar.map(f => `<tr>
        <td style="width:34px"><input type="checkbox" data-fee="${f.id}" data-amt="${f.amount}" checked></td>
        <td>${C.MONTHS[f.month - 1]} ${f.year}</td>
        <td class="t-right">${para(f.amount)}</td>
      </tr>`).join('')}</tbody></table>
    </div>
    <div class="info-banner" id="th-ozet" style="margin:0 0 14px;"></div>
    <button class="btn btn-block" id="m-save">Tahsilatı Kaydet</button>
  `, async () => {
    const secili = [...document.querySelectorAll('#th-body input[data-fee]:checked')];
    if (!secili.length) throw new Error('En az bir dönem seçin.');
    const toplam = secili.reduce((t, c) => t + Number(c.dataset.amt), 0);

    for (const c of secili) {
      const { error: uErr } = await C.supabase.from('monthly_fees').update({
        is_paid: true, paid_by: C.S.user.id, paid_date: new Date().toISOString(),
      }).eq('id', c.dataset.fee);
      if (uErr) throw new Error(uErr.message);

      /* Para dairenin KENDİ bloğunun defterine yazılır; ekranda hangi blok
         seçili olduğunun önemi yok (mobildeki tahsilEt ile aynı kural). */
      await C.adjustBalance({
        amount: Number(c.dataset.amt), operation: 'add',
        description: `Aidat ödemesi - Daire ${d.apt.apartment_number}`,
        category: 'fee', walletType: 'bank', relatedId: c.dataset.fee,
        buildingId: d.apt.building_id, scope: 'building',
      });
    }

    // Borcun tamamı kapandıysa açık takip kaydını da kapat
    if (secili.length === aylar.length) {
      await C.supabase.from('debt_notices')
        .update({ stage: 'closed' })
        .eq('apartment_id', d.apt.id).neq('stage', 'closed');
    }

    // 0023: daireye ait bildirim dairenin TÜM sakinlerine gitmeli
    if (d.apt.id && C.notifyApartment) {
      C.notifyApartment(d.apt.id, '✅ Aidat Ödemesi Alındı',
        `${secili.length} aylık aidatınız (${para(toplam)}) ödendi olarak işaretlendi.`);
    }
    if (C.refreshBuilding) await C.refreshBuilding();
    C.toast(`${para(toplam)} tahsil edildi, kasaya eklendi`);
    renderDebts();
  });

  // Seçim değiştikçe toplam güncellensin
  const ozetle = () => {
    const secili = [...document.querySelectorAll('#th-body input[data-fee]:checked')];
    const toplam = secili.reduce((t, c) => t + Number(c.dataset.amt), 0);
    const kutu = C.el('th-ozet');
    if (kutu) kutu.innerHTML = `Seçilen: <strong>${secili.length} dönem</strong> · Tahsil edilecek: <strong>${para(toplam)}</strong>`
      + (secili.length === aylar.length ? ' — borç tamamen kapanacak' : '');
  };
  const host = C.el('th-body');
  if (host) { host.addEventListener('change', ozetle); ozetle(); }
}

/* ============================================================
   6) BELGELER & DEVİR TESLİM (+ sözleşmeler)
   ============================================================ */
const DOC_CATEGORIES = {
  yonetim_plani: 'Yönetim Planı', sigorta: 'Sigorta Poliçesi', ruhsat: 'Ruhsat',
  sozlesme: 'Sözleşme', tutanak: 'Tutanak', fatura: 'Fatura', rapor: 'Rapor', diger: 'Diğer',
};

export async function renderArchive() {
  if (!needSite()) return;
  const [docRes, conRes, hoRes] = await Promise.all([
    C.supabase.from('documents').select('*').eq('site_id', C.sId()).order('created_at', { ascending: false }),
    C.supabase.from('contracts').select('*').eq('site_id', C.sId()).order('end_date', { ascending: true }),
    C.supabase.from('handovers').select('*').eq('site_id', C.sId()).order('handover_date', { ascending: false }),
  ]);
  if (docRes.error && migrationUyarisi(docRes.error)) return;

  /* Panelin ürettiği belgeler ile yöneticinin elle yüklediklerini ayır;
     ikisi farklı iş akışı, aynı listede karışınca arşiv okunmaz oluyor. */
  const tumDocs = docRes.data || [];
  const uretilen = tumDocs.filter(d => d.generated);
  const docs = tumDocs.filter(d => !d.generated);
  const contracts = conRes.data || [];
  const handovers = hoRes.data || [];
  const expiringSoon = contracts.filter(c => c.is_active && c.end_date && daysUntil(c.end_date) <= 60);

  C.$content().innerHTML = `
    <div class="page-head"><h2>Belgeler & Devir</h2>
      <div class="tools">
        <button class="btn btn-ghost" id="ho-add">+ Devir Teslim</button>
        <button class="btn btn-ghost" id="con-add">+ Sözleşme</button>
        <button class="btn" id="doc-add">+ Belge</button>
      </div>
    </div>

    ${expiringSoon.length ? `<div class="info-banner" style="margin-bottom:18px;">
      ⏳ <strong>${expiringSoon.length} sözleşme</strong> 60 gün içinde bitiyor:
      ${expiringSoon.map(c => `${C.esc(c.vendor_name)} (${C.dmy(c.end_date)})`).join(', ')}
    </div>` : ''}

    <div class="card">
      <h3>Sözleşmeler</h3>
      <table><thead><tr><th>Firma</th><th>Hizmet</th><th>İletişim</th><th>Dönem</th><th class="t-right">Tutar</th><th></th></tr></thead>
      <tbody id="con-body">${contracts.length ? contracts.map(c => {
        const d = c.end_date ? daysUntil(c.end_date) : null;
        return `<tr>
          <td><strong>${C.esc(c.vendor_name)}</strong>${c.contact_person ? `<div class="muted" style="font-size:12px">${C.esc(c.contact_person)}</div>` : ''}</td>
          <td>${C.esc(c.service_type)}</td>
          <td>${C.esc(c.phone || c.email || '—')}</td>
          <td>${c.start_date ? C.dmy(c.start_date) : '—'} → ${c.end_date ? C.dmy(c.end_date) : '—'}
            ${d !== null && d <= 60 && d >= 0 ? ` <span class="badge b-amber">${d} gün</span>` : ''}
            ${d !== null && d < 0 ? ' <span class="badge b-red">süresi doldu</span>' : ''}</td>
          <td class="t-right">${c.amount ? C.TL(c.amount) : '—'}</td>
          <td class="t-right"><button class="btn btn-sm btn-outline-red" data-con-del="${c.id}">Sil</button></td>
        </tr>`; }).join('') : '<tr><td colspan="6" class="t-empty">Sözleşme kaydı yok</td></tr>'}</tbody></table>
    </div>

    <div class="card">
      <h3>Panelin Ürettiği Belgeler</h3>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 12px;">
        Aidat raporundan ihtarnameye, tutanaktan devir teslime kadar panelde üretilen her belge
        sıra numarasıyla burada saklanır.</p>
      <table><thead><tr><th>Belge No</th><th>Belge</th><th>Tür</th><th>Dönem</th><th>Tarih</th><th></th></tr></thead>
      <tbody id="gen-body">${uretilen.length ? uretilen.map(d => `<tr>
        <td><strong>${C.esc(d.doc_no || '—')}</strong></td>
        <td>${C.esc(d.title)}</td>
        <td>${DOC_CATEGORIES[d.category] || d.category}</td>
        <td>${C.esc(d.period || '—')}</td>
        <td>${C.dmy(d.created_at)}</td>
        <td class="t-right"><button class="btn btn-sm btn-ghost" data-gen-open="${C.esc(d.storage_path || '')}">Aç</button></td>
      </tr>`).join('') : '<tr><td colspan="6" class="t-empty">Henüz belge üretilmemiş. Belge Merkezi ya da ilgili ekranlardan üretebilirsiniz.</td></tr>'}</tbody></table>
    </div>

    <div class="card">
      <h3>Elle Yüklenen Belgeler</h3>
      <table><thead><tr><th>Belge</th><th>Tür</th><th>Tarih</th><th>Geçerlilik</th><th></th></tr></thead>
      <tbody id="doc-body">${docs.length ? docs.map(d => {
        const exp = d.expires_at ? daysUntil(d.expires_at) : null;
        return `<tr>
          <td><strong>${C.esc(d.title)}</strong>${d.notes ? `<div class="muted" style="font-size:12px">${C.esc(d.notes)}</div>` : ''}</td>
          <td>${DOC_CATEGORIES[d.category] || d.category}</td>
          <td>${d.issued_date ? C.dmy(d.issued_date) : '—'}</td>
          <td>${d.expires_at ? C.dmy(d.expires_at) + (exp < 0 ? ' <span class="badge b-red">doldu</span>' : exp <= 30 ? ` <span class="badge b-amber">${exp} gün</span>` : '') : '—'}</td>
          <td class="t-right">
            ${d.file_url ? `<a class="btn btn-sm btn-ghost" href="${C.esc(d.file_url)}" target="_blank" rel="noopener">Aç</a>` : ''}
            <button class="btn btn-sm btn-outline-red" data-doc-del="${d.id}">Sil</button>
          </td>
        </tr>`; }).join('') : '<tr><td colspan="5" class="t-empty">Belge yok. Yönetim planı, sigorta poliçesi ve ruhsatları buraya ekleyin.</td></tr>'}</tbody></table>
    </div>

    <div class="card">
      <h3>Devir Teslim Kayıtları</h3>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 12px;">Yönetici değişiminde kasa, defterler ve belgelerin teslim tutanağı.</p>
      <div id="ho-list">${handovers.length ? handovers.map(h => `
        <div class="decision-card" style="margin-bottom:12px;">
          <div class="decision-top">
            <div class="decision-head">
              <h3>${C.esc(h.from_name || '—')} → ${C.esc(h.to_name || '—')}</h3>
              <div class="muted" style="font-size:12.5px;">${C.dmy(h.handover_date)} ·
                Kasa: ${C.TL(h.cash_balance || 0)} · Banka: ${C.TL(h.bank_balance || 0)}</div>
            </div>
            <div class="decision-actions">
              <button class="btn btn-sm" data-ho-belge="${h.id}">📄 Tutanak</button>
              <button class="btn btn-sm btn-outline-red" data-ho-del="${h.id}">Sil</button>
            </div>
          </div>
          ${h.items ? `<div class="decision-body rich-content">${h.items}</div>` : ''}
        </div>`).join('') : '<div class="t-empty">Devir teslim kaydı yok</div>'}</div>
    </div>`;

  /* Depodaki belgeler özel bucket'ta; açmak için kısa ömürlü imzalı bağlantı üretilir. */
  const genHost = C.el('gen-body');
  if (genHost) genHost.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-gen-open]'); if (!b) return;
    const yol = b.getAttribute('data-gen-open');
    if (!yol) return C.toast('Bu belgenin dosyası arşivde bulunamadı', true);
    b.disabled = true;
    try {
      window.open(await belgeBaglantisi(yol), '_blank', 'noopener');
    } catch (err) { C.toast('Belge açılamadı: ' + err.message, true); }
    finally { b.disabled = false; }
  });

  const hoHost = C.el('ho-list');
  if (hoHost) hoHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ho-belge]'); if (!b) return;
    const h = handovers.find(x => x.id === b.dataset.hoBelge); if (!h) return;
    belgeButonu(b, () => belgeUret({
      tur: 'devir_teslim', modul: 'archive', kategori: 'tutanak',
      baslik: 'Yönetici Devir Teslim Tutanağı',
      altBaslik: `${h.from_name || '—'} → ${h.to_name || '—'}`,
      donem: C.dmy(h.handover_date),
      dosyaAdi: `devir-teslim-${String(h.handover_date).slice(0, 10)}`,
      iliskiliId: h.id,
      ozet: [
        { etiket: 'Devir Tarihi', deger: C.dmy(h.handover_date) },
        { etiket: 'Banka Bakiyesi', deger: para(h.bank_balance || 0) },
        { etiket: 'Kasa (Nakit)', deger: para(h.cash_balance || 0) },
        { etiket: 'Toplam', deger: para(Number(h.bank_balance || 0) + Number(h.cash_balance || 0)) },
      ],
      bolumler: [
        { tip: 'kv', baslik: 'Taraflar', satirlar: [
          ['Devreden yönetici', h.from_name || '—'],
          ['Devralan yönetici', h.to_name || '—'],
          ['Devir tarihi', C.dmy(h.handover_date)],
        ] },
        { tip: 'metin', icerik:
          'İşbu tutanak, site yöneticiliği görevinin devri sırasında teslim edilen kasa mevcudu, defterler, '
          + 'belgeler ve demirbaşların tespiti amacıyla taraflar arasında düzenlenmiştir.' },
        { tip: 'tablo', baslik: 'Teslim Edilen Kasa Mevcudu',
          kolonlar: [{ baslik: 'Kalem' }, { baslik: 'Tutar', hiza: 'right', genislik: 44 }],
          satirlar: [['Banka hesabı', para(h.bank_balance || 0)], ['Nakit kasa', para(h.cash_balance || 0)]],
          toplamSatiri: ['TOPLAM', para(Number(h.bank_balance || 0) + Number(h.cash_balance || 0))] },
        h.items && { tip: 'metin', baslik: 'Teslim Edilen Defter, Belge ve Demirbaşlar', icerik: htmlDuzMetin(h.items) },
        { tip: 'kutu', baslik: 'Yasal dayanak — KMK m.36 ve m.39',
          icerik: 'Yönetici, kat malikleri kurulunun istediği zaman hesap vermekle yükümlüdür ve her takvim yılının '
            + 'birinci ayı içinde işletme defterine göre hesap özetini kat maliklerine verir. Görev süresi sona eren '
            + 'yönetici, elindeki defter ve belgeleri yeni yöneticiye devretmekle yükümlüdür.' },
        { tip: 'metin', baslik: 'Beyan',
          icerik: 'Yukarıda dökümü verilen kasa mevcudu, defter ve belgeler eksiksiz olarak teslim edilmiş ve '
            + 'teslim alınmıştır. İşbu tutanak taraflarca okunarak imza altına alınmıştır.' },
      ].filter(Boolean),
      imzalar: [{ unvan: 'Devreden Yönetici', ad: h.from_name || '' },
                { unvan: 'Devralan Yönetici', ad: h.to_name || '' },
                { unvan: 'Denetçi' }],
    }));
  });

  C.el('doc-add').onclick = () => openDocModal();
  C.el('con-add').onclick = () => openContractModal();
  C.el('ho-add').onclick = () => openHandoverModal();

  const del = (hostId, attr, table, msg) => {
    const host = C.el(hostId); if (!host) return;
    host.addEventListener('click', async (e) => {
      const b = e.target.closest(`[${attr}]`); if (!b) return;
      if (!confirm(msg)) return;
      const { error } = await C.supabase.from(table).delete().eq('id', b.getAttribute(attr));
      if (error) return C.toast(error.message, true);
      C.toast('Silindi'); renderArchive();
    });
  };
  del('doc-body', 'data-doc-del', 'documents', 'Belge silinsin mi?');
  del('con-body', 'data-con-del', 'contracts', 'Sözleşme silinsin mi?');
  del('ho-list', 'data-ho-del', 'handovers', 'Devir teslim kaydı silinsin mi?');
}

function openDocModal() {
  C.openModal('Belge Ekle', `
    <div class="field"><label>Belge Adı *</label><input id="d-title" placeholder="Örn: 2026 DASK Poliçesi" /></div>
    <div class="grid-2">
      <div class="field"><label>Tür</label>
        <select id="d-cat">${Object.entries(DOC_CATEGORIES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field"><label>Belge Tarihi</label><input id="d-issued" type="date" /></div>
    </div>
    <div class="field"><label>Geçerlilik Bitişi (poliçe/ruhsat için)</label><input id="d-exp" type="date" /></div>
    <div class="field"><label>Dosya Bağlantısı</label><input id="d-url" placeholder="Belgenin bağlantısı" /></div>
    <div class="field"><label>Not</label><input id="d-note" /></div>
    <button class="btn btn-block" id="m-save">Belgeyi Ekle</button>
  `, async () => {
    const title = C.el('d-title').value.trim();
    if (!title) throw new Error('Belge adı zorunludur.');
    const { error } = await C.supabase.from('documents').insert({
      site_id: C.sId(), title, category: C.el('d-cat').value,
      issued_date: C.el('d-issued').value || null,
      expires_at: C.el('d-exp').value || null,
      file_url: C.el('d-url').value.trim() || null,
      notes: C.el('d-note').value.trim() || null,
      uploaded_by: C.S.user.id,
    });
    if (error) throw new Error(error.message);
    C.toast('Belge eklendi');
  });
}

function openContractModal() {
  C.openModal('Sözleşme Ekle', `
    <div class="grid-2">
      <div class="field"><label>Firma Adı *</label><input id="c-vendor" placeholder="Örn: XYZ Asansör" /></div>
      <div class="field"><label>Hizmet *</label><input id="c-type" placeholder="Örn: Asansör bakımı" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Yetkili</label><input id="c-person" /></div>
      <div class="field"><label>Telefon</label><input id="c-phone" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Başlangıç</label><input id="c-start" type="date" /></div>
      <div class="field"><label>Bitiş</label><input id="c-end" type="date" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Tutar (₺)</label><input id="c-amt" inputmode="decimal" /></div>
      <div class="field"><label>Ödeme Dönemi</label>
        <select id="c-bill"><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option>
          <option value="yearly">Yıllık</option><option value="one_time">Tek Seferlik</option></select></div>
    </div>
    <div class="field"><label>Sözleşme Bağlantısı</label><input id="c-url" /></div>
    <button class="btn btn-block" id="m-save">Sözleşmeyi Ekle</button>
  `, async () => {
    const vendor = C.el('c-vendor').value.trim();
    const type = C.el('c-type').value.trim();
    if (!vendor || !type) throw new Error('Firma adı ve hizmet zorunludur.');
    const { error } = await C.supabase.from('contracts').insert({
      site_id: C.sId(), vendor_name: vendor, service_type: type,
      contact_person: C.el('c-person').value.trim() || null,
      phone: C.el('c-phone').value.trim() || null,
      start_date: C.el('c-start').value || null,
      end_date: C.el('c-end').value || null,
      amount: num(C.el('c-amt').value) || null,
      billing_period: C.el('c-bill').value,
      document_url: C.el('c-url').value.trim() || null,
    });
    if (error) throw new Error(error.message);
    C.toast('Sözleşme eklendi');
  });
}

/* Devir teslim tutanağı, panelin zaten bildiği verilerle açılır: mevcut
   yöneticinin adı, site kasa/banka bakiyesi ve teslim edilecek kalemlerin
   sayımı. Önceden bütün bunlar boş geliyordu ve yönetici, panelde duran
   rakamları başka ekranlardan bulup elle yazmak zorundaydı. */
async function openHandoverModal() {
  const mevcutYonetici = `${C.S.profile?.name || ''} ${C.S.profile?.surname || ''}`.trim();
  const banka = Number(C.S.site?.bank_balance ?? 0);
  const nakit = Number(C.S.site?.cash_balance ?? 0);
  const fon   = Number(C.S.site?.fund_balance ?? 0);

  const say = (q) => Promise.resolve(q).then(r => (r.error ? null : r.count)).catch(() => null);
  const [demirbas, belge, sozlesme, karar, toplanti] = await Promise.all([
    say(C.supabase.from('building_assets').select('id', { count: 'exact', head: true }).in('building_id', C.siteBIds())),
    say(C.supabase.from('documents').select('id', { count: 'exact', head: true }).eq('site_id', C.sId())),
    say(C.supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('site_id', C.sId()).eq('is_active', true)),
    say(C.supabase.from('building_decisions').select('id', { count: 'exact', head: true }).in('building_id', C.siteBIds())),
    say(C.supabase.from('meetings').select('id', { count: 'exact', head: true }).in('building_id', C.siteBIds())),
  ]);

  const satir = (etiket, adet, ek = '') =>
    adet == null ? '' : `<li>${etiket}: <strong>${adet} adet</strong>${ek}</li>`;
  const hazirListe = `<ul>
    ${satir('Demirbaş', demirbas, ' (sayım listesi ektedir)')}
    ${satir('Arşivdeki belge', belge)}
    ${satir('Yürürlükteki sözleşme', sozlesme)}
    ${satir('Karar defteri kaydı', karar)}
    ${satir('Genel kurul tutanağı', toplanti)}
    <li>Banka hesap cüzdanı / internet bankacılığı erişimi</li>
    <li>Ortak alan anahtarları ve güvenlik kodları</li>
  </ul>`;

  C.openModal('Devir Teslim Tutanağı', `
    <div class="info-banner" style="margin:0 0 14px;">
      Kasa bakiyeleri ve teslim listesi panelden otomatik dolduruldu; gerekirse düzeltebilirsiniz.
      ${fon > 0 ? `<br>Ayrıca <strong>${para(fon)}</strong> fon bakiyesi var — teslim listesine eklemeyi unutmayın.` : ''}
    </div>
    <div class="grid-2">
      <div class="field"><label>Devreden</label><input id="h-from" placeholder="Önceki yönetici" value="${C.esc(mevcutYonetici)}" /></div>
      <div class="field"><label>Devralan</label><input id="h-to" placeholder="Yeni yönetici" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Devir Tarihi *</label><input id="h-date" type="date" value="${C.todayISO()}" /></div>
      <div class="field"><label>Kasa Bakiyesi (₺)</label><input id="h-cash" inputmode="decimal" value="${nakit || ''}" /></div>
    </div>
    <div class="field"><label>Banka Bakiyesi (₺)</label><input id="h-bank" inputmode="decimal" value="${banka || ''}" /></div>
    <div class="field"><label>Teslim Edilenler</label>${C.richEditorHTML('h-items', hazirListe)}</div>
    <button class="btn btn-block" id="m-save">Tutanağı Kaydet</button>
  `, async () => {
    const date = C.el('h-date').value;
    if (!date) throw new Error('Devir tarihi zorunludur.');
    const { error } = await C.supabase.from('handovers').insert({
      site_id: C.sId(),
      from_name: C.el('h-from').value.trim() || null,
      to_name: C.el('h-to').value.trim() || null,
      handover_date: date,
      cash_balance: num(C.el('h-cash').value) || null,
      bank_balance: num(C.el('h-bank').value) || null,
      items: C.richValue('h-items') || null,
    });
    if (error) throw new Error(error.message);
    C.toast('Devir teslim tutanağı kaydedildi — "📄 Tutanak" ile imzalı belgesini üretebilirsiniz');
    renderArchive();
  });
  C.bindRichEditor('h-items');
}

/* ---------- panel.js'in kullanacağı rota tablosu ---------- */
export const yonetimRoutes = {
  tasks: renderTasks,
  extra: renderExtraCharges,
  board: renderBoard,
  assembly: renderAssembly,
  debts: renderDebts,
  archive: renderArchive,
};
