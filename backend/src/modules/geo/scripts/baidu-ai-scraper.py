#!/usr/bin/env python3
import json
import re
import ssl
import sys
import time
from html import unescape
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse

try:
    from curl_cffi import requests  # type: ignore
except Exception:  # pragma: no cover - runtime fallback for lean servers
    requests = None
    import urllib.request


def _read_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _request_text(url, headers, timeout=30):
    return _request_get(url, headers=headers, timeout=timeout)["text"]


def _request_get(url, headers, params=None, cookies=None, timeout=30):
    if requests:
        response = requests.get(
            url,
            params=params,
            headers=headers,
            cookies=cookies,
            timeout=timeout,
            impersonate="chrome101",
        )
        response.encoding = "utf-8"
        cookie_dict = response.cookies.get_dict() if hasattr(response.cookies, "get_dict") else {}
        return {
            "text": response.text,
            "cookies": cookie_dict,
            "headers": dict(response.headers),
        }

    if params:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}{urlencode(params)}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout, context=ssl._create_unverified_context()) as response:
        return {
            "text": response.read().decode("utf-8", errors="ignore"),
            "cookies": {},
            "headers": dict(response.headers),
        }


def _request_post(url, headers, params=None, cookies=None, timeout=30):
    if requests:
        response = requests.post(
            url,
            params=params,
            headers=headers,
            cookies=cookies,
            timeout=timeout,
            impersonate="chrome101",
        )
        response.encoding = "utf-8"
        cookie_dict = response.cookies.get_dict() if hasattr(response.cookies, "get_dict") else {}
        return {
            "text": response.text,
            "cookies": cookie_dict,
            "headers": dict(response.headers),
        }

    if params:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}{urlencode(params)}"
    req = urllib.request.Request(url, headers=headers, data=b"", method="POST")
    with urllib.request.urlopen(req, timeout=timeout, context=ssl._create_unverified_context()) as response:
        return {
            "text": response.read().decode("utf-8", errors="ignore"),
            "cookies": {},
            "headers": dict(response.headers),
        }


def _safe_json_loads(text):
    try:
        return json.loads(text)
    except Exception:
        return None


def _load_json_maybe_encoded(value):
    if value is None:
        return None
    value = str(value).strip()
    return _safe_json_loads(value) or _safe_json_loads(unquote(value))


def _decode_baiduboxapp(url):
    try:
        params = parse_qs(url.split("?", 1)[1])
    except Exception:
        return url

    if "invokeVideoDetail" in url and "params" in params:
        params_obj = _load_json_maybe_encoded(params["params"][0])
        if isinstance(params_obj, dict):
            for key_path in (
                ("extRequest", "loc"),
                ("ext", "loc"),
                ("videoInfo", "ext_log", "log_loc"),
            ):
                node = params_obj
                for key in key_path:
                    node = node.get(key, {}) if isinstance(node, dict) else {}
                if isinstance(node, str) and node:
                    return node

    if "linkageschemeinfo" in params:
        info = _safe_json_loads(params["linkageschemeinfo"][0])
        if isinstance(info, dict) and info.get("videoscheme"):
            inner_params = parse_qs(info["videoscheme"].split("?", 1)[1])
            params_obj = _load_json_maybe_encoded(inner_params.get("params", ["{}"])[0])
            if isinstance(params_obj, dict):
                loc = (params_obj.get("extRequest") or {}).get("loc")
                if loc:
                    return loc.replace("\\u0026", "&")

    if "ch_url" in params:
        return params["ch_url"][0]

    return url


def _get_real_url(link_info):
    if not isinstance(link_info, dict):
        return ""
    if link_info.get("data-url"):
        return link_info.get("data-url")
    if link_info.get("origin-url"):
        return link_info.get("origin-url")
    href = link_info.get("href", "")
    if "baiduboxapp" in href:
        return _decode_baiduboxapp(href)
    return href


def _first_non_empty(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            return value.strip()
        if not isinstance(value, str):
            text = str(value).strip()
            if text:
                return text
    return ""


def _domain(url):
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def _extract_title(content):
    for pattern in (r"==\*\*(.*?)\*\*==", r":ml-search-more\[(.*?)\}", r"ml-text\[(.*?)\}"):
        matched = re.findall(pattern, content or "")
        if matched:
            return "".join(matched).replace('"', "").strip()
    first_line = (content or "").strip().splitlines()[0:1]
    return first_line[0][:120] if first_line else ""


def _summarize(content):
    text = re.sub(r":::ml-data[\s\S]*?:::", "", content or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:500]


def _hidden_value(html_text, name):
    input_match = re.search(
        rf"<input\b(?=[^>]*\bname=[\"']{re.escape(name)}[\"'])[^>]*>",
        html_text,
        re.IGNORECASE,
    )
    if not input_match:
        return ""
    value_match = re.search(r"\bvalue=[\"']([^\"']*)", input_match.group(0), re.IGNORECASE)
    return value_match.group(1) if value_match else ""


def _server_time(html_text):
    match = re.search(r'"serverTime":\s*(\d+)', html_text)
    return int(match.group(1)) if match else int(time.time())


def _script_texts(html_text):
    return re.findall(r"<script\b[^>]*>([\s\S]*?)</script>", html_text or "", re.IGNORECASE)


def _json_from_script_text(script_text):
    text = (script_text or "").strip()
    parsed = _safe_json_loads(text)
    if isinstance(parsed, dict):
        return parsed

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        parsed = _safe_json_loads(text[start:end + 1])
        if isinstance(parsed, dict):
            return parsed

    return None


def _find_script_json(html_text, marker, data_for=None):
    if data_for:
        pattern = rf"<script\b(?=[^>]*data-for=[\"']{re.escape(data_for)}[\"'])[^>]*>([\s\S]*?)</script>"
        scripts = re.findall(pattern, html_text or "", re.IGNORECASE)
    else:
        scripts = _script_texts(html_text)

    for script in scripts:
        if marker not in script:
            continue
        parsed = _json_from_script_text(script)
        if isinstance(parsed, dict):
            return parsed

    return None


def _debug_info(stage, html_text):
    return {
        "stage": stage,
        "htmlLength": len(html_text or ""),
        "hasBaiduSecurity": "百度安全验证" in (html_text or ""),
        "hasKexinLevel": "kexin_level" in (html_text or ""),
        "hasCopyContent": "copyContent" in (html_text or ""),
        "hasCitationDrawer": "citationDrawer" in (html_text or ""),
        "hasLinkInfo": "linkInfo" in (html_text or ""),
        "hasBaikan": 'data-for="baikan"' in (html_text or "") or "data-for='baikan'" in (html_text or ""),
        "prefix": re.sub(r"\s+", " ", (html_text or "")[:220]).strip(),
    }


def _extract_ai_payload(html_text, request_headers=None, cookies=None):
    if "百度安全验证" in html_text:
        return {
            "status": "BLOCKED",
            "blockedDetected": True,
            "errorMessage": "百度安全验证",
            "citations": [],
        }

    script_json = _find_script_json(html_text, "kexin_level")
    if isinstance(script_json, dict):
        content, citations = _extract_from_kexin(script_json)
        return {
            "status": "SUCCEEDED",
            "aiTitle": _extract_title(content),
            "content": unescape(content or ""),
            "contentSummary": _summarize(content),
            "citations": citations,
        }

    script_json = _find_script_json(html_text, "copyContent", "baikan")
    if isinstance(script_json, dict):
        content, citations = _extract_from_baikan(html_text, script_json, request_headers, cookies)
        return {
            "status": "SUCCEEDED",
            "aiTitle": _extract_title(content),
            "content": unescape(content or ""),
            "contentSummary": _summarize(content),
            "citations": citations,
        }

    return {
        "status": "NO_AI",
        "content": "",
        "contentSummary": "",
        "citations": [],
    }


def _extract_from_kexin(script_json):
    data = script_json.get("data", {})
    content = (
        ((data.get("interactData") or {}).get("data") or {}).get("copyContent")
        or data.get("copyContent")
        or ""
    )
    reference_list = ((data.get("citationListData") or {}).get("data") or {}).get("referenceList") or []
    citations = []
    for row in reference_list:
        citations.append({
            "url": row.get("url") or "",
            "title": row.get("text") or row.get("title") or "",
            "sourceName": row.get("source") if isinstance(row.get("source"), str) else (row.get("source") or {}).get("name", ""),
            "authorName": row.get("source") if isinstance(row.get("source"), str) else (row.get("source") or {}).get("name", ""),
            "publishTime": str(row.get("publish_time") or ""),
            "brand": "",
        })
    return content, citations


def _citation_from_row(row):
    if not isinstance(row, dict):
        return None

    source_value = row.get("source")
    source = source_value if isinstance(source_value, dict) else {}
    source_name = _first_non_empty(
        source.get("name") if isinstance(source, dict) else "",
        source.get("title") if isinstance(source, dict) else "",
        source_value if isinstance(source_value, str) else "",
        row.get("sourceName"),
        row.get("siteName"),
        row.get("site"),
        row.get("authorName"),
    )
    link_info = row.get("linkInfo") if isinstance(row.get("linkInfo"), dict) else {}
    fallback_link_info = {
        "data-url": _first_non_empty(
            row.get("url"),
            row.get("linkUrl"),
            row.get("link"),
            row.get("jumpUrl"),
            row.get("sourceUrl"),
            row.get("originUrl"),
        ),
        "origin-url": _first_non_empty(row.get("originUrl"), row.get("origin-url")),
        "href": _first_non_empty(row.get("href"), row.get("linkUrl"), row.get("url")),
    }
    url = _get_real_url(link_info) or _get_real_url(fallback_link_info)
    title = _first_non_empty(
        row.get("title"),
        row.get("text"),
        row.get("name"),
        row.get("abstract"),
        row.get("content"),
    )

    if not url and not title:
        return None

    return {
        "url": url,
        "title": title,
        "sourceName": source_name or _domain(url),
        "authorName": _first_non_empty(
            row.get("authorName"),
            row.get("author"),
            source_name,
            _domain(url),
        ),
        "publishTime": str(_first_non_empty(row.get("publish_time"), row.get("publishTime"), row.get("date"))),
        "brand": "",
    }


def _citation_rows_from_drawer_json(script_json):
    data = ((script_json.get("data") or {}).get("data") or {}) if isinstance(script_json, dict) else {}
    rows = []

    for key in ("items", "realCitationList", "_items", "citationList"):
        value = data.get(key)
        if isinstance(value, list):
            rows.extend(value)

    nested_data = data.get("data")
    if isinstance(nested_data, dict):
        for key in ("items", "realCitationList", "_items", "citationList"):
            value = nested_data.get(key)
            if isinstance(value, list):
                rows.extend(value)

    return rows


def _dedupe_citations(citations):
    seen = set()
    deduped = []
    for citation in citations:
        key = (citation.get("url") or "", citation.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(citation)
    return deduped


def _extract_citations_from_html(html_text):
    citations = []

    for script in _script_texts(html_text):
        if "citationDrawer" not in script:
            continue
        parsed = _json_from_script_text(script)
        if not isinstance(parsed, dict):
            continue
        for row in _citation_rows_from_drawer_json(parsed):
            citation = _citation_from_row(row)
            if citation:
                citations.append(citation)

    return _dedupe_citations(citations)


def _find_baikan_async_urls(html_text):
    urls = []

    for script in _script_texts(html_text):
        if "citationDrawer" not in script:
            continue
        parsed = _json_from_script_text(script)
        if not isinstance(parsed, dict):
            continue
        data = ((parsed.get("data") or {}).get("data") or {})
        tpl_info = data.get("tplInfo") if isinstance(data, dict) else {}
        async_url = (tpl_info or {}).get("asyncTcUrl") if isinstance(tpl_info, dict) else ""
        if isinstance(async_url, str) and async_url and async_url not in urls:
            urls.append(async_url)

    return urls


def _fetch_baikan_async_citations(html_text, request_headers=None, cookies=None):
    citations = []
    headers = dict(request_headers or {})
    headers.setdefault("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    headers.setdefault("Referer", "https://www.baidu.com/")

    for async_url in _find_baikan_async_urls(html_text):
        try:
            response = _request_get(async_url, headers=headers, cookies=cookies, timeout=30)
        except Exception:
            continue
        citations.extend(_extract_citations_from_html(response.get("text") or ""))

    return _dedupe_citations(citations)


def _extract_from_baikan(html_text, script_json, request_headers=None, cookies=None):
    data = ((script_json.get("data") or {}).get("data") or {})
    content = data.get("copyContent") or ""
    citations = _extract_citations_from_html(html_text)
    if not citations:
        citations = _fetch_baikan_async_citations(html_text, request_headers, cookies)

    return content, citations


def scrape_keyword(keyword):
    home_headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN",
        "Connection": "keep-alive",
        "DNT": "1",
        "Referer": "https://www.baidu.com/",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    }
    debug = []
    home = _request_get("https://www.baidu.com", headers=home_headers)
    home_text = home["text"]
    debug.append(_debug_info("home", home_text))
    cookies = {
        "BAIDUID": home["cookies"].get("BAIDUID", ""),
        "H_WISE_SIDS": home["cookies"].get("H_WISE_SIDS", ""),
        "rsv_i": home["cookies"].get("rsv_i", ""),
        "bd_af": "1",
        "BDSVRBFE": "Go",
        "__bsi": home["cookies"].get("__bsi", ""),
    }
    hm_time = str(int(time.time()))
    cookies["Hm_lvt_12423ecbc0e2ca965d84259063d35238"] = hm_time
    cookies["Hm_lpvt_12423ecbc0e2ca965d84259063d35238"] = hm_time
    launch = int(_server_time(home_text) / 60)
    cookies["SE_LAUNCH"] = f"5%3A{launch}_0%3A{launch}_16%3A{launch}"

    search_headers = {
        **home_headers,
        "Referer": "https://www.baidu.com/",
    }
    search_params = {
        "word": keyword,
        "rsv_iqid": _hidden_value(home_text, "rsv_iqid"),
        "rsv_t": _hidden_value(home_text, "rsv_t"),
        "rsv_pq": _hidden_value(home_text, "rsv_pq"),
        "sa": _hidden_value(home_text, "sa") or "ib_d",
        "ts": "0",
        "ms": "1",
        "t_kt": "0",
        "ie": "utf-8",
        "ss": "100",
    }
    search = _request_get(
        "https://www.baidu.com/from=844b/ssid=0/s",
        headers=search_headers,
        params={key: value for key, value in search_params.items() if value},
        cookies={key: value for key, value in cookies.items() if value},
        timeout=30,
    )
    result = _extract_ai_payload(
        search["text"],
        request_headers=search_headers,
        cookies={key: value for key, value in cookies.items() if value},
    )
    result["keyword"] = keyword
    debug.append(_debug_info("wise_web", search["text"]))
    if result["status"] != "NO_AI":
        result["debug"] = debug
        return result

    app_headers = {
        "Host": "m.baidu.com",
        "Connection": "keep-alive",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SP-engine/3.53.0 main/1.0 baiduboxapp/15.31.1.10 (Baidu; P2 18.5) NABar/1.0 themeUA=Theme/default",
        "new-style": "1",
        "tabbar_mid_tab_id": "ai_tab",
        "X-BDBoxApp-NetEngine": "3",
        "show_note": "1",
        "BDPParallelLoad": "2",
        "x-search-feed": "36",
        "control_tab": "1",
        "concise-home": "1",
        "private-mode": "1",
        "X-BD-QUIC": "1",
        "incognito-mode": "1",
        "Accept": "application/x-protobuffer,text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    app_params = {
        "tn": "zbios",
        "bd_page_type": "1",
        "word": keyword,
        "sa": "iks_1_aimode",
        "ss": "100000",
        "network": "1_0",
        "mpv": "1",
        "branchname": "baiduboxapp",
        "t_samp": "preload_4_1004",
        "from": "1099a",
    }
    app_search = _request_post("https://m.baidu.com/s", headers=app_headers, params=app_params, timeout=30)
    app_result = _extract_ai_payload(app_search["text"], request_headers=app_headers)
    app_result["keyword"] = keyword
    debug.append(_debug_info("baiduboxapp", app_search["text"]))
    app_result["debug"] = debug
    return app_result


def main():
    payload = _read_input()
    keyword = str(payload.get("keyword") or "").strip()
    if not keyword:
        print(json.dumps({"status": "FAILED", "errorMessage": "缺少 keyword", "citations": []}, ensure_ascii=False))
        return

    try:
        result = scrape_keyword(keyword)
    except Exception as error:
        result = {
            "status": "FAILED",
            "keyword": keyword,
            "errorMessage": str(error),
            "citations": [],
        }
    if not payload.get("debug"):
        result.pop("debug", None)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    time.sleep(0.2)
    main()
