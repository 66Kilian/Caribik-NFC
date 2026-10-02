(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var state = {};
  var T = window.MKI18N ? window.MKI18N.t : function (x) { return x; };

  function b64(bytes) { var s = ""; new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function b64url(bytes) { return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function base32(bytes) {
    var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bits = 0, val = 0, out = "";
    new Uint8Array(bytes).forEach(function (b) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += a[(val >>> (bits - 5)) & 31]; bits -= 5; } });
    if (bits > 0) out += a[(val << (5 - bits)) & 31];
    return out;
  }
  function base32Decode(s) {
    var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bits = 0, val = 0, out = [];
    for (var i = 0; i < s.length; i++) { val = (val << 5) | a.indexOf(s[i]); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
    return new Uint8Array(out);
  }
  async function totp(secret, step) {
    var buf = new ArrayBuffer(8), v = new DataView(buf);
    v.setUint32(0, Math.floor(step / 4294967296)); v.setUint32(4, step >>> 0);
    var key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    var h = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf)), o = h[h.length - 1] & 15;
    var n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1000000).padStart(6, "0");
  }
  async function hashPw(pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 210000;
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter }, key, 256);
    return "pbkdf2$" + iter + "$" + b64(salt) + "$" + b64(bits);
  }

  $("b1").onclick = async function () {
    var a = $("pw1").value, b = $("pw2").value;
    if (a.length < 12) { $("e1").textContent = T("Legalább 12 karakter kell."); return; }
    if (a !== b) { $("e1").textContent = T("A két jelszó nem egyezik."); return; }
    $("b1").disabled = true; $("e1").textContent = "";
    state.hash = await hashPw(a);
    $("pw1").value = $("pw2").value = "";
    state.secret = base32(crypto.getRandomValues(new Uint8Array(20)));
    state.session = b64url(crypto.getRandomValues(new Uint8Array(48)));
    var label = encodeURIComponent("meinekontaktkarte.com:admin");
    var uri = "otpauth://totp/" + label + "?secret=" + state.secret + "&issuer=" + encodeURIComponent("meinekontaktkarte.com") + "&algorithm=SHA1&digits=6&period=30";
    var qr = qrcode(0, "M"); qr.addData(uri); qr.make();
    $("qr").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: false });
    $("secret").textContent = state.secret.replace(/(.{4})/g, "$1 ").trim();
    $("s1").classList.add("hidden"); $("s2").classList.remove("hidden"); $("st2").classList.add("on");
    $("code").focus();
  };

  $("b2").onclick = async function () {
    var code = $("code").value.replace(/\s/g, ""), step = Math.floor(Date.now() / 30000), ok = false;
    for (var d = -1; d <= 1; d++) if ((await totp(state.secret, step + d)) === code) ok = true;
    if (!ok) { $("e2").textContent = T("A kód nem egyezik. Ellenőrizd a telefon óráját, és próbáld újra."); return; }
    var rows = [["ADMIN_PASSWORD_HASH", state.hash], ["ADMIN_TOTP_SECRET", state.secret], ["ADMIN_SESSION_SECRET", state.session]];
    $("env").innerHTML = "";
    rows.forEach(function (r) {
      var d = document.createElement("div"); d.className = "envrow";
      var b = document.createElement("b"); b.textContent = r[0];
      var c = document.createElement("code"); c.textContent = r[1];
      var btn = document.createElement("button"); btn.className = "btn sm"; btn.textContent = T("Másolás"); btn.style.justifySelf = "start";
      btn.onclick = function () { navigator.clipboard.writeText(r[1]).then(function () { btn.textContent = T("Másolva ✓"); }); };
      d.append(b, c, btn); $("env").appendChild(d);
    });
    $("s2").classList.add("hidden"); $("s3").classList.remove("hidden"); $("st3").classList.add("on");
  };
  $("code").addEventListener("keydown", function (e) { if (e.key === "Enter") $("b2").click(); });
})();
