$(function() {
	var bg_win = chrome.extension.getBackgroundPage();
	var PREFiX = bg_win.PREFiX;
	var lscache = bg_win.lscache;

	var custom_consumer = lscache.get('custom_consumer');
	if (custom_consumer) {
		$('#key').val(custom_consumer.key);
		$('#secret').val(custom_consumer.secret);
	}
	$('#set').click(function(e) {
		var key = $('#key').val().trim();
		var secret = $('#secret').val().trim();
		if (! key || ! secret) return;
		bg_win.enableCustomConsumer(key, secret);
	});
	$('#reset').click(function(e) {
		bg_win.disableCustomConsumer();
		location.reload();
	});
});