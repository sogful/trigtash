(function () {
  try {
    window.__tgdmusicoverride = true;
    var pat = /(^|\/)((?:\d+|X)\.[^\/]* by [^\/?]*\.ogg)(\?|$)/, cmp = /(^|\/)cmp_/;
    function want() {
      try {
        var f = JSON.parse(localStorage.getItem("GDJS_trigonometrydash") || "{}");
        if (f.settings && typeof f.settings.str === "string") {
          var v = JSON.parse(f.settings.str)["compressedmusic"];
          return v === true || v === "true" || v === 1;
        }
      } catch (e) {}
      return false;
    }
    function red(u) {
      try {
        if (typeof u !== "string" || cmp.test(u)) return u;
        var m = u.match(pat);
        if (!m || !want()) return u;
        return u.replace(m[2], "cmp_" + m[2]);
      } catch (e) {return u}
    }
    var of = window.fetch;
    if (of) window.fetch = function (u, o) {try {if (typeof u === "string") u = red(u)} catch (e) {} return of.call(this, u, o)};
    var xo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {var a = [].slice.call(arguments); try {if (typeof a[1] === "string") a[1] = red(a[1])} catch (e) {} return xo.apply(this, a)};
  } catch (e) {}
})();
