/* 커뮤니티 게시판 (회원 글쓰기, 누구나 열람) */
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

  var sb = window.sb;
  var PAGE = 20;
  var shown = 0;
  var user = null;
  var myName = "";
  var currentPostId = null;

  var listBox = $("#community-list");
  var listView = $("#community-list-wrap");
  var detailView = $("#community-detail");
  var writeView = $("#community-write");
  var msg = $("#community-msg");

  function showMsg(text, ok) {
    if (!text) { msg.hidden = true; msg.textContent = ""; return; }
    msg.hidden = false;
    msg.textContent = text;
    msg.className = "auth-msg " + (ok ? "ok" : "err");
  }

  function fmtDate(iso) {
    return iso ? iso.slice(0, 10) + " " + iso.slice(11, 16) : "";
  }

  function showList() {
    listView.hidden = false;
    detailView.hidden = true;
    writeView.hidden = true;
  }

  function loadPosts(reset) {
    if (reset) { shown = 0; listBox.innerHTML = ""; }
    sb.from("posts").select("*, comments(count)")
      .order("created_at", { ascending: false })
      .range(shown, shown + PAGE - 1)
      .then(function (res) {
        if (res.error) {
          listBox.appendChild(el("div", "empty",
            "게시글을 불러오지 못했습니다.<br><span class=\"small\">" +
            esc(res.error.message) +
            "</span><br><span class=\"small\">supabase/schema.sql 실행 여부를 확인하세요.</span>"));
          $("#community-more").style.display = "none";
          return;
        }
        var rows = res.data || [];
        if (reset && !rows.length) {
          listBox.appendChild(el("div", "empty", "아직 글이 없습니다.<br>첫 글의 주인공이 되어보세요!"));
        }
        rows.forEach(function (p) { listBox.appendChild(postRow(p)); });
        shown += rows.length;
        $("#community-more").style.display = rows.length === PAGE ? "" : "none";
      });
  }

  function writerLabel(p) {
    var parts = [];
    if (p.school) parts.push(p.school);
    if (p.cohort) parts.push(p.cohort + "기");
    if (p.department) parts.push(p.department);
    if (p.grade) parts.push(p.grade + "학년");
    var info = parts.join(" · ");
    var name = p.author_name ? " (" + p.author_name + ")" : "";
    return (info || "익명") + name;
  }

  function postRow(p) {
    var row = el("div", "post-row");
    var cmCount = (p.comments && p.comments[0] && p.comments[0].count) || 0;
    row.innerHTML =
      '<span class="post-title">' + esc(p.title) +
      (cmCount ? ' <span class="post-cm-count">[' + cmCount + "]</span>" : "") + "</span>" +
      '<span class="post-meta">' + esc(writerLabel(p)) +
      " · " + fmtDate(p.created_at) + "</span>";
    row.addEventListener("click", function () { openPost(p); });
    return row;
  }

  function openPost(p) {
    listView.hidden = true;
    writeView.hidden = true;
    detailView.hidden = false;
    currentPostId = p.id;
    $("#cd-title").textContent = p.title;
    $("#cd-meta").textContent = writerLabel(p) + " · " + fmtDate(p.created_at);
    $("#cd-content").textContent = p.content;
    var del = $("#cd-delete");
    del.hidden = !(user && p.author_id === user.id);
    del.onclick = function () {
      if (!confirm("이 글을 삭제하시겠습니까?")) return;
      sb.from("posts").delete().eq("id", p.id).then(function (res) {
        if (res.error) return showMsg("삭제 실패: " + res.error.message, false);
        showMsg("삭제되었습니다.", true);
        showList();
        loadPosts(true);
      });
    };
    $("#comment-form").hidden = !user;
    $("#comment-login-hint").hidden = !!user;
    loadComments(p.id);
  }

  /* ---- 댓글 ---- */
  function loadComments(postId) {
    var box = $("#comment-list");
    box.innerHTML = "";
    sb.from("comments").select("*").eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) {
          box.innerHTML = "";
          box.appendChild(el("div", "muted small", "댓글을 불러오지 못했습니다."));
          return;
        }
        var rows = res.data || [];
        $("#cm-count").textContent = "(" + rows.length + ")";
        if (!rows.length) {
          box.appendChild(el("div", "comment-empty muted small", "아직 댓글이 없습니다. 첫 댓글을 남겨보세요."));
          return;
        }
        rows.forEach(function (cm) { box.appendChild(commentRow(cm)); });
      });
  }

  function commentRow(cm) {
    var row = el("div", "comment-row");
    row.innerHTML =
      '<div class="comment-head"><b>' + esc(cm.author_name || "익명") + "</b>" +
      '<span class="muted small">' + fmtDate(cm.created_at) + "</span>" +
      '<button type="button" class="btn cm-del">삭제</button></div>' +
      '<div class="comment-body">' + esc(cm.content) + "</div>";
    var del = row.querySelector(".cm-del");
    del.hidden = !(user && cm.author_id === user.id);
    del.addEventListener("click", function () {
      if (!confirm("댓글을 삭제하시겠습니까?")) return;
      sb.from("comments").delete().eq("id", cm.id).then(function (res) {
        if (res.error) return showMsg("삭제 실패: " + res.error.message, false);
        loadComments(currentPostId);
        loadPosts(true);
      });
    });
    return row;
  }

  $("#comment-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!user) return showMsg("로그인이 필요합니다.", false);
    var content = $("#cm-content").value.trim();
    if (!content || !currentPostId) return;

    var btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    sb.from("comments").insert({
      post_id: currentPostId,
      author_id: user.id,
      author_name: myName || "익명",
      content: content
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) return showMsg("댓글 등록 실패: " + res.error.message, false);
      $("#cm-content").value = "";
      loadComments(currentPostId);
      loadPosts(true);
    });
  });

  /* ---- 글쓰기 ---- */
  $("#community-write-btn").addEventListener("click", function () {
    showMsg("");
    listView.hidden = true;
    detailView.hidden = true;
    writeView.hidden = false;
    $("#cw-title").value = "";
    $("#cw-content").value = "";
  });

  $("#cw-cancel").addEventListener("click", function () {
    showMsg("");
    showList();
  });

  $("#cw-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var title = $("#cw-title").value.trim();
    var content = $("#cw-content").value.trim();
    var school = $("#cw-school").value.trim();
    var cohort = parseInt($("#cw-cohort").value, 10);
    var grade = parseInt($("#cw-grade").value, 10);
    var dept = $("#cw-dept").value.trim();

    if (!title) return showMsg("제목을 입력해 주세요.", false);
    if (!content) return showMsg("내용을 입력해 주세요.", false);
    if (!school) return showMsg("학교명을 입력해 주세요.", false);
    if (!cohort || cohort < 1) return showMsg("몇 기인지 입력해 주세요.", false);
    if (!grade) return showMsg("학년을 선택해 주세요.", false);
    if (!dept) return showMsg("과(전공)를 입력해 주세요.", false);

    var btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    sb.from("posts").insert({
      author_id: user ? user.id : null,
      author_name: user ? (myName || "익명") : null,
      title: title,
      content: content,
      school: school,
      cohort: cohort,
      grade: grade,
      department: dept
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) return showMsg("등록 실패: " + res.error.message, false);
      showMsg("글이 등록되었습니다.", true);
      showList();
      loadPosts(true);
    });
  });

  /* ---- 기타 버튼 ---- */
  $("#community-refresh").addEventListener("click", function () {
    showMsg("");
    showList();
    loadPosts(true);
  });
  $("#cd-back").addEventListener("click", function () {
    showMsg("");
    showList();
  });
  $("#community-more").addEventListener("click", function () { loadPosts(false); });

  /* ---- 로그인 상태 동기화 ---- */
  function setUser(u) {
    user = u;
    if (u) {
      sb.from("profiles").select("name").eq("id", u.id).single()
        .then(function (res) {
          if (!res.error && res.data) myName = res.data.name || "";
        });
    } else {
      myName = "";
    }
  }

  sb.auth.getSession().then(function (res) {
    setUser(res.data.session && res.data.session.user);
  });
  sb.auth.onAuthStateChange(function (event, session) {
    setUser(session && session.user);
  });

  showList();
  loadPosts(true);
})();
