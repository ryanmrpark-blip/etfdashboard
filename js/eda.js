/**
 * ETF Comprehensive Exploratory Data Analysis (EDA) Engine
 * 한국 증시 ETF 통계, 운용사 점유율, 수익률 분포, 괴리율, 유동성 심층 분석
 */

const ETF_EDA = {
  // 주요 운용사 브랜드 목록
  KNOWN_BRANDS: [
    { prefix: 'KODEX', company: '삼성자산운용' },
    { prefix: 'TIGER', company: '미래에셋자산운용' },
    { prefix: 'ACE', company: '한국투자신탁운용' },
    { prefix: 'RISE', company: 'KB자산운용' },
    { prefix: 'SOL', company: '신한자산운용' },
    { prefix: 'PLUS', company: '한화자산운용' },
    { prefix: 'HANARO', company: 'NH-Amundi자산운용' },
    { prefix: 'TIMEFOLIO', company: '타임폴리오자산운용' },
    { prefix: 'KoAct', company: '삼성액티브자산운용' },
    { prefix: 'WOORI', company: '우리자산운용' },
    { prefix: 'WON', company: '우리자산운용' },
    { prefix: '히어로즈', company: '키움투자자산운용' },
    { prefix: 'UNICORN', company: '현대자산운용' },
    { prefix: '마이티', company: '부국자산운용' },
    { prefix: '파워', company: '교보악사자산운용' },
    { prefix: 'ARIRANG', company: '한화자산운용(구)' },
    { prefix: 'KBSTAR', company: 'KB자산운용(구)' }
  ],

  /**
   * 원시 아이템을 정제된 숫자 및 분석 속성이 포함된 데이터 객체로 변환
   */
  processItems(rawItems) {
    return rawItems.map((item, index) => {
      const price = parseFloat(item.currentPrice) || 0;
      const changeRate = parseFloat(item.changeRate) || 0;
      const changePrice = parseFloat(item.changePrice) || 0;
      const volume = parseFloat(item.tradingVolume) || 0;
      const value = parseFloat(item.tradingValue) || 0; // 거래대금 (원)
      const aum = parseFloat(item.totalNetAssets) || 0; // 순자산 (원)
      const inav = parseFloat(item.iNav) || 0;
      const r1m = item.returnRate1m !== undefined && item.returnRate1m !== null && item.returnRate1m !== '' ? parseFloat(item.returnRate1m) : null;
      const r3m = item.returnRate3m !== undefined && item.returnRate3m !== null && item.returnRate3m !== '' ? parseFloat(item.returnRate3m) : null;
      const r6m = item.returnRate6m !== undefined && item.returnRate6m !== null && item.returnRate6m !== '' ? parseFloat(item.returnRate6m) : null;

      // 괴리율 = ((현재가 - iNav) / iNav) * 100
      let disparity = null;
      if (inav > 0 && price > 0) {
        disparity = ((price - inav) / inav) * 100;
      }

      // 회전율(Turnover Rate) = (거래대금 / 순자산) * 100
      let turnover = 0;
      if (aum > 0) {
        turnover = (value / aum) * 100;
      }

      // 브랜드 추출
      const name = item.itemName || '';
      let brand = '기타';
      let company = '기타 운용사';
      for (const b of this.KNOWN_BRANDS) {
        if (name.startsWith(b.prefix)) {
          brand = b.prefix;
          company = b.company;
          break;
        }
      }
      if (brand === '기타') {
        const firstWord = name.split(' ')[0];
        if (firstWord && firstWord.length > 1) {
          brand = firstWord;
        }
      }

      // 대분류 정규화
      const etfType = item.etfType || '미분류';
      let mainCategory = '기타/혼합';
      if (etfType.includes('해외') && etfType.includes('주식')) {
        mainCategory = '해외주식';
      } else if (etfType.includes('주식') || etfType.includes('시장대표') || etfType.includes('섹터') || etfType.includes('테마')) {
        mainCategory = '국내주식';
      } else if (etfType.includes('채권')) {
        mainCategory = etfType.includes('해외') ? '해외채권' : '국내채권';
      } else if (etfType.includes('상품') || etfType.includes('원자재') || etfType.includes('금') || etfType.includes('원유')) {
        mainCategory = '원자재/상품';
      } else if (etfType.includes('파생') || etfType.includes('레버리지') || etfType.includes('인버스')) {
        mainCategory = '파생/레버리지';
      } else if (etfType.includes('혼합')) {
        mainCategory = '자산배분/혼합';
      }

      // 파생/특수 여부 태그
      const isLeverage = name.includes('레버리지') || name.includes('2X');
      const isInverse = name.includes('인버스');
      const isActive = name.includes('액티브');
      const isHedged = name.includes('(H)');

      return {
        id: index + 1,
        code: item.itemCode,
        name: name,
        price,
        changePrice,
        changeRate,
        movement: item.priceMovement || (changeRate > 0 ? 'rising' : changeRate < 0 ? 'falling' : 'unchanged'),
        volume,
        value,
        aum,
        inav,
        disparity,
        turnover,
        r1m,
        r3m,
        r6m,
        rawType: etfType,
        mainCategory,
        brand,
        company,
        isLeverage,
        isInverse,
        isActive,
        isHedged
      };
    });
  },

  /**
   * 종합 EDA 통계 계산
   */
  computeDashboardMetrics(items) {
    if (!items || items.length === 0) return null;

    const totalCount = items.length;
    let totalAum = 0;
    let totalTradingValue = 0;
    let totalTradingVolume = 0;

    let risingCount = 0;
    let fallingCount = 0;
    let unchangedCount = 0;

    let sumChangeRate = 0;
    let weightedChangeRateSum = 0;

    let disparitySum = 0;
    let disparityCount = 0;
    let disparityAlertCount = 0; // |괴리율| >= 1.0%

    items.forEach((item) => {
      totalAum += item.aum;
      totalTradingValue += item.value;
      totalTradingVolume += item.volume;

      if (item.changeRate > 0) risingCount++;
      else if (item.changeRate < 0) fallingCount++;
      else unchangedCount++;

      sumChangeRate += item.changeRate;
      weightedChangeRateSum += item.changeRate * item.aum;

      if (item.disparity !== null && !isNaN(item.disparity)) {
        disparitySum += item.disparity;
        disparityCount++;
        if (Math.abs(item.disparity) >= 1.0) {
          disparityAlertCount++;
        }
      }
    });

    const simpleAvgChangeRate = totalCount > 0 ? sumChangeRate / totalCount : 0;
    const weightedAvgChangeRate = totalAum > 0 ? weightedChangeRateSum / totalAum : 0;
    const avgDisparity = disparityCount > 0 ? disparitySum / disparityCount : 0;

    // 운용사(브랜드) 집계
    const brandMap = {};
    items.forEach((item) => {
      const b = item.brand;
      if (!brandMap[b]) {
        brandMap[b] = {
          brand: b,
          company: item.company,
          count: 0,
          aum: 0,
          tradingValue: 0
        };
      }
      brandMap[b].count++;
      brandMap[b].aum += item.aum;
      brandMap[b].tradingValue += item.value;
    });

    const brandList = Object.values(brandMap).sort((a, b) => b.aum - a.aum);

    // 시장 집중도 지표 (CR3, CR5, HHI)
    let cr3 = 0;
    let cr5 = 0;
    let hhi = 0;
    brandList.forEach((b, idx) => {
      const share = totalAum > 0 ? (b.aum / totalAum) * 100 : 0;
      b.share = share;
      if (idx < 3) cr3 += share;
      if (idx < 5) cr5 += share;
      hhi += Math.pow(share, 2);
    });

    // 카테고리(자산군)별 집계
    const categoryMap = {};
    items.forEach((item) => {
      const cat = item.mainCategory;
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          count: 0,
          aum: 0,
          tradingValue: 0,
          r1mSum: 0,
          r1mCount: 0,
          r3mSum: 0,
          r3mCount: 0,
          r6mSum: 0,
          r6mCount: 0
        };
      }
      categoryMap[cat].count++;
      categoryMap[cat].aum += item.aum;
      categoryMap[cat].tradingValue += item.value;

      if (item.r1m !== null) {
        categoryMap[cat].r1mSum += item.r1m;
        categoryMap[cat].r1mCount++;
      }
      if (item.r3m !== null) {
        categoryMap[cat].r3mSum += item.r3m;
        categoryMap[cat].r3mCount++;
      }
      if (item.r6m !== null) {
        categoryMap[cat].r6mSum += item.r6m;
        categoryMap[cat].r6mCount++;
      }
    });

    const categoryList = Object.values(categoryMap).map((c) => ({
      ...c,
      aumShare: totalAum > 0 ? (c.aum / totalAum) * 100 : 0,
      turnover: c.aum > 0 ? (c.tradingValue / c.aum) * 100 : 0,
      avgR1m: c.r1mCount > 0 ? c.r1mSum / c.r1mCount : null,
      avgR3m: c.r3mCount > 0 ? c.r3mSum / c.r3mCount : null,
      avgR6m: c.r6mCount > 0 ? c.r6mSum / c.r6mCount : null
    })).sort((a, b) => b.aum - a.aum);

    // 수익률 히스토그램 빈 (1M, 3M, 6M)
    const returnBins = [
      { label: '< -15%', min: -Infinity, max: -15 },
      { label: '-15 ~ -10%', min: -15, max: -10 },
      { label: '-10 ~ -5%', min: -10, max: -5 },
      { label: '-5 ~ 0%', min: -5, max: 0 },
      { label: '0 ~ +5%', min: 0, max: 5 },
      { label: '+5 ~ +10%', min: 5, max: 10 },
      { label: '+10 ~ +15%', min: 10, max: 15 },
      { label: '> +15%', min: 15, max: Infinity }
    ];

    const returnDist = {
      r1m: returnBins.map(() => 0),
      r3m: returnBins.map(() => 0),
      r6m: returnBins.map(() => 0),
      labels: returnBins.map((b) => b.label)
    };

    items.forEach((item) => {
      returnBins.forEach((bin, idx) => {
        if (item.r1m !== null && item.r1m >= bin.min && item.r1m < bin.max) returnDist.r1m[idx]++;
        if (item.r3m !== null && item.r3m >= bin.min && item.r3m < bin.max) returnDist.r3m[idx]++;
        if (item.r6m !== null && item.r6m >= bin.min && item.r6m < bin.max) returnDist.r6m[idx]++;
      });
    });

    // 괴리율 구간 분포
    const disparityBins = [
      { label: '< -1.5%', min: -Infinity, max: -1.5 },
      { label: '-1.5 ~ -0.5%', min: -1.5, max: -0.5 },
      { label: '-0.5 ~ 0.5% (정상)', min: -0.5, max: 0.5 },
      { label: '+0.5 ~ +1.5%', min: 0.5, max: 1.5 },
      { label: '> +1.5%', min: 1.5, max: Infinity }
    ];
    const disparityDist = {
      labels: disparityBins.map((b) => b.label),
      counts: disparityBins.map(() => 0)
    };
    items.forEach((item) => {
      if (item.disparity !== null) {
        disparityBins.forEach((bin, idx) => {
          if (item.disparity >= bin.min && item.disparity < bin.max) {
            disparityDist.counts[idx]++;
          }
        });
      }
    });

    // Top / Bottom 랭킹 리스트
    const validR1m = items.filter((i) => i.r1m !== null);
    const topR1m = [...validR1m].sort((a, b) => b.r1m - a.r1m).slice(0, 10);
    const bottomR1m = [...validR1m].sort((a, b) => a.r1m - b.r1m).slice(0, 10);

    const topAum = [...items].sort((a, b) => b.aum - a.aum).slice(0, 10);
    const topValue = [...items].sort((a, b) => b.value - a.value).slice(0, 10);
    const topTurnover = [...items].filter((i) => i.aum > 10000000000).sort((a, b) => b.turnover - a.turnover).slice(0, 10); // 100억 이상

    // 괴리율 이상치 (고평가 / 저평가)
    const validDisparity = items.filter((i) => i.disparity !== null);
    const highDisparity = [...validDisparity].sort((a, b) => b.disparity - a.disparity).slice(0, 8);
    const lowDisparity = [...validDisparity].sort((a, b) => a.disparity - b.disparity).slice(0, 8);

    return {
      totalCount,
      totalAum,
      totalTradingValue,
      totalTradingVolume,
      risingCount,
      fallingCount,
      unchangedCount,
      simpleAvgChangeRate,
      weightedAvgChangeRate,
      avgDisparity,
      disparityAlertCount,
      marketConcentration: {
        cr3,
        cr5,
        hhi,
        level: hhi > 2500 ? '고집중 시장' : hhi > 1500 ? '중집중 시장' : '저집중 시장'
      },
      brandList,
      categoryList,
      returnDist,
      disparityDist,
      rankings: {
        topR1m,
        bottomR1m,
        topAum,
        topValue,
        topTurnover,
        highDisparity,
        lowDisparity
      }
    };
  },

  /**
   * 숫자 단위 포맷팅 (조/억원, 천분위 콤마 등)
   */
  formatMoney(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (abs >= 1e12) {
      // 조 단위
      const jo = Math.floor(abs / 1e12);
      const eok = Math.round((abs % 1e12) / 1e8);
      return eok > 0 ? `${sign}${jo.toLocaleString()}조 ${eok.toLocaleString()}억원` : `${sign}${jo.toLocaleString()}조원`;
    } else if (abs >= 1e8) {
      // 억 단위
      return `${sign}${(abs / 1e8).toLocaleString(undefined, { maximumFractionDigits: 1 })}억원`;
    } else if (abs >= 1e4) {
      // 만원 단위
      return `${sign}${(abs / 1e4).toLocaleString(undefined, { maximumFractionDigits: 0 })}만원`;
    }
    return `${sign}${Math.round(abs).toLocaleString()}원`;
  },

  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  formatPercent(num, withSign = true) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const val = Number(num).toFixed(2);
    if (withSign && num > 0) return `+${val}%`;
    return `${val}%`;
  }
};

window.ETF_EDA = ETF_EDA;
