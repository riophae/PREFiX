var history = {
	'0.2.1': [
		'修改导航栏图标快捷键',
		'改进平滑滚动效果',
		'修正字体间距不统一的问题'
	],
	'0.2.0': [
		'支持上传剪贴板图片',
		'加入平滑滚动效果',
		'修正 Mac 下窗口抖动的 bug',
		'细节更新和其他 bug 修正'
	]
};

var manifest = chrome.app.getDetails();

PREFiX.version = manifest.version;
PREFiX.old_version = localStorage['prefix_version'] || Object.keys(history)[1];
localStorage['prefix_version'] = PREFiX.version;

PREFiX.updated = PREFiX.old_version != PREFiX.version;

var updates = (function() {
	function fixVersionNum(version) {
		return parseInt(version.replace(/\./g, ''), 10);
	}

	var updated_items = [];
	var old_version = fixVersionNum(PREFiX.old_version || '0.1.2');

	var updates = Object.keys(history).filter(function(version_num) {
		return fixVersionNum(version_num) > old_version;
	});

	updates.forEach(function(version) {
		history[version].forEach(function(item) {
			if (updated_items.indexOf(item) === -1)
				updated_items.push(item);
		});
	});

	return updated_items;
})();

if (updates.length) {
	var updated_items = (function() {
		if (updates.length === 1)
			return updates[0];
		return updates.map(function(item, i) {
			return (i + 1) + '. ' + item;
		}).join('; ');
	})();
	updated_items = PREFiX.version + ' 更新内容: ' + updated_items;

	var t = updates.length * 7500;
	t = Math.max(t, 15000);
	t = Math.min(t, 60000);

	showNotification({
		title: 'PREFiX 已完成升级',
		content: updated_items,
		timeout: t
	}).
	addEventListener('click', function(e) {
		this.cancel();
	}, false);
}