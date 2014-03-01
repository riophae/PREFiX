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
var $scrolling_elem;

var last_model = PREFiX.current;

var is_windows = navigator.platform.indexOf('Win') > -1;

var loading = false;
var is_on_top = true;
PREFiX.popupActive = true;
PREFiX.is_popup_focused = true;

var lyric;

var r = PREFiX.user;

if (! r) {
	bg_win.initialize();
	close();
}

var usage_tips = bg_win.usage_tips;

function setViewHeight(height) {
	lscache.set('popup_view_height', Math.round(Math.max(600, height)));
	applyViewHeight();
}

function applyViewHeight() {
	waitFor(function() {
		return $main && $main.length;
	}, function() {
		var height = getViewHeight();
		$('body, #picture-overlay, #context-timeline, #drop-area').height(height);
		$main.height(height - parseInt($main.css('top'), 10));
	});
}

function ScrollHandler(elem) {
	this.elem = elem;
	this._listeners = [];
	this._interval = null;
	this.call = _.throttle(this._call.bind(this), 150);
	this.start();
}

ScrollHandler.prototype = {
	addListener: function(listener) {
		this._listeners.push(listener);
	},
	start: function() {
		this._interval = setInterval(this._check.bind(this), 100);
	},
	_call: function() {
		var elem = this.elem;
		this._listeners.forEach(function(listener) {
			listener.call(elem);
		});
	},
	_check: function() {
		var is_scrolled = false;
		var scroll_top = this.elem.scrollTop;
		var scroll_left = this.elem.scrollLeft;
		if (scroll_top !== this.scrollTop) {
			is_scrolled = true;
		} else if (scroll_left !== this.scrollLeft) {
			is_scrolled = true;
		}
		this.scrollTop = scroll_top;
		this.scrollLeft = scroll_left;
		if (is_scrolled) {
			this.call();
		}
	}
};

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

function getFirstItemInScreen(model) {
	var elems = [].slice.call(model.$elem.find('li[data-id]'));
	var scroll_top = $main.scrollTop();
	elems.some(function(elem) {
		if (elem.offsetTop >= scroll_top) {
			model.current = elem.dataset.id;
			return true;
		}
	});
	return model.current;
}

function findView(model, id) {
	if (id) {
		return model.$elem.find('[data-id=' + id + ']');
	} else {
		id = getFirstItemInScreen(model);
		if (id) {
			return findView(model, id);
		} else {
			return model.$elem.find('[data-id]').first();
		}
	}
}

function findModel(model, id) {
	var list = model.statuses || model.messages;
	var model_found;
	if (id) {
		list.some(function(item) {
			if (item.id === id) {
				model_found = item;
				return true;
			}
		});
	}
	return model_found || list[0];
}

function setCurrent(model, id) {
	var now = Date.now();
	var canceled = false;
	var $view;
	waitFor(function() {
		$view = findView(model, id);
		if (Date.now() - now > 5000) {
			canceled = true;
		}
		return $view.length || canceled;
	}, function() {
		if ($view.length) {
			model.current = id;
			model.$elem.children().removeClass('current');
			model.$elem.find('a.focused').removeClass('focused');
			$view.addClass('current');
		}
	})
}

function initKeyboardControl() {
	var model = getCurrent();
	var list = model.statuses || model.messages;
	waitFor(function() {
		return list.length;
	}, function() {
		if (! model.current || ! findView(model, model.current).length) {
			model.current = getFirstItemInScreen(model);
		}
		setCurrent(model, model.current);
	});
}

function initKeyboardControlEvents() {
	var min_pos = 0;
	min_pos += parseInt($main.css('top'), 10);
	min_pos += $('#title').height();
	$main.delegate('[data-id]', 'mouseenter', function(e) {
		setCurrent(getCurrent(), e.currentTarget.getAttribute('data-id'));
	});
	$(window).keydown(function(e) {
		if (e.ctrlKey || e.altKey || e.metaKey) return;
		switch (e.keyCode) {
			case 72 /* H */: case 74 /* J */:
			case 75 /* K */: case 76 /* L */:
				e.preventDefault();
				break;
			default:
				return;
		}
		var current_model = getCurrent();
		var current_id = current_model.current;
		var $current_view = findView(current_model, current_id);
		var is_context_tl = !! $('body.show-context-timeline').length;
		var is_photo = !! $('body.show-picture').length;
		if (is_context_tl || is_photo) {
			var key_matched = 0;
			switch (e.keyCode) {
				case 72:
					key_matched = 36;
					break;
				case 74:
					key_matched = 40;
					break;
				case 75:
					key_matched = 38;
					break;
				case 76:
					key_matched = 35;
					break;
			}
			if (key_matched) {
				$(window).trigger({
					type: 'keydown',
					keyCode: key_matched
				});
			}
			return;
		}

		if (e.keyCode === 72) {
			var list = current_model.statuses || current_model.messages;
			target = 0;
			if ($scrolling_elem === $main) {
				if ($main.scrollTop() === 0) {
					PREFiX.update();
					cutStream();
				}
				setCurrent(current_model, list[0].id);
			}
		} else if (e.keyCode === 74) {
			if (! $current_view.length) {
				initKeyboardControl();
				return;
			}
			var $next_view = $current_view.nextAll('li[data-id]').first();
			if (! $next_view.length) return;
			var delta = $next_view.offset().top;
			var current_pos = $main.scrollTop();
			var height = $current_view.height();
			var next_view_height = $next_view.height();
			var target = Math.max(current_pos + height, delta + current_pos - $body.height() + next_view_height);
			setCurrent(current_model, $next_view.attr('data-id'));
		} else if (e.keyCode === 75) {
			var $pre_view = $current_view.prevAll('li[data-id]').first();
			if (! $pre_view.length) return;
			var delta = $pre_view.offset().top;
			var current_pos = $main.scrollTop();
			var height = $pre_view.height();
			var target = Math.min(current_pos - height, delta + current_pos - min_pos);
			target = Math.max(target, current_pos + delta + height - $body.height());
			setCurrent(current_model, $pre_view.attr('data-id'));
		} else if (e.keyCode === 76) {
			var list = current_model.statuses || current_model.messages;
			target = $main[0].scrollHeight - $main.height();
			setCurrent(current_model, list[list.length - 1].id);
		}

		smoothScrollTo(target);
	}).keydown(function(e) {
		if (e.ctrlKey || e.altKey || e.metaKey) return;
		if (e.keyCode === 27 /* Esc */) {
			if ($scrolling_elem !== $main) {
				e.keyCode = 32;
			}
		}
		switch (e.keyCode) {
			case 8 /* Backspace*/:
			case 68 /* D */: case 70 /* F */:
			case 77 /* M */: case 78 /* N */:
			case 81 /* Q */: case 83 /* S */:
			case 85 /* U */:
				if ($scrolling_elem !== $main)
					return;

			case 82 /* R */:
				if ($('body.show-context-timeline').length &&
					! $('body.show-picture').length)
					return;

			case 8 /* Backspace*/:
			case 32 /* Space */:
			case 67 /* C */: case 70 /* F */:
			case 77 /* M */: case 78 /* N */:
			case 80 /* P */: case 81 /* Q */:
			case 82 /* R */: case 83 /* S */:
			case 85 /* U */: case 86 /* V */:
				e.preventDefault();
				break;
			default:
				return;
		}
		var current_model = getCurrent();
		var $view = findView(current_model, current_model.current);
		var current = findModel(current_model, current_model.current);
		if (e.keyCode === 8 && $scrolling_elem === $main &&
			PREFiX.current === 'usertl_model') {
			$('#back').click();
		} else if (e.keyCode === 32 && ! e.shiftKey) {
			if ($scrolling_elem !== $main) {
				hideAllOverlays(e);
			} else {
				$textarea.focus();
				if (composebar_model.type === 'repost') {
					$textarea[0].selectionStart = 0;
					$textarea[0].selectionEnd = 0;
				}
			}
		} else if (e.keyCode === 67) {
			if ($('body.show-context-timeline').length) {
				$('#context-timeline').trigger('click');
			} else {
				var $context = $view.find('.context');
				if (e.shiftKey) {
					$context.trigger('contextmenu');
				} else {
					$context.click();
				}
			}
		} else if (e.keyCode === 68 && e.shiftKey) {
			var $remove = $view.find('a.remove');
			if ($remove.length) {
				var event = new Event('dblclick');
				$remove[0].dispatchEvent(event);
			}
		} else if (e.keyCode === 70) {
			var $fav = $view.find('a.favourite');
			if (e.shiftKey && current.favorited) {
				$fav[0].click();
			} else if (! e.shiftKey && ! current.favorited) {
				$fav[0].click();
			}
		} else if (e.keyCode === 77) {
			var $focused_link = $view.find('.status-content a.focused');
			if ($focused_link.length) {
				$focused_link.removeClass('focused');
				var $prev = $focused_link.prev('a');
				if (! $prev.length) {
					$prev = $view.find('.status-content a').last();
				}
				$prev.addClass('focused');
			} else {
				var $links = [].slice.call($view.find('.status-content a')).reverse();
				if (! $links.length) return;
				$($links[0]).addClass('focused');
			}
		} else if (e.keyCode === 78) {
			var $focused_link = $view.find('.status-content a.focused');
			if ($focused_link.length) {
				$focused_link.removeClass('focused');
				var $next = $focused_link.next('a');
				if (! $next.length) {
					$next = $view.find('.status-content a').first();
				}
				$next.addClass('focused');
			} else {
				var $links = [].slice.call($view.find('.status-content a'));
				if (! $links.length) return;
				$($links[0]).addClass('focused');
			}
		} else if (e.keyCode === 80) {
			if (is_panel_mode) return;
			$('#new-window').click();
		} else if (e.keyCode === 81) {
			var $repost = $view.find('a.repost');
			if ($repost.length) {
				$repost[0].click();
			}
		} else if (e.keyCode === 82) {
			if ($('body.show-picture').length) {
				rotatePicture();
				return;
			}
			var $reply = $view.find('a.reply');
			if ($reply.length) {
				$reply[0].click();
			}
		} else if (e.keyCode === 83) {
			if (e.shiftKey) {
				var $avatar = $view.find('.avatar a');
				$avatar.trigger({
					type: 'click',
					shiftKey: true
				});
			} else {
				var $name = $view.find('.name');
				$name.trigger('click');
			}
		} else if (e.keyCode === 85) {
			var $link = $view.find('a.permanent-link');
			$link.trigger({
				type: 'click',
				shiftKey: e.shiftKey
			});
		} else if (e.keyCode === 86) {
			if ($('body.show-picture').length) {
				hidePicture();
			} else if (! e.shiftKey) {
				$view.find('.photo img').click();
			}
			if (e.shiftKey) {
				$view.find('.photo img').trigger({
					type: 'contextmenu',
					shiftKey: e.shiftKey
				});
			}
		}
	}).keydown(function(e) {
		if (e.ctrlKey || e.metaKey || e.altKey)
			return;
		if (e.keyCode !== 13) return;
		var current_model = getCurrent();
		var $view = findView(current_model, current_model.current);
		var $focused_link = $view.find('a.focused');
		if (! $focused_link.length) return;
		$focused_link.removeClass('focused').trigger({
			type: 'click',
			shiftKey: e.shiftKey
		});
		e.preventDefault();
		e.stopPropagation();
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
	var $usage_tip = $('#usage-tip');
	if (tip === undefined) {
		$usage_tip.remove();
		return;
	}
	lscache.set('usage_tip_pos', ++pos);
	if (! tip) return;
	$('#hide-usage-tip').click(function(e) {
		lscache.set('usage_tip_pos', usage_tips.length);
		$title.removeClass('show-usage-tip');
		$usage_tip.stop(true).css('margin-left', 0);
	});
	$('#usage-tip-content').html(tip);
	var $title = $('#title');
	$title.addClass('show-usage-tip');
	var width = $usage_tip.width();
	var delta = width - $body.width() + 25;
	if (delta > 0) {
		setTimeout(function() {
			$usage_tip.css('margin-left', 0).
			animate({
				'margin-left': -delta + 'px'
			}, 3000);
		}, 3000);
	}
	setTimeout(function() {
		$title.removeClass('show-usage-tip');
		$usage_tip.animate({
			'margin-left': 0
		}, 100);
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
	if (! is_panel_mode || PREFiX.is_popup_focused) return;
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
		s.relativeTime = s.created_at && getRelativeTime(s.created_at);
	});
}

var breakpoints = [];
function markBreakpoint() {
	breakpoints.push(Date.now());
}

function createTab(url, active) {
	chrome.tabs.create({
		url: url,
		active: active === true || is_panel_mode
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

function resetHeader() {
	$('#back').css('animation', 'leftOut .4s both');
	$('h1').css('animation', 'topIn .4s both');
}

function markStatusAsFavourited(status_id) {
	var lists = [
		tl_model.statuses,
		mentions_model.statuses
	];
	lists.forEach(function(list) {
		list.some(function(status) {
			if (status.id === status_id) {
				status.favorited = true;
				return true;
			}
		});
	});
}

function markStatusAsUnfavourited(status_id) {
	var lists = [
		tl_model.statuses,
		mentions_model.statuses
	];
	lists.forEach(function(list) {
		list.some(function(status) {
			if (status.id === status_id) {
				status.favorited = false;
				return true;
			}
		});
	});
}

function deleteStatusFromAllLists(status_id) {
	var lists = [
		tl_model.statuses,
		mentions_model.statuses,
		PREFiX.homeTimeline.buffered,
		PREFiX.homeTimeline.statuses,
		PREFiX.mentions.statuses
	];
	lists.forEach(function(list) {
		var index = -1;
		list.some(function(status, i) {
			if (status.id === status_id) {
				index = i;
				return true;
			}
		});
		if (index > -1) {
			list.splice(index, 1);
		}
	});
}

function filterOutAllLists() {
	var lists = [
		tl_model,
		mentions_model,
		privatemsgs_model,
		usertl_model,
		searches_model
	];
	lists.forEach(function(list) {
		[ 'statuses', 'messages' ].forEach(function(type) {
			if (! list[type]) return;
			var new_list = list[type].filter(function(status) {
				bg_win.filterOut(status);
				return ! status.filtered_out;
			});
			list[type] = [];
			list[type] = new_list;
		});
	});
}

function hideAllOverlays(e) {
	if ($('body.show-picture').length) {
		e.preventDefault();
		hidePicture();
	} else if ($('body.show-context-timeline').length) {
		e.preventDefault();
		$('#context-timeline').trigger('click');
	}
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
	} else if (is_windows) {
		$('html').attr('platform', 'win');
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
		PREFiX.is_popup_focused = true;
		stopDrawingAttention();
		markBreakpoint();
		bg_win.hideAllNotifications();
	}).on('blur', function(e) {
		PREFiX.is_popup_focused = false;
	});

	$textarea = $('#compose-bar textarea');
	$textarea.autosize().atwho({
		at: '@',
		data: PREFiX.friends,
		search_key: 'string',
		tpl: '<li data-value="${name}">${name}</li>'
	}).keydown(function(e) {
		if (! this.value && e.keyCode === 32 &&
			! (e.shiftKey || e.ctrlKey || e.metaKey)) {
			e.stopPropagation();
			e.preventDefault();
			$textarea.blur();
		}
	});

	function showDropArea(e) {
		if (! e) return;
		e = e.originalEvent || e;
		var items = e.dataTransfer.items;
		var is_file = [].slice.call(items).some(function(item) {
			if (item.kind === 'file' &&
				item.type.match(/^image\//)) {
				return true;
			}
		});
		if (! is_file) return;
		$body.addClass('show-drop-area');
	}

	function hideDropArea(e) {
		if (e && e.target !== $('#drop-area')[0]) return;
		$body.removeClass('show-drop-area');
	}

	$app.on({
		dragenter: showDropArea,
		dragover: function(e) {
			e.stopPropagation();
			e.preventDefault();
			showDropArea(e);
		},
		dragleave: hideDropArea,
		drop: function(e) {
			e = e.originalEvent;

			e.stopPropagation();
			e.preventDefault();

			hideDropArea();

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

	var $stream = $('#stream');

	var $main_scroll_handler = new ScrollHandler($main[0]);

	var pointer_events_disabled = false;

	$main_scroll_handler.addListener(function(e) {
		if (! pointer_events_disabled) {
			pointer_events_disabled = true;
			$stream.css('pointer-events', 'none');
		}
	});

	var flush_cache_timeout;
	$main_scroll_handler.addListener(function(e) {
		clearTimeout(flush_cache_timeout);
		flush_cache_timeout = setTimeout(function() {
			if ($main.scrollTop() < 30 &&
				PREFiX.settings.current.flushCacheWhenTop) {
				cutStream();
			}
		}, 5000);
		if (pointer_events_disabled) {
			pointer_events_disabled = false;
			$stream.css('pointer-events', '');
		}
		this.scrollLeft = 0;
		var scroll_top = $main.scrollTop();
		getCurrent().scrollTop = scroll_top;
		$app.toggleClass('on-top', scroll_top === 0);
		if (scroll_top + $main.height() >= $main[0].scrollHeight - ($main[0].clientHeight/2))
			loadOldder();
		if (scroll_top < 30)
			markBreakpoint();
	});

	$('#app').delegate('a', 'click', function(e) {
		if (e.currentTarget.href.indexOf('http://') !== 0 &&
			e.currentTarget.href.indexOf('https://') !== 0)
			return;
		e.preventDefault();
		e.stopPropagation();
		if (! e.currentTarget.dataset.userid || e.shiftKey) {
			createTab(e.currentTarget.href, e.shiftKey);
		}
	}).delegate('[data-userid]', 'click', function(e) {
		if (e.shiftKey) return;
		PREFiX.userid = this.dataset.userid;
		nav_model.showUserTimeline();
	}).delegate('span.context', 'click', function(e) {
		var $status = $(e.currentTarget).parents('li');
		var status_id = $status.attr('data-id');
		var model = getCurrent();
		var status;
		model.statuses.some(function(s) {
			if (s.id === status_id) {
				status = s;
				return true;
			}
		});
		showRelatedStatuses.call(status, e);
	}).delegate('span.context', 'contextmenu', function(e) {
		var $status = $(e.currentTarget).parents('li');
		var status_id = $status.attr('data-id');
		var model = getCurrent();
		var status;
		model.statuses.some(function(s) {
			if (s.id === status_id) {
				status = s;
				return true;
			}
		});
		showContextTimeline.call(status, e);
	}).delegate('a[href^="/q/"]', 'click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		var keyword = $(e.target).attr('href').replace('/q/', '');
		searches_model.search_keyword = decodeURIComponent(keyword);
		$('#navigation-bar .saved-searches').trigger('click');
	}).delegate('.photo img', 'contextmenu', function(e) {
		var large_url = e.target.dataset.largeImg;
		if (large_url) {
			e.preventDefault();
			createTab(large_url, e.shiftKey);
		}
	}).delegate('.photo img', 'click', function(e) {
		showPicture(e.target.dataset.largeImg);
	}).delegate('#picture', 'contextmenu', function(e) {
		e.preventDefault();
		createTab(e.target.src, e.shiftKey);
		hidePicture();
	}).delegate('#relationship', 'click', function(e) {
		var $this = $(e.currentTarget);
		if ($this.text() === '关注 TA') {
			r.addFriend({
				id: PREFiX.userid
			}).next(function(user) {
				$this.text(user.following ? '已关注' : '已发出关注请求');
				$this.prop('title', '取消关注');
			});
		} else if ($this.text() === '已关注') {
			r.removeFriend({
				id: PREFiX.userid
			}).next(function(user) {
				$this.text('关注 TA').prop('title', '');
			})
		}
	}).delegate('.xiami-player', 'click', function(e) {
		var song_id = $(this).attr('song-id');
		if (song_id) {
			createXiamiPlayerPopup(song_id);
		}
	});

	$('#back').click(function(e) {
		if (last_model === 'usertl_model') {
			last_model = 'tl_model';
		}
		$main.scrollTop(0);
		setTimeout(function() {
			PREFiX.current = nav_model.current = last_model;
			window[last_model].initialize();
			resetHeader();
		});
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
		createPopup();
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
			case 53:
				e.preventDefault();
				PREFiX.userid = PREFiX.account.id;
				nav_model.showUserTimeline();
				return;
			default:
				return;
		}
		e.preventDefault();
		var event = new Event('click');
		$link[0].dispatchEvent(event);
	}).on('keydown', function(e) {
		if ($(e.target).is('select'))
			return;
		switch (e.keyCode) {
			case 40: case 38:
				break;
			default:
				return;
		}
		e.preventDefault();
		var direction = e.keyCode === 40 ? -1 : 1;
		$scrolling_elem.trigger('mousewheel', direction);
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
		var current_pos = $scrolling_elem.scrollTop();
		var height = $scrolling_elem.height();
		smoothScrollTo(e.keyCode === 34 ?
			current_pos + height : current_pos - height);
	}).on('keydown', function(e) {
		if (e.keyCode !== 116) return;
		e.preventDefault();
		PREFiX.update();
	});

	tl_model.$elem = $('#home-timeline');
	mentions_model.$elem = $('#mentions');
	privatemsgs_model.$elem = $('#privatemsgs');
	searches_model.$elem = $('#saved-searches');
	usertl_model.$elem = $('#user-timeline');

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
		current.current = current.statuses[0].id;
	} else {
		current.messages = current.messages.slice(0, 20);
		current.current = current.messages[0].id;
	}
}

function computePosition(data, no_minus_left) {
	var left = parseInt(($body[0].clientWidth - data.width) / 2, 10);
	var top = parseInt(($body[0].clientHeight - data.height) / 2, 10);
	if (no_minus_left) {
		data.left = Math.max(0, left);
	}
	data.top = Math.max(0, top);
	for (var key in data) {
		data[key] += 'px';
	}
	return data;
}

function showPicture(img_url) {
	var $picture = $('#picture');
	$body.addClass('show-picture');
	if ($picture.prop('src') != img_url) {
		$picture.prop('src', img_url);
	}
	$picture.hide().removeClass('run-animation').css({
		'width': '',
		'height': '',
		'margin-left': '',
		'transform': '',
		'left': '',
		'top': ''
	});
	var $overlay = $scrolling_elem = $('#picture-overlay');
	$overlay.removeClass('error').addClass('loading');
	$overlay.scrollTop(0);
	$picture.off().on('error', function(e) {
		$overlay.addClass('error').removeClass('loading');
		canceled = true;
	});
	var canceled = false;
	waitFor(function() {
		var height = $picture[0].naturalHeight;
		if (height && height > $body.height() * 1.5) {
			return true;
		}
		return $picture[0].complete || canceled;
	}, function() {
		$('#picture-copy').remove();
		var $picture_copy = $picture.clone();
		$picture_copy.prop('id', 'picture-copy');
		$picture.after($picture_copy);
		$overlay.removeClass('loading');
		if ($picture[0].naturalWidth > 400) {
			$picture.css('width', '400px');
		}
		var width = $picture.width();
		var height = $picture.height();
		$picture.css(computePosition({
			width: width / 1.5,
			height: height / 1.5
		}, true)).
		css({
			opacity: .05,
			display: 'block'
		}).
		show().
		addClass('run-animation').
		css(computePosition({
			width: width,
			height: height
		}, true)).
		css({
			opacity: 1
		});
		$('#picture-wrapper').css({
			animation: 'pictureSlideIn 225ms both',
			width: 400 + 'px',
			height: height
		});
	});
}

function hidePicture() {
	$('#picture-overlay').scrollTop(0);
	$scrolling_elem = $main;
	var $picture = $('#picture');
	var width = $picture.width();
	var height = $picture.height();
	var transform = $picture[0].style.transform ||
		$picture[0].style.webkitTransform;
	var rotate_deg = 0;
	if (transform && transform.indexOf('rotateZ') > -1) {
		rotate_deg = +transform.match(/rotateZ\((\d+)deg\)/)[1];
	}
	if (rotate_deg % 180) {
		var temp = width;
		width = height;
		height = temp;
	}
	var style = computePosition({
		width: width / 1.5,
		height: height / 1.5
	});
	style.left = (400 - ($picture.width() / 1.5)) / 2 + 'px';
	style.width = $picture.width() / 1.5 + 'px';
	style.height = $picture.height() / 1.5 + 'px';
	style.opacity = .05;
	style['margin-left'] = 0;
	$picture.css(style);
	$('#picture-wrapper').css({
		animation: 'pictureSlideOut 225ms both',
		width: '400px',
		height: height
	});
	setTimeout(function() {
		$('body').removeClass('show-picture');
		$picture.removeClass('run-animation');
	}, 225);
}

function rotatePicture() {
	var $picture = $('#picture');
	$picture.css('animation', '');
	var $picture_copy = $('#picture-copy');
	$picture_copy.attr('style', '');
	var transform = $picture[0].style.transform ||
		$picture[0].style.webkitTransform;
	var rotate_deg = 90;
	if (transform && transform.indexOf('rotateZ') > -1) {
		rotate_deg = +transform.match(/rotateZ\((\d+)deg\)/)[1];
		rotate_deg += 90;
	}
	var rotate_value = 'rotateZ(' + rotate_deg + 'deg)';
	var style = {
		'margin-left': 0
	};
	var width, height;
	waitFor(function() {
		return $picture_copy.width();
	}, function() {
		if (rotate_deg % 180 === 0) {
			if ($picture[0].naturalWidth > 400) {
				$picture_copy.css('width', '400px');
			}
		} else {
			if ($picture[0].naturalHeight > 400) {
				$picture_copy.css('height', '400px');
			}
			if ($picture[0].naturalWidth > 400) {
				style['margin-left'] = (400 - $picture_copy.width()) / 2 + 'px';
			}
		}
		width = $picture_copy.width();
		height = $picture_copy.height();
		$('#picture-wrapper').css(rotate_deg % 180 === 0 ? {
			width: width, height: height
		} : {
			width: height, height: width
		});
		$.extend(style, computePosition({
			width: width,
			height: height
		}));
		style.transform = rotate_value;
		$picture.css(style);
	});
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

function insertKeepScrollTop(insert) {
	var scroll_top = $main[0].scrollTop;
	var scroll_height = $main[0].scrollHeight;
	insert();
	setTimeout(function() {
		$main.scrollTop(scroll_top + $main[0].scrollHeight - scroll_height);
	}, 50);
}

function getRealId(username, id, callback) {
	var real_id = lscache.get('real_id_of_' + id);
	if (id.indexOf('~') !== 0) {
		real_id = id;
	}
	if (real_id) {
		setTimeout(function() {
			callback(real_id);
		});
		return;
	}
	r.postStatus({
		status: '@' + username
	}).next(function(status) {
		r.showStatus({
			id: status.id,
			format: 'html'
		}).next(function(status) {
			r.destroyStatus({
				id: status.id
			});
			var mention_re = /<a href="http:\/\/fanfou\.com\/([^"]+)" class="former">([^<]+)<\/a>/i;
			real_id = status.text.match(mention_re)[1];
			if (real_id.indexOf('~') !== 0) {
				lscache.set('real_id_of_' + id, real_id);
			}
			callback(real_id);
		});
	});
}

function autoScroll(model, list) {
	list = fixStatusList(list);
	var first_item = list[0];
	var last_item = list[list.length - 1];
	var pre_target, target;
	var $breakpoint;
	setTimeout(function() {
		waitFor(function() {
			pre_target = target;
			var $item = model.$elem.find('li[data-id="' + last_item.id + '"]');
			if (! $item.length) return;
			$breakpoint = $item.next('.breakpoint');
			if ($breakpoint.length) {
				$item = $breakpoint;
			} else if (list.length >= 50) {
				return;
			}
			var offset = $item.offset().top + $item.height();
			var height = $body.height();
			var pos = $main.scrollTop();
			target = Math.max(pos - (height - offset), 0);
			return pre_target !== undefined && pre_target === target;
		}, function() {
			setCurrent(model, target > 0 ? last_item.id : first_item.id);
			if ($scrolling_elem === $main) {
				if ($breakpoint && $breakpoint.length) {
					waitFor(function() {
						return $main[0].scrollHeight >= target;
					}, function() {
						$main.scrollTop(target);
					});
				} else {
					smoothScrollTo(target);
				}
			}
		});
	}, 100);
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
				page: searches_model.page + 1
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
			if (k === null) {
				k = searches_model.keyword;
			}
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
	} else if (model === usertl_model) {
		var oldest_status = usertl_model.statuses[usertl_model.statuses.length - 1];
		if (! oldest_status) return;
		r.getUserTimeline({
			id: PREFiX.userid,
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
			push(usertl_model.statuses, statuses);
		});
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
			push(model.statuses, statuses);
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
	cancelReply();
	showNotification('正在删除..');
	var current_model = getCurrent();
	var current = current_model.current;
	var next;
	if (current) {
		var index;
		current_model.statuses.some(function(status, i) {
			if (status.id === current) {
				index = i;
				return true;
			}
		});
		if (index === current_model.statuses.length - 1) {
			index--;
		}
	}
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
		var $item = $(self);
		$item.parents('.status').
		css('animation', 'remove .4s linear');
		$item.parents('li').
		slideUp(function() {
			self.$vmodel.$remove();
			deleteStatusFromAllLists(status_id);
			if (index >= 0) {
				setCurrent(current_model, current_model.statuses[index].id);
			}
		});
		if (self.$vmodel.status.is_self && PREFiX.count.mentions) {
			PREFiX.update();
		}
	});
}

function cancelReply() {
	var models = [
		tl_model,
		mentions_model,
		privatemsgs_model,
		searches_model,
		usertl_model
	];
	models.forEach(function(model) {
		model.is_replying = false;
		(model.statuses || model.messages).some(function(status) {
			if (status.current_replied) {
				status.current_replied = false;
				return true;
			}
		});
	});
}

function generateMethod(type) {
	return function() {
		cancelReply();
		var status = this.$vmodel.status;
		composebar_model.type = type;
		composebar_model.id = status.id;
		if (type === 'reply') {
			var at_users = { };
			at_users[status.user.name] = true;
			var at_re = /data-userid="([^"\/]+)">([^<>\s]+)/g;
			var result;
			while (result = at_re.exec(status.fixedText)) {
				if (result[1] != PREFiX.account.id && result[2] != PREFiX.account.name) {
					at_users[result[2]] = true;
				}
			}
			var prefix = '@' + status.user.name + ' ';
			var value = prefix + Object.keys(at_users).map(function(user) {
				return user == status.user.name ? '' : ('@' + user + ' ');
			}).join('');
		} else {
			var value = PREFiX.settings.current.repostFormat.
				replace(/\$name\$|\$text\$/ig, function(k) {
					return k === '$name$' ?
						status.user.name : status.textWithoutTags;
				})
		}
		composebar_model.text = value;
		$textarea.focus();
		if (type === 'reply') {
			$textarea[0].selectionStart = prefix.length;
			$textarea[0].selectionEnd = value.length;
			var current_model = getCurrent();
			current_model.is_replying = true;
			status.current_replied = true;
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
	var status = this.$model;
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
	var status = this.$model;
	(function get() {
		push(statuses, [ status ]);
		var id = status.repost_status_id || status.in_reply_to_status_id;
		if (id) {
			showRelatedStatuses.ajax = r.showStatus({ id: id }).next(function(s) {
				status = s;
				get();
			}).error(function() {
				var s = searchStatusInCache(id);
				if (s) {
					status = s;
					get();
					return;
				}
				$context_tl.removeClass('loading');
				unshift(context_tl_model.statuses, statuses, true);
			});
		} else {
			$context_tl.removeClass('loading');
			unshift(context_tl_model.statuses, statuses, true);
		}
	})();
}

function hideBlockTip() {
	$('#block-tip').css('animation', 'wobbleOut .4s').delay(400).hide(0);
}

function blockUser(e) {
	if (! e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)
		return;
	e.preventDefault();
	var status = this.$vmodel.status || this.$vmodel.message;
	var user = status.user || status.sender;
	var userid = user.id;
	var username = user.name;
	var real_id = '';
	getRealId(username, userid, function(id) {
		real_id = id;
	});
	$('#blocked-user-name').text('@' + username + ' (' + userid + ')');
	$('#block-tip').show().css('animation', 'wobbleIn .4s');
	$('#block-user').off().click(function(e) {
		var filters = PREFiX.settings.current.filters;
		filters.push({
			pattern: userid,
			type: 'id'
		}, {
			pattern: username,
			type: 'name'
		});
		if (real_id) {
			filters.push({
				pattern: 'http://fanfou.com/' + real_id,
				type: 'content'
			});
		}
		PREFiX.settings.save();
		filterOutAllLists();
		bg_win.filterOutAllLists();
	}).click(hideBlockTip);
	$('#hide-block-tip').off().click(hideBlockTip);
}

function onNewStatusInserted() {
	this.forEach(function(s) {
		setTimeout(function() {
			bg_win.enrichStatus(s);
			if (s.photo && s.photo.url) {
				bg_win.processPhoto(s, s.photo);
			}
		});
	});
}

var nav_model = avalon.define('navigation', function(vm) {
	vm.current = PREFiX.current;
	vm.showHomeTimeline = function(e) {
		if (loading) return;
		if (vm.current == 'tl_model' && $main.scrollTop())
			return goTop(e);
		last_model = PREFiX.current = vm.current = 'tl_model';
		tl_model.initialize();
	}
	vm.showMentions = function(e) {
		if (loading) return;
		if (vm.current == 'mentions_model' && $main.scrollTop())
			return goTop(e);
		last_model = PREFiX.current = vm.current = 'mentions_model';
		mentions_model.initialize();
	}
	vm.showPrivateMsgs = function(e) {
		if (loading) return;
		if (vm.current == 'privatemsgs_model' && $main.scrollTop())
			return goTop(e);
		last_model = PREFiX.current = vm.current = 'privatemsgs_model';
		privatemsgs_model.initialize();
	}
	vm.showSavedSearches = function(e) {
		if (loading) return;
		if (vm.current == 'searches_model' && $main.scrollTop())
			return goTop(e);
		last_model = PREFiX.current = vm.current = 'searches_model';
		searches_model.initialize();
	}
	vm.showUserTimeline = function(e) {
		if (loading) return;
		PREFiX.current = vm.current = 'usertl_model';
		usertl_model.initialize();
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
		if (old_value == 'usertl_model') {
			resetHeader();
		}
		$('#title').show();
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
		var is_sending_pm = [ 'send-pm', 'reply-pm' ].indexOf(vm.type) > -1;
		$('#compose-bar').toggleClass('uploading-not-supported', is_sending_pm);
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
		var is_sending_pm = [ 'send-pm', 'reply-pm' ].indexOf(vm.type) > -1;
		$('#compose-bar').toggleClass('uploading-not-supported', is_sending_pm);
	}
	vm.ondblclick = function(e) {
		if (e.ctrlKey || e.metaKey) {
			if (! vm.text.trim() && ! PREFiX.image) {
				vm.text = $textarea.prop('placeholder');
			}
		} else if (PREFiX.settings.current.holdCtrlToSubmit) {
			return;
		}
		e.preventDefault();
		return vm.onkeydown({
			ctrlKey: true,
			keyCode: 13
		});
	}
	vm.onkeydown = function(e) {
		e.stopPropagation && e.stopPropagation();
		if (e.keyCode === 27 /* Esc */) {
			$textarea.blur();
			return;
		}
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
						cancelReply();
						$textarea.blur();
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
					var text = vm.text;
					if (PREFiX.settings.current.newlineAfterMyName) {
						var re = new RegExp('@' + PREFiX.account.name, 'g');
						text = text.replace(re, function(_, pos) {
							return '@' + (pos ? '\n': '') + PREFiX.account.name;
						});
					}
					data.status = text;
					data.photo = PREFiX.image;
					r[ PREFiX.image ? 'postPhoto' : 'postStatus' ](data).
					setupAjax({
						lock: vm,
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
						$textarea.blur();
						PREFiX.update(7, status.id);
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
			cancelReply();
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
	vm.current = PREFiX.homeTimeline.current;

	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;

	vm.showContextTimeline = showContextTimeline;

	vm.blockUser = blockUser;

	vm.statuses = [];

	vm.scrollTop = 0;

	vm.is_replying = PREFiX.homeTimeline.is_replying;
});
tl_model.$watch('current', function(value) {
	PREFiX.homeTimeline.current = value;
});
tl_model.$watch('scrollTop', function(value) {
	PREFiX.homeTimeline.scrollTop = value;
});
tl_model.$watch('is_replying', function(value) {
	PREFiX.homeTimeline.is_replying = value;
});
tl_model.statuses.$watch('length', function() {
	PREFiX.homeTimeline.statuses = tl_model.$model.statuses.map(function(s) {
		return s.$model || s;
	});
});
tl_model.statuses.$watch('length', onNewStatusInserted);
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
			initKeyboardControl();
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
		if (! PREFiX.is_popup_focused || $main[0].scrollTop > $body.height / 2)
			return;
		var buffered = tl.buffered;
		tl.buffered = [];
		if (! tl.statuses.length) {
			unshift(tl_model.statuses, buffered);
		} else {
			setTimeout(function() {
				var scroll_top = $main.scrollTop();
				insertKeepScrollTop(function() {
					if (buffered.length >= 50) {
						var now = Date.now();
						var is_breakpoint = breakpoints.some(function(time) {
							return Math.abs(time - now) < 500;
						});
						if (is_breakpoint) {
							buffered = fixStatusList(buffered);
							var oldest_status = buffered[buffered.length - 1];
							oldest_status.is_breakpoint = true;
							oldest_status.loaded_at = 'Loaded @ ' + getShortTime(now) + '.';
						}
					}
					unshift(tl_model.statuses, buffered);
					if (scroll_top <= 30) {
						autoScroll(tl_model, buffered);
					}
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
	vm.current = PREFiX.mentions.current;

	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;

	vm.showContextTimeline = showContextTimeline;

	vm.blockUser = blockUser;

	vm.statuses = [];

	vm.scrollTop = 0;

	vm.is_replying = PREFiX.mentions.is_replying;
});
mentions_model.$watch('current', function(value) {
	PREFiX.mentions.current = value;
});
mentions_model.$watch('scrollTop', function(value) {
	PREFiX.mentions.scrollTop = value;
});
mentions_model.$watch('is_replying', function(value) {
	PREFiX.mentions.is_replying = value;
});
mentions_model.statuses.$watch('length', function() {
	PREFiX.mentions.statuses = mentions_model.$model.statuses.map(function(s) {
		return s.$model || s;
	});
});
mentions_model.statuses.$watch('length', onNewStatusInserted);
mentions_model.initialize = function() {
	$('#navigation-bar .mentions').addClass('current');
	$('#title h2').text('Mentions');
	$('#mentions').addClass('current');

	function check() {
		if (! PREFiX.is_popup_focused || $main[0].scrollTop) return;
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
				if (statuses.length) {
					var scroll_top = $main.scrollTop();
					insertKeepScrollTop(function() {
						unshift(mentions_model.statuses, statuses);
						if (scroll_top <= 30) {
							autoScroll(mentions_model, statuses);
						}
					});
				}
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
	initKeyboardControl();
	updateRelativeTime();
	update();

	this.interval = setInterval(check, 100);
}
mentions_model.unload = function() {
	clearInterval(this.interval);
}

var privatemsgs_model = avalon.define('privatemsgs', function(vm) {
	vm.current = PREFiX.privatemsgs.current;

	vm.remove = function() {
		cancelReply();
		showNotification('正在删除..')
		var current_model = privatemsgs_model;
		var current = current_model.current;
		var next;
		if (current) {
			var index;
			current_model.messages.some(function(message, i) {
				if (message.id === current) {
					index = i;
					return true;
				}
			});
			if (index === current_model.messages.length - 1) {
				index--;
			}
		}
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
			var $item = $(self);
			$item.parents('.status').
			css('animation', 'remove .4s linear');
			$item.parents('li').
			slideUp(function() {
				self.$vmodel.$remove();
				if (index >= 0) {
					setCurrent(current_model, current_model.messages[index].id);
				}
			});
		});
	}

	vm.reply = function() {
		cancelReply();
		var message = this.$vmodel.message;
		composebar_model.text = '';
		composebar_model.type = 'reply-pm';
		composebar_model.id = message.id;
		composebar_model.user = message.sender.id;
		composebar_model.username = message.sender.name;
		$textarea.focus();
		privatemsgs_model.is_replying = true;
		message.current_replied = true;
	}

	vm.blockUser = blockUser;

	vm.messages = [];

	vm.scrollTop = 0;

	vm.is_replying = PREFiX.privatemsgs.is_replying;
});
privatemsgs_model.$watch('current', function(value) {
	PREFiX.privatemsgs.current = value;
});
privatemsgs_model.$watch('is_replying', function(value) {
	PREFiX.privatemsgs.is_replying = value;
});
privatemsgs_model.$watch('scrollTop', function(value) {
	PREFiX.privatemsgs.scrollTop = value;
});
privatemsgs_model.messages.$watch('length', function() {
	PREFiX.privatemsgs.messages = privatemsgs_model.$model.messages.map(function(m) {
		return m.$model || m;
	});
});
privatemsgs_model.messages.$watch('length', onNewStatusInserted);
privatemsgs_model.initialize = function() {
	$('#navigation-bar .privatemsgs').addClass('current');
	$('#title h2').text('Private Messages');
	$('#privatemsgs').addClass('current');

	function check() {
		if (! PREFiX.is_popup_focused || $main[0].scrollTop) return;
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
				if (messages.length) {
					var scroll_top = $main.scrollTop();
					insertKeepScrollTop(function() {
						unshift(privatemsgs_model.messages, messages);
						if (scroll_top <= 30) {
							autoScroll(privatemsgs_model, messages);
						}
					});
				}
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
	initKeyboardControl();
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

	vm.blockUser = blockUser;

	vm.keyword = PREFiX.keyword;

	vm.is_replying = false;

	vm.statuses = [];
});
searches_model.$watch('keyword', function() {
	PREFiX.keyword = searches_model.keyword;
});
searches_model.statuses.$watch('length', onNewStatusInserted);
searches_model.initialize = function() {
	$('#navigation-bar .saved-searches').addClass('current');
	$('#title h2').text('Discover');
	$('#saved-searches').addClass('current');

	$main.scrollTop(0);

	function showPublicTimeline() {
		$('#topic-selector').prop('disabled', true);
		$('#loading').show();
		searches_model.statuses = [];
		searches_model.current = null;
		r.getPublicTimeline({
			count: 60
		}).next(function(statuses) {
			unshift(searches_model.statuses, statuses);
			$('#loading').hide();
			initKeyboardControl();
		}).hold(function() {
			$('#topic-selector').prop('disabled', false);
		});
	}

	function showFavorites() {
		$('#topic-selector').prop('disabled', true);
		$('#loading').show();
		searches_model.statuses = [];
		searches_model.current = null;
		searches_model.page = 1;
		r.getFavorites({
			id: PREFiX.account.id
		}).next(function(statuses) {
			searches_model.statuses = statuses;
			initKeyboardControl();
			updateRelativeTime();
		}).hold(function() {
			$('#topic-selector').prop('disabled', false);
		});
	}

	function search() {
		$('#loading').show();
		var keyword = searches_model.keyword;
		searches_model.statuses = [];
		searches_model.current = null;
		var statuses;
		var is_saved = bg_win.saved_searches_items.some(function(item) {
			if (item.keyword !== keyword) return;
			statuses = JSON.parse(JSON.stringify(item.statuses));
			lscache.set('saved-search-' + keyword + '-rawid', statuses[0].rawid);
			item.unread_count = 0;
			item.check();
			return true;
		});
		if (is_saved) {
			unshift(searches_model.statuses, statuses);
			initKeyboardControl();
		} else {
			r.searchPublicTimeline({
				q: keyword
			}).setupAjax({
				lock: search
			}).next(function(statuses) {
				unshift(searches_model.statuses, statuses);
				initKeyboardControl();
			});
		}
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
		var $selector = $('<select />');
		$selector.prop('id', 'topic-selector');
		$selector.prop('tabIndex', 2);

		var $public_tl = $('<option />');
		$public_tl.text('随便看看');
		$public_tl.prop('value', '##PUBLIC_TIMELINE##');
		$selector.append($public_tl);

		var $fav = $('<option />');
		$fav.text('我的收藏');
		$fav.prop('value', '##MY_FAVORITES##');
		$selector.append($fav);

		bg_win.saved_searches_items.some(function(item) {
			var $item = $('<option />');
			$item.val(item.keyword);
			$item.text(item.keyword);
			$selector.append($item);
		});

		var $search = $('<option />');
		$search.text('搜索');
		$search.prop('value', '##SEARCH##');
		$search.prop('disabled', true);
		$selector.append($search);

		$selector.val('##PUBLIC_TIMELINE##');
		$selector.appendTo('#title');

		$selector.on('change', function(e) {
			if (this.value === '##PUBLIC_TIMELINE##') {
				searches_model.keyword = '';
				showPublicTimeline();
			} else if (this.value === '##MY_FAVORITES##') {
				searches_model.keyword = '';
				showFavorites();
			} else if (this.value === '##SEARCH##') {
				searches_model.keyword = searches_model.search_keyword;
				delete searches_model.search_keyword;
				search();
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
	if (searches_model.search_keyword) {
		$selector.val('##SEARCH##');
	} else if (last) {
		$selector.val(searches_model.keyword);
	} else if (! last && bg_win.getSavedSearchStatusesCount()) {
		bg_win.saved_searches_items.some(function(item) {
			if (item.unread_count) {
				$selector.val(item.keyword);
				return true;
			}
		});
	} else if (searches_model.keyword) {
		var keyword = searches_model.keyword;
		var is_saved = [].slice.call($selector.find('option')).
			some(function(option) {
				return option.value === keyword;
			});
		$selector.val(is_saved ? keyword : '##PUBLIC_TIMELINE##');
	} else {
		$selector.val('##PUBLIC_TIMELINE##');
	}
	$selector.trigger('change');

	this.interval = setInterval(refreshCount, 100);
}
searches_model.unload = function() {
	clearInterval(this.interval);
}

var usertl_model = avalon.define('user-timeline', function(vm) {
	vm.remove = remove;

	;[ 'reply', 'repost' ].forEach(function(type) {
		vm[type] = generateMethod(type);
	});

	vm.toggleFavourite = toggleFavourite;

	vm.showContextTimeline = showContextTimeline;

	vm.blockUser = blockUser;

	vm.statuses = [];

	vm.is_replying = false;
});
usertl_model.statuses.$watch('length', onNewStatusInserted);
usertl_model.initialize = function() {
	$('#title').hide();
	$('#user-timeline').addClass('current');
	$('h1, #back').attr('style', '');
	$body.addClass('show-back-button');

	r.showUser({
		id: PREFiX.userid
	}).next(function(user) {
		user.error = '';
		fixUser(user);
		var following = user.following;
		var $relationship = $('#relationship');
		if (user.protected && ! user.following) {
			user.error = '该用户没有公开 TA 的消息. ';
		} else if (! user.status) {
			user.error = '该用户还没有发表消息. '
		}
		if (user.status) {
			r.getUserTimeline({
				id: PREFiX.userid
			}).next(function(statuses) {
				unshift(usertl_model.statuses, statuses);
				getRealId(user.name, user.id, function(id) {
					usertl_model.statuses[0].user.id = id;
				});
				setTimeout(initKeyboardControl);
				if (following) {
					r.showRelationshipById(user.id, PREFiX.account.id).
					next(function(result) {
						if (JSON.parse(result.relationship.source.following)) {
							$('#relationship').text('互相关注');
						} else {
							$relationship.prop('title', '取消关注');
						}
					});
				}
			});
		} else {
			var statuses = [ { id: 0, user: user } ];
			usertl_model.statuses = statuses;
			$relationship.prop('title', following ? '取消关注' : '');
		}
		if (user.error) {
			$('#loading').hide();
		}
	})

	usertl_model.statuses = [];
	$main.scrollTop(0);
	usertl_model.current = null;
	usertl_model.is_replying = false;
}
usertl_model.unload = function() { }

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
context_tl_model.statuses.$watch('length', onNewStatusInserted);

$(function() {
	require('avalon.live', function() {
		initMainUI();
		setTimeout(function() {
			$textarea.focus();
			if (! PREFiX.compose.text) {
				$textarea.blur();
			} else if (PREFiX.compose.type === 'repost') {
				$textarea[0].selectionStart = $textarea[0].selectionEnd = 0;
			}
			getCurrent().initialize();
			initKeyboardControlEvents();
			setTimeout(showUsageTip, 100);
		}, 100);
		var $tip = $('#uploading-photo-tip');
		var shown = lscache.get('uploading_photo_tip');
		if (! shown && lscache.get('hide-following-tip')) {
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
});

onunload = function() {
	PREFiX.popupActive = false;
	if ($main[0].scrollTop < 30)
		cutStream();
	if (is_panel_mode) {
		var pos = {
			x: screenX,
			y: screenY
		};
		lscache.set('popup_pos', pos);
	}
	PREFiX.panelMode = false;
	PREFiX.is_popup_focused = false;
}

if (location.search == '?new_window=true') {
	is_panel_mode = true;
	$('html').addClass('panel-mode');
	initFixSize(400, 600);
	$(applyViewHeight);
	PREFiX.panelMode = true;
} else {
	PREFiX.panelMode = false;
}

chrome.runtime.sendMessage({ });

bg_win.hideAllNotifications();