var $set = $('<input />');
$set.prop('type', 'button');
$set.prop('value', '设置 PREFiX 尾巴');
$set.addClass('formbutton');
$set.css({
	'margin-left': $('#resetkey').css('margin-left'),
	'letter-spacing': '1px'
});
$set.click(function(e) {
	var key = $('#app-consumer-key').text().trim();
	var secret = $('#app-consumer-secret').text().trim();
	var is_approved = $('.detail').text().indexOf('审核状态:已审核') > -1;
	if (! is_approved) {
		var msg = '该应用还没有通过审核, 设置尾巴后发送消息将显示 "通过 API". ' +
			'您无需额外操作, 耐心等待审核即可. ';
		alert(msg);
	}
	chrome.runtime.sendMessage({
		act: 'set_consumer',
		key: key,
		secret: secret
	});
});
$('#resetkey').after($set);