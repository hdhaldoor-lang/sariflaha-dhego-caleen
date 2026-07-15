const state = {
  authenticated: false,
  role: 'agent',
  exchangeRate: 0.985,
  limits: { maxPerTxn: 1000, maxPerDay: 5000 },
  cards: [
    { id: 1, customerNumber: '25261', amount: 100, currency: 'USD', target: 'Zaad', exchangeValue: 98.5, status: 'todo', apiStatus: 'queued', error: '' },
    { id: 2, customerNumber: '25288', amount: 250, currency: 'USD', target: 'eDahab', exchangeValue: 246.25, status: 'doing', apiStatus: 'pending', error: '' },
    { id: 3, customerNumber: '25294', amount: 80, currency: 'USD', target: 'Zaad', exchangeValue: 78.8, status: 'done', apiStatus: 'success', error: '' }
  ],
  timeline: [
    { text: 'Rate updated to 0.985 by admin', time: 'Just now' },
    { text: 'API sync completed with Zaad', time: '3 min ago' }
  ],
  metrics: { queued: 1, completed: 12, volume: 1250, failed: 3 }
};

const elements = {
  board: document.getElementById('board'),
  statsGrid: document.getElementById('stats-grid'),
  timeline: document.getElementById('timeline'),
  headerRate: document.getElementById('header-rate'),
  sidebarRate: document.getElementById('sidebar-rate'),
  roleBadge: document.getElementById('role-badge'),
  loginOverlay: document.getElementById('login-overlay'),
  rateModal: document.getElementById('rate-modal'),
  limitsModal: document.getElementById('limits-modal'),
  toast: document.getElementById('toast'),
  metricQueue: document.getElementById('metric-queue'),
  metricCompleted: document.getElementById('metric-completed')
};

function init() {
  bindEvents();
  render();
}

function bindEvents() {
  document.getElementById('login-admin').addEventListener('click', () => login('admin'));
  document.getElementById('login-agent').addEventListener('click', () => login('agent'));
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('new-card-form').addEventListener('submit', handleCreateCard);
  document.getElementById('rate-open').addEventListener('click', openRateModal);
  document.getElementById('rate-close').addEventListener('click', closeRateModal);
  document.getElementById('rate-save').addEventListener('click', saveRate);
  document.getElementById('limits-open').addEventListener('click', openLimitsModal);
  document.getElementById('limits-close').addEventListener('click', closeLimitsModal);
  document.getElementById('limits-save').addEventListener('click', saveLimits);
  elements.board.addEventListener('dragstart', handleDragStart);
  elements.board.addEventListener('dragover', (event) => event.preventDefault());
  elements.board.addEventListener('drop', handleDrop);
}

function login(role) {
  state.authenticated = true;
  state.role = role;
  elements.loginOverlay.classList.add('hidden');
  elements.roleBadge.textContent = role === 'admin' ? 'Admin' : 'Agent';
  showToast(`Welcome ${role === 'admin' ? 'Admin' : 'Agent'}`);
  render();
}

function logout() {
  state.authenticated = false;
  elements.loginOverlay.classList.remove('hidden');
  render();
}

function handleCreateCard(event) {
  event.preventDefault();
  const customerNumber = document.getElementById('customer-number').value.trim();
  const amount = Number(document.getElementById('card-amount').value);
  const currency = document.getElementById('card-currency').value;
  const target = document.getElementById('card-target').value;

  if (!customerNumber || !amount) {
    showToast('Please fill in all fields');
    return;
  }

  state.cards.unshift({
    id: Date.now(),
    customerNumber,
    amount,
    currency,
    target,
    exchangeValue: amount * state.exchangeRate,
    status: 'todo',
    apiStatus: 'queued',
    error: ''
  });
  state.metrics.queued += 1;
  document.getElementById('new-card-form').reset();
  render();
  showToast('Request added to the board');
}

function handleDragStart(event) {
  if (!state.authenticated) return;
  const card = event.target.closest('.card');
  if (!card) return;
  event.dataTransfer.setData('text/plain', card.dataset.cardId);
}

function handleDrop(event) {
  event.preventDefault();
  const cardId = Number(event.dataTransfer.getData('text/plain'));
  const columnId = event.target.closest('.column')?.dataset.column;
  if (!cardId || !columnId) return;

  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  card.status = columnId;
  if (columnId === 'doing') {
    card.apiStatus = 'pending';
    card.error = '';
    processCard(card);
  } else if (columnId === 'done') {
    card.apiStatus = 'success';
  }
  render();
}

function processCard(card) {
  const exceedsLimit = card.amount > state.limits.maxPerTxn;
  const exceedsDaily = state.metrics.volume + card.amount > state.limits.maxPerDay;

  if (exceedsLimit || exceedsDaily) {
    card.apiStatus = 'failed';
    card.error = exceedsLimit ? 'Limit exceeded for this transaction' : 'Daily cap reached';
    card.status = 'todo';
    state.metrics.failed += 1;
    state.metrics.queued += 1;
    render();
    showToast('Transaction blocked by policy');
    return;
  }

  setTimeout(() => {
    card.apiStatus = 'success';
    card.status = 'done';
    state.metrics.completed += 1;
    state.metrics.queued = Math.max(0, state.metrics.queued - 1);
    state.metrics.volume += card.amount;
    render();
    showToast(`Transaction complete for ${card.customerNumber}`);
  }, 1000);
}

function openRateModal() {
  if (state.role !== 'admin') { showToast('Only admins can adjust the live rate'); return; }
  document.getElementById('new-rate').value = state.exchangeRate;
  elements.rateModal.classList.remove('hidden');
}

function closeRateModal() { elements.rateModal.classList.add('hidden'); }

function saveRate() {
  const value = Number(document.getElementById('new-rate').value);
  if (!value) { showToast('Please enter a valid rate'); return; }
  state.exchangeRate = value;
  state.cards.forEach((card) => { card.exchangeValue = card.amount * state.exchangeRate; });
  state.timeline.unshift({ text: `Rate updated to ${value} by ${state.role}`, time: 'Just now' });
  render();
  closeRateModal();
  showToast('Rate saved');
}

function openLimitsModal() {
  if (state.role !== 'admin') { showToast('Only admins can edit limits'); return; }
  document.getElementById('max-txn').value = state.limits.maxPerTxn;
  document.getElementById('max-day').value = state.limits.maxPerDay;
  elements.limitsModal.classList.remove('hidden');
}

function closeLimitsModal() { elements.limitsModal.classList.add('hidden'); }

function saveLimits() {
  const maxTxn = Number(document.getElementById('max-txn').value);
  const maxDay = Number(document.getElementById('max-day').value);
  if (!maxTxn || !maxDay) { showToast('Please enter valid limits'); return; }
  state.limits.maxPerTxn = maxTxn;
  state.limits.maxPerDay = maxDay;
  render();
  closeLimitsModal();
  showToast('Limits updated');
}

function render() {
  if (!state.authenticated) {
    elements.loginOverlay.classList.remove('hidden');
    return;
  }
  elements.loginOverlay.classList.add('hidden');
  elements.headerRate.textContent = state.exchangeRate.toFixed(3);
  elements.sidebarRate.textContent = `1 USD = ${state.exchangeRate.toFixed(3)} SLSH`;
  elements.roleBadge.textContent = state.role === 'admin' ? 'Admin' : 'Agent';
  elements.metricQueue.textContent = state.metrics.queued;
  elements.metricCompleted.textContent = state.metrics.completed;
  renderStats();
  renderBoard();
  renderTimeline();
}

function renderStats() {
  elements.statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="label">Volume</div>
      <strong>$${state.metrics.volume.toFixed(0)}</strong>
    </div>
    <div class="stat-card">
      <div class="label">Successful</div>
      <strong>${state.metrics.completed}</strong>
    </div>
    <div class="stat-card">
      <div class="label">Failed</div>
      <strong>${state.metrics.failed}</strong>
    </div>
    <div class="stat-card">
      <div class="label">Limits</div>
      <strong>$${state.limits.maxPerTxn} / $${state.limits.maxPerDay}</strong>
    </div>
  `;
}

function renderBoard() {
  const columns = [
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'In progress' },
    { id: 'done', title: 'Completed' }
  ];
  elements.board.innerHTML = columns.map((column) => {
    const cards = state.cards.filter((card) => card.status === column.id);
    return `
      <div class="column" data-column="${column.id}">
        <h4>${column.title}</h4>
        ${cards.map((card) => `
          <article class="card" draggable="true" data-card-id="${card.id}">
            <div class="card-header">
              <strong>${card.customerNumber}</strong>
              <span class="badge ${getBadgeClass(card.apiStatus)}">${getBadgeLabel(card.apiStatus)}</span>
            </div>
            <p>${card.amount.toFixed(2)} ${card.currency} → ${card.exchangeValue.toFixed(2)} ${card.target}</p>
            <p>Target: ${card.target}</p>
            ${card.error ? `<p style="color:#8a1f1f;">${card.error}</p>` : ''}
          </article>
        `).join('')}
      </div>
    `;
  }).join('');
}

function renderTimeline() {
  elements.timeline.innerHTML = state.timeline.map((item) => `
    <div class="timeline-item">
      <strong>${item.text}</strong>
      <p class="label">${item.time}</p>
    </div>
  `).join('');
}

function getBadgeClass(apiStatus) { if (apiStatus === 'success') return 'success'; if (apiStatus === 'failed') return 'failed'; return 'pending'; }
function getBadgeLabel(apiStatus) { if (apiStatus === 'success') return 'Success'; if (apiStatus === 'failed') return 'Failed'; return 'Pending'; }

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 1800);
}

window.addEventListener('DOMContentLoaded', init);
