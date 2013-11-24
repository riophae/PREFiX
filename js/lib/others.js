(function() {
	function d(a) {
		var d = {};
		d["word-spacing"] = a.css("word-spacing");
		d["line-height"] = a.css("line-height");
		d.padding = a.css("padding");
		d["font-size"] = a.css("font-size");
		d["font-family"] = a.css("font-family");
		d["word-wrap"] = a.css("word-wrap");
		d["white-space"] = "pre-wrap";
		d["box-sizing"] = "box-sizing";
		d.width = a.width() + "px";
		a = $("<div>").css($.extend(d, {
					position : "absolute",
					left : "-9999px",
					top : "-9999px"
				}));
		$("body").append(a);
		return a
	}
	$.fn.autosize = function () {
		var a;
		return this.each(function () {
			function e() {
				a ||
				(a = d(f), $("body").append(a));
				a.css('text-indent', f.css('text-indent'));
				var e = f.val() || f.prop('placeholder') || '';
				e != j && (j = e, a.text(e), f.height(a.height()))
			}
			var f = $(this),
			h;
			f.on("focus", function () {
				clearInterval(h);
				h = setInterval(e, 30)
			}).on("blur", function () {
				clearInterval(h);
				e()
			});
			var j
		})
	};
})();