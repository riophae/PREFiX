var default_consumer = {
	key: '11d4291ccc71b962d657b47006411831',
	secret: '9d71fb4415e2ccb1f516144d7fb922ab'
};
var custom_consumer = lscache.get('custom_consumer');
Ripple.setupConsumer(custom_consumer || default_consumer);

Ripple.shorten['t.cn'] = function(long_url) {
	return Ripple.ajax.get('http://api.t.sina.com.cn/short_url/shorten.json', {
		params: {
			source: 850454853,
			url_long: long_url
		}
	});
}

function enableCustomConsumer(key, secret) {
	custom_consumer = {
		key: key,
		secret: secret
	};
	lscache.set('custom_consumer', custom_consumer);
	Ripple.setupConsumer(custom_consumer);
	PREFiX.reset();
}

function disableCustomConsumer() {
	custom_consumer = null;
	lscache.remove('custom_consumer');
	Ripple.setupConsumer(default_consumer);
	PREFiX.reset();
}

function createPopup(callback) {
	var url = '/popup.html?new_window=true';
	var dimensions = lscache.get('popup_dimentions') || {
		width: 400,
		height: 600
	};
	var pos = lscache.get('popup_pos') || {
		x: Math.round((screen.width - dimensions.width) / 2),
		y: Math.round((screen.height - dimensions.height) / 2)
	};
	var options = {
		url: url,
		focused: true,
		type: 'panel',
		width: dimensions.width,
		height: dimensions.height,
		left: pos.x,
		top: pos.y
	};
	chrome.windows.create(options, callback || function() {});
}

function createXiamiPlayerPopup(id) {
	var size = getDefaultWindowSize(257, 33);
	var options = {
		url: 'http://www.xiami.com/widget/0_' + id + '/singlePlayer.swf',
		focused: true,
		type: 'panel',
		width: size.width,
		height: size.height
	};
	chrome.windows.create(options);
}

var waitFor = (function() {
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

var getRandomNumber = (function() {
	var today = new Date();
	var seed = today.getTime();
	function rnd() {
		seed = (seed * 9301 + 49297) % 233280;
		return seed / 233280.0;
	}
	return function(number) {
		return Math.ceil(rnd(seed) * number);
	}
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
				return m + ' min' + (m === '1' ? '' : 's') + ' ago';
			}
		], [
			table.d,
			function(convertor) {
				var h = convertor.h();
				return h + ' hr' + (h === '1' ? '' : 's') + ' ago';
			}
		], function(c) {
			return c._h(2) + ':' + c._m(2) + ', ' + c._d() +　' ' + c._MS(3);
		}
	];
});

var getShortTime = Ripple.helpers.generateTimeFormater(function(table) {
	return [ function(c) {
		return c._h(2) + ':' + c._m(2) + ', ' + c._d() +　' ' + c._MS(3);
	} ];
});

var getFullTime = Ripple.helpers.generateTimeFormater(function(table) {
	return [
		function(c) {
			return c._ms(2) + '-' + c._d(2) + '-' + c._yr() +
			' ' + c._h(2) + ':' + c._m(2) + ':' + c._s(2);
		}
	];
});

var getYMD = Ripple.helpers.generateTimeFormater(function(table) {
	return [
		function(c) {
			return c._yr() + '-' + c._ms(2) + 　 '-' + c._d(2);
		}
	];
});

function searchStatusInCache(status_id) {
	var status;
	var lists = [
		PREFiX.homeTimeline.buffered,
		PREFiX.homeTimeline.statuses,
		PREFiX.mentions.statuses
	];
	(window.saved_searches_items || bg_win.saved_searches_items).
	forEach(function(item) {
		lists.push(item.statuses);
	});
	lists.forEach(function(list) {
		list.some(function(s) {
			if (s.id === status_id) {
				status = s;
				return true;
			}
		});
	});
	return status;
}

function fixUser(user) {
	user.description = user.description.replace(/\s*\n\s*/g, '<br />');
}

function fixStatusList(statuses) {
	statuses = statuses.filter(function(status) {
		status.relativeTime = getRelativeTime(status.created_at);
		return ! status.filtered_out;
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

function isImage(type) {
	switch (type) {
	case 'image/jpeg':
	case 'image/png':
	case 'image/gif':
	case 'image/bmp':
	case 'image/jpg':
		return true;
	default:
		return false;
	}
}

function computeSize(size) {
	var units = ['', 'K', 'M', 'G', 'T'];
	while (size / 1024 >= .75) {
		size = size / 1024;
		units.shift();
	}
	size = Math.round(size * 10) / 10 + units[0] + 'B';
	return size;
}

function fixTransparentPNG(file) {
	var d = new Deferred;
	var img = new Image;
	var fr = new FileReader;
	fr.onload = function(e) {
		img.src = fr.result;
		Ripple.helpers.image2canvas(img).
		next(function(canvas) {
			var ctx = canvas.getContext('2d');
			var image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
			var pixel_array = image_data.data;
			var m, a, s;
			for (var i = 0, len = pixel_array.length; i < len; i += 4) {
				a = pixel_array[i+3];
				if (a === 255) continue;
				s = 255 - a;
				a /= 255;
				m = 3;
				while (m--) {
					pixel_array[i+m] = pixel_array[i+m] * a + s;
				}
				pixel_array[i+3] = 255;
			}
			ctx.putImageData(image_data, 0, 0);
			canvas.toBlob(function(blob) {
				blob.name = file.name;
				d.call(blob);
			});
		});
	}
	fr.readAsDataURL(file);
	return d;
}

function getDefaultWindowSize(width, height) {
	var delta_x = lscache.get('delta_x') || outerWidth - innerWidth;
	var delta_y = lscache.get('delta_y') || outerHeight - innerHeight;
	return {
		width: Math.round(width + delta_x),
		height: Math.round(height + delta_y)
	};
}

var _retried;
var _retryDelayBase = 60 * 1000;
var _maxExponent = 5;
function resetRetryDelay() {
	_retried = 0;
}
resetRetryDelay();
function getRetryDelay() {
	_retried = Math.min(_retried, _maxExponent);
	return 2 ** _retried++ * _retryDelayBase;
}
