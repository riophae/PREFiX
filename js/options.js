$(function() {
	var ce = chrome.extension;
	var bg_win = ce.getBackgroundPage();
	var PREFiX = bg_win.PREFiX;
	var account = PREFiX.account || {
		profile_image_url_large: '/images/unknown-user.jpg'
	};

	$('#avatar img').prop('src', account.profile_image_url_large).prop('title', account.name);
	$('#switchAccount').click(function(e) {
		PREFiX.reset();
		close();
	});
	$('#setCustomConsumer').click(function(e) {
		location.href = '/set-custom-consumer.html';
	});
	$('#version').text(PREFiX.version);

	var current = PREFiX.settings.current;

	$('[key]').each(function() {
		var $item = $(this);
		var key = $item.attr('key');
		var value = current[key];
		switch ($item.attr('type')) {
			case 'checkbox':
				$item.prop('checked', value);
				break;
			case 'select':
				$item.val(value);
				break;
		}
	});

	if (! PREFiX.account) {
		$('#switchAccount').text('登入账号');
	}

	onunload = function(e) {
		$('[key]').each(function() {
			var $item = $(this);
			var key = $item.attr('key');
			var value;
			switch ($item.attr('type')) {
				case 'checkbox':
					value = $item.prop('checked');
					break;
				case 'select':
					value = $item.val();
					break;
			}
			current[key] = value;
		});
		PREFiX.settings.save();
		bg_win.detectFriendBirthday();
		bg_win.initSavedSearches();
	}
});