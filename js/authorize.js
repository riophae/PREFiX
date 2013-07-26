
// 这个脚本可能在同一页面加载多次
var loaded = loaded || false;

chrome.extension.onConnect.addListener(function(port) {

	function authorize() {

		if (loaded) return;
		loaded = true;

		if (document.querySelector('input[type="submit"]')) return;

		var pin_elem = document.getElementsByClassName('pin')[0];
		if (! pin_elem) return;

		var pin_code = pin_elem.textContent.trim();
		port.postMessage({
			type: 'authorize',
			pinCode: pin_code
		});

		pin_elem.textContent = '正在完成验证, 请稍候..';

		port.onMessage.addListener(function(msg) {
			if (msg.type === 'authorize' && msg.msg === 'success') {
				pin_elem.textContent = '验证成功完成! :) 数秒后页面将关闭.';
			} else {
				pin_elem.innerHTML = '验证失败. 点击 <span id="retry">这里</span> 重试. :( ';
				var retry = document.getElementById('retry');
				retry.addEventListener('click', function() {
					port.postMessage({
						type: 'authorize',
						msg: 'retry'
					});
				}, false);
			}
		});

	}

	if (document.readyState === 'complete') {
		authorize();
	} else {
		document.addEventListener('DOMContentLoaded', authorize, false);
		document.addEventListener('load', authorize, false);
	}

});

