/* ============================================================
   BELGE MERKEZİ — panelin ortak evrak katmanı
   ============================================================
   Panelde yapılan her iş (aidat tahakkuku, ihtar, tutanak, denetim raporu,
   iş emri, devir teslim…) buradan geçerek aynı görünümde resmî bir PDF'e
   dönüşür. Belge üç şey yapar:

     1. Antetli, numaralı, imza alanlı PDF üretir ve indirir.
     2. PDF'i 'documents' bucket'ına yükler (özel bucket, imzalı URL ile açılır).
     3. documents tablosuna kütük kaydı düşer.

   Böylece "Belgeler & Devir" ekranı, yönetimin ürettiği her evrakın tek
   arşivi olur; yönetici değiştiğinde devir teslim eksiksiz yapılabilir.

   TÜRKÇE KARAKTER: jsPDF'in yerleşik fontları (helvetica…) Latin-1'dir,
   ğ/ş/ı/İ harflerini basamaz — eski raporlarda "Ödedi" yerine "Odedi"
   yazmasının sebebi buydu. Burada Inter TTF gömülüyor; resmî bir ihtarname
   ya da tutanakta harflerin doğru çıkması pazarlık konusu değil.
   ============================================================ */

let C = null;
export function initBelge(ctx) { C = ctx; }

/* ---------- Ölçüler (mm) ---------- */
const M         = 16;    // sol/sağ kenar boşluğu
const HEADER_H  = 30;    // her sayfada antet için ayrılan alan
const FOOTER_H  = 16;    // her sayfada dipnot için ayrılan alan
const CONTENT_Y = HEADER_H + 4;

/* ---------- Renkler (panel.css ile aynı) ---------- */
const INK   = [43, 38, 32];
const MUTED = [110, 99, 87];
const LINE  = [222, 210, 191];
const CREAM = [255, 246, 233];
const GREEN = [47, 133, 90];
const RED   = [178, 58, 46];
const AMBER = [183, 121, 31];

/* ============================================================
   1) Font
   ============================================================ */
// Inter, tam Latin-Extended kapsar (ğ ş ı İ ö ü ç ve ₺). İlk belgede bir kez
// indirilir, sonrasında sekme kapanana kadar bellekte kalır.
const FONT_URL = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3';
const FONTS = [
  { dosya: 'Inter_400Regular.ttf', ad: 'Inter', stil: 'normal' },
  { dosya: 'Inter_700Bold.ttf',    ad: 'Inter', stil: 'bold'   },
];

let fontCache = null;      // { dosya: base64 }
let fontYuklendi = false;  // false ise helvetica'ya düşeriz

const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  // String.fromCharCode(...bytes) 300KB'de yığını taşırıyor; parça parça
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
};

async function fontlariGetir() {
  if (fontCache) return fontCache;
  const sonuc = {};
  await Promise.all(FONTS.map(async (f) => {
    const res = await fetch(`${FONT_URL}/${f.dosya}`);
    if (!res.ok) throw new Error(`Font indirilemedi (${f.dosya})`);
    sonuc[f.dosya] = toBase64(await res.arrayBuffer());
  }));
  fontCache = sonuc;
  return sonuc;
}

async function fontuKur(doc) {
  try {
    const veri = await fontlariGetir();
    FONTS.forEach((f) => {
      doc.addFileToVFS(f.dosya, veri[f.dosya]);
      doc.addFont(f.dosya, f.ad, f.stil);
    });
    fontYuklendi = true;
    return 'Inter';
  } catch (err) {
    // Ağ kapalıysa belge yine de çıksın; sadece Türkçe harfler sadeleşir.
    console.warn('Belge fontu yüklenemedi, helvetica kullanılıyor:', err.message);
    fontYuklendi = false;
    return 'helvetica';
  }
}

/* Font gömülemediyse Latin-1 dışı harfleri sadeleştir. */
const TR_MAP = { 'ı':'i','İ':'I','ş':'s','Ş':'S','ğ':'g','Ğ':'G','ü':'u','Ü':'U','ö':'o','Ö':'O','ç':'c','Ç':'C','₺':'TL' };
const yaz = (s) => {
  const t = String(s ?? '');
  return fontYuklendi ? t : t.replace(/[ıİşŞğĞüÜöÖçÇ₺]/g, (c) => TR_MAP[c]);
};

/* ---------- Biçimlendirme ---------- */
export const para = (n) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  .format(Number(n) || 0)} ₺`;
export const tarih = (v) => (v ? new Date(v).toLocaleDateString('tr-TR') : '—');
export const tarihSaat = (v) => (v ? new Date(v).toLocaleString('tr-TR',
  { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—');

/* Zengin metin editörünün HTML'i PDF'e düz metin olarak girer. */
export function htmlDuzMetin(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = String(html)
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  return (d.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

const slugla = (s) => String(s || 'belge')
  .toLowerCase()
  .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);

/* ============================================================
   2) Sayfa düzeni
   ============================================================ */
/** Sayfanın üst anteti ve alt dipnotu. Tüm sayfalar için en sonda basılır,
 *  çünkü "Sayfa 1/3" yazabilmek için toplam sayfa sayısı gerekiyor. */
function sayfaCercevesi(doc, font, { siteAdi, siteAdres, belgeNo, uretimZamani }) {
  const gen = doc.internal.pageSize.getWidth();
  const yuk = doc.internal.pageSize.getHeight();
  const toplam = doc.internal.getNumberOfPages();

  for (let i = 1; i <= toplam; i++) {
    doc.setPage(i);

    /* --- Antet --- */
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, gen, HEADER_H - 6, 'F');
    doc.setFillColor(...INK);
    doc.rect(0, 0, 3.2, HEADER_H - 6, 'F');   // sol dikey vurgu şeridi

    doc.setFont(font, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(yaz(siteAdi), M, 11);

    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(yaz(siteAdres || ''), M, 16.5, { maxWidth: gen - M * 2 - 46 });

    doc.setFont(font, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(yaz(`Belge No: ${belgeNo}`), gen - M, 11, { align: 'right' });
    doc.setFont(font, 'normal');
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(yaz(uretimZamani), gen - M, 16.5, { align: 'right' });

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.line(M, HEADER_H - 6, gen - M, HEADER_H - 6);

    /* --- Dipnot --- */
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, yuk - FOOTER_H + 4, gen - M, yuk - FOOTER_H + 4);
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(yaz('Bu belge Komşu Yönetim Paneli tarafından üretilmiştir.'), M, yuk - FOOTER_H + 9);
    doc.text(yaz(`Sayfa ${i} / ${toplam}`), gen - M, yuk - FOOTER_H + 9, { align: 'right' });
  }
}

/** İçerik imleci. Yeri kalmayınca yeni sayfa açar. */
function imlec(doc) {
  const yuk = doc.internal.pageSize.getHeight();
  const gen = doc.internal.pageSize.getWidth();
  return {
    y: CONTENT_Y,
    gen,
    icGen: gen - M * 2,
    dip: yuk - FOOTER_H,
    yerAc(h) {
      if (this.y + h > this.dip) { doc.addPage(); this.y = CONTENT_Y; }
    },
  };
}

/* ============================================================
   3) İçerik blokları
   ============================================================ */
function baslikBlogu(doc, font, im, { baslik, altBaslik, donem }) {
  im.yerAc(26);
  doc.setFont(font, 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  const satirlar = doc.splitTextToSize(yaz(baslik).toLocaleUpperCase('tr-TR'), im.icGen);
  doc.text(satirlar, M, im.y + 6);
  im.y += 6 + satirlar.length * 7;

  if (altBaslik) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(yaz(altBaslik), M, im.y);
    im.y += 5.5;
  }
  if (donem) {
    doc.setFont(font, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(yaz(`Dönem: ${donem}`), M, im.y);
    im.y += 5.5;
  }
  im.y += 3;
}

/** Üstteki özet kartları — belgenin bir bakışta okunan rakamları. */
function ozetBlogu(doc, font, im, kartlar) {
  if (!kartlar || !kartlar.length) return;
  const n = kartlar.length;
  const bosluk = 3;
  const w = (im.icGen - bosluk * (n - 1)) / n;
  const h = 17;
  im.yerAc(h + 6);

  kartlar.forEach((k, i) => {
    const x = M + i * (w + bosluk);
    doc.setFillColor(...CREAM);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, im.y, w, h, 2, 2, 'FD');

    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(yaz(k.etiket), x + 3, im.y + 5.5, { maxWidth: w - 6 });

    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...(k.renk === 'yesil' ? GREEN : k.renk === 'kirmizi' ? RED : k.renk === 'sari' ? AMBER : INK));
    doc.text(yaz(String(k.deger)), x + 3, im.y + 12.5, { maxWidth: w - 6 });
  });
  im.y += h + 7;
}

function bolumBasligi(doc, font, im, baslik) {
  if (!baslik) return;
  im.yerAc(12);
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(yaz(baslik), M, im.y + 4);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, im.y + 6, M + 14, im.y + 6);
  im.y += 11;
}

function metinBlogu(doc, font, im, icerik) {
  const paragraflar = Array.isArray(icerik) ? icerik : String(icerik || '').split('\n');
  doc.setFont(font, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  paragraflar.forEach((p) => {
    if (!String(p).trim()) { im.y += 3; return; }
    const satirlar = doc.splitTextToSize(yaz(p), im.icGen);
    satirlar.forEach((s) => {
      im.yerAc(5.5);
      doc.text(s, M, im.y + 3.5);
      im.y += 5;
    });
    im.y += 1.5;
  });
  im.y += 2;
}

/** Etiket–değer çiftleri (ör. "Borçlu: Daire 12 — Ahmet Yılmaz"). */
function kvBlogu(doc, font, im, satirlar) {
  const etiketGen = 46;
  satirlar.forEach(([etiket, deger]) => {
    const degerSatirlari = doc.splitTextToSize(yaz(String(deger ?? '—')), im.icGen - etiketGen);
    im.yerAc(degerSatirlari.length * 5 + 2);
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(yaz(etiket), M, im.y + 3.5);
    doc.setFont(font, 'bold');
    doc.setTextColor(...INK);
    doc.text(degerSatirlari, M + etiketGen, im.y + 3.5);
    im.y += degerSatirlari.length * 5 + 1.5;
  });
  im.y += 3;
}

function listeBlogu(doc, font, im, maddeler) {
  doc.setFontSize(9.5);
  maddeler.forEach((m, i) => {
    const satirlar = doc.splitTextToSize(yaz(String(m)), im.icGen - 8);
    im.yerAc(satirlar.length * 5 + 2);
    doc.setFont(font, 'bold');
    doc.setTextColor(...INK);
    doc.text(`${i + 1}.`, M, im.y + 3.5);
    doc.setFont(font, 'normal');
    doc.text(satirlar, M + 7, im.y + 3.5);
    im.y += satirlar.length * 5 + 2;
  });
  im.y += 2;
}

/** Yasal dayanak / uyarı kutusu. */
function kutuBlogu(doc, font, im, { baslik, icerik, renk }) {
  const kenar = renk === 'kirmizi' ? RED : renk === 'sari' ? AMBER : INK;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.8);
  const satirlar = doc.splitTextToSize(yaz(icerik), im.icGen - 12);
  const h = satirlar.length * 4.6 + (baslik ? 6 : 0) + 8;
  im.yerAc(h + 4);

  doc.setFillColor(...CREAM);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, im.y, im.icGen, h, 2, 2, 'FD');
  doc.setFillColor(...kenar);
  doc.rect(M, im.y, 1.8, h, 'F');

  let iy = im.y + 6;
  if (baslik) {
    doc.setFont(font, 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...kenar);
    doc.text(yaz(baslik), M + 6, iy);
    iy += 5.5;
  }
  doc.setFont(font, 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...INK);
  doc.text(satirlar, M + 6, iy);
  im.y += h + 5;
}

function tabloBlogu(doc, font, im, bolum) {
  const kolonlar = bolum.kolonlar || [];
  const stiller = {};
  kolonlar.forEach((k, i) => {
    stiller[i] = {};
    if (k.hiza) stiller[i].halign = k.hiza;
    if (k.genislik) stiller[i].cellWidth = k.genislik;
  });

  const govde = (bolum.satirlar || []).map((r) => r.map((h) => yaz(h ?? '—')));
  const altSatir = bolum.toplamSatiri ? [bolum.toplamSatiri.map((h) => yaz(h ?? ''))] : undefined;

  doc.autoTable({
    startY: im.y,
    head: [kolonlar.map((k) => yaz(k.baslik))],
    body: govde.length ? govde : [[{ content: yaz('Kayıt yok'), colSpan: kolonlar.length, styles: { halign: 'center', textColor: MUTED } }]],
    foot: altSatir,
    margin: { top: CONTENT_Y, left: M, right: M, bottom: FOOTER_H },
    // Başlık her sayfada tekrarlansın, toplam satırı yalnızca sonda çıksın —
    // aksi hâlde her sayfanın altında "TOPLAM" yazıp yanıltıyor.
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'grid',
    styles: { font, fontSize: 8.4, cellPadding: 2.2, lineColor: LINE, lineWidth: 0.2, textColor: INK },
    headStyles: { font, fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], fontSize: 8.4 },
    footStyles: { font, fontStyle: 'bold', fillColor: CREAM, textColor: INK, fontSize: 8.6 },
    alternateRowStyles: { fillColor: [252, 249, 243] },
    columnStyles: stiller,
  });

  im.y = doc.lastAutoTable.finalY + 5;

  if (bolum.not) {
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const satirlar = doc.splitTextToSize(yaz(bolum.not), im.icGen);
    im.yerAc(satirlar.length * 4 + 2);
    doc.text(satirlar, M, im.y);
    im.y += satirlar.length * 4 + 4;
  }
}

/** İmza alanları — ıslak imza gereken belgeler için. */
function imzaBlogu(doc, font, im, imzalar) {
  if (!imzalar || !imzalar.length) return;
  const liste = imzalar.map((i) => (typeof i === 'string' ? { unvan: i } : i));
  const n = Math.min(liste.length, 3);
  const bosluk = 8;
  const w = (im.icGen - bosluk * (n - 1)) / n;

  im.yerAc(34);
  im.y += 8;
  liste.slice(0, 3).forEach((s, i) => {
    const x = M + i * (w + bosluk);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.line(x, im.y + 14, x + w, im.y + 14);

    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(yaz(s.unvan || ''), x, im.y + 19, { maxWidth: w });
    if (s.ad) {
      doc.setFont(font, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(yaz(s.ad), x, im.y + 23.5, { maxWidth: w });
    }
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(yaz('İmza'), x, im.y + 12);
  });
  im.y += 28;
}

/* ============================================================
   4) Ana giriş noktası
   ============================================================ */
/**
 * Belgeyi üretir, indirir ve (arsivle=true ise) arşive kaydeder.
 *
 * bolumler dizisindeki her eleman:
 *   { tip:'metin',  baslik?, icerik }                          düz paragraf(lar)
 *   { tip:'kv',     baslik?, satirlar:[[etiket, deger], …] }    etiket–değer
 *   { tip:'liste',  baslik?, maddeler:[…] }                     numaralı liste
 *   { tip:'tablo',  baslik?, kolonlar:[{baslik,hiza?,genislik?}],
 *                   satirlar:[[…]], toplamSatiri?, not? }
 *   { tip:'kutu',   baslik?, icerik, renk? }                    yasal dayanak
 */
export async function belgeUret({
  tur,
  modul,
  kategori = 'rapor',
  baslik,
  altBaslik,
  donem,
  ozet = [],
  bolumler = [],
  imzalar = [],
  dosyaAdi,
  iliskiliId = null,
  binaId = null,
  arsivle = true,
  yatay = false,
}) {
  if (!window.jspdf?.jsPDF) throw new Error('PDF kütüphanesi yüklenemedi, sayfayı yenileyin.');

  const site = C.S.site;
  const siteId = C.sId();

  /* Belge numarası önce alınır — antette basılacak. Migration uygulanmadıysa
     numara yerine tarih kullanılır ve arşivleme atlanır. */
  let belgeNo = null;
  let numaraliyiz = true;
  if (siteId) {
    const { data, error } = await C.supabase.rpc('next_document_no', { p_site_id: siteId });
    if (error) numaraliyiz = false; else belgeNo = data;
  } else {
    numaraliyiz = false;
  }
  if (!belgeNo) belgeNo = `${new Date().getFullYear()}/—`;

  const doc = new window.jspdf.jsPDF({ orientation: yatay ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const font = await fontuKur(doc);

  const duzenleyen = `${C.S.profile?.name || ''} ${C.S.profile?.surname || ''}`.trim() || 'Yönetici';
  const uretimZamani = tarihSaat(new Date());

  const im = imlec(doc);
  baslikBlogu(doc, font, im, { baslik, altBaslik, donem });

  /* Belgeyi kimin, ne zaman düzenlediği her evrakta bulunur. */
  kvBlogu(doc, font, im, [
    ['Düzenleyen', duzenleyen],
    ['Düzenleme tarihi', tarih(new Date())],
    ...(binaId && C.S.buildings.length > 1
      ? [['Bina', C.S.buildings.find((b) => b.id === binaId)?.name || '—']]
      : []),
  ]);

  ozetBlogu(doc, font, im, ozet);

  for (const bolum of bolumler) {
    if (!bolum) continue;
    // Kutu kendi başlığını çerçevenin içine basar; dışarıda ikinci kez yazma.
    if (bolum.tip !== 'kutu') bolumBasligi(doc, font, im, bolum.baslik);
    switch (bolum.tip) {
      case 'tablo': tabloBlogu(doc, font, im, bolum); break;
      case 'kv':    kvBlogu(doc, font, im, bolum.satirlar || []); break;
      case 'liste': listeBlogu(doc, font, im, bolum.maddeler || []); break;
      case 'kutu':  kutuBlogu(doc, font, im, bolum); break;
      case 'bosluk': im.y += bolum.yukseklik || 6; break;
      default:      metinBlogu(doc, font, im, bolum.icerik); break;
    }
  }

  imzaBlogu(doc, font, im, imzalar);

  sayfaCercevesi(doc, font, {
    siteAdi: site?.name || C.S.buildings[0]?.name || 'Site',
    siteAdres: site?.address || C.S.buildings[0]?.address || '',
    belgeNo,
    uretimZamani,
  });

  const dosya = `${slugla(dosyaAdi || baslik)}-${belgeNo.replace('/', '-')}.pdf`;
  doc.save(dosya);

  let arsivSonuc = null;
  if (arsivle && numaraliyiz && siteId) {
    arsivSonuc = await arsiveKaydet(doc, {
      siteId, binaId, belgeNo, tur, modul, kategori, baslik, altBaslik, donem, iliskiliId, dosya,
    });
  }

  return { belgeNo, dosya, arsivlendi: !!(arsivSonuc && !arsivSonuc.hata), arsivHatasi: arsivSonuc?.hata || null };
}

/* ---------- Arşivleme ---------- */
async function arsiveKaydet(doc, m) {
  const yil = new Date().getFullYear();
  const yol = `${m.siteId}/${yil}/${m.dosya}`;
  try {
    const blob = doc.output('blob');
    const { error: upErr } = await C.supabase.storage
      .from('documents')
      .upload(yol, blob, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { error: dbErr } = await C.supabase.from('documents').insert({
      site_id: m.siteId,
      building_id: m.binaId,
      title: m.altBaslik ? `${m.baslik} — ${m.altBaslik}` : m.baslik,
      category: m.kategori,
      doc_no: m.belgeNo,
      doc_type: m.tur,
      module: m.modul,
      period: m.donem || null,
      related_id: m.iliskiliId,
      storage_path: yol,
      issued_date: new Date().toISOString().slice(0, 10),
      generated: true,
      uploaded_by: C.S.user.id,
    });
    if (dbErr) throw new Error(dbErr.message);
    return { yol };
  } catch (err) {
    // Belge kullanıcıya zaten indi; arşivleme başarısızsa iş durmasın.
    console.warn('Belge arşivlenemedi:', err.message);
    return { hata: err.message };
  }
}

/** Arşivdeki bir belgeyi açmak için kısa ömürlü imzalı bağlantı üretir. */
export async function belgeBaglantisi(storagePath) {
  const { data, error } = await C.supabase.storage.from('documents').createSignedUrl(storagePath, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/* ============================================================
   5) Butonlar için ortak sarmalayıcı
   ============================================================ */
/** Butonu kilitler, belgeyi üretir, sonucu tost olarak bildirir. */
export async function belgeButonu(btn, uretici) {
  if (!btn) return uretici();
  const eskiMetin = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Belge hazırlanıyor…';
  try {
    const sonuc = await uretici();
    C.toast(sonuc?.arsivlendi
      ? `Belge ${sonuc.belgeNo} indirildi ve arşive kaydedildi`
      : `Belge indirildi${sonuc?.belgeNo ? ` (${sonuc.belgeNo})` : ''}`);
    return sonuc;
  } catch (err) {
    C.toast(err.message, true);
    throw err;
  } finally {
    btn.disabled = false;
    btn.textContent = eskiMetin;
  }
}
