# -*- coding: utf-8 -*-
"""
사람인에서 공고를 수집해 data/jobs.js + data/jobs.json 을 생성한다.

실행:  python scraper/run.py
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import saramin  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 수집에 사용할 검색어 (필요하면 자유롭게 추가)
QUERIES = [
    "공기업", "공공기관", "공기업 신입", "공채", "채용연계",
    "마이스터고", "고졸", "고졸 신입", "기능사", "산업기사",
    # 공기업/공공기관 직접 검색
    "한국전력", "한국철도공사", "한국가스공사", "한국도로공사", "한국수력원자력",
    "한국남동발전", "한국서부발전", "한국중부발전", "한국동서발전", "한국남부발전",
    "LH공사", "서울교통공사", "한국수자원공사", "한국환경공단", "한국공항공사",
    "인천국제공항공사", "한국마사회", "코레일네트웍스", "국가철도공단", "한국석유관리원",
    "한국지역난방공사", "한국농어촌공사", "SH공사",
    # 대기업 직접 검색
    "현대자동차", "기아", "삼성전자", "SK하이닉스", "LG전자", "포스코",
    "두산에너빌리티", "대한항공", "HD현대", "현대모비스",
]

# 학력/마이스터고 관련 키워드가 있으면 관련 공고로 판정
ELIGIBLE_KEYWORDS = ["고졸", "학력무관", "마이스터", "고등학교"]


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def classify(company, rules):
    c = company.replace(" ", "").lower()
    for kw in rules["major"]:
        if kw.lower() in c:
            return "대기업"
    for kw in rules["public"]:
        if kw.lower() in c:
            return "공기업"
    return "기타"


def main():
    rules = load_json(os.path.join(ROOT, "data", "companies.json"))
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    today = now.date()

    jobs = {}
    for q in QUERIES:
        print(f"[수집] '{q}' 검색 중...", flush=True)
        try:
            items = saramin.search(q)
        except Exception as e:  # noqa: BLE001
            print(f"  실패: {e}")
            continue
        print(f"  {len(items)}건")
        for it in items:
            j = jobs.get(it["id"])
            if j is None:
                j = dict(it)
                j["queries"] = [q]
                jobs[it["id"]] = j
            else:
                if q not in j["queries"]:
                    j["queries"].append(q)
                # 더 정확한 값으로 보완
                for k in ("title", "company", "location", "career", "edu", "jobType", "deadlineRaw"):
                    if not j.get(k) and it.get(k):
                        j[k] = it[k]
        time.sleep(2.0)

    result = []
    for j in jobs.values():
        dl, ongoing = saramin.normalize_deadline(j.get("deadlineRaw", ""), today)
        title_company = (j.get("title", "") + " " + j.get("edu", "") + " " + j.get("company", ""))
        eligible = any(k in title_company for k in ELIGIBLE_KEYWORDS)
        if not eligible:
            continue
        j["deadline"] = dl
        j["ongoing"] = ongoing
        j["registered"] = saramin.normalize_registered(j.get("registeredRaw", ""))
        j["type"] = classify(j.get("company", ""), rules)
        j["meister"] = "마이스터" in title_company
        j["source"] = "사람인"
        j["collectedAt"] = now.strftime("%Y-%m-%dT%H:%M:%S+09:00")
        result.append(j)

    # 마감 순(임박→늦음, 상시는 뒤로) → 등록일 내림차순
    result.sort(key=lambda j: (j.get("deadline") or "9999-99-99",
                               -(int(re.sub(r"\D", "", j.get("registered") or "0")) or 0)))

    data = {
        "collectedAt": now.strftime("%Y-%m-%d %H:%M"),
        "source": "사람인(www.saramin.co.kr) 검색 결과",
        "count": len(result),
        "jobs": result,
    }

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "jobs.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "data", "jobs.js"), "w", encoding="utf-8") as f:
        f.write("// 자동 생성: scraper/run.py\n")
        f.write("window.JOBS_DATA = ")
        json.dump(data, f, ensure_ascii=False)
        f.write(";\n")

    certs = load_json(os.path.join(ROOT, "data", "certs.json"))
    with open(os.path.join(ROOT, "data", "certs.js"), "w", encoding="utf-8") as f:
        f.write("// 자동 생성: data/certs.json 기반\n")
        f.write("window.CERTS_DATA = ")
        json.dump(certs, f, ensure_ascii=False)
        f.write(";\n")

    print(f"\n완료: 총 {len(result)}건 → data/jobs.json / data/jobs.js")
    print(f"갱신 시각: {data['collectedAt']}")


if __name__ == "__main__":
    main()
