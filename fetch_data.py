"""
네이버 증권 ETF 전체 종목 수집 스크립트
uv run python fetch_data.py
"""
import urllib.request
import json
import time
import os
from datetime import datetime

def fetch_all_etfs():
    base_url = "https://stock.naver.com/api/stockSecurity/etfs/v2/domestic?listingType=aumDesc&size=100&index="
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://finance.naver.com/"
    }

    all_items = []
    page = 1
    total_count = 0

    print("Fetching ETF data from Naver Securities API...")

    while True:
        url = f"{base_url}{page}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status != 200:
                    print(f"Failed to fetch page {page}: HTTP {response.status}")
                    break
                data = json.loads(response.read().decode('utf-8'))
                
                total_count = int(data.get("totalCount", 0))
                items = data.get("items", [])
                if not items:
                    break
                
                all_items.extend(items)
                print(f"Page {page}: collected {len(items)} items (Total: {len(all_items)} / {total_count})")
                
                if not data.get("hasNext", False) or len(all_items) >= total_count:
                    break
                
                page += 1
                time.sleep(0.1)  # polite delay
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    result = {
        "fetchedAt": datetime.now().isoformat(),
        "totalCount": len(all_items),
        "items": all_items
    }

    os.makedirs("data", exist_ok=True)
    out_path = os.path.join("data", "etf_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved {len(all_items)} ETFs to {out_path}")
    return result

if __name__ == "__main__":
    fetch_all_etfs()
