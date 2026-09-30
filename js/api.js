/**
 * ETF Data API Engine
 * 실시간 네이버 API 수집 + CORS 프록시 지원 + 로컬 정적 JSON 캐스케이드
 */

const ETF_API = {
  BASE_URL: 'https://stock.naver.com/api/stockSecurity/etfs/v2/domestic?listingType=aumDesc&size=100&index=',
  FALLBACK_JSON: 'data/etf_data.json',
  
  // 프록시 리스트 (브라우저 직접 fetch CORS 차단 시 순차 시도)
  PROXIES: [
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ],

  /**
   * 단일 URL fetch 시도 (다이렉트 -> 프록시1 -> 프록시2)
   */
  async fetchWithProxyFallback(url, timeoutMs = 8000) {
    const urlsToTry = [
      { type: 'direct', url },
      ...this.PROXIES.map((fn, idx) => ({ type: `proxy-${idx + 1}`, url: fn(url) }))
    ];

    for (const item of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(item.url, {
          signal: controller.signal,
          headers: item.type === 'direct' ? {} : undefined
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data && data.items) {
            return { data, method: item.type };
          }
        }
      } catch (err) {
        // 다음 프록시 시도
      }
    }
    throw new Error(`Failed to fetch ${url} via direct and proxies`);
  },

  /**
   * 네이버 실시간 API 전체 종목(1~N 페이지) 수집
   */
  async fetchAllLive(onProgress) {
    if (onProgress) onProgress({ current: 0, total: 1, status: '1페이지 연결 확인 중...' });

    // 1페이지 요청
    const firstPageUrl = `${this.BASE_URL}1`;
    let firstResult;
    try {
      firstResult = await this.fetchWithProxyFallback(firstPageUrl);
    } catch (e) {
      throw new Error('실시간 API 연결 실패: CORS 또는 네트워크 제한');
    }

    const totalCount = parseInt(firstResult.data.totalCount || '0', 10);
    const pageSize = 100;
    const totalPages = Math.ceil(totalCount / pageSize);
    let allItems = [...firstResult.data.items];

    if (onProgress) {
      onProgress({
        current: 1,
        total: totalPages,
        status: `1/${totalPages} 페이지 수집 완료 (${allItems.length}개 종목)`
      });
    }

    // 2페이지부터 순차/병렬 수집
    const remainingPages = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    // 과도한 동시 요청으로 인한 차단을 방지하기 위해 3개씩 배치 처리
    const BATCH_SIZE = 3;
    for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
      const batch = remainingPages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (page) => {
        const url = `${this.BASE_URL}${page}`;
        const res = await this.fetchWithProxyFallback(url);
        return res.data.items || [];
      });

      const results = await Promise.all(batchPromises);
      results.forEach((items) => allItems.push(...items));

      if (onProgress) {
        const curr = Math.min(1 + i + batch.length, totalPages);
        onProgress({
          current: curr,
          total: totalPages,
          status: `${curr}/${totalPages} 페이지 수집 완료 (${allItems.length}/${totalCount}개 종목)`
        });
      }
    }

    return {
      source: 'live',
      method: firstResult.method,
      fetchedAt: new Date().toISOString(),
      totalCount: allItems.length,
      items: allItems
    };
  },

  /**
   * 정적 번들 JSON 로드 (Fallback / 고속 첫 화면 로딩)
   */
  async fetchLocalData() {
    const res = await fetch(this.FALLBACK_JSON + '?v=' + Date.now());
    if (!res.ok) {
      throw new Error(`로컬 데이터 파일을 읽을 수 없습니다: ${res.status}`);
    }
    const data = await res.json();
    return {
      source: 'local',
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      totalCount: data.totalCount || data.items.length,
      items: data.items
    };
  }
};

window.ETF_API = ETF_API;
