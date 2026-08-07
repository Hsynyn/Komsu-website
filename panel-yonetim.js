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

let C = null;   // panel.js'ten gelen bağlam

export function initYonetim(ctx) { C = ctx; }

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
   ============================================================ */
const TASK_CATEGORIES = {
  yasal: { label: 'Yasal', icon: '⚖️' },
  bakim: { label: 'Bakım', icon: '🔧' },
  sozlesme: { label: 'Sözleşme', icon: '📄' },
  finans: { label: 'Finans', icon: '₺' },
  diger: { label: 'Diğer', icon: '•' },
};

let taskFilter = 'pending';

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
  const pending = all.filter(t => t.status === 'pending');
  const overdue = pending.filter(t => daysUntil(t.due_date) < 0);
  const soon = pending.filter(t => { const d = daysUntil(t.due_date); return d >= 0 && d <= 30; });
  const shown = taskFilter === 'all' ? all : all.filter(t => t.status === taskFilter);

  const row = (t) => {
    const d = daysUntil(t.due_date);
    const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.diger;
    const durum = t.status === 'done'
      ? '<span class="badge b-green">Tamamlandı</span>'
      : t.status === 'skipped'
        ? '<span class="badge b-gray">Atlandı</span>'
        : d < 0 ? `<span class="badge b-red">${Math.abs(d)} gün gecikti</span>`
        : d <= 30 ? `<span class="badge b-amber">${d} gün kaldı</span>`
        : `<span class="badge b-gray">${d} gün</span>`;
    return `<tr>
      <td><strong>${cat.icon} ${C.esc(t.title)}</strong>
        ${t.legal_basis ? `<div class="muted" style="font-size:12px">${C.esc(t.legal_basis)}</div>` : ''}
        ${t.description ? `<div class="muted" style="font-size:12px">${C.esc(t.description)}</div>` : ''}</td>
      <td>${cat.label}</td>
      <td>${C.dmy(t.due_date)}</td>
      <td>${t.recurrence_months ? `${t.recurrence_months} ayda bir` : 'Tek seferlik'}</td>
      <td>${durum}</td>
      <td class="t-right">
        ${t.status === 'pending' ? `<button class="btn btn-sm btn-green" data-act="done" data-id="${t.id}">Yapıldı</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${t.id}">Düzenle</button>
        <button class="btn btn-sm btn-outline-red" data-act="del" data-id="${t.id}">Sil</button>
      </td>
    </tr>`;
  };

  C.$content().innerHTML = `
    <div class="page-head"><h2>Yönetim Takvimi</h2>
      <div class="tools">
        <button class="btn btn-ghost" id="task-seed">Hazır Şablonları Yükle</button>
        <button class="btn" id="task-add">+ Görev Ekle</button>
      </div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      Yasal süreler ve periyodik bakımlar tek yerden. Tamamlanan tekrarlı görevler,
      periyoduna göre otomatik olarak bir sonraki tarihe yeniden oluşturulur.
    </p>

    <div class="stat-grid">
      <div class="stat"><div class="val" style="color:var(--red)">${overdue.length}</div><div class="lbl">Gecikmiş</div></div>
      <div class="stat"><div class="val" style="color:var(--amber)">${soon.length}</div><div class="lbl">30 gün içinde</div></div>
      <div class="stat"><div class="val">${pending.length}</div><div class="lbl">Bekleyen toplam</div></div>
    </div>

    <div class="card">
      <div class="cat-grid" id="task-filter" style="margin-bottom:14px;">
        ${[['pending','Bekleyen'],['done','Tamamlanan'],['skipped','Atlanan'],['all','Tümü']]
          .map(([v,l]) => `<button type="button" class="cat-chip ${taskFilter===v?'active':''}" data-f="${v}">${l}</button>`).join('')}
      </div>
      <table><thead><tr><th>Görev</th><th>Tür</th><th>Son Tarih</th><th>Tekrar</th><th>Durum</th><th></th></tr></thead>
      <tbody id="task-body">${shown.length ? shown.map(row).join('')
        : '<tr><td colspan="6" class="t-empty">Bu filtrede görev yok. "Hazır Şablonları Yükle" ile başlayabilirsiniz.</td></tr>'}</tbody></table>
    </div>`;

  C.el('task-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    taskFilter = b.dataset.f; renderTasks();
  });

  C.el('task-seed').onclick = async () => {
    const btn = C.el('task-seed'); btn.disabled = true; btn.textContent = 'Yükleniyor…';
    try {
      const { data: n, error: e2 } = await C.supabase.rpc('seed_management_tasks', { p_site_id: C.sId() });
      if (e2) throw new Error(e2.message);
      C.toast(n > 0 ? `${n} görev eklendi` : 'Tüm şablon görevler zaten mevcut');
      renderTasks();
    } catch (err) {
      C.toast(err.message, true);
      btn.disabled = false; btn.textContent = 'Hazır Şablonları Yükle';
    }
  };

  C.el('task-add').onclick = () => openTaskModal(null);

  C.el('task-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const rec = all.find(x => x.id === b.dataset.id); if (!rec) return;

    if (b.dataset.act === 'edit') return openTaskModal(rec);

    if (b.dataset.act === 'del') {
      if (!confirm('Bu görev silinsin mi?')) return;
      const { error: e3 } = await C.supabase.from('management_tasks').delete().eq('id', rec.id);
      if (e3) return C.toast(e3.message, true);
      C.toast('Görev silindi'); return renderTasks();
    }

    if (b.dataset.act === 'done') {
      b.disabled = true;
      try {
        await C.supabase.from('management_tasks')
          .update({ status: 'done', completed_at: new Date().toISOString(), completed_by: C.S.user.id })
          .eq('id', rec.id);
        // Tekrarlı görev: bir sonraki dönem için yenisini aç
        if (rec.recurrence_months) {
          await C.supabase.from('management_tasks').insert({
            site_id: rec.site_id, building_id: rec.building_id,
            title: rec.title, description: rec.description, category: rec.category,
            legal_basis: rec.legal_basis, assigned_to: rec.assigned_to,
            due_date: addMonths(rec.due_date, rec.recurrence_months),
            recurrence_months: rec.recurrence_months,
          });
          C.toast('Tamamlandı, bir sonraki dönem oluşturuldu');
        } else {
          C.toast('Görev tamamlandı');
        }
        renderTasks();
      } catch (err) { C.toast(err.message, true); b.disabled = false; }
    }
  });
}

function openTaskModal(rec) {
  const isEdit = !!rec;
  C.openModal(isEdit ? 'Görevi Düzenle' : 'Yeni Görev', `
    <div class="field"><label>Görev Adı *</label>
      <input id="t-title" placeholder="Örn: Asansör periyodik kontrolü" value="${isEdit ? C.esc(rec.title) : ''}" /></div>
    <div class="grid-2">
      <div class="field"><label>Tür</label>
        <select id="t-cat">${Object.entries(TASK_CATEGORIES).map(([v, o]) =>
          `<option value="${v}" ${isEdit && rec.category === v ? 'selected' : ''}>${o.icon} ${o.label}</option>`).join('')}</select></div>
      <div class="field"><label>Son Tarih *</label>
        <input id="t-due" type="date" value="${isEdit ? C.esc(rec.due_date) : C.todayISO()}" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Tekrar</label>
        <select id="t-rec">
          <option value="">Tek seferlik</option>
          ${[1,3,6,12,24].map(m => `<option value="${m}" ${isEdit && rec.recurrence_months === m ? 'selected' : ''}>${m} ayda bir</option>`).join('')}
        </select></div>
      <div class="field"><label>Sorumlu</label>
        <input id="t-who" placeholder="Örn: Yönetici" value="${isEdit ? C.esc(rec.assigned_to || '') : ''}" /></div>
    </div>
    <div class="field"><label>Yasal Dayanak (opsiyonel)</label>
      <input id="t-legal" placeholder="Örn: KMK m.41" value="${isEdit ? C.esc(rec.legal_basis || '') : ''}" /></div>
    <div class="field"><label>Açıklama</label>
      <textarea id="t-desc" rows="3">${isEdit ? C.esc(rec.description || '') : ''}</textarea></div>
    <div class="field"><label>Belge/Kanıt Bağlantısı</label>
      <input id="t-url" placeholder="Rapor, fatura ya da etiket fotoğrafı bağlantısı" value="${isEdit ? C.esc(rec.evidence_url || '') : ''}" /></div>
    <button class="btn btn-block" id="m-save">${isEdit ? 'Kaydet' : 'Görevi Ekle'}</button>
  `, async () => {
    const title = C.el('t-title').value.trim();
    const due = C.el('t-due').value;
    if (!title || !due) throw new Error('Görev adı ve son tarih zorunludur.');
    const payload = {
      title,
      category: C.el('t-cat').value,
      due_date: due,
      recurrence_months: C.el('t-rec').value ? Number(C.el('t-rec').value) : null,
      assigned_to: C.el('t-who').value.trim() || null,
      legal_basis: C.el('t-legal').value.trim() || null,
      description: C.el('t-desc').value.trim() || null,
      evidence_url: C.el('t-url').value.trim() || null,
    };
    const { error } = isEdit
      ? await C.supabase.from('management_tasks').update(payload).eq('id', rec.id)
      : await C.supabase.from('management_tasks').insert({ site_id: C.sId(), ...payload });
    if (error) throw new Error(error.message);
    C.toast(isEdit ? 'Görev güncellendi' : 'Görev eklendi');
  });
}

/* ============================================================
   2) İŞLETME PROJESİ (KMK m.37)
   ============================================================ */
let budgetYear = new Date().getFullYear();

export async function renderBudget() {
  if (!needSite()) return;

  const [budRes, aptRes] = await Promise.all([
    C.supabase.from('operating_budgets').select('*').eq('site_id', C.sId()).eq('year', budgetYear).maybeSingle(),
    C.supabase.from('apartments').select('id, apartment_number, owner_name, land_share, building_id').in('building_id', C.siteBIds()),
  ]);

  if (budRes.error && migrationUyarisi(budRes.error)) return;

  const budget = budRes.data;
  const apts = C.sortByApartment(aptRes.data);
  let items = [];
  if (budget) {
    const { data: it } = await C.supabase.from('operating_budget_items')
      .select('*').eq('budget_id', budget.id).order('sort_order');
    items = it || [];
  }

  const income = items.filter(i => i.kind === 'income');
  const expense = items.filter(i => i.kind === 'expense');
  const totalIncome = income.reduce((s, i) => s + Number(i.annual_amount), 0);
  const totalExpense = expense.reduce((s, i) => s + Number(i.annual_amount), 0);

  // KMK m.20 dağıtımı: 'equal' kalemler daire sayısına, 'arsa_payi' kalemler
  // arsa payına bölünür. Arsa payı girilmemişse eşit dağıtıma düşer.
  const totalShare = apts.reduce((s, a) => s + (Number(a.land_share) || 0), 0);
  const useShare = totalShare > 0;
  const equalTotal = expense.filter(i => i.share_basis === 'equal').reduce((s, i) => s + Number(i.annual_amount), 0);
  const shareTotal = expense.filter(i => i.share_basis === 'arsa_payi').reduce((s, i) => s + Number(i.annual_amount), 0);

  const perApt = (a) => {
    const eq = apts.length ? equalTotal / apts.length : 0;
    const sh = useShare
      ? shareTotal * ((Number(a.land_share) || 0) / totalShare)
      : (apts.length ? shareTotal / apts.length : 0);
    return { yearly: eq + sh, monthly: (eq + sh) / 12 };
  };

  const years = [budgetYear - 1, budgetYear, budgetYear + 1];
  const STATUS = {
    draft: '<span class="badge b-gray">Taslak</span>',
    notified: '<span class="badge b-amber">Tebliğ edildi</span>',
    approved: '<span class="badge b-green">Kesinleşti</span>',
    rejected: '<span class="badge b-red">Reddedildi</span>',
  };

  C.$content().innerHTML = `
    <div class="page-head"><h2>İşletme Projesi</h2>
      <div class="tools">
        <select class="mini" id="bud-year">${years.map(y => `<option value="${y}" ${y===budgetYear?'selected':''}>${y}</option>`).join('')}</select>
        ${budget ? `<button class="btn" id="bud-item-add">+ Kalem Ekle</button>`
                 : `<button class="btn" id="bud-create">${budgetYear} Projesini Oluştur</button>`}
      </div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      KMK m.37 — Kat malikleri kurulunca kabul edilmiş işletme projesi yoksa yönetici hazırlar.
      Kat maliklerine tebliğ edilir; tebliğden itibaren <strong>7 gün</strong> içinde itiraz edilmezse kesinleşir
      ve icra takibine dayanak olur.
    </p>

    ${!budget ? `<div class="card" style="text-align:center;padding:44px;">
      <div style="font-size:38px;line-height:1">📊</div>
      <h3 style="margin:10px 0 6px;">${budgetYear} için işletme projesi yok</h3>
      <p class="muted" style="font-size:13.5px;max-width:420px;margin:0 auto;">
        Yıllık tahmini gelir ve giderleri girin; sistem daire başına düşen yıllık ve aylık tutarı
        KMK m.20'ye göre hesaplasın.</p>
    </div>` : `
    <div class="stat-grid">
      <div class="stat"><div class="val">${C.TL(totalExpense)}</div><div class="lbl">Yıllık Gider</div></div>
      <div class="stat"><div class="val">${C.TL(totalIncome)}</div><div class="lbl">Yıllık Gelir</div></div>
      <div class="stat"><div class="val">${apts.length}</div><div class="lbl">Daire</div></div>
      <div class="stat"><div class="val">${STATUS[budget.status] || budget.status}</div><div class="lbl">Durum</div></div>
    </div>

    <div class="card">
      <h3>Gider Kalemleri</h3>
      <table><thead><tr><th>Kalem</th><th>Dağıtım</th><th class="t-right">Yıllık</th><th></th></tr></thead>
      <tbody id="bud-exp">${expense.length ? expense.map(i => `<tr>
        <td><strong>${C.esc(i.name)}</strong>${i.notes ? `<div class="muted" style="font-size:12px">${C.esc(i.notes)}</div>` : ''}</td>
        <td>${i.share_basis === 'equal' ? 'Eşit' : 'Arsa payı'}</td>
        <td class="t-right">${C.TL(i.annual_amount)}</td>
        <td class="t-right"><button class="btn btn-sm btn-outline-red" data-del="${i.id}">Sil</button></td>
      </tr>`).join('') : '<tr><td colspan="4" class="t-empty">Henüz gider kalemi yok</td></tr>'}</tbody></table>
    </div>

    ${income.length ? `<div class="card"><h3>Gelir Kalemleri</h3>
      <table><thead><tr><th>Kalem</th><th class="t-right">Yıllık</th><th></th></tr></thead>
      <tbody id="bud-inc">${income.map(i => `<tr>
        <td><strong>${C.esc(i.name)}</strong></td>
        <td class="t-right">${C.TL(i.annual_amount)}</td>
        <td class="t-right"><button class="btn btn-sm btn-outline-red" data-del="${i.id}">Sil</button></td>
      </tr>`).join('')}</tbody></table></div>` : ''}

    <div class="card">
      <h3>Daire Başına Dağıtım</h3>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 12px;">
        ${useShare
          ? 'Arsa payı girilmiş dairelere göre hesaplandı (KMK m.20).'
          : '⚠️ Dairelere arsa payı girilmediği için tüm kalemler eşit dağıtıldı. Daireler ekranından arsa paylarını girerseniz hesap kanuna uygun olur.'}
      </p>
      <table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th class="t-right">Arsa Payı</th><th class="t-right">Yıllık</th><th class="t-right">Aylık Aidat</th></tr></thead>
      <tbody>${apts.map(a => { const p = perApt(a); return `<tr>
        <td><strong>${C.esc(a.apartment_number)}</strong></td>
        <td>${C.esc(a.owner_name || '—')}</td>
        <td class="t-right">${a.land_share ? Number(a.land_share).toFixed(2) : '—'}</td>
        <td class="t-right">${C.TL(p.yearly)}</td>
        <td class="t-right"><strong>${C.TL(p.monthly)}</strong></td>
      </tr>`; }).join('') || '<tr><td colspan="5" class="t-empty">Daire kaydı yok</td></tr>'}</tbody></table>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <button class="btn btn-ghost" id="bud-csv">⬇ CSV İndir</button>
        ${budget.status === 'draft' ? `<button class="btn" id="bud-notify">Kat Maliklerine Tebliğ Et</button>` : ''}
        ${budget.status === 'notified' ? `<button class="btn btn-green" id="bud-approve">Kesinleşti Olarak İşaretle</button>` : ''}
        ${budget.status === 'approved' ? `<button class="btn" id="bud-apply">Aidatlara Uygula</button>` : ''}
      </div>
      ${budget.status === 'notified' && budget.objection_deadline ? `
        <div class="info-banner" style="margin:14px 0 0;">
          Tebliğ tarihi: <strong>${C.dmy(budget.notified_at)}</strong> ·
          İtiraz süresi bitişi: <strong>${C.dmy(budget.objection_deadline)}</strong>
          ${daysUntil(budget.objection_deadline) >= 0 ? ` (${daysUntil(budget.objection_deadline)} gün kaldı)` : ' — süre doldu, proje kesinleşmiş sayılır'}
        </div>` : ''}
    </div>`}`;

  C.el('bud-year').addEventListener('change', (e) => { budgetYear = +e.target.value; renderBudget(); });

  if (C.el('bud-create')) C.el('bud-create').onclick = async () => {
    const { error } = await C.supabase.from('operating_budgets').insert({ site_id: C.sId(), year: budgetYear });
    if (error) return C.toast(error.message, true);
    C.toast(`${budgetYear} işletme projesi oluşturuldu`); renderBudget();
  };

  if (C.el('bud-item-add')) C.el('bud-item-add').onclick = () => openBudgetItemModal(budget.id);

  ['bud-exp', 'bud-inc'].forEach(id => {
    const host = C.el(id); if (!host) return;
    host.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (!confirm('Kalem silinsin mi?')) return;
      const { error } = await C.supabase.from('operating_budget_items').delete().eq('id', b.dataset.del);
      if (error) return C.toast(error.message, true);
      C.toast('Kalem silindi'); renderBudget();
    });
  });

  if (C.el('bud-csv')) C.el('bud-csv').onclick = () => {
    C.downloadCSV(`isletme-projesi-${budgetYear}.csv`,
      ['Daire', 'Ev Sahibi', 'Arsa Payı', 'Yıllık', 'Aylık Aidat'],
      apts.map(a => { const p = perApt(a); return [a.apartment_number, a.owner_name || '', a.land_share || '', p.yearly.toFixed(2), p.monthly.toFixed(2)]; }));
    C.toast('İndirildi');
  };

  if (C.el('bud-notify')) C.el('bud-notify').onclick = async () => {
    if (!confirm('Proje kat maliklerine tebliğ edilmiş sayılacak ve 7 günlük itiraz süresi başlayacak. Onaylıyor musunuz?')) return;
    const now = new Date().toISOString();
    const { error } = await C.supabase.from('operating_budgets')
      .update({ status: 'notified', notified_at: now, objection_deadline: addDays(now.slice(0, 10), 7) })
      .eq('id', budget.id);
    if (error) return C.toast(error.message, true);
    if (C.notifyBuilding) {
      C.notifyBuilding('📊 İşletme Projesi', `${budgetYear} yılı işletme projesi tebliğ edildi. İtirazlarınızı 7 gün içinde iletebilirsiniz.`);
    }
    C.toast('Tebliğ edildi'); renderBudget();
  };

  if (C.el('bud-approve')) C.el('bud-approve').onclick = async () => {
    const { error } = await C.supabase.from('operating_budgets')
      .update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', budget.id);
    if (error) return C.toast(error.message, true);
    C.toast('Proje kesinleşti'); renderBudget();
  };

  if (C.el('bud-apply')) C.el('bud-apply').onclick = async () => {
    if (!confirm('Hesaplanan aylık tutarlar, bu yılın kalan aylarında aidat olarak tanımlanacak. Ödenmiş kayıtlara dokunulmaz. Devam edilsin mi?')) return;
    const btn = C.el('bud-apply'); btn.disabled = true; btn.textContent = 'Uygulanıyor…';
    try {
      const startMonth = budgetYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 1;
      for (const a of apts) {
        const amt = Math.round(perApt(a).monthly * 100) / 100;
        if (amt <= 0) continue;
        for (let m = startMonth; m <= 12; m++) {
          const { data: ex } = await C.supabase.from('monthly_fees').select('id, is_paid')
            .eq('apartment_id', a.id).eq('year', budgetYear).eq('month', m).maybeSingle();
          if (!ex) {
            await C.supabase.from('monthly_fees').insert({
              apartment_id: a.id, building_id: a.building_id, year: budgetYear, month: m, amount: amt, is_paid: false });
          } else if (!ex.is_paid) {
            await C.supabase.from('monthly_fees').update({ amount: amt }).eq('id', ex.id);
          }
        }
      }
      C.toast('Aidatlar işletme projesine göre güncellendi');
    } catch (err) { C.toast(err.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Aidatlara Uygula'; }
  };
}

function openBudgetItemModal(budgetId) {
  C.openModal('Bütçe Kalemi Ekle', `
    <div class="field"><label>Kalem Adı *</label>
      <input id="bi-name" placeholder="Örn: Kapıcı ücreti, Asansör bakımı, Elektrik" /></div>
    <div class="grid-2">
      <div class="field"><label>Tür</label>
        <select id="bi-kind"><option value="expense">Gider</option><option value="income">Gelir</option></select></div>
      <div class="field"><label>Yıllık Tutar (₺) *</label>
        <input id="bi-amt" inputmode="decimal" placeholder="Örn: 120000" /></div>
    </div>
    <div class="field"><label>Dağıtım Esası</label>
      <select id="bi-basis">
        <option value="arsa_payi">Arsa payı oranında (sigorta, bakım-onarım, yönetici aylığı…)</option>
        <option value="equal">Eşit (kapıcı, kaloriferci, bahçıvan, bekçi)</option>
      </select>
      <p class="muted" style="font-size:12px;margin-top:6px;">KMK m.20: kapıcı, kaloriferci, bahçıvan ve bekçi giderlerine <strong>eşit</strong>;
      sigorta primleri, ortak yerlerin bakım-onarımı ve yönetici aylığı gibi diğer giderlere <strong>arsa payı</strong> oranında katılınır.</p>
    </div>
    <div class="field"><label>Not</label><input id="bi-note" /></div>
    <button class="btn btn-block" id="m-save">Kalemi Ekle</button>
  `, async () => {
    const name = C.el('bi-name').value.trim();
    const amt = num(C.el('bi-amt').value);
    if (!name || amt <= 0) throw new Error('Kalem adı ve geçerli bir tutar zorunludur.');
    const { error } = await C.supabase.from('operating_budget_items').insert({
      budget_id: budgetId, name, kind: C.el('bi-kind').value,
      share_basis: C.el('bi-basis').value, annual_amount: amt,
      notes: C.el('bi-note').value.trim() || null,
    });
    if (error) throw new Error(error.message);
    C.toast('Kalem eklendi');
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

  C.$content().innerHTML = `
    <div class="page-head"><h2>Kurul & Denetim</h2>
      <div class="tools">
        <button class="btn btn-ghost" id="audit-add">+ Denetim Raporu</button>
        <button class="btn" id="board-add">+ Kurul Üyesi</button>
      </div>
    </div>

    ${(!hasYonetici || !hasDenetci || auditOverdue) ? `<div class="info-banner" style="margin-bottom:18px;">
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
      </tr>`).join('') : '<tr><td colspan="7" class="t-empty">Henüz kurul üyesi eklenmemiş</td></tr>'}</tbody></table>
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
              <button class="btn btn-sm btn-outline-red" data-audit-del="${a.id}">Sil</button>
            </div>
          </div>
          ${a.findings ? `<div class="decision-body rich-content">${a.findings}</div>` : ''}
        </div>`).join('') : '<div class="t-empty">Henüz denetim raporu yok</div>'}</div>
    </div>`;

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
      KMK m.30 — Toplantı yeter sayısı: kat maliklerinin <strong>sayı ve arsa payı bakımından yarıdan fazlası</strong>.
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
  C.el('gk-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const rec = list.find(x => x.id === b.dataset.id); if (!rec) return;
    if (b.dataset.act === 'edit') return openMeetingModal(rec);
    if (b.dataset.act === 'hazirun') return openAttendance(rec);
  });
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
    C.supabase.from('apartments').select('id, apartment_number, owner_name, land_share').in('building_id', C.siteBIds()),
    C.supabase.from('meeting_attendance').select('*').eq('meeting_id', meeting.id),
  ]);
  if (attRes.error && /does not exist|schema cache/i.test(attRes.error.message || '')) {
    return C.toast("Hazirun tablosu yok — 0020 migration'ını uygulayın", true);
  }

  const apts = C.sortByApartment(aptRes.data);
  const byNo = new Map((attRes.data || []).map(a => [a.apartment_no, a]));

  const rows = apts.map(a => {
    const rec = byNo.get(a.apartment_number);
    return `<tr>
      <td><strong>${C.esc(a.apartment_number)}</strong></td>
      <td>${C.esc(a.owner_name || '—')}</td>
      <td class="t-right">${a.land_share ? Number(a.land_share).toFixed(2) : '—'}</td>
      <td><label class="pay-check"><input type="checkbox" data-apt="${C.esc(a.apartment_number)}" ${rec?.attended ? 'checked' : ''}><span>Katıldı</span></label></td>
      <td><input data-proxy="${C.esc(a.apartment_number)}" placeholder="Vekil (varsa)" value="${C.esc(rec?.proxy_name || '')}" style="width:100%;padding:7px 10px;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:13px;" /></td>
    </tr>`;
  }).join('');

  C.openModal(`Hazirun Cetveli — ${meeting.title}`, `
    <div id="quorum-box" class="info-banner" style="margin:0 0 14px;"></div>
    <div style="max-height:52vh;overflow-y:auto;">
      <table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th class="t-right">Arsa Payı</th><th>Katılım</th><th>Vekalet</th></tr></thead>
      <tbody id="haz-body">${rows || '<tr><td colspan="5" class="t-empty">Daire kaydı yok</td></tr>'}</tbody></table>
    </div>
    <button class="btn btn-block" id="m-save" style="margin-top:14px;">Hazirun Cetvelini Kaydet</button>
  `, async () => {
    const rowsOut = apts.map(a => {
      const box = document.querySelector(`input[data-apt="${CSS.escape(a.apartment_number)}"]`);
      const proxy = document.querySelector(`input[data-proxy="${CSS.escape(a.apartment_number)}"]`);
      return {
        meeting_id: meeting.id, apartment_id: a.id, apartment_no: a.apartment_number,
        owner_name: a.owner_name || null, land_share: a.land_share,
        attended: !!box?.checked, proxy_name: proxy?.value.trim() || null,
      };
    });
    const { error } = await C.supabase.from('meeting_attendance')
      .upsert(rowsOut, { onConflict: 'meeting_id,apartment_no' });
    if (error) throw new Error(error.message);
    C.toast('Hazirun cetveli kaydedildi');
  });

  // KMK m.30 yeter sayısı: sayı VE arsa payı bakımından yarıdan fazla
  const updateQuorum = () => {
    const total = apts.length;
    const totalShare = apts.reduce((s, a) => s + (Number(a.land_share) || 0), 0);
    let cnt = 0, share = 0;
    apts.forEach(a => {
      const box = document.querySelector(`input[data-apt="${CSS.escape(a.apartment_number)}"]`);
      if (box?.checked) { cnt++; share += Number(a.land_share) || 0; }
    });
    const byCount = total > 0 && cnt > total / 2;
    const byShare = totalShare > 0 ? share > totalShare / 2 : byCount;
    const ok = byCount && byShare;
    const box = C.el('quorum-box');
    if (!box) return;
    box.innerHTML = meeting.is_second_call
      ? `<strong>İkinci toplantı</strong> — Katılım: ${cnt}/${total} daire${totalShare > 0 ? `, arsa payı ${share.toFixed(2)}/${totalShare.toFixed(2)}` : ''}.
         KMK m.30: ikinci toplantıda yeter sayı aranmaz, katılanların salt çoğunluğuyla karar alınır.`
      : `${ok ? '✅ <strong>Yeter sayı sağlandı</strong>' : '⚠️ <strong>Yeter sayı sağlanamadı</strong>'} —
         Katılım: ${cnt}/${total} daire ${byCount ? '✓' : '✗'}${totalShare > 0 ? `, arsa payı ${share.toFixed(2)}/${totalShare.toFixed(2)} ${byShare ? '✓' : '✗'}` : ''}.
         ${!ok ? 'İkinci toplantı çağrısı yapılabilir.' : ''}`;
  };
  const host = C.el('haz-body');
  if (host) { host.addEventListener('change', updateQuorum); updateQuorum(); }
}

/* ============================================================
   5) BORÇ TAKİBİ (KMK m.20 — aylık %5 gecikme tazminatı)
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
    C.supabase.from('apartments').select('id, apartment_number, owner_name, building_id').in('building_id', C.siteBIds()),
    C.supabase.from('debt_notices').select('*').eq('site_id', C.sId()).order('created_at', { ascending: false }),
  ]);
  if (noticeRes.error && migrationUyarisi(noticeRes.error)) return;

  const apts = C.sortByApartment(aptRes.data);
  const aptById = new Map(apts.map(a => [a.id, a]));
  const notices = noticeRes.data || [];

  // Daire bazında borç ve gecikme tazminatı.
  // Vade: ilgili ayın 1'i kabul edilir; gecikilen gün üzerinden aylık %5.
  const debts = new Map();
  (feeRes.data || []).forEach(f => {
    const a = aptById.get(f.apartment_id); if (!a) return;
    const due = new Date(f.year, f.month - 1, 1);
    const lateDays = Math.max(0, Math.floor((Date.now() - due.getTime()) / DAY));
    const fee = Math.round((lateDays / 30) * 0.05 * Number(f.amount) * 100) / 100;
    const cur = debts.get(a.id) || { apt: a, principal: 0, late: 0, months: 0 };
    cur.principal += Number(f.amount);
    cur.late += fee;
    cur.months += 1;
    debts.set(a.id, cur);
  });

  const list = [...debts.values()].sort((x, y) => (y.principal + y.late) - (x.principal + x.late));
  const totalPrincipal = list.reduce((s, d) => s + d.principal, 0);
  const totalLate = list.reduce((s, d) => s + d.late, 0);

  C.$content().innerHTML = `
    <div class="page-head"><h2>Borç Takibi</h2>
      <div class="tools"><button class="btn btn-ghost" id="debt-csv">⬇ CSV İndir</button></div>
    </div>
    <p class="muted" style="margin:-8px 0 18px;font-size:13px;">
      KMK m.20 — Ortak gider borcunu ödemeyen kat maliki, gecikilen günler için <strong>aylık %5</strong>
      gecikme tazminatı öder. Bu oran kanunla sabittir, yönetim planıyla değiştirilemez.
      Aşağıdaki hesap, ilgili ayın 1'i vade kabul edilerek yapılmıştır.
    </p>

    <div class="stat-grid">
      <div class="stat"><div class="val">${list.length}</div><div class="lbl">Borçlu Daire</div></div>
      <div class="stat"><div class="val">${C.TL(totalPrincipal)}</div><div class="lbl">Anapara</div></div>
      <div class="stat"><div class="val" style="color:var(--red)">${C.TL(totalLate)}</div><div class="lbl">Gecikme Tazminatı</div></div>
      <div class="stat"><div class="val">${C.TL(totalPrincipal + totalLate)}</div><div class="lbl">Toplam</div></div>
    </div>

    <div class="card">
      <h3>Borçlu Daireler</h3>
      <table><thead><tr><th>Daire</th><th>Ev Sahibi</th><th class="t-right">Ay</th><th class="t-right">Anapara</th><th class="t-right">Gecikme</th><th class="t-right">Toplam</th><th></th></tr></thead>
      <tbody id="debt-body">${list.length ? list.map(d => `<tr>
        <td><strong>${C.esc(d.apt.apartment_number)}</strong></td>
        <td>${C.esc(d.apt.owner_name || '—')}</td>
        <td class="t-right">${d.months}</td>
        <td class="t-right">${C.TL(d.principal)}</td>
        <td class="t-right" style="color:var(--red)">${C.TL(d.late)}</td>
        <td class="t-right"><strong>${C.TL(d.principal + d.late)}</strong></td>
        <td class="t-right"><button class="btn btn-sm btn-ghost" data-notice="${d.apt.id}">İhtar Kaydı Aç</button></td>
      </tr>`).join('') : '<tr><td colspan="7" class="t-empty">Ödenmemiş aidat yok 🎉</td></tr>'}</tbody></table>
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

  C.el('debt-csv').onclick = () => {
    C.downloadCSV(`borc-listesi-${C.todayISO()}.csv`,
      ['Daire', 'Ev Sahibi', 'Ay Sayısı', 'Anapara', 'Gecikme Tazminatı', 'Toplam'],
      list.map(d => [d.apt.apartment_number, d.apt.owner_name || '', d.months,
        d.principal.toFixed(2), d.late.toFixed(2), (d.principal + d.late).toFixed(2)]));
    C.toast('İndirildi');
  };

  C.el('debt-body').addEventListener('click', async (e) => {
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

  const docs = docRes.data || [];
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
      <h3>Belge Arşivi</h3>
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
              <button class="btn btn-sm btn-outline-red" data-ho-del="${h.id}">Sil</button>
            </div>
          </div>
          ${h.items ? `<div class="decision-body rich-content">${h.items}</div>` : ''}
        </div>`).join('') : '<div class="t-empty">Devir teslim kaydı yok</div>'}</div>
    </div>`;

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

function openHandoverModal() {
  C.openModal('Devir Teslim Tutanağı', `
    <div class="grid-2">
      <div class="field"><label>Devreden</label><input id="h-from" placeholder="Önceki yönetici" /></div>
      <div class="field"><label>Devralan</label><input id="h-to" placeholder="Yeni yönetici" /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Devir Tarihi *</label><input id="h-date" type="date" value="${C.todayISO()}" /></div>
      <div class="field"><label>Kasa Bakiyesi (₺)</label><input id="h-cash" inputmode="decimal" /></div>
    </div>
    <div class="field"><label>Banka Bakiyesi (₺)</label><input id="h-bank" inputmode="decimal" /></div>
    <div class="field"><label>Teslim Edilenler</label>${C.richEditorHTML('h-items', '')}</div>
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
    C.toast('Devir teslim tutanağı kaydedildi');
  });
  C.bindRichEditor('h-items');
}

/* ---------- panel.js'in kullanacağı rota tablosu ---------- */
export const yonetimRoutes = {
  tasks: renderTasks,
  budget: renderBudget,
  board: renderBoard,
  assembly: renderAssembly,
  debts: renderDebts,
  archive: renderArchive,
};
