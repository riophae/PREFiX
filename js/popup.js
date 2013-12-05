var ce = chrome.extension;
var bg_win = ce.getBackgroundPage();
var Ripple = bg_win.Ripple;
var Deferred = bg_win.Deferred;
var lscache = bg_win.lscache;
var jEmoji = bg_win.jEmoji;
var PREFiX = bg_win.PREFiX;

var $body;
var $app;
var $textarea;
var $main;

var is_panel_mode = false;
var is_focused = true;
var $scrolling_elem;

var is_windows = navigator.platform.indexOf('Win') > -1;

var loading = false;
var is_on_top = true;
PREFiX.popupActive = true;

var lyric;

var r = PREFiX.user;

if (! r) {
	bg_win.initialize();
	close();
}

var usage_tips = bg_win.usage_tips;

function getViewHeight() {
	return lscache.get('popup_view_height') || 600;
}

function setViewHeight(height) {
	lscache.set('popup_view_height', Math.round(Math.max(600, height)));
	applyViewHeight();
}

function applyViewHeight() {
	var height = getViewHeight();
	$('body, #picture-overlay, #context-timeline').height(height);
	$main.height(height - parseInt($main.css('top'), 10));
}

var goTop = (function() {
	var s = 0;
	var current;
	var id;
	var stop = function() { };
	return function(e) {
		stopSmoothScrolling();
		stop();
		stop = function() {
			stop = function() { };
			cancelAnimationFrame(id);
		}
		if (e) {
			e.preventDefault && e.preventDefault();
			s = $main[0].scrollTop;
		}
		var breakpoint;
		id = requestAnimationFrame(function(timestamp) {
			if (breakpoint) {
				var diff = (timestamp - breakpoint) * 1.2;
				current = $main[0].scrollTop;
				if (s != current) {
					return stop();
				}
				var to = Math.floor(s / 1.15 / Math.max(1, diff / 32));
				$main[0].scrollTop = s = to;
			}
			if (s >= 1 || ! breakpoint) {
				breakpoint = timestamp;
				id = requestAnimationFrame(arguments.callee);
			};
		});
	}
})();

var registered_smooth_scroll_data = [];
function initSmoothScroll($target) {
	var id;
	var is_scrolling = false;
	var destination = null;
	var _stop = function() { };
	function runAnimation(dest) {
		if (dest !== undefined) {
			destination = Math.round(dest);
		}
		function renderFrame(timestamp) {
			if (! is_scrolling) return;

			if (breakpoint) {
				var progress = (timestamp - breakpoint) * 1.2;

				var pos = $target.scrollTop();
				var diff = destination - pos;
				var dist = Math.round(Math.min(1, progress / 32) * diff / 4);
				dist = dist || Math.abs(diff) / diff;

				var min_pos = 0;
				var max_pos = $target[0].scrollHeight - height;
				var this_pos = Math.max(min_pos, pos + dist);
				this_pos = Math.min(this_pos, max_pos);

				$target.scrollTop(this_pos);

				diff = destination - this_pos;
				if (! diff || [ min_pos, max_pos ].indexOf(this_pos) > -1) {
					return _stop();
				}
			}


			breakpoint = timestamp;
			id = requestAnimationFrame(renderFrame);
		}
		if (is_scrolling) return;
		var height = $target.height();
		is_scrolling = true;
		var breakpoint;
		id = requestAnimationFrame(renderFrame);
		_stop = function() {
			_stop = function() { };
			if ($target === $main) {
				stopSmoothScrolling = _stop;
			}
			destination = null;
			is_scrolling = false;
			cancelAnimationFrame(id);
		}
		if ($target === $main) {
			stopSmoothScrolling = _stop;
		}
	}
	$target.on('mousewheel', function(e, delta) {
		if (! PREFiX.settings.current.smoothScroll && e.flag !== true)
			return;
		e.preventDefault();
		destination = destination || $target.scrollTop();
		destination = Math.ceil(-delta * 120 + destination);
		runAnimation();
	});
	registered_smooth_scroll_data.push({
		elem: $target[0],
		run: runAnimation
	});
}
function stopSmoothScrolling() { }
function smoothScrollTo(destination) {
	registered_smooth_scroll_data.forEach(function(item) {
		if (item.elem === $scrolling_elem[0]) {
			item.run(destination);
		}
	});
}

var showNotification = (function() {
	var timeout;
	return function(text) {
		clearTimeout(timeout);
		$('#notification').text(text).css({
			display: 'inline-block',
			opacity: 0,
			'margin-top': '15px'
		}).animate({
			opacity: 1,
			'margin-top': '0px'
		});
		timeout = setTimeout(function() {
			$('#notification').fadeOut();
		}, 5000);
	}
})();

function showUsageTip() {
	if ($main[0].scrollTop) {
		setTimeout(showUsageTip, 100);
		return;
	}
	var pos = lscache.get('usage_tip_pos') || 0;
	pos = Math.min(pos, usage_tips.length);
	var tip = usage_tips[pos];
	if (! tip) {
		$('#usage-tip').remove();
		return;
	}
	$('#hide-usage-tip').click(function(e) {
		lscache.set('usage_tip_pos', usage_tips.length);
		$title.removeClass('show-usage-tip');
	});
	lscache.set('usage_tip_pos', ++pos);
	$('#usage-tip-content').html(tip);
	var $title = $('#title');
	$title.addClass('show-usage-tip');
	setTimeout(function() {
		$title.removeClass('show-usage-tip');
	}, 15000);
}

function count(e) {
	var length = computeLength(composebar_model.text);
	$app.toggleClass('over', length > 140);
}

function setContent(content) {
	composebar_model.text = content.trim().replace(/\s+/g, ' ');
	count();
}

function shorten(links, force) {
	var result = links || composebar_model.text.match(url_re) || [];
	var dl = [];
	var ignored = [];

	[].forEach.call(result, function(link) {
		if (link.length <= url_max_len) {
			if (! force && link.length > url_placeholder.length) {
				ignored.push(link);
				return;
			}
			if (! force) return;
		}
		var d = Ripple.shorten['is.gd'](link).
			next(function(short_url) {
				setContent(composebar_model.text.replace(link, short_url));
			}).
			error(function(e) {
				if (e && ! e.status) {
					ignored.push(link);
				}
			});
		dl.push(d);
	});
	dl = Deferred.parallel(dl);
	dl = dl.next(function() {
		if (composebar_model.text.length <= 140) return;
		if (ignored.length) {
			return shorten(ignored, true);
		}
	});
	return dl;
}

function getCurrent() {
	return window[PREFiX.current];
}

var last_draw_attention = new Date;
function drawAttention() {
	if (! is_panel_mode || is_focused) return;
	var now = new Date;
	if (now - last_draw_attention < 3000) return;
	last_draw_attention = now;
	setTimeout(function() {
		chrome.runtime.sendMessage({
			act: 'draw_attention'
		});
	}, 0);
}

function stopDrawingAttention() {
	chrome.runtime.sendMessage({
		act: 'stop_drawing_attention'
	});
}

function updateRelativeTime() {
	var current = getCurrent();
	if (! current || (! current.statuses && ! current.messages))
		return;
	(current.statuses || current.messages).forEach(function(s) {
		s.relativeTime = getRelativeTime(s.created_at);
	});
}

var breakpoints = [];
function markBreakpoint() {
	breakpoints.push(Date.now());
}

function createTab(url, active) {
	chrome.tabs.create({
		url: url,
		active: active === true
	});	
}

function confirmFollowing() {
	r.addFriend({ id: 'ruif' }).next(function() {
		showNotification('感谢关注 :)');
	});
	hideFollowingTip();
}

function denyFollowing() {
	hideFollowingTip();
}

function hideFollowingTip() {
	$('#follow-author').css({
		'animation-name': 'wobbleOut',
		'animation-duration': 400
	}).delay(400).hide(0, function() {
		$(this).remove();
		lscache.set('hide-following-tip', true);
	});
}

function showRatingPage() {
	var url = 'https://chrome.google.com/webstore/detail/prefix/gjpcbbbopajjjnkbkeaflldnocoppcpc/reviews';
	createTab(url, true);
	hideRatingTip();
}

function showRatingTip() {
	$('#rating-tip').show();
}

function hideRatingTip() {
	$('#rating-tip').css({
		'animation-name': 'wobbleOut',
		'animation-duration': 400
	}).delay(400).hide(0, function() {
		$(this).remove();
		lscache.set('hide-rating-tip', true);
	});
}

function accumulateTime() {
	var time = lscache.get('timer') || 0;
	time++;

	if (time >= 600) {
		clearInterval(rating_interval);
		showRatingTip();
	}

	lscache.set('timer', time);
}

function sendBirthdayMessage() {
	var type = PREFiX.settings.current.birthdayGreetingType;
	if (PREFiX.birthdayFriends.length > 1)
		type = 'post_status';

	switch (type) {
		case 'post_status':
			var text = [];
			PREFiX.birthdayFriends.forEach(function(friend) {
				text.push('@' + friend.name + ' ');
			});
			text.push('生日快乐! :)');
			composebar_model.text = text.join('');
			focusToEnd();
			break;

		case 'send_pm':
			var friend = PREFiX.birthdayFriends[0];
			sendBirthdayMessageViaPM(friend.id, friend.name)
			break;
	}
}

function sendBirthdayMessageViaPM(id, name) {
	if (id === PREFiX.account.id) return;
	composebar_model.birthdayGreeting = true;
	sendPM(id, name);
}

function sendPM(id, name) {
	if (id === PREFiX.account.id) return;
	composebar_model.text = '';
	composebar_model.type = 'send-pm';
	composebar_model.id = '';
	composebar_model.user = id;
	composebar_model.username = name;
	focusToEnd();
}

function focusToEnd() {
	$textarea.focus();
	var pos = composebar_model.text.length;
	$textarea[0].selectionStart = $textarea[0].selectionEnd = pos;
}

function setImage(file) {
	$textarea.css('text-indent', file ? '30px' : '');
	var size;
	if (file) {
		size = computeSize(file.size);
	}
	if (file && file.size > 2 * 1024 * 1024) {
		var msg = '您的图片文件大小 (' + size + ') 超过 2MB, 上传可能会失败.' +
			' 确定要继续吗?';
		if (! confirm(msg)) return;
	}
	var $upload = $('#uploading-photo');
	var title = '上传图片';
	if (file) {
		title = '取消上传 ' + file.name + ' (' +
			size + ')';
			$textarea.focus();
	}
	$upload.prop('title', title);
	$upload.toggleClass('file-selected', !! file);
	PREFiX.image = file;
	$textarea[0].focus();
	$textarea[0].blur();
	if (file) {
		$textarea.focus();
	}
}

function initMainUI() {
	$body = $('body');
	$app = $('#app');

	if (navigator.platform.indexOf('Linux') > -1) {
		$('html').attr('platform', 'linux');
	} else if (PREFiX.is_mac) {
		$('html').attr('platform', 'mac');
	}

	var ratio = +PREFiX.settings.current.zoomRatio;
	if (ratio !== 1 && is_panel_mode) {
		$body.css('zoom', ratio);
		$('<link />').
		prop('rel', 'stylesheet').
		prop('href', 'css/retina.css').
		appendTo('head');
		if (ratio > 1.4) {
			$('h2').css('letter-spacing', '.5px');
		}
		if (ratio === 1.25) {
			$('<link />').
			prop('rel', 'stylesheet').
			prop('href', 'css/font-fix.css').
			appendTo('head');
		}
	}

	var $birthday_cake = $('#birthday-cake');
	if (PREFiX.isTodayBirthday) {
		var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
		var today = now.getFullYear() + '-' + (now.getMonth() + 1) + now.getDate();
		var count = lscache.get(today + '-birthday') || 0;
		if (count >= 1) {
			$birthday_cake.remove();
		} else {
			$birthday_cake.fadeIn(1000, function() {
				setTimeout(function() {
					$birthday_cake.fadeOut(1000, function() {
						$birthday_cake.remove();
						lscache.set(today + '-birthday', ++count);
					});
				}, 10000);
			});
		}
	} else {
		$birthday_cake.remove();
	}

	var birthday_friends = [].slice.call(PREFiX.birthdayFriends, 0);
	var $birthday_tip = $('#birthday-tip');
	if (birthday_friends.length && PREFiX.settings.current.birthdayNotice) {
		var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
		var today = now.getFullYear() + '-' + (now.getMonth() + 1) + now.getDate();
		if (! lscache.get(today + '-friends-birthday')) {
			function getHTML(friends) {
				return friends.map(function(friend) {
					return '<a href="http://fanfou.com/' +
						friend.id + '" send-birthday-message-to="' +
						friend.id + ':' + friend.name +
						'">@' + friend.name + '</a>';
				});
			}
			function hideBirthdayTip() {
				$('#birthday-tip').css({
					'animation-name': 'wobbleOut',
					'animation-duration': 400
				}).delay(400).hide(0, function() {
					$(this).remove();
					lscache.set(today + '-friends-birthday', true);
				});
			}
			var friends = [];
			var total = birthday_friends.length;
			if (total > 2) {
				var pre_friends = birthday_friends.splice(0, total - 1);
				friends.push(getHTML(pre_friends).join('、'));
			}
			if (birthday_friends.length) {
				friends.push(getHTML(birthday_friends).join(' 和 '));
			}
			$('#birthday-friend-list').html(friends.join(' 和 ')).
			delegate('[send-birthday-message-to]', 'click', function(e) {
				e.preventDefault();
				e.stopPropagation();
				var $item = $(this);
				var data = $item.attr('send-birthday-message-to').split(':');
				$item.removeAttr('send-birthday-message-to');
				sendBirthdayMessageViaPM(data[0], data[1]);
				if (! $('[send-birthday-message-to]').length) {
					hideBirthdayTip();
				}
			});
			$('#send-birthday-message').click(sendBirthdayMessage).click(hideBirthdayTip);
			$('#hide-birthday-tip').click(hideBirthdayTip);
			$birthday_tip.show();
		}
	} else {
		$birthday_tip.remove();
	}

	if (! lscache.get('hide-following-tip')) {
		$('#confirm-following').click(confirmFollowing);
		$('#deny-following').click(denyFollowing);
		r.isFollowing(PREFiX.account.id, 'ruif').next(function(result) {
			if (result) denyFollowing();
		});
	} else {
		$('#follow-author').remove();
	}

	$(window).on('focus', function(e) {
		is_focused = true;
		stopDrawingAttention();
		markBreakpoint();
	}).on('blur', function(e) {
		is_focused = false;
	});

	$textarea = $('#compose-bar textarea');
	$textarea.autosize().atwho({
		at: '@',
		data: PREFiX.friends,
		search_key: 'string',
		tpl: '<li data-value="${name}">${name}</li>'
	});

	$app.on({
		dragenter: function(e) {},
		dragover: function(e) {
			e.stopPropagation();
			e.preventDefault();
		},
		dragleave: function(e) {},
		drop: function(e) {
			e = e.originalEvent;

			e.stopPropagation();
			e.preventDefault();

			var file = e.dataTransfer.files[0];
			if (! file || ! isImage(file.type))
				return;

			if (file.type === 'image/png') {
				fixTransparentPNG(file).next(function(blob) {
					setImage(blob);
				});
			} else {
				setImage(file);
			}
		}
	});

	$('#uploading-photo').click(function(e) {
		if (! PREFiX.image) {
			if (! is_panel_mode && ! is_windows) {
				$('#new-window').click();
			}
			return;
		};
		setImage(null);
		var $copy = $file.clone(true);
		$file.replaceWith($copy);
		$file = $copy;
	});

	var $file = $('#file');
	$file.on('change', function(e) {
		var file = $(this)[0].files[0];
		if (! file || ! isImage(file.type))
			return;
		if (file.type === 'image/png') {
			fixTransparentPNG(file).next(function(blob) {
				setImage(blob);
			});
		} else {
			setImage(file);
		}
	});

	if (! is_windows && ! is_panel_mode) {
		$file.hide();
	}

	$(window).on('paste', function(e) {
		var e = e.originalEvent;
		var items = e.clipboardData.items;
		if (! items.length) return;
		var f, i = 0;
		while (items[i]) {
			f = items[i].getAsFile();
			if (f && isImage(f.type))	{
				break;
			}
			i++;
		}
		if (! f) return;
		f.name = 'image-from-clipboard.' + f.type.replace('image/', '');
		if (file.type === 'image/png') {
			fixTransparentPNG(f).next(function(blob) {
				setImage(f);
			});
		} else {
			setImage(f);
		}
	});

	setImage(PREFiX.image);

	$main = $scrolling_elem = $('#main');

	$main[0].onscroll = function(e) {
		this.scrollLeft = 0;
	}

	$main.scroll(_.throttle(function(e) {
		var scroll_top = $main.scrollTop();
		getCurrent().scrollTop = scroll_top;
		$app.toggleClass('on-top', scroll_top === 0);
		if (scroll_top + $main.height() >= $main[0].scrollHeight - ($main[0].clientHeight/2))
			loadOldder();
		if (scroll_top < 30)
			markBreakpoint();
	}, 100));

	$('#app').delegate('[data-send-pm]', 'click', function(e) {
		e.stopImmediatePropagation();
		e.preventDefault();
		var data = $(this).data('send-pm').split(':');
		sendPM(data[0], data[1]);
	}).delegate('a', 'click', function(e) {
		if (e.currentTarget.href.indexOf('http://') !== 0 &&
			e.currentTarget.href.indexOf('https://') !== 0)
			return;
		e.preventDefault();
		e.stopPropagation();
		createTab(e.currentTarget.href);
	}).delegate('a[href^="/q/"]', 'click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		createTab('http://fanfou.com' + $(e.target).attr('href'));
	}).delegate('.photo img', 'contextmenu', function(e) {
		var large_url = e.target.dataset.largeImg;
		if (large_url) {
			e.preventDefault();
			createTab(large_url);
		}
	}).delegate('.photo img', 'click', function(e) {
		showPicture(e.target.dataset.largeImg);
	});

	$('h1').click(function(e) {
		if ($main[0].scrollTop) {
			goTop(e);
		}
		if ($main[0].scrollTop < 30) {
			if (PREFiX.current === 'searches_model') {
				$('#topic-selector').trigger('change');
			} else {
				cutStream();
				PREFiX.update();
			}
		}
	});

	$('#new-window').click(function(e) {
		createPanel(400, getViewHeight(), '/popup.html?new_window=true');
		close();
	});

	$('#picture-overlay').click(function(e) {
		hidePicture();
	});

	$('#context-timeline').click(function(e) {
		if (! $(e.target).is('a') && ! $(e.target).is('img')) {
			$(this).removeClass('focusInFromBottom').addClass('focusOutFromTop');
			setTimeout(function() {
				$scrolling_elem = $main;
				$('body').removeClass('show-context-timeline');
			}, 250);
			if (showContextTimeline.ajax) {
				showContextTimeline.ajax.cancel();
			}
			if (showRelatedStatuses.ajax) {
				showRelatedStatuses.ajax.cancel();
			}
		}
	});
	
	$('#context-timeline ul').click(function(e) {
		if (! $(e.target).is('a') && ! $(e.target).is('img'))
			e.stopPropagation();
	});

	composebar_model.type = PREFiX.compose.type;
	composebar_model.id = PREFiX.compose.id;
	composebar_model.user = PREFiX.compose.user;
	composebar_model.username = PREFiX.compose.username;
	composebar_model.text = PREFiX.compose.text;
	if (PREFiX.compose.text) {
		focusToEnd();
	}

	[ $main, $('#context-timeline'), $('#picture-overlay') ].forEach(initSmoothScroll);

	$(window).on('keydown', function(e) {
		var $link;
		switch (e.keyCode) {
			case 49:
				$link = $('#navigation-bar .home-timeline');
				break;
			case 50:
				$link = $('#navigation-bar .mentions');
				break;
			case 51:
				$link = $('#navigation-bar .privatemsgs');
				break;
			case 52:
				$link = $('#navigation-bar .saved-searches');
				break;
			default:
				return;
		}
		e.preventDefault();
		var event = new Event('click');
		$link[0].dispatchEvent(event);
	}).on('keydown', function(e) {
		switch (e.keyCode) {
			case 40: case 38:
				break;
			default:
				return;
		}
		e.preventDefault();
		var page_height = innerHeight / ratio;
		if ($scrolling_elem === $main) {
			page_height -= parseInt($main.css('top'), 10);
		}
		var current_pos = $scrolling_elem.scrollTop();
		var direction = e.keyCode === 40 ? 1 : -1;
		smoothScrollTo(current_pos + (page_height * direction));
	}).on('keydown', function(e) {
		if (e.keyCode !== 36) return;
		if ($scrolling_elem === $main)
			goTop(e);
		else
			smoothScrollTo(0);
	}).on('keydown', function(e) {
		if (e.keyCode !== 35) return;
		e.preventDefault();
		var full_height = $scrolling_elem[0].scrollHeight;
		var page_height = $scrolling_elem[0].clientHeight;
		var destination = full_height - page_height;
		if ($scrolling_elem.scrollTop() < destination)
			smoothScrollTo(destination);
	}).on('keydown', function(e) {
		switch (e.keyCode) {
			case 34: case 33:
				break;
			default:
				return;
		}
		e.preventDefault();
		var $win = $(window);
		var event;
		for (var i = 0; i < 4; i++) {
			event = new Event('keydown');
			event.keyCode = e.keyCode === 33 ? 38 : 40;
			dispatchEvent(event);
		}
	});

	resetLoadingEffect();

	setInterval(updateRelativeTime, 15000);
	setInterval(checkCount, 100);

	if (! lscache.get('hide-rating-tip')) {
		window.rating_interval = setInterval(accumulateTime, 60000);
		accumulateTime();
		$('#show-rating-page').click(showRatingPage);
		$('#hide-rating-tip').click(hideRatingTip);
	} else {
		$('#rating-tip').remove();
	}
}

function cutStream() {
	var current = getCurrent();
	if (current.statuses) {
		current.statuses = current.statuses.slice(0, 20);
	} else {
		current.messages = current.messages.slice(0, 20);
	}
}

function computePosition(data) {
	var left = parseInt(($body[0].clientWidth - data.width) / 2, 10);
	var top = parseInt(($body[0].clientHeight - data.height) / 2, 10);
	data.left = Math.max(0, left);
	data.top = Math.max(0, top);
	for (var key in data) {
		data[key] += 'px';
	}
	return data;
}

function createPanel(width, height, url) {
	var size = getDefaultWindowSize(width, height);
	var options = {
		url: url,
		focused: true,
		type: 'panel',
		width: Math.round(size.width),
		height: Math.round(size.height),
		left: Math.round((screen.width - size.width) / 2),
		top: Math.round((screen.height - size.height) / 2)
	};
	chrome.windows.create(options);
}

function showPicture(img_url) {
	var $picture = $('#picture');
	$body.addClass('show-picture');
	if ($picture.prop('src') != img_url) {
		$picture.prop('src', img_url);
	}
	$picture.hide().removeClass('run-animation').css({
		'width': '',
		'height': ''
	});
	var $overlay = $scrolling_elem = $('#picture-overlay');
	$overlay.removeClass('error');
	$overlay.scrollTop(0);
	$picture.off().on('error', function(e) {
		$overlay.addClass('error');
		canceled = true;
	});
	var canceled = false;
	waitFor(function() {
		return $picture[0].naturalWidth || canceled;
	}, function() {
		if ($picture[0].naturalWidth > 400) {
			$picture.css('width', '400px');
		}
		var width = parseInt($picture.css('width'), 10);
		var height = parseInt($picture.css('height'), 10);
		$picture.css(computePosition({
			width: width / 2,
			height: height / 2
		})).
		css({
			opacity: .5,
			display: 'block',
			'transition-timing-function': 'linear'
		}).
		show().
		addClass('run-animation').
		css(computePosition({
			width: width,
			height: height
		})).
		css({
			opacity: 1,
			animation: 'pictureSlideIn .3s both'
		});
	});
}

function hidePicture() {
	$scrolling_elem = $main;
	var $picture = $('#picture');
	$picture.
	css(computePosition({
		width: parseInt($picture.css('width'), 10) / 2,
		height: parseInt($picture.css('height'), 10) / 2
	})).
	css({
		opacity: .5,
		animation: 'pictureSlideOut .3s both',
		'transition-timing-function': 'linear'
	});
	setTimeout(function() {
		$('body').removeClass('show-picture');
		$picture.removeClass('run-animation');
	}, 350);
}

var pre_count = {
	timeline: 0,
	mentions: 0,
	direct_messages: 0
};
function checkCount() {
	var count = PREFiX.count;
	var title_contents = [];
	var $home_tl = $('#navigation-bar .home-timeline .count');
	var $mentions = $('#navigation-bar .mentions .count');
	var $privatemsgs = $('#navigation-bar .privatemsgs .count');
	var $saved_searchs = $('#navigation-bar .saved-searches .count');
	if (count.mentions) {
		title_contents.push(count.mentions + ' @');
		$mentions.text(count.mentions).fadeIn(120);
		if (pre_count.mentions < count.mentions)
			drawAttention();
	} else {
		$mentions.text('').fadeOut(120);
	}
	pre_count.mentions = count.mentions;
	if (count.direct_messages) {
		title_contents.push(count.direct_messages + ' 私信');
		$privatemsgs.text(count.direct_messages).fadeIn(120);
		if (pre_count.direct_messages < count.direct_messages)
			drawAttention();
	} else {
		$privatemsgs.text('').fadeOut(120);
	}
	pre_count.direct_messages = count.direct_messages;
	var buffered = PREFiX.homeTimeline.buffered.filter(function(status) {
		return ! status.is_self;
	}).length;
	if (buffered) {
		title_contents.push(buffered + ' 新消息');
		$home_tl.text(Math.min(buffered, 99)).fadeIn(120);
	} else {
		$home_tl.text('').fadeOut(120);
	}
	var search_statuses_count = bg_win.getSavedSearchStatusesCount();
	if (search_statuses_count) {
		title_contents.push(search_statuses_count + ' 关注话题消息');
		$saved_searchs.text(Math.min(search_statuses_count, 99)).fadeIn(120);
	} else {
		$saved_searchs.text('').fadeOut(120);
	}
	var title = 'PREFiX';
	if (title_contents.length) {
		title += ' (' + title_contents.join(' / ') + ')';
	}
	document.title = title;
}

function resetLoadingEffect() {
	$('#loading').hide();
	setTimeout(function() {
		$('#loading').show();
	}, 0);
}

function appendStatuses(statuses) {
	var model = getCurrent();
	push(model.statuses, statuses);
}

function bufferStatuses(statuses) {
	push(PREFiX.homeTimeline.buffered, statuses);
}

function insertKeepScrollTop(insert) {
	var scroll_top = $main[0].scrollTop;
	var scroll_height = $main[0].scrollHeight;
	insert();
	setTimeout(function() {
		$main.scrollTop(scroll_top + $main[0].scrollHeight - scroll_height);
	}, 50);
}

function loadOldder() {
	var model = getCurrent();
	if (model === searches_model) {
		var oldest_status = searches_model.statuses[searches_model.statuses.length - 1];
		if (! oldest_status) return;
		var $selector = $('#topic-selector');
		var k = $selector.val();
		if (k === '##MY_FAVORITES##') {
			r.getFavorites({
				id: PREFiX.account.id,
				page: searches_model.page + 1,
			}).setupAjax({
				lock: loadOldder,
				send: function() {
					loading = true;
				},
				oncomplete: function() {
					loading = false;
				}
			}).next(function(statuses) {
				searches_model.page++;
				var list = searches_model.statuses;
				list.push.apply(list, statuses);
				updateRelativeTime();
			});
		} else if (k !== '##PUBLIC_TIMELINE##') {
			r.searchPublicTimeline({
				q: k,
				max_id: oldest_status.id,
			}).setupAjax({
				lock: loadOldder,
				send: function() {
					loading = true;
				},
				oncomplete: function() {
					loading = false;
				}
			}).next(function(statuses) {
				push(searches_model.statuses, statuses);
			});
		}
	} else if (model.statuses) {
		var oldest_status = model.statuses[model.statuses.length - 1];
		if (! oldest_status) return;
		var id = oldest_status.id;
		r[model === tl_model ? 'getHomeTimeline' : 'getMentions']({
			max_id: id
		}).setupAjax({
			lock: loadOldder,
			send: function() {
				loading = true;
			},
			oncomplete: function() {
				loading = false;
			}
		}).next(function(statuses) {
			appendStatuses(statuses)
		});
	} else {
		var oldest_message = model.messages[model.messages.length - 1];
		if (! oldest_message) return;
		var id = oldest_message.id;
		r.showInbox({
			max_id: id
		}).setupAjax({
			lock: loadOldder,
			send: function() {
				loading = true;
			},
			oncomplete: function() {
				loading = false;
			}
		}).next(function(messages) {
			push(privatemsgs_model.messages, messages);
		});
	}
}

function remove(e) {
	showNotification('正在删除..')
	var self = this;
	var status_id = self.$vmodel.status.id;
	r.destroyStatus({ 
		id: status_id 
	}).setupAjax({
		lock: self
	}).error(function(e) {
		if (e.status !== 404) {
			throw e;
		}
	}).next(function() {
		showNotification('删除成功!');
		$(self).parents('li').slideUp(function() {
			self.$vmodel.$remove();
		});
		if (self.$vmodel.status.is_self && PREFiX.count.mentions) {
			PREFiX.update();
		}
	});
}

function generateMethod(type) {
	return function() {
		var status = this.$vmodel.status;
		composebar_model.type = type;
		composebar_model.id = status.id;
		if (type === 'reply') {
			var at_users = { };
			at_users[status.user.name] = true;
			var at_re = /([^"/]+)"\s+class=\"former">([^<>\s]+)/g;
			var result;
			while (result = at_re.exec(status.text)) {
				if (result[1] != PREFiX.account.id && result[2] != PREFiX.account.name) {
					at_users[result[2]] = true;
				}
			}
			var prefix = '@' + status.user.name + ' ';
			var value = prefix + Object.keys(at_users).map(function(user) {
				return user == status.user.name ? '' : ('@' + user + ' ');
			}).join('');
		} else {
			var value = '转@' + status.user.name + ' ' + 
				$('<div>' + status.text + '</div>').text();
		}
		composebar_model.text = value;
		$textarea.focus();
		if (type === 'reply') {
			$textarea[0].selectionStart = prefix.length;
			$textarea[0].selectionEnd = value.length;
		} else {
			$textarea[0].selectionStart = $textarea[0].selectionEnd = 0;
		}
	}
}

function toggleFavourite(e) {
	var self = this;
	var status = self.$vmodel.status;
	$(self).css('animation', '');
	showNotification(status.favorited ? '取消收藏..' : '正在收藏..')
	r[status.favorited ? 'removeFavorite' : 'addFavorite']({
		id: status.id
	}).setupAjax({
		lock: self
	}).next(function() {
		status.favorited = ! status.favorited;
		showNotification(status.favorited ? '收藏成功!' : '取消收藏成功!');
		$(self).css('animation', 'spring .5s linear');
	});
}

function showContextTimeline(e) {
	e.preventDefault();
	$body.addClass('show-context-timeline');
	var status = this.$vmodel.status.$model;
	var id = status.id;
	context_tl_model.statuses = [];
	var context_statuses = [ status ];
	var $context_tl = $scrolling_elem = $('#context-timeline');
	$context_tl.removeClass('focusOutFromTop').addClass('focusInFromBottom loading');
	$context_tl.scrollTop(0);
	if (status.repost_status) {
		context_statuses.push(status.repost_status);
		id = status.repost_status.id;
	}
	(function get() {
		showContextTimeline.ajax = r.getContextTimeline({
			id: id
		}).next(function(statuses) {
			unshift(context_statuses, statuses, true);
			context_tl_model.statuses = fixStatusList(context_statuses).reverse();
			$('#context-timeline').removeClass('loading');
		}).error(function(e) {
			id = status.in_reply_to_status_id;
			if (e.status === 403 && id)
				get();
		});
	})();
}

function showRelatedStatuses(e) {
	$body.addClass('show-context-timeline');
	var $context_tl = $scrolling_elem = $('#context-timeline');
	$context_tl.removeClass('focusOutFromTop').addClass('focusInFromBottom loading');
	$context_tl.scrollTop(0);
	context_tl_model.statuses = [];
	var statuses = [];
	var status = this.$vmodel.status.$model;
	(function get() {
		push(statuses, [ status ]);
		var id = status.repost_status_id || status.in_reply_to_status_id;
		if (id) {
			showRelatedStatuses.ajax = r.showStatus({ id: id }).next(function(s) {
				status = s;
				get();
			}).error(function() {
				$context_tl.removeClass('loading');
				unshift(context_tl_model.statuses, statuses, true);
			});
		} else {
			$context_tl.removeClass('loading');
			unshift(context_tl_model.statuses, statuses, true);
		}
	})();
}

var nav_model = avalon.define('navigation', function(vm) {
	vm.current = PREFiX.current;
	vm.showHomeTimeline = function(e) {
		if (loading) return;
		if (vm.current == 'tl_model' && $main.scrollTop())
			return goTop(e);
		PREFiX.current = vm.current = 'tl_model';
		tl_model.initialize();
	}
	vm.showMentions = function(e) {
		if (loading) return;
		if (vm.current == 'mentions_model' && $main.scrollTop())
			return goTop(e);
		PREFiX.current = vm.current = 'mentions_model';
		mentions_model.initialize();
	}
	vm.showPrivateMsgs = function(e) {
		if (loading) return;
		if (vm.current == 'privatemsgs_model' && $main.scrollTop())
			return goTop(e);
		PREFiX.current = vm.current = 'privatemsgs_model';
		privatemsgs_model.initialize();
	}
	vm.showSavedSearches = function(e) {
		if (loading) return;
		if (vm.current == 'searches_model' && $main.scrollTop())
			return goTop(e);
		PREFiX.current = vm.current = 'searches_model';
		searches_model.initialize();
	}
	vm.$watch('current', function(new_value, old_value) {
		if (old_value == 'privatemsgs_model') {
			composebar_model.type = '';
		}
		if (old_value == 'searches_model') {
			$('#topic-selector').hide();
		}
		if (new_value == 'searches_model') {
			$('#topic-selector').show();
		}
		window[old_value] && window[old_value].unload();
		$('#navigation-bar li').removeClass('current');
		$('#stream > ul').removeClass('current');
		updateRelativeTime();
		resetLoadingEffect();
	});
});

var composebar_model = avalon.define('composebar-textarea', function(vm) {
	vm.text = vm.type = vm.id = vm.user = vm.username = '';
	vm.birthdayGreeting = false;
	vm.submitting = false;
	vm.onfocus = function(e) {
		var placeholder;
		if (PREFiX.isTodayFanfouBirthday) {
			placeholder = '还记得今天是什么日子吗? 祝你饭否 ' + 
				Math.floor(PREFiX.fanfouYears) + 
				' 周岁生日快乐! :)';
		} else {
			placeholder = lyric = lyric || getLyric();
		}
		if (vm.username) {
			if (! vm.id) {
				placeholder = '发送私信给 @' + vm.username;
				if (vm.birthdayGreeting) {
					placeholder += ', 为 TA 送上生日祝福';
				}
			} else {
				placeholder = '回复 @' + vm.username + ' 的私信';
			}
		}
		$textarea.prop('placeholder', placeholder);
	}
	vm.onblur = function(e) {
		$textarea.prop('placeholder', '');
		if (! vm.text.length) {
			vm.type = '';
			vm.id = '';
			vm.user = '';
			vm.username = '';
			vm.birthdayGreeting = false;
		}
	}
	vm.ondblclick = function(e) {
		if (e.ctrlKey || e.metaKey) {
			if (! vm.text.trim()) {
				vm.text = $textarea.prop('placeholder');
			}
		}
		return vm.onkeydown({
			ctrlKey: true,
			keyCode: 13
		});
	}
	vm.onkeydown = function(e) {
		e.stopPropagation && e.stopPropagation();
		var value = $textarea.val().trim();
		if ((! value && ! PREFiX.image) || vm.submitting) return;
		if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
			e.preventDefault && e.preventDefault();
			vm.submitting = true;
			showNotification('正在提交..');
			var data = {
				status: vm.text.trim()
			};
			if (vm.type === 'reply') {
				data.in_reply_to_status_id = vm.id;
			} else if (vm.type === 'repost') {
				data.repost_status_id = vm.id;
			}
			if (vm.type === 'reply-pm' || vm.type === 'send-pm') {
				shorten().next(function() {
					r.postDirectMessage({
						user: vm.user,
						text: vm.text.trim(),
						in_reply_to_id: vm.id
					}).setupAjax({
						lock: vm
					}).next(function() {
						showNotification('发表成功!');
						vm.text = '';
					}).error(function(e) {
						if (e.status && e.response) {
							showNotification(e.response.error);
						} else {
							showNotification('发送失败, 请检查网络连接.')
						}
					}).next(function() {
						vm.submitting = false;
					});
				});
			} else {
				var $compose_bar = $('#compose-bar');
				var full_length = $compose_bar.width();
				shorten().next(function() {
					data.status = vm.text;
					data.photo = PREFiX.image;
					r[ PREFiX.image ? 'postPhoto' : 'postStatus' ](data).
					setupAjax({
						timeout: PREFiX.image ? 180000 : 30000,
						onstart: function(e) {
							if (data.photo) {
								$textarea.css('background-size', '48px 1px');
								$compose_bar.addClass('uploading');
							}
						},
						onprogress: function(e) {
							if (! data.photo || ! e.lengthComputable) return;
							var percent = e.loaded / e.total;
							var green_length = Math.round(percent * full_length);
							$textarea.css('background-size', Math.max(48, green_length) + 'px 1px');
						},
						oncomplete: function(e) {
							$compose_bar.removeClass('uploading');
							$textarea.css('background-size', '');
						}
					}).next(function(status) {
						showNotification('发表成功!');
						vm.text = '';
						setImage(null);
						PREFiX.update(7, status.id).next(function() {
							if (PREFiX.current === 'tl_model') {
								var now = new Date;
								waitFor(function() {
									return tl_model.statuses.some(function(s) {
											return status.id == s.id;
										}) || ((new Date) - now > 5000);
								}, function() {
									if ($main[0].scrollTop < $main.height() / 2) {
										setTimeout(function() {
											goTop(true);
										}, 100);
									}
								});
							}
						});
					}).setupAjax({
						lock: vm
					}).error(function(e) {
						if (e.status && e.response) {
							showNotification(e.response.error);
						} else {
							showNotification('发送失败, 请检查网络连接.')
						}
					}).next(function() {
						vm.submitting = false;
					});
				});
			}
		}
	}
	vm.$watch('text', function(value) {
		if (! value && nav_model.current != 'privatemsgs_model') {
			vm.type = '';
			vm.id = '';
			vm.user = '';
			vm.username = '';
		}
		$textarea.toggleClass('filled', !! value);
		count();
		PREFiX.compose.text = value;
	});
	vm.$watch('type', function(value) {
		PREFiX.compose.type = value;
	});
	vm.$watch('id', function(value) {
		PREFiX.compose.id = value;
	});
	vm.$watch('user', function(value) {
		PREFiX.compose.user = value;
	});
	vm.$watch('username', function(value) {
		PREFiX.compose.username = value;
	});
});

var tl_model = avalon.define('home-timeline', function(vm) {
	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;
	
	vm.showContextTimeline = showContextTimeline;
	
	vm.statuses = [];

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.homeTimeline.scrollTop = value;
	});
});
tl_model.statuses.$watch('length', function() {
	PREFiX.homeTimeline.statuses = tl_model.$model.statuses.map(function(s) {
		return s.$model || s;
	});
});
tl_model.initialize = function() {
	$('#navigation-bar .home-timeline').addClass('current');
	$('#title h2').text('Timeline');
	$('#home-timeline').addClass('current');

	var tl = PREFiX.homeTimeline;
	waitFor(function() {
		return tl.statuses.length;
	}, function() {
		tl_model.statuses = tl.statuses;
		markBreakpoint();
		setTimeout(function() {
			$main.scrollTop(PREFiX.homeTimeline.scrollTop);
		}, 50);
		updateRelativeTime();
	});

	this.interval = setInterval(function update() {
		if (! tl.buffered.length) {
			pre_count.timeline = 0;
			return;
		}
		if (tl.buffered.length !== pre_count.timeline) {
			if (PREFiX.settings.current.drawAttention)
				drawAttention();
			pre_count.timeline = tl.buffered.length;
		}
		if (! is_focused || $main[0].scrollTop > $body.height / 2)
			return;
		var buffered = tl.buffered;
		tl.buffered = [];
		if (! tl.statuses.length) {
			unshift(tl_model.statuses, buffered);
		} else {
			setTimeout(function() {
				insertKeepScrollTop(function() {
					if (buffered.length >= 50) {
						var now = Date.now();
						var is_breakpoint = breakpoints.some(function(time) {
							return Math.abs(time - now) < 500;
						});
						if (is_breakpoint) {
							var oldest_status = fixStatusList(buffered).reverse()[0];
							oldest_status.is_breakpoint = true;
							oldest_status.loaded_at = 'Loaded @ ' + getShortTime(now) + '.';
						}
					}
					unshift(tl_model.statuses, buffered);
				});
			}, 50);
		}
		bg_win.updateTitle();
	}, 16);
}
tl_model.unload = function() {
	clearInterval(this.interval);
}

var mentions_model = avalon.define('mentions', function(vm) {
	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;
	
	vm.showContextTimeline = showContextTimeline;
	
	vm.statuses = [];

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.mentions.scrollTop = value;
	});
});
mentions_model.statuses.$watch('length', function() {
	PREFiX.mentions.statuses = mentions_model.$model.statuses.map(function(s) {
		return s.$model || s;
	});
});
mentions_model.initialize = function() {
	$('#navigation-bar .mentions').addClass('current');
	$('#title h2').text('Mentions');
	$('#mentions').addClass('current');

	function check() {
		if (! is_focused || $main[0].scrollTop) return;
		if (PREFiX.count.mentions) {
			update();
		}
	}

	function update() {
		var ajax;
		if (mentions.statuses.length) {
			var statuses = fixStatusList(mentions.statuses);
			ajax = PREFiX.getDataSince('getMentions', statuses[0].id, update, null, 45);
		} else {
			ajax = r.getMentions().setupAjax({
				lock: update
			});
		}
		ajax.next(function(statuses) {
			if (mentions_model.statuses.length) {
				insertKeepScrollTop(function() {
					unshift(mentions_model.statuses, statuses);
				});
			} else {
				mentions_model.statuses = fixStatusList(statuses);
				resetLoadingEffect();
			}
			PREFiX.update();
		});
	}

	var mentions = PREFiX.mentions;
	mentions_model.statuses = mentions.statuses;
	$main.scrollTop(mentions.scrollTop);
	updateRelativeTime();
	update();

	this.interval = setInterval(check, 100);
}
mentions_model.unload = function() {
	clearInterval(this.interval);
}

var privatemsgs_model = avalon.define('privatemsgs', function(vm) {
	vm.remove = function() {
		showNotification('正在删除..')
		var self = this;
		var message_id = self.$vmodel.message.id;
		r.destroyDirectMessage({ 
			id: message_id 
		}).setupAjax({
			lock: self
		}).error(function(e) {
			if (e.status !== 404) {
				throw e;
			}
		}).next(function() {
			showNotification('删除成功!');
			$(self).parents('li').slideUp(function() {
				self.$vmodel.$remove();
			});
		});
	}

	vm.reply = function() {
		var message = this.$vmodel.message;
		composebar_model.text = '';
		composebar_model.type = 'reply-pm';
		composebar_model.id = message.id;
		composebar_model.user = message.sender.id;
		composebar_model.username = message.sender.name;
		$textarea.focus();
	}

	vm.messages = [];

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.privatemsgs.scrollTop = value;
	});
});
privatemsgs_model.messages.$watch('length', function() {
	PREFiX.privatemsgs.messages = privatemsgs_model.$model.messages.map(function(m) {
		return m.$model || m;
	});
});
privatemsgs_model.initialize = function() {
	$('#navigation-bar .privatemsgs').addClass('current');
	$('#title h2').text('Private Messages');
	$('#privatemsgs').addClass('current');

	function check() {
		if (! is_focused || $main[0].scrollTop) return;
		if (PREFiX.count.direct_messages) {
			update();
		}
	}

	function update() {
		var ajax;
		if (privatemsgs.messages.length) {
			var messages = fixStatusList(privatemsgs.messages);
			ajax = PREFiX.getDataSince('showInbox', messages[0].id, update, null, 45);
		} else {
			ajax = r.showInbox().setupAjax({
				lock: update
			});
		}
		ajax.next(function(messages) {
			if (privatemsgs_model.messages.length) {
				insertKeepScrollTop(function() {
					unshift(privatemsgs_model.messages, messages);
				});
			} else {
				privatemsgs_model.messages = fixStatusList(messages);	
				resetLoadingEffect();
			}
			PREFiX.update();
		});
	}

	var privatemsgs = PREFiX.privatemsgs;
	privatemsgs_model.messages = privatemsgs.messages;
	$main.scrollTop(privatemsgs.scrollTop);
	updateRelativeTime();
	update();

	this.interval = setInterval(check, 100);
}
privatemsgs_model.unload = function() {
	clearInterval(this.interval);
}

var searches_model = avalon.define('saved-searches', function(vm) {
	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;

	vm.showContextTimeline = showContextTimeline;

	vm.keyword = PREFiX.keyword;

	vm.statuses = [];
});
searches_model.$watch('keyword', function() {
	PREFiX.keyword = searches_model.keyword;
});
searches_model.initialize = function() {
	$('#navigation-bar .saved-searches').addClass('current');
	$('#title h2').text('Discover');
	$('#saved-searches').addClass('current');

	$main.scrollTop(0);

	function showPublicTimeline() {
		$('#loading').show();
		searches_model.statuses = [];
		r.getPublicTimeline({
			count: 60
		}).next(function(statuses) {
			unshift(searches_model.statuses, statuses);
			$('#loading').hide();
		});
	}

	function showFavorites() {
		$('#loading').show();
		searches_model.statuses = [];
		searches_model.page = 1;
		r.getFavorites({
			id: PREFiX.account.id
		}).next(function(statuses) {
			searches_model.statuses = statuses;
			updateRelativeTime();
		});
	}

	function search() {
		$('#loading').show();
		var keyword = searches_model.keyword;
		searches_model.statuses = [];
		var statuses;
		bg_win.saved_searches_items.some(function(item) {
			if (item.keyword !== keyword) return;
			statuses = JSON.parse(JSON.stringify(item.statuses));
			lscache.set('saved-search-' + keyword + '-rawid', statuses[0].rawid);
			item.unread_count = 0;
			item.check();
			return true;
		});
		unshift(searches_model.statuses, statuses);
	}

	function refreshCount() {
		bg_win.saved_searches_items.some(function(item) {
			$selector.find('option').each(function() {
				var $item = $(this);
				if ($item.val() === item.keyword) {
					var text = item.keyword;
					if (item.unread_count) {
						text += ' (' + item.unread_count + ')';
					}
					if (text !== $item.text()) {
						$item.text(text);
					}
				}
			});
		});
	}

	if (! $('#topic-selector').length) {
		var public_tl_id = '##PUBLIC_TIMELINE##';
		var fav_id ='##MY_FAVORITES##';

		var $selector = $('<select />');
		$selector.prop('id', 'topic-selector');

		var $public_tl = $('<option />');
		$public_tl.text('随便看看');
		$public_tl.prop('value', public_tl_id);
		$selector.append($public_tl);

		var $fav = $('<option />');
		$fav.text('我的收藏');
		$fav.prop('value', fav_id);
		$selector.append($fav);

		bg_win.saved_searches_items.some(function(item) {
			var $item = $('<option />');
			$item.val(item.keyword);
			$item.text(item.keyword);
			$selector.append($item);
		});

		$selector.val(public_tl_id);
		$selector.appendTo('#title');

		$selector.on('change', function(e) {
			if (this.value === public_tl_id) {
				searches_model.keyword = '';
				showPublicTimeline();
			} else if (this.value === fav_id) {
				searches_model.keyword = '';
				showFavorites();
			} else {
				searches_model.keyword = this.value;
				search();
			}
		});

		refreshCount();
	}

	var last = bg_win.saved_searches_items.some(function(item) {
		if (item.keyword === searches_model.keyword) {
			return !! item.unread_count;
		}
	});

	var $selector = $('#topic-selector');
	if (last) {
		$selector.val(searches_model.keyword);
	} else if (! last && bg_win.getSavedSearchStatusesCount()) {
		bg_win.saved_searches_items.some(function(item) {
			if (item.unread_count) {
				$selector.val(item.keyword);
				return true;
			}
		});
	} else if (searches_model.keyword) {
		$selector.val(searches_model.keyword);
	}
	$selector.trigger('change');

	this.interval = setInterval(refreshCount, 100);
}
searches_model.unload = function() {
	clearInterval(this.interval);
}

var context_tl_model = avalon.define('context-timeline', function(vm) {
	vm.statuses = [];
});
context_tl_model.statuses.$watch('length', function(length) {
	if (! length) return;
	var $context_tl = $('#context-timeline');
	$context_tl.find('li').each(function(i) {
		setTimeout(function() {
			$(this).show();
		}.bind(this), i * 100);
	});
});

$(function() {
	initMainUI();
	setTimeout(function() {
		$textarea.focus();
		if (! PREFiX.compose.text) {
			$textarea.blur();
		} else if (PREFiX.compose.type === 'repost') {
			$textarea[0].selectionStart = $textarea[0].selectionEnd = 0;
		}
		getCurrent().initialize();
		setTimeout(showUsageTip, 100);
	}, 100);
	var $tip = $('#uploading-photo-tip');
	var shown = lscache.get('uploading_photo_tip');
	if (! shown) {
		$('#hide-uploading-photo-tip').click(function(e) {
			$tip.css({
				'animation-name': 'wobbleOut',
				'animation-duration': 400
			}).delay(400).hide(0, function() {
				$(this).remove();
				lscache.set('uploading_photo_tip', true);
			});
		});
	} else {
		$tip.remove();
	}
});

onunload = function() {
	PREFiX.popupActive = false;
	if ($main[0].scrollTop < 30)
		cutStream();
}

if (location.search == '?new_window=true') {
	is_panel_mode = true;
	$('html').addClass('panel-mode');
	initFixSize(400, 600);
	$(applyViewHeight);
}

chrome.runtime.sendMessage({ });