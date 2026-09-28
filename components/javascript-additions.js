// Issue Detail Modal Management
let currentIssueDetail = null;

function showIssueDetail(issue) {
  currentIssueDetail = issue;
  $('detail-id').textContent = issue.id || '—';
  $('detail-ts').textContent = fmtTime(issue.ts);
  $('detail-consignment').textContent = issue.consignment || '—';
  $('detail-channel').textContent = issue.channel || '—';
  $('detail-zone').textContent = issue.zone || '—';
  $('detail-hub').textContent = issue.hub || '—';
  $('detail-category').textContent = issue.category || '—';
  $('detail-subcategory').textContent = issue.subcategory || '—';
  const statusHtml = `<span class="badge ${statusClass(issue.status)}">${escapeHtml(issue.status)}</span>`;
  $('detail-status').innerHTML = statusHtml;
  $('detail-flag').innerHTML = renderFlag(issue);
  $('detail-logged-by').textContent = issue.logged_by_name || issue.logged_by || '—';
  $('detail-details').textContent = issue.details || '—';
  $('detail-remarks').textContent = issue.remarks || '—';
  const attachments = parseAttachments(issue);
  if (attachments.length > 0) {
    $('detail-attachments-section').style.display = 'block';
    const attachHtml = `<div class="detail-attachments-grid">` + attachments.map((a, idx) => a.type === 'photo' ? `<img src="${a.dataUrl}" alt="attachment" class="detail-attach-thumb" data-issue="${issue.id}" data-idx="${idx}" onclick="openLightbox(this.src)">` : `<audio controls src="${a.dataUrl}" style="max-width:100%;"></audio>`).join('') + `</div>`;
    $('detail-attachments').innerHTML = attachHtml;
  } else {
    $('detail-attachments-section').style.display = 'none';
  }
  if (issue.history && issue.history.length > 0) {
    $('detail-history-section').style.display = 'block';
    const historyHtml = `<div class="history-timeline">` + issue.history.map(h => `<div class="history-item"><div class="history-time">${fmtTime(h.timestamp)}</div><div class="history-action">${escapeHtml(h.action)}</div></div>`).join('') + `</div>`;
    $('detail-history').innerHTML = historyHtml;
  } else {
    $('detail-history-section').style.display = 'none';
  }
  const canClose = issue.remarks && !issue.closed_by && (issue.logged_by || '').toLowerCase() === (authEmail || '').toLowerCase();
  const canReprocess = !issue.closed_by && issue.status !== 'Open';
  if (!canClose && !canReprocess) {
    $('detail-panel-actions').innerHTML = '<div class="empty-state">No actions available for this issue.</div>';
  } else {
    const closeBtn = $('detailActionClose');
    const reprocessBtn = $('detailActionReprocess');
    if (closeBtn) closeBtn.style.display = canClose ? 'flex' : 'none';
    if (reprocessBtn) reprocessBtn.style.display = canReprocess ? 'flex' : 'none';
  }
  $('actionStatusMsg').textContent = '';
  switchDetailTab('details');
  $('issueDetailOverlay').style.display = 'flex';
}

function closeIssueDetail() {
  $('issueDetailOverlay').style.display = 'none';
  currentIssueDetail = null;
}

function switchDetailTab(tab) {
  document.querySelectorAll('.detail-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.detail-panel').forEach(panel => panel.classList.toggle('active', panel.id === `detail-panel-${tab}`));
}

$('issueDetailClose').addEventListener('click', closeIssueDetail);
$('issueDetailOverlay').addEventListener('click', (e) => { if (e.target.id === 'issueDetailOverlay') closeIssueDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('issueDetailOverlay').style.display === 'flex') closeIssueDetail(); });
document.querySelectorAll('.detail-tab').forEach(btn => btn.addEventListener('click', () => switchDetailTab(btn.dataset.tab)));
$('detailActionClose').addEventListener('click', () => { if (currentIssueDetail) { closeIssueDetail(); openCloseModal(currentIssueDetail.id); } });

let pendingReprocessId = null;

function openReprocessModal(id) {
  pendingReprocessId = id;
  $('reprocessModalMsg').textContent = '';
  $('reprocessModalOverlay').style.display = 'flex';
}

function closeReprocessModal() {
  $('reprocessModalOverlay').style.display = 'none';
  pendingReprocessId = null;
}

$('reprocessModalCancel').addEventListener('click', closeReprocessModal);
$('reprocessModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'reprocessModalOverlay') closeReprocessModal(); });

async function confirmReprocess() {
  if (!pendingReprocessId) return;
  const msgEl = $('reprocessModalMsg');
  msgEl.textContent = 'Re-processing...';
  msgEl.className = 'status-msg';
  try {
    const res = await authedFetch(`/api/issues/${encodeURIComponent(pendingReprocessId)}/reprocess`, { method: 'PATCH', body: JSON.stringify({ reprocessed_by: authEmail, reprocessed_at: new Date().toISOString() }) });
    const data = await res.json();
    if (!res.ok) {
      msgEl.textContent = data.error || 'Could not re-process issue.';
      msgEl.classList.add('err');
      return;
    }
    msgEl.textContent = 'Issue re-escalated successfully!';
    msgEl.classList.add('ok');
    setTimeout(async () => { closeReprocessModal(); closeIssueDetail(); await loadAndRenderDashboard(); }, 1500);
  } catch (err) {
    msgEl.textContent = 'Could not reach the server.';
    msgEl.classList.add('err');
  }
}

$('reprocessModalConfirm').addEventListener('click', confirmReprocess);
$('detailActionReprocess').addEventListener('click', () => { if (currentIssueDetail) { closeIssueDetail(); openReprocessModal(currentIssueDetail.id); } });

function renderTable(list, bodyId, emptyId) {
  const body = $(bodyId);
  body.innerHTML = '';
  const sorted = [...list].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  $(emptyId).style.display = sorted.length ? 'none' : 'block';
  sorted.forEach(i => {
    const tr = document.createElement('tr');
    const canClose = i.remarks && !i.closed_by && (i.logged_by || '').toLowerCase() === (authEmail || '').toLowerCase();
    const canReprocess = !i.closed_by && i.status !== 'Open';
    let actionsHtml = '';
    if (i.closed_by) {
      actionsHtml = '✓ Closed';
    } else if (canClose || canReprocess) {
      if (canClose) actionsHtml += `<button class="action-btn-small btn-close" data-role="close-btn">Close</button>`;
      if (canReprocess) actionsHtml += `<button class="action-btn-small btn-reprocess" data-role="reprocess-btn">Re-process</button>`;
    } else {
      actionsHtml = '—';
    }
    tr.innerHTML = `<td class="mono">${fmtTime(i.ts)}</td><td>${escapeHtml(i.consignment)}</td><td>${escapeHtml(i.channel)}</td><td>${escapeHtml(i.zone)}</td><td class="hub-cell" data-hub="${escapeHtml(i.hub || '')}"><span class="hub-link">${escapeHtml(i.hub || '—')}</span><div class="hub-contacts" style="display:none;"></div></td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.subcategory)}</td><td><span class="badge ${statusClass(i.status)}">${escapeHtml(i.status)}</span></td><td>${renderFlag(i)}</td><td>${escapeHtml(i.logged_by_name || i.logged_by)}</td><td class="details-cell"><div class="details-text">${escapeHtml(i.remarks || '—')}</div></td><td class="details-cell"><div class="details-text">${escapeHtml(i.details)}</div>${renderAttachments(i)}</td><td class="actions-cell">${actionsHtml}</td>`;
    tr.addEventListener('click', (e) => { if (e.target.closest('[data-role]') || e.target.closest('.hub-link') || e.target.closest('.details-text') || e.target.closest('.attach-thumb')) return; showIssueDetail(i); });
    tr.querySelector('.details-text').addEventListener('click', (e) => { e.stopPropagation(); e.target.classList.toggle('expanded'); });
    const hubCell = tr.querySelector('.hub-cell');
    if (i.hub) hubCell.querySelector('.hub-link').addEventListener('click', (e) => { e.stopPropagation(); toggleHubContacts(hubCell, i.hub); });
    const closeBtn = tr.querySelector('[data-role="close-btn"]');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); openCloseModal(i.id); });
    const reprocessBtn = tr.querySelector('[data-role="reprocess-btn"]');
    if (reprocessBtn) reprocessBtn.addEventListener('click', (e) => { e.stopPropagation(); openReprocessModal(i.id); });
    body.appendChild(tr);
  });
}