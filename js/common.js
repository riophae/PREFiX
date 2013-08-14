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
				return convertor.s(2) + 'secs ago';
			}
		], [
			table.h,
			function(convertor) {
				return convertor.m() + 'min' + (convertor.m() > 1 ? 's' : '') + ' ago';
			}
		], [
			table.d,
			function(convertor) {
				return convertor.h() + 'hr' + (convertor.h() > 1 ? 's' : '') + ' ago';
			}
		], function(c) {
			return c._yr() + '-' + c._ms(2) + 　 '-' + c._d(2) +
			' ' + c._h(2) + ':' + c._m(2) + ':' + c._s(2);
		}
	];
});

function fixStatusList(statuses) {
	statuses.forEach(function(status) {
		status.source = ({
			'网页': 'Web',
			'手机上网': 'Wap'
		})[status.source] || status.source;
		status.relativeTime = getRelativeTime(status.created_at);
	});
	return statuses.sort(function(status_a, status_b) {
		return status_a.rawid ?
		 (status_b.rawid - status_a.rawid) : (+status_b.id - +status_a.id);
	});
}

