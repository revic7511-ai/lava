/* 회원가입·로그인 (Supabase Auth) */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  var sb = window.sb;
  var msg = $("#auth-msg");

  function showMsg(text, ok) {
    if (!text) { msg.hidden = true; msg.textContent = ""; return; }
    msg.hidden = false;
    msg.textContent = text;
    msg.className = "auth-msg " + (ok ? "ok" : "err");
  }

  function setBusy(form, busy) {
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = busy;
    btn.textContent = busy ? "처리 중..." : (form.id === "signup-form" ? "가입하기" : "로그인");
  }

  var koError = {
    "User already registered": "이미 가입된 이메일입니다.",
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 메일함에서 인증 후 로그인해 주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
    "Unable to validate email address: invalid format": "이메일 형식이 올바르지 않습니다."
  };
  function errText(e) { return koError[e.message] || ("오류: " + e.message); }

  /* ---- 화면 전환 ---- */
  function showProfile(u, p) {
    $("#auth-box").hidden = true;
    $("#profile-box").hidden = false;
    $("#tab-member").textContent = "내 정보";
    var rows = [
      ["이름", p && p.name],
      ["이메일", u.email],
      ["학교", p && p.school],
      ["기수", p && p.cohort ? p.cohort + "기" : ""],
      ["학년", p && p.grade ? p.grade + "학년" : ""],
      ["과", p && p.department]
    ];
    $("#profile-list").innerHTML = rows.map(function (r) {
      return '<li><span class="k">' + r[0] + '</span><span>' + esc(r[1] || "-") + "</span></li>";
    }).join("");
  }

  function showForms() {
    $("#auth-box").hidden = false;
    $("#profile-box").hidden = true;
    $("#tab-member").textContent = "회원가입";
    showMsg("");
  }

  function loadProfile(u) {
    sb.from("profiles").select("*").eq("id", u.id).single()
      .then(function (res) {
        if (res.error) {
          showProfile(u, null);
          showMsg("프로필 정보를 불러오지 못했습니다. (supabase/schema.sql 실행 여부를 확인하세요)", false);
        } else {
          showProfile(u, res.data);
        }
      });
  }

  function refresh() {
    sb.auth.getSession().then(function (res) {
      var u = res.data.session && res.data.session.user;
      if (u) loadProfile(u); else showForms();
    });
  }

  /* ---- 회원가입 ---- */
  $("#signup-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("#su-name").value.trim();
    var email = $("#su-email").value.trim();
    var pw = $("#su-pw").value;
    var pw2 = $("#su-pw2").value;
    var school = $("#su-school").value.trim();
    var cohort = parseInt($("#su-cohort").value, 10);
    var grade = parseInt($("#su-grade").value, 10);
    var dept = $("#su-dept").value.trim();

    if (!name) return showMsg("이름을 입력해 주세요.");
    if (!email) return showMsg("이메일을 입력해 주세요.");
    if (pw.length < 6) return showMsg("비밀번호는 6자 이상으로 입력해 주세요.");
    if (pw !== pw2) return showMsg("비밀번호가 서로 다릅니다.");
    if (!school) return showMsg("학교명을 입력해 주세요.");
    if (!cohort || cohort < 1) return showMsg("몇 기인지 입력해 주세요.");
    if (!grade) return showMsg("학년을 선택해 주세요.");
    if (!dept) return showMsg("과(전공)를 입력해 주세요.");

    var form = ev.target;
    setBusy(form, true);
    showMsg("");
    sb.auth.signUp({
      email: email,
      password: pw,
      options: {
        data: { name: name, school: school, cohort: cohort, grade: grade, department: dept }
      }
    }).then(function (res) {
      setBusy(form, false);
      if (res.error) return showMsg(errText(res.error));
      if (res.data.session) { loadProfile(res.data.session.user); return; }
      form.reset();
      showMsg("가입 완료! " + email + " 로 인증 메일을 보냈습니다. 메일함에서 인증 후 로그인해 주세요.", true);
    });
  });

  /* ---- 로그인 ---- */
  $("#login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target;
    setBusy(form, true);
    showMsg("");
    sb.auth.signInWithPassword({
      email: $("#li-email").value.trim(),
      password: $("#li-pw").value
    }).then(function (res) {
      setBusy(form, false);
      if (res.error) return showMsg(errText(res.error));
      form.reset();
      loadProfile(res.data.user);
    });
  });

  /* ---- 로그아웃 ---- */
  $("#logout-btn").addEventListener("click", function () {
    sb.auth.signOut().then(showForms);
  });

  sb.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") showForms();
  });

  refresh();
})();
