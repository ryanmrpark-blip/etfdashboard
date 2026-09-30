/**
 * ETF Comprehensive EDA Dashboard - Main Application Controller
 */

const AppState = {
  rawItems: [],
  items: [],
  metrics: null,
  source: 'local',
  fetchedAt: null,
  
  // Table & Filters
  filters: {
    search: '',
    brand: 'all',
    category: 'all',
    movement: 'all',
    disparityAlertOnly: false
  },
  sort: {
    field: 'aum',
    direction: 'desc'
  },
  pagination: {
    page: 1,
    pageSize: 25
  },
  
  // Charts State
  returnDistPeriod: 'r1m',
  activeTab: 'tab-overview'
};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadInitialData();
});

/**
 * UI 초기화 및 이벤트 리스너 등록
 */
function initUI() {
  // 테마 토글
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    const savedTheme = localStorage.getItem('etf_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      updateThemeIcon('light');
    }
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('etf_theme', isLight ? 'light' : 'dark');
      updateThemeIcon(isLight ? 'light' : 'dark');
    });
  }

  // 탭 네비게이션
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        AppState.activeTab = targetId;
        // 차트 크기 재조정 트리거
        window.dispatchEvent(new Event('resize'));
      }
    });
  });

  // 수익률 분포 기간 토글 버튼
  document.querySelectorAll('.return-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.return-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.returnDistPeriod = btn.dataset.period;
      if (AppState.metrics) {
        ETF_CHARTS.renderReturnDistChart('chart-return-dist', AppState.metrics.returnDist, AppState.returnDistPeriod);
      }
    });
  });

  // 실시간 새로고침 버튼
  const refreshBtn = document.getElementById('btn-refresh-live');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchLiveData();
    });
  }

  // 테이블 검색 및 필터 이벤트
  const searchInput = document.getElementById('table-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.filters.search = e.target.value.trim().toLowerCase();
      AppState.pagination.page = 1;
      renderTable();
    });
  }

  const brandSelect = document.getElementById('filter-brand');
  if (brandSelect) {
    brandSelect.addEventListener('change', (e) => {
      AppState.filters.brand = e.target.value;
      AppState.pagination.page = 1;
      renderTable();
    });
  }

  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      AppState.filters.category = e.target.value;
      AppState.pagination.page = 1;
      renderTable();
    });
  }

  const moveSelect = document.getElementById('filter-movement');
  if (moveSelect) {
    moveSelect.addEventListener('change', (e) => {
      AppState.filters.movement = e.target.value;
      AppState.pagination.page = 1;
      renderTable();
    });
  }

  const alertCheck = document.getElementById('check-disparity-alert');
  if (alertCheck) {
    alertCheck.addEventListener('change', (e) => {
      AppState.filters.disparityAlertOnly = e.target.checked;
      AppState.pagination.page = 1;
      renderTable();
    });
  }

  // 테이블 정렬 클릭 이벤트
  document.querySelectorAll('#etf-data-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (AppState.sort.field === field) {
        AppState.sort.direction = AppState.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        AppState.sort.field = field;
        AppState.sort.direction = 'desc';
      }
      renderTable();
    });
  });

  // 페이지네이션
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (AppState.pagination.page > 1) {
      AppState.pagination.page--;
      renderTable();
    }
  });

  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredItems().length / AppState.pagination.pageSize);
    if (AppState.pagination.page < totalPages) {
      AppState.pagination.page++;
      renderTable();
    }
  });

  // 내보내기 버튼
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);

  // 모달 닫기
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('etf-detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'etf-detail-modal') closeModal();
  });
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.innerHTML = theme === 'light' 
      ? '<i data-lucide="moon"></i>' 
      : '<i data-lucide="sun"></i>';
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * 초기 데이터 로드 (로컬 정적 JSON 우선 로드로 초고속 렌더링)
 */
async function loadInitialData() {
  showLoading('데이터 로드 중...');
  try {
    const res = await ETF_API.fetchLocalData();
    applyData(res);
    hideLoading();
  } catch (err) {
    console.warn('로컬 데이터 로드 실패, 실시간 API 시도:', err);
    fetchLiveData();
  }
}

/**
 * 네이버 API 실시간 수집 실행
 */
async function fetchLiveData() {
  const refreshBtn = document.getElementById('btn-refresh-live');
  const originalText = refreshBtn ? refreshBtn.innerHTML : '';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner"></span> 수집 중...';
  }

  const progressBar = document.getElementById('progress-bar');
  const progressWrap = document.getElementById('progress-wrap');
  if (progressWrap) progressWrap.style.display = 'block';

  try {
    const res = await ETF_API.fetchAllLive((prog) => {
      const pct = Math.round((prog.current / prog.total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      updateStatusText(prog.status);
    });

    applyData(res);
    updateStatusText(`실시간 데이터 동기화 완료 (${res.totalCount}개 종목)`);
  } catch (err) {
    console.error('실시간 수집 실패:', err);
    alert(`실시간 데이터 수집 실패: ${err.message}\n로컬 캐시 데이터를 유지합니다.`);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalText;
    }
    if (progressWrap) {
      setTimeout(() => {
        progressWrap.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
      }, 1000);
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * 데이터 적용 및 전체 화면 렌더링
 */
function applyData(dataset) {
  AppState.rawItems = dataset.items || [];
  AppState.source = dataset.source || 'local';
  AppState.fetchedAt = dataset.fetchedAt || new Date().toISOString();

  // EDA 엔진으로 데이터 전처리 및 지표 계산
  AppState.items = ETF_EDA.processItems(AppState.rawItems);
  AppState.metrics = ETF_EDA.computeDashboardMetrics(AppState.items);

  // 헤더 및 상태바 업데이트
  updateHeaderStatus();

  // 브랜드 및 카테고리 필터 셀렉트박스 채우기
  populateFilterOptions();

  // KPI 카드 렌더링
  renderKPICards();

  // 차트 렌더링
  renderAllCharts();

  // 랭킹 리스트 렌더링
  renderRankings();

  // 테이블 렌더링
  renderTable();

  if (window.lucide) window.lucide.createIcons();
}

/**
 * 상단 상태 표시줄 업데이트
 */
function updateHeaderStatus() {
  const timeEl = document.getElementById('last-sync-time');
  if (timeEl && AppState.fetchedAt) {
    const d = new Date(AppState.fetchedAt);
    timeEl.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  const sourceBadge = document.getElementById('data-source-badge');
  if (sourceBadge) {
    if (AppState.source === 'live') {
      sourceBadge.className = 'source-badge source-live';
      sourceBadge.textContent = '네이버 실시간 API';
    } else {
      sourceBadge.className = 'source-badge source-local';
      sourceBadge.textContent = '정적 번들 데이터';
    }
  }

  const countBadge = document.getElementById('total-stock-count');
  if (countBadge) {
    countBadge.textContent = `${AppState.items.length.toLocaleString()}개 종목`;
  }
}

function updateStatusText(text) {
  const el = document.getElementById('status-message');
  if (el) el.textContent = text;
}

/**
 * 필터 셀렉트 박스 옵션 생성
 */
function populateFilterOptions() {
  const brandSelect = document.getElementById('filter-brand');
  if (brandSelect && AppState.metrics) {
    const currentVal = brandSelect.value;
    brandSelect.innerHTML = '<option value="all">운용사/브랜드 전체</option>';
    AppState.metrics.brandList.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.brand;
      opt.textContent = `${b.brand} (${b.count}개, ${(b.share || 0).toFixed(1)}%)`;
      brandSelect.appendChild(opt);
    });
    brandSelect.value = currentVal || 'all';
  }

  const catSelect = document.getElementById('filter-category');
  if (catSelect && AppState.metrics) {
    const currentVal = catSelect.value;
    catSelect.innerHTML = '<option value="all">자산분류 전체</option>';
    AppState.metrics.categoryList.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.category;
      opt.textContent = `${c.category} (${c.count}개)`;
      catSelect.appendChild(opt);
    });
    catSelect.value = currentVal || 'all';
  }
}

/**
 * 상단 핵심 KPI 카드 렌더링
 */
function renderKPICards() {
  const m = AppState.metrics;
  if (!m) return;

  // 1. 총 순자산
  document.getElementById('kpi-total-aum').textContent = ETF_EDA.formatMoney(m.totalAum);
  document.getElementById('kpi-aum-sub').textContent = `상장종목 ${m.totalCount.toLocaleString()}개 기준`;

  // 2. 일일 거래대금
  document.getElementById('kpi-trading-val').textContent = ETF_EDA.formatMoney(m.totalTradingValue);
  const avgTurnover = m.totalAum > 0 ? (m.totalTradingValue / m.totalAum) * 100 : 0;
  document.getElementById('kpi-turnover-sub').textContent = `시장 일평균 회전율 ${avgTurnover.toFixed(2)}%`;

  // 3. 시장 등락 현황 & 마켓 브레드스
  const risingPct = ((m.risingCount / m.totalCount) * 100).toFixed(1);
  const fallingPct = ((m.fallingCount / m.totalCount) * 100).toFixed(1);
  document.getElementById('kpi-market-breadth-val').textContent = `상승 ${m.risingCount} / 하락 ${m.fallingCount}`;
  document.getElementById('kpi-market-breadth-sub').innerHTML = `
    <span class="text-up">상승 ${risingPct}%</span> · 
    <span class="text-down">하락 ${fallingPct}%</span> · 
    <span class="text-flat">보합 ${m.unchangedCount}개</span>
  `;

  // 4. 가중평균 등락률
  const weightedEl = document.getElementById('kpi-weighted-rate');
  weightedEl.textContent = ETF_EDA.formatPercent(m.weightedAvgChangeRate);
  weightedEl.className = `kpi-value ${m.weightedAvgChangeRate > 0 ? 'text-up' : m.weightedAvgChangeRate < 0 ? 'text-down' : 'text-flat'}`;
  document.getElementById('kpi-simple-rate-sub').textContent = `단순평균 등락률 ${ETF_EDA.formatPercent(m.simpleAvgChangeRate)}`;

  // 5. 시장 집중도 (HHI)
  document.getElementById('kpi-hhi-val').textContent = `CR3: ${m.marketConcentration.cr3.toFixed(1)}%`;
  document.getElementById('kpi-hhi-sub').textContent = `HHI 지수: ${Math.round(m.marketConcentration.hhi)} (${m.marketConcentration.level})`;

  // 6. 괴리율 리스크 경보
  const dispEl = document.getElementById('kpi-disparity-val');
  dispEl.textContent = `${m.disparityAlertCount}개 종목`;
  dispEl.className = `kpi-value ${m.disparityAlertCount > 20 ? 'text-up' : ''}`;
  document.getElementById('kpi-disparity-sub').textContent = `평균 괴리율 ${ETF_EDA.formatPercent(m.avgDisparity)} (|괴리율| ≥ 1%)`;
}

/**
 * 차트 렌더링
 */
function renderAllCharts() {
  const m = AppState.metrics;
  if (!m) return;

  // 운용사 점유율 도넛
  ETF_CHARTS.renderBrandShareChart('chart-brand-share', m.brandList, m.totalAum);

  // 자산군별 AUM 규모
  ETF_CHARTS.renderCategoryAumChart('chart-category-aum', m.categoryList);

  // 수익률 분포 히스토그램
  ETF_CHARTS.renderReturnDistChart('chart-return-dist', m.returnDist, AppState.returnDistPeriod);

  // 자산군별 평균 수익률 비교
  ETF_CHARTS.renderCategoryReturnsChart('chart-category-returns', m.categoryList);

  // 유동성 산점도 (AUM vs 거래대금)
  ETF_CHARTS.renderScatterChart('chart-liquidity-scatter', AppState.items);

  // 괴리율 분포
  ETF_CHARTS.renderDisparityChart('chart-disparity-dist', m.disparityDist);
}

/**
 * 랭킹 리스트 렌더링
 */
function renderRankings() {
  const r = AppState.metrics?.rankings;
  if (!r) return;

  renderRankingList('list-top-r1m', r.topR1m, (item) => ETF_EDA.formatPercent(item.r1m), 'text-up');
  renderRankingList('list-bottom-r1m', r.bottomR1m, (item) => ETF_EDA.formatPercent(item.r1m), 'text-down');
  renderRankingList('list-top-turnover', r.topTurnover, (item) => `${item.turnover.toFixed(1)}%`, 'text-up');
  renderRankingList('list-high-disparity', r.highDisparity, (item) => ETF_EDA.formatPercent(item.disparity), 'text-up');
}

function renderRankingList(elementId, items, valueFormatter, colorClass = '') {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="text-muted p-2">데이터가 없습니다.</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="ranking-item" onclick="openDetailModal('${item.code}')">
      <span class="ranking-rank ${idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : ''}">${idx + 1}</span>
      <div class="ranking-info">
        <span class="ranking-name">${escapeHtml(item.name)}</span>
        <span class="ranking-sub">${item.code} · ${item.brand}</span>
      </div>
      <span class="ranking-val ${colorClass}">${valueFormatter(item)}</span>
    </div>
  `).join('');
}

/**
 * 필터링된 아이템 목록 가져오기
 */
function getFilteredItems() {
  let list = AppState.items;

  // 검색어 (이름, 코드)
  if (AppState.filters.search) {
    const q = AppState.filters.search;
    list = list.filter((i) => i.name.toLowerCase().includes(q) || i.code.includes(q));
  }

  // 브랜드
  if (AppState.filters.brand !== 'all') {
    list = list.filter((i) => i.brand === AppState.filters.brand);
  }

  // 카테고리
  if (AppState.filters.category !== 'all') {
    list = list.filter((i) => i.mainCategory === AppState.filters.category);
  }

  // 등락
  if (AppState.filters.movement !== 'all') {
    if (AppState.filters.movement === 'rising') list = list.filter((i) => i.changeRate > 0);
    else if (AppState.filters.movement === 'falling') list = list.filter((i) => i.changeRate < 0);
    else if (AppState.filters.movement === 'flat') list = list.filter((i) => i.changeRate === 0);
  }

  // 괴리율 위험 종목만 (|괴리율| >= 1.0%)
  if (AppState.filters.disparityAlertOnly) {
    list = list.filter((i) => i.disparity !== null && Math.abs(i.disparity) >= 1.0);
  }

  // 정렬
  const { field, direction } = AppState.sort;
  list.sort((a, b) => {
    let va = a[field];
    let vb = b[field];

    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;

    if (typeof va === 'string') {
      return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return direction === 'asc' ? va - vb : vb - va;
  });

  return list;
}

/**
 * 전체 종목 테이블 렌더링
 */
function renderTable() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  const filtered = getFilteredItems();
  const totalItems = filtered.length;
  const { page, pageSize } = AppState.pagination;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (AppState.pagination.page > totalPages) {
    AppState.pagination.page = totalPages;
  }

  const startIdx = (AppState.pagination.page - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  // 테이블 헤더 정렬 표시 업데이트
  document.querySelectorAll('#etf-data-table th[data-sort]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === AppState.sort.field) {
      th.classList.add(AppState.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">조건에 맞는 종목이 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map((item, idx) => {
      const rateClass = item.changeRate > 0 ? 'text-up' : item.changeRate < 0 ? 'text-down' : 'text-flat';
      const dispVal = item.disparity !== null ? ETF_EDA.formatPercent(item.disparity) : '-';
      const isDispAlert = item.disparity !== null && Math.abs(item.disparity) >= 1.0;

      return `
        <tr onclick="openDetailModal('${item.code}')">
          <td class="text-center" style="color:var(--text-muted);">${startIdx + idx + 1}</td>
          <td class="text-left">
            <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.name)}</div>
            <div style="display:flex; gap:6px; margin-top:2px;">
              <span class="item-code-badge">${item.code}</span>
              <span class="tag-badge tag-brand">${item.brand}</span>
              <span class="tag-badge tag-category">${item.mainCategory}</span>
            </div>
          </td>
          <td>${ETF_EDA.formatNumber(item.price)}원</td>
          <td class="${rateClass}">${ETF_EDA.formatPercent(item.changeRate)}</td>
          <td>${ETF_EDA.formatMoney(item.value)}</td>
          <td>${ETF_EDA.formatMoney(item.aum)}</td>
          <td class="${item.r1m > 0 ? 'text-up' : item.r1m < 0 ? 'text-down' : ''}">${ETF_EDA.formatPercent(item.r1m)}</td>
          <td class="${item.r3m > 0 ? 'text-up' : item.r3m < 0 ? 'text-down' : ''}">${ETF_EDA.formatPercent(item.r3m)}</td>
          <td class="${item.r6m > 0 ? 'text-up' : item.r6m < 0 ? 'text-down' : ''}">${ETF_EDA.formatPercent(item.r6m)}</td>
          <td class="${isDispAlert ? 'tag-disparity-danger' : ''}">${dispVal}</td>
        </tr>
      `;
    }).join('');
  }

  // 페이지네이션 업데이트
  document.getElementById('table-count-info').textContent = `총 ${totalItems.toLocaleString()}개 종목 중 ${Math.min(startIdx + 1, totalItems)}-${Math.min(startIdx + pageSize, totalItems)}`;
  document.getElementById('page-indicator').textContent = `${AppState.pagination.page} / ${totalPages} 페이지`;
  document.getElementById('btn-prev-page').disabled = AppState.pagination.page <= 1;
  document.getElementById('btn-next-page').disabled = AppState.pagination.page >= totalPages;
}

/**
 * 종목 상세 모달 열기
 */
function openDetailModal(code) {
  const item = AppState.items.find((i) => i.code === code);
  if (!item) return;

  document.getElementById('modal-etf-name').textContent = item.name;
  document.getElementById('modal-etf-code').textContent = `${item.code} · ${item.company} (${item.brand})`;

  document.getElementById('modal-price').textContent = `${ETF_EDA.formatNumber(item.price)}원`;
  const rateEl = document.getElementById('modal-change-rate');
  rateEl.textContent = `${ETF_EDA.formatPercent(item.changeRate)} (${item.changePrice > 0 ? '+' : ''}${ETF_EDA.formatNumber(item.changePrice)}원)`;
  rateEl.className = `modal-stat-value ${item.changeRate > 0 ? 'text-up' : item.changeRate < 0 ? 'text-down' : 'text-flat'}`;

  document.getElementById('modal-aum').textContent = ETF_EDA.formatMoney(item.aum);
  document.getElementById('modal-trading-val').textContent = ETF_EDA.formatMoney(item.value);
  document.getElementById('modal-volume').textContent = `${ETF_EDA.formatNumber(item.volume)}주`;

  document.getElementById('modal-inav').textContent = item.inav > 0 ? `${ETF_EDA.formatNumber(item.inav, 2)}원` : '-';
  const dispEl = document.getElementById('modal-disparity');
  if (item.disparity !== null) {
    dispEl.textContent = ETF_EDA.formatPercent(item.disparity);
    dispEl.className = `modal-stat-value ${Math.abs(item.disparity) >= 1.0 ? 'text-up' : 'text-emerald'}`;
  } else {
    dispEl.textContent = '-';
  }

  document.getElementById('modal-r1m').textContent = ETF_EDA.formatPercent(item.r1m);
  document.getElementById('modal-r3m').textContent = ETF_EDA.formatPercent(item.r3m);
  document.getElementById('modal-r6m').textContent = ETF_EDA.formatPercent(item.r6m);

  document.getElementById('modal-raw-type').textContent = item.rawType;
  document.getElementById('modal-turnover').textContent = `${item.turnover.toFixed(2)}%`;

  // 네이버 증권 링크
  const naverLink = document.getElementById('modal-naver-link');
  if (naverLink) {
    naverLink.href = `https://finance.naver.com/item/main.naver?code=${item.code}`;
  }

  document.getElementById('etf-detail-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('etf-detail-modal').classList.remove('open');
}

/**
 * CSV 내보내기
 */
function exportCSV() {
  const items = getFilteredItems();
  if (items.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const headers = ['종목코드', '종목명', '브랜드', '카테고리', '현재가', '등락률(%)', '전일대비(원)', '거래대금(원)', '거래량(주)', '순자산(원)', '1개월수익률(%)', '3개월수익률(%)', '6개월수익률(%)', 'iNav', '괴리율(%)'];
  const rows = items.map((i) => [
    `"${i.code}"`,
    `"${i.name.replace(/"/g, '""')}"`,
    `"${i.brand}"`,
    `"${i.mainCategory}"`,
    i.price,
    i.changeRate,
    i.changePrice,
    i.value,
    i.volume,
    i.aum,
    i.r1m ?? '',
    i.r3m ?? '',
    i.r6m ?? '',
    i.inav ?? '',
    i.disparity ? i.disparity.toFixed(2) : ''
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `naver_etf_eda_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * JSON 내보내기
 */
function exportJSON() {
  const items = getFilteredItems();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
  const link = document.createElement('a');
  link.href = dataStr;
  link.download = `naver_etf_eda_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function showLoading(msg) {
  updateStatusText(msg);
}

function hideLoading() {
  updateStatusText('데이터 준비 완료');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.openDetailModal = openDetailModal;
