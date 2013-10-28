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

var loading = false;
var is_on_top = true;
PREFiX.popupActive = true;

var lyric;

var r = PREFiX.user;

if (! r) {
	bg_win.initialize();
	close();
}

var usage_tips = [
	'按 Ctrl + Enter 或双击输入框即可发送消息. ',
	'如果您觉得字体太小, 可以在设置页启用<b>放大功能</b>. ',
	'点击 PREFiX 回到页面顶部或刷新. ',
	'在地址栏输入 f 按空格键, 然后输入内容即可直接发送消息. ',
	'在上传图片窗口, 双击输入框发送. ',
	'按 1/2/3 键在 首页/提到我的/私信 页面间切换. ',
	'左击上下文图标展开回复和转发, 右击显示上下文. ',
	'右击消息中的图片小图, 将在新窗口打开大图. ',
	'将鼠标指针放在用户头像上, 可以显示用户 ID. ',
	'如果饭友生日提醒打扰了您, 可以在设置页关闭. ',
	'如果您不希望 PREFiX 播放提示音, 可以在设置页关闭. ',
	'本页面关闭前保持滚动条在顶端可让程序性能更佳. ',
	'当输入框中字数超过 140 时, 输入框背景显示为淡红色. ',
	'按 PageUp/PageDown 可以快速翻页. ',
	'按 Home/End 可以快速滑动到页面顶端/末端. ',
	'您可以自定义尾巴 (即通过...发送), 详情请见设置页. '
];

var requestAnimationFrame = requestAnimationFrame || webkitRequestAnimationFrame;
var cancelRequestAnimationFrame = cancelRequestAnimationFrame || webkitCancelRequestAnimationFrame;

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
			cancelRequestAnimationFrame(id);
		}
		if (e) {
			e.preventDefault && e.preventDefault();
			s = $main[0].scrollTop;
		}
		var breakpoint = Date.now();
		id = requestAnimationFrame(function(timestamp) {
			var diff = timestamp - breakpoint;
			if (diff >= 10) {
				breakpoint = timestamp;
				current = $main[0].scrollTop;
				if (s != current) {
					return stop();
				}
				var to = Math.floor(s / 1.12 / Math.max(diff / 32, 1));
				$main[0].scrollTop = s = to;
			}
			if (s >= 1) {
				requestAnimationFrame(arguments.callee);
			};
		});
	}
})();

function initSmoothScroll($target) {
	var id;
	var is_scrolling = false;
	var destination = null;
	var height = $target.height();
	var _stop = function() { };
	function runAnimation() {
		function renderFrame(timestamp) {
			if (! is_scrolling) return;
			var progress = timestamp - breakpoint;
			if (progress >= 16) {
				var pos = $target.scrollTop();
				var diff = destination - pos;
				var dist = Math.floor(progress * diff / 100);
				$target.scrollTop(Math.max(0, pos + dist));
				diff = Math.max(0, destination) - pos;
				if (Math.abs(diff) <= 1) {
					return _stop();
				}
				breakpoint = timestamp;
			}
			id = requestAnimationFrame(renderFrame);
			return;
		}
		if (is_scrolling) return;
		is_scrolling = true;
		var breakpoint = Date.now();
		renderFrame(breakpoint);
		_stop = function() {
			_stop = function() { };
			if ($target === $main) {
				stopSmoothScrolling = _stop;
			}
			destination = null;
			is_scrolling = false;
			cancelRequestAnimationFrame(id);
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
		destination = Math.min(destination, $target[0].scrollHeight - height);
		runAnimation();
	});
}
function stopSmoothScrolling() { }

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
	var pos = lscache.get('usage_tip_pos') || 0;
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
	$textarea.toggleClass('over', length > 140);
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
	$('#follow-author').fadeOut();
	lscache.set('hide-following-tip', true);
}

function showRatingPage() {
	var url = 'https://chrome.google.com/webstore/detail/prefix/gjpcbbbopajjjnkbkeaflldnocoppcpc/reviews';
	createTab(url, true);
	hideRatingTip();
}

function showRatingTip() {
	$('#rating-tip').fadeIn();
}

function hideRatingTip() {
	$('#rating-tip').fadeOut();
	lscache.set('hide-rating-tip', true);
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
	var text = [];
	PREFiX.birthdayFriends.forEach(function(friend) {
		text.push('@' + friend.name + ' ');
	});
	text.push('生日快乐! :)');
	composebar_model.text = text.join('');
	focusToEnd();
}

function focusToEnd() {
	$textarea.focus();
	var pos = composebar_model.text.length;
	$textarea[0].selectionStart = $textarea[0].selectionEnd = pos;
}

function initMainUI() {
	$body = $('body');
	$app = $('#app');

	if (navigator.platform.indexOf('Linux') > -1) {
		$('<link />').
		prop('rel', 'stylesheet').
		prop('href', 'css/linux-fix.css').
		appendTo('head');
	}

	var ratio = +PREFiX.settings.current.zoomRatio;
	if (ratio !== 1 && is_panel_mode) {
		$body.css('zoom', ratio);
		if (ratio > 1.4) {
			$('h2').css('letter-spacing', '.5px');
		}
	}

	var $birthday_cake = $('#birthday-cake');
	if (PREFiX.isTodayBirthday) {
		var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
		var today = now.getFullYear() + '-' + (now.getMonth() + 1) + now.getDate();
		var count = lscache.get(today + '-birthday') || 0;
		if (count >= 3) {
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
						friend.id + '">@' + friend.name + '</a>';
				});
			}
			function hideBirthdayTip() {
				$('#birthday-tip').fadeOut(function() {
					$(this).remove();
					lscache.set(today + '-friends-birthday', true);
				})
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
			$('#birthday-friend-list').html(friends.join(' 和 '));
			$('#send-birthday-message').click(sendBirthdayMessage).click(hideBirthdayTip);
			$('#hide-birthday-tip').click(hideBirthdayTip);
			$birthday_tip.fadeIn();
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

	$main = $scrolling_elem = $('#main');

	$main.scroll(_.throttle(function(e) {
		var scroll_top = $main.scrollTop();
		getCurrent().scrollTop = scroll_top;
		$app.toggleClass('on-top', scroll_top === 0);
		if (scroll_top + $main.height() >= $main[0].scrollHeight - ($main[0].clientHeight/2))
			loadOldder();
	}, 100));

	$('#app').delegate('a', 'click', function(e) {
		if (e.target.href.indexOf('http://') !== 0 &&
			e.target.href.indexOf('https://') !== 0)
			return;
		e.preventDefault();
		e.stopPropagation();
		createTab(e.target.href);
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
			cutStream();
			PREFiX.update();
		}
	});

	$('#new-window').click(function(e) {
		createPanel(400, 600, '/popup.html?new_window=true');
		close();
	});

	$('#uploading-photo').click(function(e) {
		createPanel(300, 150, 'uploading-photo.html');
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
			}, 150);
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

	showUsageTip();

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
		$scrolling_elem.trigger({
			type: 'mousewheel',
			flag: true
		}, e.keyCode === 40 ? -1 : 1, true);
	}).on('keydown', function(e) {
		if (e.keyCode !== 36) return;
		goTop(e);
	}).on('keydown', function(e) {
		if (e.keyCode !== 35) return;
		e.preventDefault();
		var $win = $(window);
		var event;
		var times = ($main[0].scrollHeight - $main.height() - $main.scrollTop())/ 120;
		for (var i = 0; i < times; i++) {
			event = new Event('keydown');
			event.keyCode = 40;
			dispatchEvent(event);
		}
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
	var left = parseInt(($body[0].clientWidth - data.width) / 2);
	var top = parseInt(($body[0].clientHeight - data.height) / 2);
	data.left = Math.max(0, left);
	data.top = Math.max(0, top);
	for (var key in data) {
		data[key] += 'px';
	}
	return function(param) {
		return $.extend(data, param);
	}
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
	$picture.hide().css({
		'width': '',
		'height': ''
	});
	var $overlay = $scrolling_elem = $('#picture-overlay');
	$overlay.removeClass('error');
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
		var width = parseInt($picture.css('width'));
		var height = parseInt($picture.css('height'));
		$picture.css(computePosition({
			width: width / 2,
			height: height / 2
		})({
			opacity: 0,
			display: 'block'
		})).animate(computePosition({
			width: width,
			height: height
		})({
			opacity: 1
		}), 250);
		$picture.css('margin-top', (-$body[0].clientWidth / 3) + 'px').animate({
			'margin-top': '0px'
		}, {
			duration: 250,
			queue: false,
			easing: 'easeOutBack'
		});
	});
}

function hidePicture() {
	$scrolling_elem = $main;
	var $picture = $('#picture');
	$picture.animate(computePosition({
		width: parseInt($picture.css('width')) / 2,
		height: parseInt($picture.css('height')) / 2
	})({
		opacity: 0
	})).animate({
		'margin-top': (-$body[0].clientWidth / 3) + 'px'
	}, {
		duration: 250,
		queue: false,
		easing: 'easeInBack',
		complete: function() {
			$('body').removeClass('show-picture');
		}
	});
}

var pre_count = 0;
function checkCount() {
	var count = PREFiX.count;
	var title_contents = [];
	var $home_tl = $('#navigation-bar .home-timeline .count');
	var $mentions = $('#navigation-bar .mentions .count');
	var $privatemsgs = $('#navigation-bar .privatemsgs .count');
	if (count.mentions) {
		title_contents.push(count.mentions + ' @');
		$mentions.text(count.mentions).show();
	} else {
		$mentions.text('').hide();
	}
	if (count.direct_messages) {
		title_contents.push(count.direct_messages + ' 私信');
		$privatemsgs.text(count.direct_messages).show();
	} else {
		$privatemsgs.text('').hide();
	}
	var buffered = PREFiX.homeTimeline.buffered.filter(function(status) {
		return ! status.is_self;
	}).length;
	if (buffered) {
		title_contents.push(buffered + ' 新消息');
		$home_tl.text(Math.min(buffered, 99)).show();
	} else {
		$home_tl.text('').hide();
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
	if (model.statuses) {
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
	$context_tl.removeClass('focusOutFromTop').addClass('focusInFromBottom');
	if (status.repost_status) {
		context_statuses.push(status.repost_status);
		id = status.repost_status.id;
	}
	$context_tl.addClass('loading');
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
	context_tl_model.statuses = [];
	var status = this.$vmodel.status.$model;
	(function get() {
		unshift(context_tl_model.statuses, [ status ]);
		var id = status.repost_status_id || status.in_reply_to_status_id;
		if (id) {
			showRelatedStatuses.ajax = r.showStatus({ id: id }).next(function(s) {
				status = s;
				get();
			}).error(function() {
				$context_tl.removeClass('loading');
			});
		} else {
			$context_tl.removeClass('loading');
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
	vm.$watch('current', function(new_value, old_value) {
		if (old_value == 'privatemsgs_model') {
			composebar_model.type = '';
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
	vm.submitting = false;
	vm.onfocus = function(e) {
		var placeholder;
		if (PREFiX.isTodayFanfouBirthday) {
			placeholder = '还记得今天是什么日子吗? 祝你饭否 ' + Math.floor(PREFiX.fanfouYears) + ' 周岁生日快乐! :)';
		} else {
			placeholder = lyric = lyric || getLyric();
		}
		placeholder = vm.username ? '回复 @' + vm.username + ' 的私信' : placeholder;
		$textarea.prop('placeholder', placeholder);
	}
	vm.onblur = function(e) {
		$textarea.prop('placeholder', '');
		if (! vm.text.length) {
			vm.type = '';
			vm.id = '';
			vm.user = '';
			vm.username = '';
		}
	}
	vm.ondblclick = function(e) {
		return vm.onkeydown({
			ctrlKey: true,
			keyCode: 13
		});
	}
	vm.onkeydown = function(e) {
		e.stopPropagation && e.stopPropagation();
		if (e.keyCode === 13) {
			e.preventDefault && e.preventDefault();
		}
		var value = $textarea.val();
		if (! value || vm.submitting) return;
		if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
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
			if (vm.type === 'reply-pm') {
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
				var type = vm.type;
				shorten().next(function() {
					data.status = vm.text;
					r.postStatus(data).next(function(status) {
						showNotification('发表成功!');
						vm.text = '';
						PREFiX.update().next(function() {
							if (PREFiX.current === 'tl_model' && ! type) {
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
	PREFiX.homeTimeline.statuses = tl_model.$model.statuses;
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
		$main.scrollTop(PREFiX.homeTimeline.scrollTop);
		updateRelativeTime();
	});

	this.interval = setInterval(function update() {
		if (! tl.buffered.length) {
			pre_count = 0;
			return;
		}
		if (tl.buffered.length !== pre_count) {
			drawAttention();
			pre_count = tl.buffered.length;
		}
		if (! is_focused || $main[0].scrollTop) return;
		var buffered = tl.buffered;
		tl.buffered = [];
		if (! tl.statuses.length) {
			unshift(tl_model.statuses, buffered);
		} else {
			insertKeepScrollTop(function() {
				unshift(tl_model.statuses, buffered);
			});
		}
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
	PREFiX.mentions.statuses = mentions_model.$model.statuses;
});
mentions_model.initialize = function() {
	$('#navigation-bar .mentions').addClass('current');
	$('#title h2').text('Mentions');
	$('#mentions').addClass('current');

	function check() {
		if (! is_focused || $main[0].scrollTop) return;
		if (PREFiX.count.mentions) {
			update();
			drawAttention();
		}
	}

	function update() {
		var data = { };
		if (mentions.statuses.length) {
			var statuses = fixStatusList(mentions.statuses);
			data.since_id = statuses[0].id;
		}
		r.getMentions(data).setupAjax({
			lock: update
		}).next(function(statuses) {
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
	PREFiX.privatemsgs.messages = privatemsgs_model.$model.messages;
});
privatemsgs_model.initialize = function() {
	$('#navigation-bar .privatemsgs').addClass('current');
	$('#title h2').text('Private Messages');
	$('#privatemsgs').addClass('current');

	function check() {
		if (! is_focused || $main[0].scrollTop) return;
		if (PREFiX.count.direct_messages) {
			update();
			drawAttention();
		}
	}

	function update() {
		var data = { };
		if (privatemsgs.messages.length) {
			var messages = fixStatusList(privatemsgs.messages);
			data.since_id = messages[0].id;
		}
		r.showInbox(data).setupAjax({
			lock: update
		}).next(function(messages) {
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

var context_tl_model = avalon.define('context-timeline', function(vm) {
	vm.statuses = [];
});

$(function() {
	avalon.scan();
	initMainUI();
	setTimeout(function() {
		if (! PREFiX.compose.text) {
			$textarea.blur();
		}
		getCurrent().initialize();
	}, 100);
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
}

chrome.runtime.sendMessage({ });
