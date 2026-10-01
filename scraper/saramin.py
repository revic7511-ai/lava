# -*- coding: utf-8 -*-
"""사람인 검색 페이지에서 공고 목록을 수집하는 모듈 (표준 라이브러리만 사용)."""
import html
import re
import ssl
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta

BASE_URL = "https://www.saramin.co.kr"
SEARCH_URL = BASE_URL + "/zf_user/search"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

_SSL = ssl.create_default_context()


def fetch(url, retries=3, delay=2.0, timeout=25):
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=_SSL, timeout=timeout) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(delay * (i + 1))
    raise RuntimeError(f"요청 실패: {url} ({last_err})")


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_items(page_html):
    """검색 결과 HTML에서 공고 항목들을 파싱한다."""
    starts = [m.start() for m in re.finditer(r'class="item_recruit"', page_html)]
    if not starts:
        return []
    ends = starts[1:] + [min(len(page_html), starts[-1] + 7000)]
    items = []
    for s, e in zip(starts, ends):
        block = page_html[s:e]
        try:
            item = _parse_block(block)
            if item and item.get("id") and item.get("title"):
                items.append(item)
        except Exception:  # noqa: BLE001
            continue
    return items


def _parse_block(block):
    m = re.search(r'class="item_recruit"[^>]*value="(\d+)"', block)
    if not m:
        return None
    rec_idx = m.group(1)

    m = re.search(r'<h2 class="job_tit">\s*<a[^>]*?title="([^"]+)"', block)
    title = html.unescape(m.group(1)).strip() if m else ""
    if not title:
        m = re.search(r'<h2 class="job_tit">.*?<span>(.*?)</span>', block, re.S)
        title = strip_tags(m.group(1)) if m else ""

    m = re.search(r'<h2 class="job_tit">\s*<a[^>]*?href="([^"]+)"', block)
    link = m.group(1) if m else f"/zf_user/jobs/relay/view?rec_idx={rec_idx}"
    if link.startswith("/"):
        link = BASE_URL + link
    # 불필요한 트래킹 파라미터 제거
    link = f"{BASE_URL}/zf_user/jobs/relay/view?rec_idx={rec_idx}"

    m = re.search(r'<div class="job_date">\s*<span class="date">(.*?)</span>', block, re.S)
    deadline_raw = strip_tags(m.group(1)) if m else ""

    m = re.search(r'<div class="job_condition">(.*?)</div>', block, re.S)
    conditions = [strip_tags(x) for x in re.findall(r"<span[^>]*>(.*?)</span>", m.group(1), re.S)] if m else []

    m = re.search(r'<div class="job_sector">(.*?)</div>', block, re.S)
    sectors = []
    if m:
        sectors = [strip_tags(x) for x in re.findall(r"<a[^>]*>(.*?)</a>", m.group(1), re.S)]
        sectors = [x for x in sectors if x]

    m = re.search(r'<span class="job_day">(.*?)</span>', block, re.S)
    job_day = strip_tags(m.group(1)) if m else ""

    m = re.search(r'<div class="area_badge">\s*<span[^>]*>(.*?)</span>', block, re.S)
    badge = strip_tags(m.group(1)) if m else ""

    m = re.search(r'<strong class="corp_name">\s*<a[^>]*>(.*?)</a>', block, re.S)
    company = strip_tags(m.group(1)) if m else ""

    location = conditions[0] if conditions else ""
    career = edu = job_type = ""
    for c in conditions[1:]:
        if re.search(r"신입|경력", c) and not career:
            career = c
        elif re.search(r"고졸|대졸|초대졸|학력|석사|박사", c) and not edu:
            edu = c
        elif re.search(r"정규직|계약직|파견|인턴|위촉|프리랜서|아르바이트", c) and not job_type:
            job_type = c

    return {
        "id": rec_idx,
        "title": title,
        "company": company,
        "location": location,
        "career": career,
        "edu": edu,
        "jobType": job_type,
        "sectors": sectors,
        "deadlineRaw": deadline_raw,
        "registeredRaw": job_day,
        "badge": badge,
        "url": link,
    }


def normalize_deadline(raw, today=None):
    """'~ 09/28(월)' 같은 표기를 ISO 날짜로 변환. 상시/채용시까지는 None."""
    today = today or date.today()
    if not raw:
        return None, True
    if "상시" in raw or "채용시" in raw or "채용 시" in raw:
        return None, True
    m = re.search(r"(\d{4})[./]\s?(\d{1,2})[./]\s?(\d{1,2})", raw)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d).isoformat(), False
        except ValueError:
            return None, False
    m = re.search(r"(\d{2,4})[./]\s?(\d{1,2})[./]\s?(\d{1,2})", raw)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y = y + 2000 if y < 100 else y
        try:
            return date(y, mo, d).isoformat(), False
        except ValueError:
            return None, False
    m = re.search(r"~\s*(\d{1,2})/(\d{1,2})", raw)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        year = today.year
        try:
            dt = date(year, mo, d)
        except ValueError:
            return None, False
        if dt < today - timedelta(days=7):
            dt = date(year + 1, mo, d)
        return dt.isoformat(), False
    if "오늘" in raw:
        return today.isoformat(), False
    if "내일" in raw:
        return (today + timedelta(days=1)).isoformat(), False
    if "모레" in raw:
        return (today + timedelta(days=2)).isoformat(), False
    return None, True


def normalize_registered(raw, today=None):
    """'등록일 26/09/09' → '2026-09-09'"""
    today = today or date.today()
    if not raw:
        return None
    m = re.search(r"(\d{2,4})/(\d{1,2})/(\d{1,2})", raw)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    y = y + 2000 if y < 100 else y
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def search(word, extra_params=None, timeout=25):
    params = {"searchword": word}
    if extra_params:
        params.update(extra_params)
    url = SEARCH_URL + "?" + urllib.parse.urlencode(params)
    page = fetch(url, timeout=timeout)
    return parse_items(page)
