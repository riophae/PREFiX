R.setupConsumer({
	key: '11d4291ccc71b962d657b47006411831',
	secret: '9d71fb4415e2ccb1f516144d7fb922ab'
});

waitFor = (function() {
	var waiting_list = [];

	var interval = 0;
	var lock = false;
	function setWaiting() {
		if (interval) return;
		interval = setInterval(function() {
			if (lock) return;
			lock = true;

			var not_avail = 0;
			for (var i = 0; i < waiting_list.length; ++i) {
				var item = waiting_list[i];
				if (item) {
					if (item.checker()) {
						item.worker();
						waiting_list[i] = null;
					} else {
						++not_avail;
					}
				}
			}

			if (! not_avail) {
				interval = 0 * clearInterval(interval);
			}

			lock = false;
		}, 40);
	}

	return function(checker, worker) {
		if (checker()) return worker();
		waiting_list.push({ checker: checker, worker: worker });
		setWaiting();
	};
})();

var getRelativeTime = Ripple.helpers.generateTimeFormater(function(table) {
	return [
		[
			15 * table.s,
			function() {
				return 'Just now';
			}
		], [
			table.m,
			function(convertor) {
				return convertor.s() + ' secs ago';
			}
		], [
			table.h,
			function(convertor) {
				var m = convertor.m();
				return m + ' min' + (m === '1' ? '' : 's') + '  ago';
			}
		], [
			table.d,
			function(convertor) {
				var h = convertor.h();
				return h + ' hour' + (h === '1' ? '' : 's') + ' ago';
			}
		], function(c) {
			return c._MS(3) +　' ' + c._d(true) + ' ' + c._h(2) + ':' + c._m(2);
		}
	];
});

var getFullTime = Ripple.helpers.generateTimeFormater(function(table) {
	return [
		function(c) {
			return c._yr() + '-' + c._ms(2) + 　 '-' + c._d(2) +
			' ' + c._h(2) + ':' + c._m(2) + ':' + c._s(2);
		}
	];
});

var re = new RegExp;
re.compile('[「\u4E00-\u9FA5\uf900-\ufa2d」]', 'g');
function fixStatusList(statuses) {
	var $text = $('<div />');
	statuses.forEach(function(status) {
		if (status.source && ! status.sourceFixed) {
			status.source = $text.html(status.source).text();
			status.source = ({
				'网页': 'Web',
				'手机上网': 'Wap',
				'iPhone版': 'iPhone'
			})[status.source] || status.source;
			status.source = status.source.replace('客户端', '');
			status.source = status.source.replace(/[a-zA-Z0-0]+/g, function(en) {
				return '<span class="en">' + en + '</span>'
			}).replace(re, function(chs) {
				return '<span class="chs">' + chs + '</span>';
			});
			status.sourceFixed = true;
		}
		if (! status.textFixed) {
			var html = status.text;
			$text.html(html);
			status.textWithoutTags = $text.text();
			html = jEmoji.softbankToUnified(html);
			html = jEmoji.googleToUnified(html);
			html = jEmoji.docomoToUnified(html);
			html = jEmoji.kddiToUnified(html);
			status.fixedText = jEmoji.unifiedToHTML(html);
			status.textFixed = true;
		}
		status.relativeTime = getRelativeTime(status.created_at);
		status.fullTime = getFullTime(status.created_at);
	});
	return statuses.sort(function(status_a, status_b) {
		return status_a.rawid ?
		 (status_b.rawid - status_a.rawid) : (+status_b.id - +status_a.id);
	});
}

function filter(list, statuses) {
	if (! statuses.length) return statuses;
	var ids = { };
	list.forEach(function(s) {
		ids[s.id] = true;
	});
	return statuses.filter(function(status) {
		return ids[status.id] !== true;
	});
}

function push(list, statuses, reverse) {
	statuses = filter(list, statuses);
	if (! statuses.length) return;
	statuses = fixStatusList(statuses);
	if (reverse) statuses = statuses.reverse();
	list.push.apply(list, statuses);
}

function unshift(list, statuses, reverse) {
	statuses = filter(list, statuses);
	if (! statuses.length) return;
	statuses = fixStatusList(statuses);
	if (reverse) statuses = statuses.reverse();
	list.unshift.apply(list, statuses);
}

function getDefaultWindowSize(width, height) {
	var PREFiX = chrome.extension.getBackgroundPage().PREFiX;
	return PREFiX.is_mac ? {
		width: width, height: height + 36
	} : {
		width: width + 16, height: height + 38
	};
}

var fixing_size = false;
function initFixSize(width, height) {
	var de = document.documentElement;
	onresize = _.throttle(function() {
		if (fixing_size) return;
		fixing_size = true;
		var size = getDefaultWindowSize(width, height);
		resizeTo(size.width, size.height);
		setTimeout(function() {
			resizeBy(width - de.clientWidth, height - de.clientHeight);
			setTimeout(function() {
				fixing_size = false;
			}, 48);
		}, 36);
	}, 24);
	setInterval(function() {
		if (de.clientWidth !== width || de.clientHeight !== height)
			onresize();
	}, 250);
}