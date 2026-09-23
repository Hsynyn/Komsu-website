/* ============================================================
   Google Analytics 4 + KVKK çerez onayı
   ============================================================
   Tek dosya, her halka açık sayfaya tek satırla eklenir:

     <script src="analytics.js" defer></script>

   Neden banner: GA4 çerez yazar. KVKK ve AB tarafında zorunlu
   olmayan çerezler için açık rıza gerekir. Google Consent Mode v2
   ile ölçüm varsayılan olarak KAPALI başlar; ziyaretçi "Kabul et"
   demeden hiçbir çerez yazılmaz, sadece anonim ve çerezsiz sinyal
   gider. Reddederse hiç veri gitmez.

   Tercih localStorage'da saklanır (komsu.cerez), sunucuya gitmez.
   Panel (panel.html) ve iç araçlar bu dosyayı KULLANMAZ; orada
   ölçüm yapmıyoruz, giriş yapmış yöneticinin davranışını izlemek
   gereksiz ve gizlilik açısından fazladan yük.
   ============================================================ */
(function () {
  'use strict';

  var OLCUM_ID = 'G-GBHX15ZG11';
  var ANAHTAR  = 'komsu.cerez';       // 'kabul' | 'red'

  /* localStorage gizli sekmede patlayabilir; her erişim korumalı. */
  function oku() {
    try { return localStorage.getItem(ANAHTAR); } catch (e) { return null; }
  }
  function yaz(deger) {
    try { localStorage.setItem(ANAHTAR, deger); } catch (e) { /* yoksay */ }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  /* 1) Önce reddet, sonra izin varsa aç. Sıra önemli: gtag.js
        yüklenmeden ÖNCE default verilmezse çerez yazılır. */
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  var secim = oku();
  if (secim === 'kabul') izinVer();

  /* 2) gtag.js'i yükle. Onay olmasa da yüklenir; Consent Mode
        sayesinde çerezsiz, kimliksiz sinyal gönderir. */
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + OLCUM_ID;
  document.head.appendChild(s);

  gtag('js', new Date());
  gtag('config', OLCUM_ID, { anonymize_ip: true });

  function izinVer() {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',            // reklam yok, sadece ölçüm
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }

  /* 3) Banner — yalnızca ziyaretçi henüz seçim yapmadıysa. */
  if (secim === 'kabul' || secim === 'red') return;

  function bannerKur() {
    var kutu = document.createElement('div');
    kutu.className = 'cerez-bant';
    kutu.setAttribute('role', 'dialog');
    kutu.setAttribute('aria-label', 'Çerez tercihi');
    kutu.innerHTML =
      '<p>Siteyi nasıl kullandığınızı anlamak için isteğe bağlı ölçüm çerezleri kullanıyoruz. ' +
      'Reddederseniz site aynı şekilde çalışır. ' +
      '<a href="gizlilik-politikasi.html">Gizlilik Politikası</a></p>' +
      '<div class="cerez-btnler">' +
        '<button type="button" class="cerez-red">Reddet</button>' +
        '<button type="button" class="cerez-kabul">Kabul Et</button>' +
      '</div>';

    var stil = document.createElement('style');
    stil.textContent =
      '.cerez-bant{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;' +
      'max-width:640px;margin:0 auto;background:#FFFFFF;color:#2B2620;' +
      'border:1px solid #EFE2CF;border-radius:18px;padding:18px 20px;' +
      'box-shadow:0 18px 44px rgba(43,38,32,.18);display:flex;gap:16px;' +
      'align-items:center;flex-wrap:wrap;font-size:14px;line-height:1.5;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;}' +
      '.cerez-bant p{flex:1;min-width:240px;margin:0;}' +
      '.cerez-bant a{color:#8A6B45;}' +
      '.cerez-btnler{display:flex;gap:10px;flex-shrink:0;}' +
      '.cerez-bant button{font:inherit;font-weight:700;cursor:pointer;' +
      'border-radius:12px;padding:10px 18px;border:2px solid #2B2620;}' +
      '.cerez-red{background:transparent;color:#2B2620;}' +
      '.cerez-kabul{background:#2B2620;color:#FFF6E9;}' +
      '@media(max-width:520px){.cerez-btnler{width:100%}.cerez-bant button{flex:1}}';

    document.head.appendChild(stil);
    document.body.appendChild(kutu);

    kutu.querySelector('.cerez-kabul').addEventListener('click', function () {
      yaz('kabul'); izinVer(); kutu.remove();
    });
    kutu.querySelector('.cerez-red').addEventListener('click', function () {
      yaz('red'); kutu.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bannerKur);
  } else {
    bannerKur();
  }
})();
