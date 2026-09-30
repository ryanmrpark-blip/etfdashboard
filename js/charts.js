/**
 * ETF Visualization Module (Chart.js v4)
 * 브랜드 점유율, 자산군 분포, 수익률 히스토그램, 유동성 산점도, 괴리율 분석
 */

const ETF_CHARTS = {
  instances: {},

  colors: {
    kodex: '#3b82f6',
    tiger: '#f97316',
    ace: '#10b981',
    rise: '#eab308',
    sol: '#06b6d4',
    plus: '#8b5cf6',
    others: '#64748b',
    palette: [
      '#3b82f6', '#f97316', '#10b981', '#eab308', '#06b6d4', 
      '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'
    ],
    up: '#ef4444',     // 한국 주식 상승: 레드
    down: '#3b82f6',   // 한국 주식 하락: 블루
    neutral: '#94a3b8'
  },

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  /**
   * 1. 운용사/브랜드별 AUM 점유율 도넛 차트
   */
  renderBrandShareChart(canvasId, brandList, totalAum) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const topBrands = brandList.slice(0, 6);
    const otherAum = brandList.slice(6).reduce((acc, cur) => acc + cur.aum, 0);

    const labels = topBrands.map(b => b.brand);
    const data = topBrands.map(b => b.aum);
    const colors = topBrands.map((b, i) => this.colors.palette[i % this.colors.palette.length]);

    if (otherAum > 0) {
      labels.push('기타 운용사');
      data.push(otherAum);
      colors.push(this.colors.others);
    }

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#1e293b',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 12,
              color: '#94a3b8',
              font: { family: 'Pretendard, sans-serif', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const pct = totalAum > 0 ? ((val / totalAum) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${ETF_EDA.formatMoney(val)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  /**
   * 2. 자산군(카테고리)별 AUM 규모 가로 막대 차트
   */
  renderCategoryAumChart(canvasId, categoryList) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = categoryList.map(c => c.category);
    const data = categoryList.map(c => Math.round(c.aum / 1e8)); // 억원 단위

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '순자산총액 (억원)',
          data: data,
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` 순자산: ${ETF_EDA.formatMoney(context.raw * 1e8)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#334155' },
            ticks: {
              color: '#94a3b8',
              callback: (val) => `${Math.round(val / 10000)}조`
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#e2e8f0', font: { family: 'Pretendard', size: 12 } }
          }
        }
      }
    });
  },

  /**
   * 3. 수익률 분포 히스토그램 (1M / 3M / 6M)
   */
  renderReturnDistChart(canvasId, returnDist, period = 'r1m') {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const data = returnDist[period] || returnDist.r1m;
    const bgColors = returnDist.labels.map(l => {
      if (l.includes('-')) return '#3b82f6cc'; // 하락 파랑
      if (l.includes('+')) return '#ef4444cc'; // 상승 빨강
      return '#94a3b8cc';
    });

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: returnDist.labels,
        datasets: [{
          label: '종목 수',
          data: data,
          backgroundColor: bgColors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` 종목 수: ${ctx.raw}개`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } }
          },
          y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },

  /**
   * 4. 자산군별 기간별 평균 수익률 비교 차트
   */
  renderCategoryReturnsChart(canvasId, categoryList) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = categoryList.map(c => c.category);
    const r1m = categoryList.map(c => c.avgR1m !== null ? Number(c.avgR1m.toFixed(2)) : 0);
    const r3m = categoryList.map(c => c.avgR3m !== null ? Number(c.avgR3m.toFixed(2)) : 0);
    const r6m = categoryList.map(c => c.avgR6m !== null ? Number(c.avgR6m.toFixed(2)) : 0);

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: '1개월 평균 (%)', data: r1m, backgroundColor: '#38bdf8', borderRadius: 4 },
          { label: '3개월 평균 (%)', data: r3m, backgroundColor: '#818cf8', borderRadius: 4 },
          { label: '6개월 평균 (%)', data: r6m, backgroundColor: '#c084fc', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Pretendard', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#e2e8f0', font: { size: 11 } }
          },
          y: {
            grid: { color: '#334155' },
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  },

  /**
   * 5. 유동성 산점도: 순자산(AUM) vs 거래대금 (상위 150종목)
   */
  renderScatterChart(canvasId, items) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // AUM 상위 150개 종목 추출 (가독성 향상)
    const topItems = [...items].sort((a, b) => b.aum - a.aum).slice(0, 150);

    const dataPoints = topItems.map(item => ({
      x: item.aum / 1e8,       // 억원
      y: item.value / 1e8,     // 억원
      name: item.name,
      code: item.code,
      rate: item.changeRate,
      turnover: item.turnover
    }));

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'ETF 종목',
          data: dataPoints,
          backgroundColor: dataPoints.map(p => p.rate > 0 ? '#ef4444aa' : p.rate < 0 ? '#3b82f6aa' : '#94a3b8aa'),
          borderColor: dataPoints.map(p => p.rate > 0 ? '#ef4444' : p.rate < 0 ? '#3b82f6' : '#94a3b8'),
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const pt = context.raw;
                return [
                  `[${pt.code}] ${pt.name}`,
                  `순자산: ${ETF_EDA.formatMoney(pt.x * 1e8)}`,
                  `거래대금: ${ETF_EDA.formatMoney(pt.y * 1e8)}`,
                  `등락률: ${ETF_EDA.formatPercent(pt.rate)}`,
                  `회전율: ${pt.turnover.toFixed(2)}%`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'logarithmic',
            title: { display: true, text: '순자산 AUM (억원, 로그 스케일)', color: '#94a3b8' },
            grid: { color: '#334155' },
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v.toLocaleString()}억`
            }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: '거래대금 (억원, 로그 스케일)', color: '#94a3b8' },
            grid: { color: '#334155' },
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v.toLocaleString()}억`
            }
          }
        }
      }
    });
  },

  /**
   * 6. 괴리율 구간 분포 차트
   */
  renderDisparityChart(canvasId, disparityDist) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const bgColors = [
      '#3b82f6', // 저평가 파랑
      '#60a5fa',
      '#10b981', // 정상 녹색
      '#f87171',
      '#ef4444'  // 고평가 빨강
    ];

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: disparityDist.labels,
        datasets: [{
          label: '종목 수',
          data: disparityDist.counts,
          backgroundColor: bgColors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` 종목 수: ${ctx.raw}개`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } }
          },
          y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }
};

window.ETF_CHARTS = ETF_CHARTS;
