/* 고졸·마이스터고 채용 모아보기 */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  var today = function () {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  var diffDays = function (iso) {
    if (!iso) return null;
    var t = today().split("-");
    var d = iso.split("-");
    var a = new Date(+t[0], +t[1] - 1, +t[2]);
    var b = new Date(+d[0], +d[1] - 1, +d[2]);
    return Math.round((b - a) / 86400000);
  };

  /* ---------- 탭 ---------- */
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.classList.remove("active"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
      t.classList.add("active");
      $("#panel-" + t.dataset.tab).classList.add("active");
    });
  });

  /* ---------- 채용 공고 ---------- */
  var jobs = (window.JOBS_DATA && window.JOBS_DATA.jobs) || [];
  var collectedAt = (window.JOBS_DATA && window.JOBS_DATA.collectedAt) || "";
  var PAGE = 30;
  var shown = PAGE;

  // 직무 대분류
  if (window.classifyJob) {
    jobs.forEach(function (j) { j.fields = window.classifyJob(j); });
  }
  (function () {
    var counts = {};
    jobs.forEach(function (j) {
      (j.fields || []).forEach(function (f) { counts[f] = (counts[f] || 0) + 1; });
    });
    var sel = $("#f-field");
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
      .forEach(function (f) {
        var o = el("option", null, f + " (" + counts[f] + ")");
        o.value = f;
        sel.appendChild(o);
      });
  })();

  // 지역 옵션
  var regions = {};
  jobs.forEach(function (j) {
    var r = (j.location || "").split(/\s+/)[0];
    if (r && r.length <= 5) regions[r] = 1;
  });
  Object.keys(regions).sort(function (a, b) { return a.localeCompare(b, "ko"); })
    .forEach(function (r) {
      var o = el("option", null, esc(r));
      o.value = r;
      $("#f-region").appendChild(o);
    });

  function ddayBadge(j) {
    if (j.ongoing) return '<span class="badge ongoing">상시</span>';
    var d = diffDays(j.deadline);
    if (d == null) return "";
    if (d < 0) return '<span class="badge closed">마감</span>';
    if (d === 0) return '<span class="badge d">오늘마감</span>';
    if (d <= 3) return '<span class="badge d">D-' + d + "</span>";
    return '<span class="badge soon">D-' + d + "</span>";
  }

  function jobCard(j) {
    var c = el("div", "job-card");
    var typeBadge = j.type === "공기업" ? '<span class="badge public">공기업</span>'
      : j.type === "대기업" ? '<span class="badge major">대기업</span>' : "";
    var meister = j.meister ? '<span class="badge meister">마이스터고</span>' : "";
    var fieldBadge = (j.fields && j.fields.length)
      ? '<span class="badge field">' + esc(j.fields[0]) + "</span>" : "";

    var meta = [];
    if (j.location) meta.push(esc(j.location));
    if (j.career) meta.push(esc(j.career));
    if (j.edu) meta.push("<b>" + esc(j.edu) + "</b>");
    if (j.jobType) meta.push(esc(j.jobType));

    var chips = (j.sectors || []).slice(0, 6)
      .map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("");

    var foot = [];
    if (j.deadlineRaw) foot.push("마감: " + esc(j.deadlineRaw));
    if (j.registered) foot.push("등록 " + esc(j.registered));
    foot.push("출처: " + esc(j.source || "사람인"));

    c.innerHTML =
      '<div class="job-top">' +
        "<h3 class=\"job-title\"><a href=\"" + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.title) + "</a></h3>" +
        typeBadge + meister + fieldBadge + ddayBadge(j) +
      "</div>" +
      '<div class="job-meta"><b>' + esc(j.company) + "</b></div>" +
      '<div class="job-meta">' + meta.join(" <span>·</span> ") + "</div>" +
      (chips ? '<div class="chips">' + chips + "</div>" : "") +
      '<div class="job-foot"><span class="muted small">' + foot.join(" · ") + "</span></div>";
    return c;
  }

  function filterJobs() {
    var q = $("#q").value.trim().toLowerCase();
    var type = $("#f-type").value;
    var field = $("#f-field").value;
    var career = $("#f-career").value;
    var region = $("#f-region").value;
    var sort = $("#f-sort").value;
    var hideClosed = $("#f-open").checked;
    var meisterOnly = $("#f-meister").checked;
    var t = today();

    var list = jobs.filter(function (j) {
      if (q && (j.title + " " + j.company + " " + (j.sectors || []).join(" ")).toLowerCase().indexOf(q) === -1) return false;
      if (type !== "all" && j.type !== type) return false;
      if (field !== "all" && (j.fields || []).indexOf(field) === -1) return false;
      if (region !== "all" && (j.location || "").split(/\s+/)[0] !== region) return false;
      if (meisterOnly && !j.meister) return false;
      if (career === "fresh") {
        var c = j.career || "";
        if (!(c === "" || /신입|무관/.test(c))) return false;
      } else if (career === "career") {
        var c2 = j.career || "";
        if (!(/경력/.test(c2) && !/무관/.test(c2))) return false;
      }
      if (hideClosed && !j.ongoing && j.deadline && j.deadline < t) return false;
      return true;
    });

    if (sort === "deadline") {
      list.sort(function (a, b) {
        var da = a.ongoing ? "9999-99-99" : (a.deadline || "9999-99-99");
        var db = b.ongoing ? "9999-99-99" : (b.deadline || "9999-99-99");
        if (da !== db) return da < db ? -1 : 1;
        return (b.registered || "").localeCompare(a.registered || "");
      });
    } else if (sort === "registered") {
      list.sort(function (a, b) { return (b.registered || "").localeCompare(a.registered || ""); });
    } else if (sort === "company") {
      list.sort(function (a, b) { return (a.company || "").localeCompare(b.company || "", "ko"); });
    }
    return list;
  }

  function renderJobs() {
    var list = filterJobs();
    var box = $("#jobs-list");
    box.innerHTML = "";
    $("#jobs-count").textContent = "총 " + list.length + "건";
    $("#jobs-updated").textContent = collectedAt ? "데이터 갱신: " + collectedAt : "";

    if (!list.length) {
      box.appendChild(el("div", "empty", "조건에 맞는 공고가 없습니다.<br>검색어나 필터를 바꿔 보세요."));
      $("#more").style.display = "none";
      return;
    }
    list.slice(0, shown).forEach(function (j) { box.appendChild(jobCard(j)); });
    $("#more").style.display = shown < list.length ? "" : "none";
  }

  ["f-type", "f-field", "f-career", "f-region", "f-sort", "f-open", "f-meister"].forEach(function (id) {
    $("#" + id).addEventListener("change", renderJobs);
  });
  $("#q").addEventListener("input", function () { shown = PAGE; renderJobs(); });
  $("#more").addEventListener("click", function () { shown += PAGE; renderJobs(); });

  /* ---------- 자격증 가점표 ---------- */
  var certs = (window.CERTS_DATA && window.CERTS_DATA.companies) || [];

  function renderLevelGuide() {
    var guide = (window.CERTS_DATA && window.CERTS_DATA.levelGuide) || [];
    var box = $("#level-guide");
    box.innerHTML = "";
    guide.forEach(function (g) {
      var c = el("div", "level-card");
      c.innerHTML = "<h3>" + esc(g.level) + "</h3><p>" + esc(g.desc) + "</p>";
      box.appendChild(c);
    });
  }

  function normLevel(level) {
    return String(level || "기타").replace(/\(.*$/, "").trim() || "기타";
  }

  function certRow(cert, hl) {
    var lv = normLevel(cert.level);
    var nameHtml = '<span class="lv ' + esc(lv) + '">' + esc(cert.level) + "</span> " + esc(cert.name);
    return "<tr" + (hl ? ' class="hl"' : "") + ">" +
      "<td>" + nameHtml + "</td>" +
      "<td>" + esc(cert.field || "") + "</td>" +
      '<td class="points">' + esc(cert.benefit || "") + "</td>" +
      "<td>" + esc(cert.note || "") + "</td></tr>";
  }

  function renderCerts() {
    var q = $("#cq").value.trim().toLowerCase();
    var type = $("#cf-type").value;
    var level = $("#cf-level").value;
    var box = $("#certs-list");
    box.innerHTML = "";

    var list = certs.filter(function (co) {
      if (type !== "all" && co.type !== type) return false;
      if (q) {
        var hit = co.name.toLowerCase().indexOf(q) !== -1 ||
          (co.certs || []).some(function (x) { return (x.name + " " + (x.field || "")).toLowerCase().indexOf(q) !== -1; });
        if (!hit) return false;
      }
      if (level !== "all" && !(co.certs || []).some(function (x) { return normLevel(x.level) === level; })) return false;
      return true;
    });

    if (!list.length) {
      box.appendChild(el("div", "empty", "조건에 맞는 회사가 없습니다."));
      return;
    }

    list.forEach(function (co) {
      var rows = (co.certs || []).filter(function (x) {
        if (level !== "all" && normLevel(x.level) !== level) return false;
        if (q && co.name.toLowerCase().indexOf(q) === -1) {
          return (x.name + " " + (x.field || "")).toLowerCase().indexOf(q) !== -1;
        }
        return true;
      });
      if (!rows.length) return;

      var card = el("div", "cert-card");
      var typeBadge = co.type === "공기업" ? '<span class="badge public">공기업</span>'
        : '<span class="badge major">대기업</span>';
      var link = co.homepage ? ' <a class="small" href="' + esc(co.homepage) + '" target="_blank" rel="noopener">채용 홈페이지 ↗</a>' : "";
      card.innerHTML =
        "<h3>" + esc(co.name) + " " + typeBadge + "</h3>" + link +
        '<p class="apply-note">' + esc(co.applyNote || "") + "</p>" +
        "<table><thead><tr><th>자격증 (등급)</th><th>직무</th><th>가점/반영</th><th>비고</th></tr></thead><tbody>" +
        rows.map(function (x) {
          var hl = q && (x.name + " " + (x.field || "")).toLowerCase().indexOf(q) !== -1 && co.name.toLowerCase().indexOf(q) === -1;
          return certRow(x, hl);
        }).join("") +
        "</tbody></table>";
      box.appendChild(card);
    });
  }

  /* ---------- 보유 자격증 기반 기업 추천 ---------- */
  var ownedCertStorageKey = "lava-owned-certificates";
  var ownedCerts = [];
  var availableCerts = [];
  var availableCertNames = {};
  certs.forEach(function (co) {
    (co.certs || []).forEach(function (cert) {
      var name = String(cert.name || "").trim();
      var key = normalizeCertName(name);
      if (name && key && !availableCertNames[key]) {
        availableCertNames[key] = name;
        availableCerts.push(name);
      }
    });
  });
  availableCerts.sort(function (a, b) { return a.localeCompare(b, "ko"); });

  function normalizeCertName(name) {
    return String(name || "").toLowerCase().replace(/[\s·()\-]/g, "");
  }

  try {
    var savedCerts = JSON.parse(window.localStorage.getItem(ownedCertStorageKey) || "[]");
    if (Array.isArray(savedCerts)) {
      ownedCerts = savedCerts.map(function (name) {
        return availableCertNames[normalizeCertName(name)];
      }).filter(function (name, index, list) {
        return name && list.indexOf(name) === index;
      });
    }
  } catch (err) {
    ownedCerts = [];
  }

  availableCerts.forEach(function (name) {
    var option = el("option");
    option.value = name;
    $("#owned-cert-options").appendChild(option);
  });

  function saveOwnedCerts() {
    try { window.localStorage.setItem(ownedCertStorageKey, JSON.stringify(ownedCerts)); }
    catch (err) { /* 저장소를 사용할 수 없는 환경에서도 현재 페이지에서는 계속 동작 */ }
  }

  function renderRecommendations() {
    var listBox = $("#recommend-list");
    var type = $("#recommend-type").value;
    listBox.innerHTML = "";

    if (!ownedCerts.length) {
      $("#recommend-count").textContent = "";
      listBox.appendChild(el("div", "empty", "보유한 자격증을 추가하면 맞는 기업을 추천해 드려요."));
      return;
    }

    var ownedKeys = {};
    ownedCerts.forEach(function (name) { ownedKeys[normalizeCertName(name)] = true; });
    var matches = certs.map(function (co) {
      var matched = (co.certs || []).filter(function (cert) {
        return ownedKeys[normalizeCertName(cert.name)];
      });
      return { company: co, matched: matched };
    }).filter(function (result) {
      return result.matched.length && (type === "all" || result.company.type === type);
    });
    matches.sort(function (a, b) {
      return b.matched.length - a.matched.length || a.company.name.localeCompare(b.company.name, "ko");
    });

    $("#recommend-count").textContent = matches.length
      ? "총 " + matches.length + "개 기업 · 보유 자격증 " + ownedCerts.length + "개 기준"
      : "선택한 구분에 추천할 기업이 없습니다.";
    if (!matches.length) {
      listBox.appendChild(el("div", "empty", "선택한 자격증을 우대하는 기업이 없습니다.<br>구분을 전체로 바꾸거나 다른 자격증을 추가해 보세요."));
      return;
    }

    matches.forEach(function (result) {
      var co = result.company;
      var card = el("article", "recommend-card");
      var typeBadge = co.type === "공기업" ? '<span class="badge public">공기업</span>'
        : '<span class="badge major">사기업·대기업</span>';
      var matchedChips = result.matched.map(function (cert) {
        var details = [cert.field, cert.benefit].filter(Boolean).join(" · ");
        return '<span class="recommend-chip"><b>' + esc(cert.name) + "</b>" +
          (details ? '<span class="muted">' + esc(details) + "</span>" : "") + "</span>";
      }).join("");
      var homepage = co.homepage
        ? '<a class="small" href="' + esc(co.homepage) + '" target="_blank" rel="noopener">채용 홈페이지 ↗</a>' : "";
      card.innerHTML =
        '<div class="recommend-card-top"><h4>' + esc(co.name) + "</h4>" + typeBadge +
          '<span class="match-count">' + result.matched.length + "개 자격증 매칭</span></div>" +
        (homepage ? '<div class="recommend-homepage">' + homepage + "</div>" : "") +
        '<div class="recommend-chips">' + matchedChips + "</div>" +
        (co.applyNote ? '<p class="apply-note">' + esc(co.applyNote) + "</p>" : "");
      listBox.appendChild(card);
    });
  }

  function renderOwnedCerts() {
    var box = $("#owned-cert-list");
    box.innerHTML = "";
    ownedCerts.forEach(function (name) {
      var button = el("button", "owned-cert");
      button.type = "button";
      button.dataset.cert = name;
      button.setAttribute("aria-label", name + " 삭제");
      button.innerHTML = esc(name) + " <span aria-hidden=\"true\">×</span>";
      box.appendChild(button);
    });
    renderRecommendations();
  }

  function addOwnedCert() {
    var input = $("#owned-cert-input");
    var typedName = input.value.trim();
    var canonicalName = availableCertNames[normalizeCertName(typedName)];
    var message = $("#owned-cert-message");
    if (!canonicalName) {
      message.textContent = "자격증 목록에서 항목을 선택해 주세요. 등록된 자격증 " + availableCerts.length + "개 중에서 검색할 수 있어요.";
      return;
    }
    if (ownedCerts.indexOf(canonicalName) !== -1) {
      message.textContent = "이미 보유 목록에 추가된 자격증이에요.";
      input.value = "";
      return;
    }
    ownedCerts.push(canonicalName);
    ownedCerts.sort(function (a, b) { return a.localeCompare(b, "ko"); });
    saveOwnedCerts();
    input.value = "";
    message.textContent = canonicalName + "을(를) 추가했어요.";
    renderOwnedCerts();
  }

  $("#add-owned-cert").addEventListener("click", addOwnedCert);
  $("#owned-cert-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addOwnedCert();
    }
  });
  $("#owned-cert-list").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-cert]");
    if (!button) return;
    ownedCerts = ownedCerts.filter(function (name) { return name !== button.dataset.cert; });
    saveOwnedCerts();
    $("#owned-cert-message").textContent = button.dataset.cert + "을(를) 보유 목록에서 삭제했어요.";
    renderOwnedCerts();
  });
  $("#recommend-type").addEventListener("change", renderRecommendations);
  renderOwnedCerts();

  /* ---------- 기업 위치 지도 ---------- */
  var companyLocations = window.COMPANY_LOCATIONS || [];
  var companyLocationByName = {};
  companyLocations.forEach(function (location) { companyLocationByName[location.name] = location; });
  var selectedMapCompany = "";
  var svgNS = "http://www.w3.org/2000/svg";

  function mapPoint(lon, lat) {
    return { x: (lon - 124.5) * 120 + 35, y: (38.8 - lat) * 112 + 20 };
  }

  function drawKoreaLand() {
    var outline = [
      [126.65, 38.12], [126.95, 38.25], [127.35, 38.25], [127.75, 38.30], [128.15, 38.38],
      [128.50, 38.28], [128.82, 38.08], [129.10, 37.83], [129.34, 37.50], [129.43, 37.10],
      [129.48, 36.70], [129.55, 36.28], [129.48, 35.90], [129.34, 35.52], [129.18, 35.15],
      [128.95, 34.92], [128.75, 34.82], [128.48, 34.75], [128.22, 34.65], [127.94, 34.66],
      [127.68, 34.62], [127.43, 34.52], [127.17, 34.40], [126.92, 34.42], [126.68, 34.50],
      [126.47, 34.62], [126.27, 34.76], [126.10, 34.94], [126.02, 35.20], [126.14, 35.45],
      [126.25, 35.70], [126.16, 35.96], [126.30, 36.18], [126.40, 36.43], [126.39, 36.70],
      [126.30, 36.95], [126.40, 37.20], [126.35, 37.46], [126.50, 37.72], [126.65, 38.12]
    ];
    var path = outline.map(function (point, index) {
      var p = mapPoint(point[0], point[1]);
      return (index ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    }).join(" ") + " Z";
    $("#korea-land").setAttribute("d", path);

    var jeju = [[126.10, 33.52], [126.28, 33.30], [126.58, 33.20], [126.86, 33.27], [126.96, 33.43], [126.78, 33.59], [126.49, 33.63], [126.25, 33.61]];
    var islandPath = jeju.map(function (point, index) {
      var p = mapPoint(point[0], point[1]);
      return (index ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    }).join(" ") + " Z";
    $("#jeju-island").setAttribute("d", islandPath);
  }

  function setMapSelection(company) {
    selectedMapCompany = company.name;
    var location = companyLocationByName[company.name];
    var detail = $("#map-company-detail");
    var badge = company.type === "공기업" ? '<span class="badge public">공기업</span>'
      : '<span class="badge major">대기업</span>';
    var homepage = company.homepage
      ? '<a href="' + esc(company.homepage) + '" target="_blank" rel="noopener">공식·채용 홈페이지 ↗</a>' : "";
    detail.innerHTML = '<div class="map-detail-heading"><h3>' + esc(company.name) + "</h3>" + badge + "</div>" +
      '<p><span class="muted">본사 소재 지역</span><br><b>' + esc(location.city) + "</b></p>" +
      (homepage ? '<div class="map-detail-link">' + homepage + "</div>" : "");
    $("#map-company-list").querySelectorAll(".map-company-row").forEach(function (row) {
      var active = row.dataset.company === company.name;
      row.classList.toggle("active", active);
      row.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $("#company-map-points").querySelectorAll(".map-point").forEach(function (point) {
      point.classList.toggle("selected", point.dataset.company === company.name);
    });
  }

  function renderCompanyMap() {
    drawKoreaLand();
    var type = $("#company-map-type").value;
    var list = certs.map(function (company) {
      return { company: company, location: companyLocationByName[company.name] };
    }).filter(function (entry) {
      return entry.location && (type === "all" || entry.company.type === type);
    }).sort(function (a, b) {
      return a.location.city.localeCompare(b.location.city, "ko") || a.company.name.localeCompare(b.company.name, "ko");
    });

    $("#map-company-count").textContent = "(" + list.length + "개)";
    var pointLayer = $("#company-map-points");
    var companyList = $("#map-company-list");
    pointLayer.innerHTML = "";
    companyList.innerHTML = "";

    if (!list.length) {
      $("#map-company-detail").innerHTML = "<p class=\"muted\">표시할 기업 위치가 없습니다.</p>";
      companyList.appendChild(el("div", "empty", "표시할 기업이 없습니다."));
      return;
    }

    var cityGroups = {};
    list.forEach(function (entry) {
      var city = entry.location.city;
      if (!cityGroups[city]) cityGroups[city] = [];
      cityGroups[city].push(entry);
    });

    Object.keys(cityGroups).forEach(function (city) {
      var entries = cityGroups[city];
      var center = mapPoint(entries[0].location.lon, entries[0].location.lat);
      entries.forEach(function (entry, index) {
        var angle = (Math.PI * 2 * index / entries.length) - Math.PI / 2;
        var radius = entries.length === 1 ? 0 : (entries.length > 7 ? 19 : 13);
        var circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", (center.x + Math.cos(angle) * radius).toFixed(1));
        circle.setAttribute("cy", (center.y + Math.sin(angle) * radius).toFixed(1));
        circle.setAttribute("r", "7");
        circle.setAttribute("class", "map-point" + (entry.company.name === selectedMapCompany ? " selected" : ""));
        circle.setAttribute("tabindex", "0");
        circle.setAttribute("role", "button");
        circle.setAttribute("aria-label", entry.company.name + " · " + city);
        circle.dataset.company = entry.company.name;
        var title = document.createElementNS(svgNS, "title");
        title.textContent = entry.company.name + " · " + city;
        circle.appendChild(title);
        circle.addEventListener("click", function () { setMapSelection(entry.company); });
        circle.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMapSelection(entry.company);
          }
        });
        pointLayer.appendChild(circle);
      });
    });

    list.forEach(function (entry) {
      var row = el("button", "map-company-row");
      row.type = "button";
      row.dataset.company = entry.company.name;
      row.setAttribute("aria-pressed", "false");
      var badge = entry.company.type === "공기업" ? '<span class="badge public">공기업</span>'
        : '<span class="badge major">대기업</span>';
      row.innerHTML = '<span class="map-row-name">' + esc(entry.company.name) + " " + badge +
        '</span><span class="map-row-city">' + esc(entry.location.city) + "</span>";
      row.addEventListener("click", function () { setMapSelection(entry.company); });
      companyList.appendChild(row);
    });

    var selected = list.filter(function (entry) { return entry.company.name === selectedMapCompany; })[0] || list[0];
    setMapSelection(selected.company);
  }

  $("#company-map-type").addEventListener("change", renderCompanyMap);
  renderCompanyMap();

  ["cq", "cf-type", "cf-level"].forEach(function (id) {
    $("#" + id).addEventListener("input", renderCerts);
    $("#" + id).addEventListener("change", renderCerts);
  });

  /* ---------- 시작 ---------- */
  renderLevelGuide();
  renderJobs();
  renderCerts();
})();
