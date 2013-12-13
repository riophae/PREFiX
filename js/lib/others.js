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
				setTimeout(e, 30);
				clearInterval(h);
				e()
			});
			var j
		})
	};
})();

/*
 *  Iphone unlock Animate menu version 0.1
 */

$(function(){

        var selectedClass=".slide-effect";

        /*
         * Increase that for faster animation
         */
        var animationStep=1;

        /*
         * Hold the dom and if is animating
         */
        function animatingText(){
                this.isAnimating;
                this.dom;
        }

        var itemArr= new Array();

        /*
         * Where the animation actually happens
         */
        function animateOption(animatingText,progress,color){

                if(progress>100){
                        progress = 0;
                }

                var highlightColor = "rgba(255, 255, 255, .4)";

                function getColor(progress) {
                	progress = parseInt(progress, 10);
                	return (progress < 0 ? color : highlightColor) + progress + "%";
                }

                /*
                 * move the animation
                 */
                progress+=animationStep;
                $(animatingText.dom).children().first().css({
                        "background-image": "-webkit-linear-gradient(left,"+ getColor(progress-40) + ',' +color+ " " + parseInt(progress) +"%, rgba(255, 255, 255, .4)  "+ parseInt(36+progress) + "%,  "+ color + " " + parseInt(80+progress) +"%)",
                        "background-position": "-5px center",
                        "-webkit-background-clip": "text",
                        "-webkit-text-fill-color": "transparent"
                });

                /*
                 * Run recursive at 60fps ... hopefully.
                 */
                setTimeout(function(){animateOption(animatingText,progress,color)}, 10);
        }

        /*
         *        On mouse enter toggle the effect
         */
        var $text = $(selectedClass);

        (function(){

                /*
                 * Get the id from data-id to identify the animation
                 */
                var id = $(this).data('id');

                /*
                 * Create a new object or retreive it if already
                 * created
                 */
                var thisItem =itemArr[id];

                if(thisItem!=undefined){

                        /*
                         * if is already animating exit
                         */
                        if(thisItem.isAnimating){
                                return;
                        }
                }else{
                        thisItem = new animatingText();
                        itemArr[id]=thisItem;
                        thisItem.dom=this;
                }

                /*
                 * Set that is animating
                 */
                thisItem.isAnimating=true;

                /*
                 * Start animation
                 */
                animateOption(thisItem,-70,$(thisItem.dom).children().first().css('color'));

        }).call($text[0]);

});