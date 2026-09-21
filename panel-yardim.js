/* ============================================================
   Yardım Modülü — kurulum rehberi + sayfa bazlı yardım paneli
   ============================================================
   İki iş yapar:

   1) KURULUM REHBERİ. Yeni kaydolan yönetici ne yapacağını bilmiyor; üstelik
      Genel Bakış ona "denetim raporu girilmemiş", "genel kurul planlanmamış"
      diyordu — bina belki hepsini yapmıştı, sisteme dün kaydolmuştu. Rehber,
      kurulum tamamlanana kadar uyarıların yerine geçer ve adım adım yol
      gösterir. Adımların durumu HİÇBİR YERDE SAKLANMAZ; her seferinde canlı
      veriden hesaplanır (sakin var mı, aidat tanımlı mı...). Böylece hep
      doğru, migration da gerektirmiyor.

   2) YARDIM PANELİ. Sağ üstteki "?" ile açılan, o anki sayfaya göre içerik
      gösteren çekmece. Bir adıma tıklayınca ilgili düğme sayfada parlar.

   Bağımlılıklar panel.js'ten initYardim(ctx) ile gelir (panel-yonetim.js ile
   aynı desen). Tercihler (paneli kapattım, kartı küçülttüm) tarayıcıda
   localStorage'da; anahtar deseni komsu.panel.<özellik>.<uid>.
============================================================ */

let C = null;

export function initYardim(ctx) {
  C = ctx;
  bindYardimPaneli();
}

/* Site bu kadar günden gençse "yapılmadı" iddiası taşıyan uyarılar
   (denetim, genel kurul) üretilmez — yönetici geçmişi girmeye fırsat bulsun. */
export const YENI_SITE_GUN = 90;

const GUN = 86400000;

export function siteYasiGun() {
  const t = C?.S?.site?.created_at;
  if (!t) return Infinity;          // site bilinmiyorsa mevcut davranışı bozma
  return Math.floor((Date.now() - new Date(t).getTime()) / GUN);
}

/* ---------- localStorage (yalnızca tercihler) ---------- */
const anahtar = (ozellik) => `komsu.panel.${ozellik}.${C?.S?.user?.id || 'anon'}`;
const tercihOku = (ozellik) => { try { return localStorage.getItem(anahtar(ozellik)) === '1'; } catch { return false; } };
const tercihYaz = (ozellik, deger) => {
  try { deger ? localStorage.setItem(anahtar(ozellik), '1') : localStorage.removeItem(anahtar(ozellik)); } catch { /* özel pencere vb. */ }
};

/* ============================================================
   1) KURULUM DURUMU
   ============================================================ */

/* Tablo yoksa ya da RLS engellerse 0 döner — rehber hiçbir zaman sayfayı
   düşürmemeli. */
async function say(tablo, filtre) {
  try {
    const { count, error } = await filtre(C.supabase.from(tablo).select('id', { count: 'exact', head: true }));
    return error ? 0 : (count || 0);
  } catch { return 0; }
}

async function aidatTutari() {
  try {
    const { data, error } = await C.supabase.rpc('building_fee_amount', { p_building_id: C.bId() });
    if (!error && data != null) return Number(data) || 0;
  } catch { /* RPC yoksa aşağıya düş */ }
  return Number(C.S.site?.default_fee_amount) || 0;
}

/**
 * Sekiz adım, üç kademe. "Kurulum tamamlandı" = çekirdek üçü bitmiş.
 * Her adım: { id, baslik, aciklama, bolum, hedef, kademe, tamam, ekstraHTML }
 */
export async function kurulumDurumu() {
  const bos = { tamam: true, adimlar: [], bitenSayisi: 0, toplam: 0, cekirdekBitti: true };
  if (!C?.sId?.() || !C.bId?.()) return bos;

  const bIds = C.siteBIds();
  const site = C.S.site || {};
  const bina = C.activeBuilding?.() || C.S.buildings?.[0] || {};

  const [sakin, aidat, tx, demirbas, kural, toplanti, denetim] = await Promise.all([
    say('apartments', (q) => q.in('building_id', bIds).not('user_id', 'is', null)),
    aidatTutari(),
    say('transactions', (q) => q.in('building_id', bIds)),
    say('building_assets', (q) => q.in('building_id', bIds)),
    say('building_rules', (q) => q.in('building_id', bIds)),
    say('meetings', (q) => q.in('building_id', bIds)),
    say('audit_reports', (q) => q.eq('site_id', C.sId())),
  ]);

  const bakiyeVar = ['bank_balance', 'cash_balance', 'fund_balance'].some((k) => Number(site[k]) !== 0);
  const erisim = C.getAccessState ? C.getAccessState() : { source: 'none', daysLeft: 99 };
  const denemeBitiyor = erisim.source === 'trial' && erisim.daysLeft <= 7;
  const kod = bina.building_code || '';

  const adimlar = [
    {
      id: 'sakin', kademe: 'cekirdek', tamam: sakin > 0,
      baslik: 'Sakinleri davet edin',
      aciklama: sakin > 0
        ? `${sakin} daire dolu. Katılmayan sakinlere kodu iletmeyi sürdürün.`
        : 'Sakinler mobil uygulamada bu kodla kendi dairelerine katılır. Kodu WhatsApp grubuna atmanız yeterli.',
      bolum: 'subscription', hedef: '.copy-code',
      ekstraHTML: kod ? `<span class="kurulum-kod">${C.esc(kod)}</span>
        <button class="btn btn-sm btn-ghost" data-kurulum-kopyala="${C.esc(kod)}">Kopyala</button>` : '',
    },
    {
      id: 'aidat', kademe: 'cekirdek', tamam: aidat > 0,
      baslik: 'Aidat tutarını belirleyin',
      aciklama: aidat > 0
        ? `Aylık ${C.TL(aidat)}. Her ay Aidat Takibi'nden "Uygula" demeniz yeterli.`
        : 'Aylık aidat tutarı. Ayarlar\'da bir kez girin; her ay tek tıkla tüm dairelere çıkar.',
      bolum: 'settings', hedef: '#s-fee',
    },
    {
      id: 'iban', kademe: 'cekirdek', tamam: !!(site.iban && String(site.iban).trim()),
      baslik: 'IBAN\'ı girin',
      aciklama: 'Sakinler aidatı nereye yatıracağını uygulamada bu alandan görür. Boşsa "nereye yatıracağız?" diye size sorarlar.',
      bolum: 'settings', hedef: '#s-iban',
    },
    {
      id: 'kasa', kademe: 'onerilen', tamam: tx > 0 || bakiyeVar,
      baslik: 'Kasa açılış bakiyesini girin',
      aciklama: 'Binanın şu anki parasını bir "gelir" olarak girin. Yoksa kasa sıfırdan başlar ve ilk aylık rapor yanlış çıkar.',
      bolum: 'transactions', hedef: '#tx-add',
    },
    {
      id: 'demirbas', kademe: 'onerilen', tamam: demirbas > 0,
      baslik: 'Demirbaşları girin',
      aciklama: 'Asansör, kazan, hidrofor, jeneratör… Bakım periyodu girerseniz takvim sizi hatırlatır.',
      bolum: 'assets', hedef: '#asset-add',
    },
    {
      id: 'kural', kademe: 'onerilen', tamam: kural > 0,
      baslik: 'Site kurallarını yazın',
      aciklama: 'Hazır şablonlardan seçmek bir dakika sürer. Sakinler kuralları uygulamadan okur.',
      bolum: 'rules', hedef: '#tpl-list',
    },
    {
      id: 'gecmis', kademe: 'istege', tamam: toplanti > 0 || denetim > 0,
      baslik: 'Geçmiş kayıtları işleyin',
      aciklama: 'Son genel kurulunuzun tarihi ve kararları, varsa son denetim. Girince sistem "yapılmadı" diye uyarmaz.',
      bolum: 'assembly', hedef: '#gk-add',
    },
    {
      id: 'abonelik', kademe: denemeBitiyor ? 'cekirdek' : 'istege', tamam: erisim.source === 'paid',
      acil: denemeBitiyor,
      baslik: 'Aboneliği başlatın',
      aciklama: erisim.source === 'trial'
        ? `Deneme ${erisim.daysLeft} gün sonra bitiyor. Bitince davet kodları kapanır, sakinler bir hafta sonra uygulamaya giremez.`
        : 'Fiyat daire sayınıza göre hesaplanır; 1, 3, 6 veya 12 ay seçebilirsiniz.',
      bolum: 'subscription', hedef: '#sub-pay',
    },
  ];

  const cekirdek = adimlar.filter((a) => a.kademe === 'cekirdek');
  const cekirdekBitti = cekirdek.every((a) => a.tamam);
  const bitenSayisi = adimlar.filter((a) => a.tamam).length;

  return { tamam: cekirdekBitti, cekirdekBitti, adimlar, bitenSayisi, toplam: adimlar.length };
}

/* ============================================================
   2) KURULUM KARTI (Genel Bakış)
   ============================================================ */

const KADEME_BASLIK = { cekirdek: 'Önce bunlar', onerilen: 'Sonra bunlar', istege: 'Zamanla' };

export function kurulumKartiHTML(d) {
  if (!d || !d.adimlar.length) return '';
  if (d.bitenSayisi === d.toplam) return '';               // her şey bitti: kart yok

  const yuzde = Math.round((d.bitenSayisi / d.toplam) * 100);
  const gizli = tercihOku('kurulum.gizli');
  const kalan = d.toplam - d.bitenSayisi;

  /* Küçültülmüş hal: çekirdek bittiyse otomatik, yoksa yönetici istediyse. */
  if (d.cekirdekBitti || gizli) {
    const baslik = d.cekirdekBitti
      ? `Kurulum tamamlandı ✓ · ${kalan} isteğe bağlı adım kaldı`
      : `Kurulum ${d.bitenSayisi}/${d.toplam}`;
    return `<div class="card kurulum-card kurulum-mini">
      <strong>${baslik}</strong>
      <div class="kurulum-bar"><div style="width:${yuzde}%"></div></div>
      <button class="btn btn-sm btn-ghost" data-kurulum-goster>Göster</button>
    </div>`;
  }

  const satir = (a) => `
    <div class="todo-row ${a.tamam ? 't-tamam' : (a.acil ? 't-sari' : 't-bekle')}">
      <span class="todo-ico">${a.tamam ? '✅' : (a.acil ? '⏳' : '○')}</span>
      <div class="todo-text">
        <strong>${C.esc(a.baslik)}</strong>
        <span class="muted">${C.esc(a.aciklama)}</span>
        ${a.ekstraHTML ? `<span style="margin-top:4px;display:flex;align-items:center;gap:8px;">${a.ekstraHTML}</span>` : ''}
      </div>
      ${a.tamam ? '' : `<button class="btn btn-sm" data-kurulum-git="${a.bolum}" data-hedef="${C.esc(a.hedef || '')}">Git →</button>`}
    </div>`;

  const grup = (kademe) => {
    const liste = d.adimlar.filter((a) => a.kademe === kademe);
    if (!liste.length) return '';
    return `<div class="kurulum-grup">${KADEME_BASLIK[kademe]}</div>${liste.map(satir).join('')}`;
  };

  return `<div class="card kurulum-card">
    <div class="kurulum-head">
      <h3>Sitenizi ayağa kaldıralım</h3>
      <span class="badge b-amber">${d.bitenSayisi}/${d.toplam}</span>
    </div>
    <p class="kurulum-sub">Bu adımlar bitince sistem sizin adınıza takibe başlar: borç, süre dolan yükümlülük, açık arıza.
      Sıra önemli değil; her adım kendi ekranında bir dakika sürer.</p>
    <div class="kurulum-bar"><div style="width:${yuzde}%"></div></div>
    ${grup('cekirdek')}${grup('onerilen')}${grup('istege')}
    <div class="kurulum-foot"><button class="btn btn-sm btn-ghost" data-kurulum-kucult>Rehberi küçült</button></div>
  </div>`;
}

export function bindKurulumKarti(host) {
  if (!host || host.dataset.kurulumBagli) return;
  host.dataset.kurulumBagli = '1';
  host.addEventListener('click', async (e) => {
    const git = e.target.closest('[data-kurulum-git]');
    if (git) return gitVeVurgula(git.dataset.kurulumGit, git.dataset.hedef);

    const kopyala = e.target.closest('[data-kurulum-kopyala]');
    if (kopyala) {
      try { await navigator.clipboard.writeText(kopyala.dataset.kurulumKopyala); C.toast('Davet kodu kopyalandı'); }
      catch { C.toast('Kopyalanamadı — kodu elle seçin', true); }
      return;
    }
    if (e.target.closest('[data-kurulum-kucult]')) { tercihYaz('kurulum.gizli', true); C.navigate('overview'); return; }
    if (e.target.closest('[data-kurulum-goster]')) { tercihYaz('kurulum.gizli', false); C.navigate('overview'); }
  });
}

/* ============================================================
   3) YARDIM PANELİ — bölüm bazlı içerik
   ============================================================
   Her adım: { metin, hedef?: CSS seçici (sayfada parlar), git?: bölüm }
   Ton: kısa, "siz" dili, ne yapılacağı ve neden. */

const YARDIM = {
  overview: {
    baslik: 'Genel Bakış',
    ozet: 'Sitenizin bugünkü durumu: kasa, bu ayın tahsilatı, borç, açık işler. Altta sistemin sizin adınıza takip ettiği şeyler.',
    adimlar: [
      { metin: 'Kurulum bitene kadar burada <strong>kurulum rehberi</strong> görünür; adımları sırayla bitirin.', hedef: '.kurulum-card' },
      { metin: 'Üstteki dört kutu tıklanabilir — ilgili ekrana götürür.', hedef: '.dash-kpi' },
      { metin: '"Dikkat gerektirenler" kurulum bittikten sonra devreye girer. Her satırın sağındaki düğme sizi işin yapılacağı yere götürür.' },
    ],
  },
  apartments: {
    baslik: 'Daireler & Sakinler',
    ozet: 'Daireler, kurulumda girdiğiniz sayıya göre oluştu. Sakinler mobil uygulamadan davet koduyla kendileri katılır; siz buradan görür ve yönetirsiniz.',
    adimlar: [
      { metin: 'Davet kodunu sakinlerle paylaşın — kod <strong>Abonelik</strong> sayfasında.', git: 'subscription', hedef: '.copy-code' },
      { metin: 'Bir dairede en fazla <strong>iki sakin</strong> olabilir; ad ve telefon sakinin kendi kaydından gelir.' },
      { metin: 'Taşınan sakini <strong>Çıkar</strong> ile çıkarın; daire boşa düşer, aidat çıkmaz.', hedef: '[data-act="rm-member"]' },
      { metin: '<strong>Sil</strong> daireyi tüm geçmişiyle siler — yalnızca yanlış oluşturulmuş daireler için.' },
    ],
  },
  fees: {
    baslik: 'Aidat Takibi',
    ozet: 'Her ay dairelere aidat çıkarır, ödemeleri işaretlersiniz. Borç ve tahsilat oranı buradan hesaplanır.',
    adimlar: [
      { metin: 'Tutarı yazıp <strong>Uygula</strong> — tüm dolu dairelere bu ayın aidatı çıkar.', hedef: '#bulk-amt' },
      { metin: 'Ödeme gelince satırdaki kutuyu işaretleyin; <strong>kasaya otomatik yazılır</strong>.', hedef: '.pay-check' },
      { metin: 'Bir daire tek seferlik farklı tutar ödeyecekse <strong>Aidat Gir</strong> ile ayrı yazın.' },
      { metin: 'Çatı tamiri gibi işe bağlı giderler aidata karışmasın — <strong>Ek Ödemeler</strong>.', git: 'extra' },
      { metin: 'Geçmiş aylar için üstteki ay/yıl seçiciyi kullanın.', hedef: '#fee-month' },
    ],
  },
  extra: {
    baslik: 'Ek Ödemeler',
    ozet: 'Aidat dışında, belirli bir iş için toplanan paralar. Sakin bunu aidatından ayrı bir satır olarak görür — parasının nereye gittiğini bilir.',
    adimlar: [
      { metin: 'Başlık, toplam tutar ve taksit sayısı girin; sistem dairelere böler.', hedef: '#ec-title' },
      { metin: 'Tutar <strong>tüm dairelere</strong> eşit bölünür, boş daireler dahil. Boş dairelerin payını maliklerden tahsil edersiniz — kart bunu size gösterir.' },
      { metin: '<strong>Daire Dökümü</strong> ile kim ödedi görün, ödemeleri işaretleyin; kasaya yazılır.' },
    ],
  },
  transactions: {
    baslik: 'Kasa & Harcamalar',
    ozet: 'Sitenin parası. Aidat tahsilatları otomatik gelir olarak düşer; harcamaları siz girersiniz. Kasa banka + nakit + fon olarak üç cepte tutulur.',
    adimlar: [
      { metin: 'Kuruluşta binanın <strong>mevcut parasını</strong> bir gelir olarak girin: açılış bakiyesi.', hedef: '#tx-add' },
      { metin: 'Her harcamayı fiş tarihiyle girin, kategori seçin (bakım, sabit gider…). Rapor bu kategorilerden çıkar.' },
      { metin: 'Belirli tutarın üstündeki harcamalar <strong>onay bekler</strong> — eşiği Ayarlar\'dan değiştirirsiniz.', git: 'settings', hedef: '#s-threshold' },
      { metin: 'Ay sonu kasa raporu <strong>Belge Merkezi</strong>\'nden.', git: 'reports', hedef: '#btn-rep-cash' },
    ],
  },
  announcements: {
    baslik: 'Duyurular',
    ozet: 'Sakinlerin telefonuna bildirim olarak gider. Su kesintisi, toplantı hatırlatması, aidat duyurusu — hepsi buradan.',
    adimlar: [
      { metin: '<strong>Yeni Duyuru</strong> ile yazın; gönderince tüm sakinlere bildirim düşer.', hedef: '#ann-add' },
      { metin: 'Önemli duyuruları <strong>sabitleyin</strong>; sakinlerin listesinde üstte kalır.' },
      { metin: 'Toplantı çağrısı için Duyuru değil <strong>Genel Kurul</strong> ekranını kullanın — orada çağrı otomatik oluşur.', git: 'assembly' },
    ],
  },
  maintenance: {
    baslik: 'Arıza Bildirimleri',
    ozet: 'Sakinler telefondan arıza bildirir, fotoğraf ekler. Burada görür; iş olarak tanımlar ya da kapatırsınız.',
    adimlar: [
      { metin: 'Yeni bildirimleri inceleyin; <strong>yüksek öncelikli</strong> olanlar üstte.' },
      { metin: 'Yapılacaksa <strong>İş olarak tanımla</strong> — İş Takibi\'ne düşer, ustayı ve tutarı oradan izlersiniz.', git: 'jobs' },
      { metin: 'İşlem gerektirmiyorsa kapatın; bildiren sakine haber gider.' },
    ],
  },
  jobs: {
    baslik: 'İş Takibi',
    ozet: 'Yapılacak ve yapılmakta olan işler: kim yapıyor, ne zaman biter, ne kadar tutar.',
    adimlar: [
      { metin: '<strong>Yeni İş</strong>: başlık, sorumlu, tarih, tahmini tutar.', hedef: '#job-add' },
      { metin: 'Düzenli tekrar eden işler (asansör bakımı) için <strong>Yönetim Takvimi</strong> daha uygun.', git: 'tasks' },
      { metin: 'İş bitince <strong>Tamamlandı</strong>; harcamayı Kasa\'ya girmeyi unutmayın.', git: 'transactions' },
    ],
  },
  assembly: {
    baslik: 'Genel Kurul',
    ozet: 'Toplantı çağrısından tutanağa kadar tüm süreç. KMK\'nın istediği belgeler (hazirun cetveli, tutanak) buradan üretilir.',
    adimlar: [
      { metin: '<strong>Toplantı oluşturun</strong>: tarih, gündem, olağan/olağanüstü.', hedef: '#gk-add' },
      { metin: '<strong>Duyur</strong> ile sakinlere çağrı gider. KMK toplantıdan en az 15 gün önce ister.' },
      { metin: 'Toplantı günü <strong>hazirun cetveli</strong>: katılanları işaretleyin, yeter sayı otomatik hesaplanır.' },
      { metin: 'Sonra tutanak ve kararları girin; kararlar <strong>Karar Defteri</strong>\'ne işlenir.', git: 'decisions' },
      { metin: 'Geçmiş bir genel kurulunuz varsa tarihini ve kararlarını buraya işleyin — sistem bir daha "planlanmamış" demez.' },
    ],
  },
  rules: {
    baslik: 'Site Kuralları',
    ozet: 'Sakinlerin uyması gereken kurallar. Mobil uygulamada okunur; değişince bildirim gider.',
    adimlar: [
      { metin: '<strong>Hazır şablonlardan</strong> seçerek bir dakikada başlayın.', hedef: '#tpl-list' },
      { metin: 'Kendi kuralınızı <strong>Yeni Kural</strong> ile ekleyin.', hedef: '#rule-add' },
      { metin: 'Genel kurulda değişen kuralları buraya da işleyin; Karar Defteri ile tutarlı kalsın.', git: 'decisions' },
    ],
  },
  assets: {
    baslik: 'Demirbaşlar',
    ozet: 'Asansör, kazan, hidrofor, jeneratör… Sitenin sabit varlıkları. Bakım takvimi ve sözleşmeler buradan beslenir.',
    adimlar: [
      { metin: 'Her demirbaşı ekleyin: ad, marka, alım tarihi, garanti.', hedef: '#asset-add' },
      { metin: '<strong>Bakım periyodu</strong> girerseniz Yönetim Takvimi zamanı gelince hatırlatır.', git: 'tasks' },
      { metin: 'Demirbaş listesi belge olarak <strong>Belge Merkezi</strong>\'nden alınır — devir tesliminde gerekir.', git: 'reports', hedef: '#btn-rep-assets' },
    ],
  },
  decisions: {
    baslik: 'Karar Defteri',
    ozet: 'Alınan her karar tarih ve numarayla burada. Genel kurul kararları otomatik düşer; yönetici kararlarını siz girersiniz.',
    adimlar: [
      { metin: '<strong>İlk kararı yazın</strong>: konu, tarih, karar metni.', hedef: '#decision-add' },
      { metin: 'Aidat artışı, kural değişikliği, büyük harcama — hepsi karar olarak kaydedilmeli; ileride "ne zaman karar verildi" sorusunun cevabı burası.' },
      { metin: 'Her karar belge olarak indirilebilir.' },
    ],
  },
  tasks: {
    baslik: 'Yönetim Takvimi',
    ozet: 'Yasal yükümlülükler ve periyodik işler. Neyin ne zaman yapılacağını tutar, süre yaklaşınca Genel Bakış\'ta uyarır.',
    adimlar: [
      { metin: '<strong>Hazır Şablonları Yükle</strong> ile KMK\'daki standart yükümlülükleri tek tıkla ekleyin.' },
      { metin: 'Kendi görevinizi <strong>Yeni Görev</strong> ile ekleyin; periyodikse tekrar aralığı seçin.', hedef: '#task-add' },
      { metin: 'Görev bitince <strong>Tamamlandı</strong>; periyodikse sonraki tarih kendiliğinden açılır.' },
    ],
  },
  board: {
    baslik: 'Kurul & Denetim',
    ozet: 'Yönetim ve denetim kurulu üyeleri, denetim raporları. KMK m.41: yönetim planında süre yoksa denetim üç ayda bir.',
    adimlar: [
      { metin: 'Yönetici ve denetçiyi <strong>Kurul Üyesi</strong> olarak kaydedin.', hedef: '#board-add' },
      { metin: 'Denetim yapılınca <strong>Denetim Raporu</strong> girin: dönem, denetçi, bulgular.', hedef: '#audit-add' },
      { metin: 'Geçmiş bir denetiminiz varsa tarihini işleyin — sistem "denetim yapılmamış" diye uyarmaz.' },
    ],
  },
  debts: {
    baslik: 'Borç Takibi',
    ozet: 'Vadesi geçmiş ödenmemiş aidatlar, daire bazında. Vade ayın son günü; henüz vadesi gelmemiş aylar borç sayılmaz.',
    adimlar: [
      { metin: '<strong>Tahsilat</strong>: kapıda alınan ödemeyi işaretleyin, kasaya yazılır.' },
      { metin: 'Ödemeyen için <strong>İhtar Kaydı</strong> açıp <strong>İhtarname</strong> üretin — icra takibinin dayanağı.' },
      { metin: 'Borç listesi CSV ve belge olarak indirilebilir.' },
    ],
  },
  archive: {
    baslik: 'Belgeler & Devir',
    ozet: 'Sitenin resmî belgeleri tek yerde: yönetim planı, sigorta, ruhsat, tedarikçi sözleşmeleri, devir-teslim.',
    adimlar: [
      { metin: 'Yönetim planı, sigorta poliçesi, ruhsat gibi belgeleri <strong>yükleyin</strong>.', hedef: '#doc-add' },
      { metin: 'Tedarikçi sözleşmelerini girin; <strong>bitiş tarihi</strong> yaklaşınca Genel Bakış uyarır.', hedef: '#con-add' },
      { metin: 'Yönetim değişince <strong>devir-teslim tutanağı</strong> buradan üretilir.', hedef: '#ho-add' },
    ],
  },
  settings: {
    baslik: 'Site Ayarları',
    ozet: 'Sitenin kimliği ve çalışma kuralları. Kurulumdaki en önemli üç alan burada: IBAN, aidat tutarı, onay eşiği.',
    adimlar: [
      { metin: '<strong>IBAN</strong> girin — sakinler aidatı nereye yatıracağını uygulamada buradan görür.', hedef: '#s-iban' },
      { metin: '<strong>Varsayılan aidat tutarı</strong> — her ay Aidat Takibi\'nde bu tutar hazır gelir.', hedef: '#s-fee' },
      { metin: '<strong>Harcama onay eşiği</strong> — üstündeki harcamalar onayınızı bekler.', hedef: '#s-threshold' },
      { metin: 'Kapı görevlisi için <strong>güvenlik girişi</strong> tanımlayın; görevli yalnızca ziyaretçi ve plaka ekranını görür.', hedef: '#s-sec-user' },
    ],
  },
  reports: {
    baslik: 'Belge Merkezi',
    ozet: 'Tek tıkla resmî belge: aidat, kasa, borç, demirbaş, yıllık faaliyet raporu. Hepsi numaralı, imza alanlı PDF; üretilenler Belgeler\'de saklanır.',
    adimlar: [
      { metin: 'Ay sonu: <strong>Kasa raporu</strong>.', hedef: '#btn-rep-cash' },
      { metin: 'Genel kurul öncesi: <strong>Yıllık faaliyet raporu</strong> — bir yılın tamamını tek belgede toplar.', hedef: '#btn-rep-annual' },
      { metin: 'Üretilen her belge <strong>Belgeler & Devir</strong>\'de numarasıyla saklanır.', git: 'archive' },
    ],
  },
  subscription: {
    baslik: 'Abonelik',
    ozet: 'Davet kodlarınız ve ödeme. Deneme bir ay; bitince davet kodları kapanır, mevcut sakinler bir hafta sonra uygulamaya giremez.',
    adimlar: [
      { metin: '<strong>Davet kodlarınız</strong> burada; sakinlere iletin, uygulamada bu kodla katılırlar.', hedef: '.copy-code' },
      { metin: 'Fiyat daire sayınıza göre hesaplanır. 1, 3, 6 veya 12 ay seçip kartla ödeyin.' },
      { metin: 'Deneme bitmeden ödeme yaparsanız kesinti olmaz; kalan deneme günleri kaybolmaz.' },
    ],
  },
  security_mode: {
    baslik: 'Güvenlik Modu',
    ozet: 'Kapıdaki görevli için ayrı ekran: ziyaretçi kaydı ve plaka sorgusu. Görevli kendi kullanıcı adı ve şifresiyle girer, başka hiçbir şey göremez.',
    adimlar: [
      { metin: 'Görevli hesabını <strong>Ayarlar</strong>\'dan tanımlayın.', git: 'settings', hedef: '#s-sec-user' },
      { metin: 'Bu ekranı görevlinin tablet ya da telefonunda açık bırakın.' },
    ],
  },
};

/* ---------- panel açma/kapama/güncelleme ---------- */

const drawer = () => document.getElementById('help-drawer');

export function yardimAc() {
  const d = drawer(); if (!d) return;
  yardimGuncelle(C.S.section);
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
}

export function yardimKapat() {
  const d = drawer(); if (!d) return;
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
  tercihYaz('yardim.gorundu', true);           // ilk giriş bitti
}

export function yardimGuncelle(section) {
  const icerik = YARDIM[section] || YARDIM.overview;
  const baslik = document.getElementById('help-title');
  const body = document.getElementById('help-body');
  if (!baslik || !body) return;

  baslik.textContent = icerik.baslik;
  body.innerHTML = `
    <p class="help-ozet">${icerik.ozet}</p>
    <div class="help-grup">Bu sayfada</div>
    ${icerik.adimlar.map((a, i) => {
      const tiklanir = !!(a.hedef || a.git);
      const gitEtiket = a.git && a.git !== section ? `→ ${YARDIM[a.git]?.baslik || a.git}` : (a.hedef ? '→ sayfada göster' : '');
      return `<div class="help-adim ${tiklanir ? 'tikla' : ''}" ${a.hedef ? `data-hedef="${a.hedef}"` : ''} ${a.git ? `data-git="${a.git}"` : ''}>
        <span class="help-adim-no">${i + 1}</span>
        <div class="help-adim-text">${a.metin}${gitEtiket ? `<span class="help-adim-git">${gitEtiket}</span>` : ''}</div>
      </div>`;
    }).join('')}`;
}

function bindYardimPaneli() {
  const btn = document.getElementById('help-btn');
  const kapat = document.getElementById('help-close');
  const body = document.getElementById('help-body');
  if (btn) btn.addEventListener('click', () => {
    btn.classList.remove('pulse');
    drawer()?.classList.contains('open') ? yardimKapat() : yardimAc();
  });
  if (kapat) kapat.addEventListener('click', yardimKapat);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer()?.classList.contains('open')) yardimKapat(); });
  if (body) body.addEventListener('click', (e) => {
    const adim = e.target.closest('.help-adim.tikla'); if (!adim) return;
    gitVeVurgula(adim.dataset.git || C.S.section, adim.dataset.hedef || '');
  });
}

/* navigate()'in her sayfa render'ı sonrası çağırdığı kanca. */
export function yardimSayfaDegisti() {
  yardimGuncelle(C.S.section);
  if (C.S.beklenenVurgu) {
    const h = C.S.beklenenVurgu; C.S.beklenenVurgu = null;
    setTimeout(() => vurgula(h), 180);       // render bitsin, sonra parla
  }
}

/* İlk giriş: bu tarayıcıda panel hiç kapatılmadıysa açık gelir. */
export function ilkGirisKontrol() {
  if (tercihOku('yardim.gorundu')) return;
  yardimAc();
  document.getElementById('help-btn')?.classList.add('pulse');
}

/* ============================================================
   4) VURGULAMA
   ============================================================ */

export function vurgula(selector) {
  if (!selector) return;
  let hedef = null;
  try { hedef = document.querySelector(selector); } catch { return; }
  if (!hedef) return;                         // sayfa değişmiş, seçici eskimiş — sessizce geç
  hedef.scrollIntoView({ block: 'center', behavior: 'smooth' });
  hedef.classList.remove('help-pulse'); void hedef.offsetWidth;   // animasyonu yeniden başlat
  hedef.classList.add('help-pulse');
  setTimeout(() => hedef.classList.remove('help-pulse'), 3500);
}

export function gitVeVurgula(bolum, hedef) {
  if (!bolum || bolum === C.S.section) return vurgula(hedef);
  C.S.beklenenVurgu = hedef || null;
  C.navigate(bolum);
}
