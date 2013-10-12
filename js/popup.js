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

var loading = false;
var is_on_top = true;
PREFiX.popupActive = true;

var lyric;

var r = PREFiX.user;

if (! r) {
	bg_win.initialize();
	close();
}

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
			stopSmoothScrolling();
			e.preventDefault();
			s = $main[0].scrollTop;
		}
		var breakpoint = Date.now();
		id = requestAnimationFrame(function(timestamp) {
			var diff = timestamp - breakpoint;
			if (diff >= 10) {
				console.log(diff)
				breakpoint = timestamp;
				current = $main[0].scrollTop;
				if (s != current) {
					return stop();
				}
				var to = Math.floor(s / 1.1 / Math.max(20 / diff, 1));
				$main[0].scrollTop = s = to;
			}
			if (s >= 1) {
				requestAnimationFrame(arguments.callee);
			};
		});
	}
})();

function initSmoothScroll() {
	var id;
	var is_scrolling = false;
	var destination = null;
	var height = $main.height();
	function runAnimation() {
		function renderFrame(timestamp) {
			if (! is_scrolling) return;
			var progress = timestamp - breakpoint;
			if (progress >= 16) {
				var pos = $main.scrollTop();
				var diff = destination - pos;
				var dist = progress * diff / 100;
				$main.scrollTop(pos + dist);
				if (Math.abs(dist) <= 1) {
					return stopSmoothScrolling();
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
		stopSmoothScrolling = function() {
			stopSmoothScrolling = function() { };
			destination = null;
			is_scrolling = false;
			cancelRequestAnimationFrame(id);
		}
	}
	$main.on('mousewheel', function(e, delta) {
		if (! PREFiX.settings.current.smoothScroll)
			return;
		e.preventDefault();
		destination = destination || $main.scrollTop();
		destination = Math.ceil(-delta * 120 + destination);
		destination = Math.max(destination, 0);
		destination = Math.min(destination, $main[0].scrollHeight - height);
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

function drawAttention() {
	if (! is_panel_mode || is_focused) return;
	chrome.runtime.sendMessage({
		act: 'draw_attention'
	});
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

function initMainUI() {
	$body = $('body');
	$app = $('#app');

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

	$('#navigation-bar li').each(function(i) {
		var $li = $(this);
		$li.css('margin-right', (i-1 * $li.width()) + 'px').animate({
			'margin-right': 0
		});
	})

	$textarea = $('#compose-bar textarea');
	$textarea.autosize().atwho({
		at: '@',
		data: PREFiX.friends,
		search_key: 'string',
		tpl: '<li data-value="${name}">${name}</li>'
	});

	$main = $('#main');
	initSmoothScroll();

	$main.scroll(_.throttle(function(e) {
		var scroll_top = $main.scrollTop();
		getCurrent().scrollTop = scroll_top;
		$app.toggleClass('on-top', scroll_top === 0);
		if (scroll_top + $main.height() >= $main[0].scrollHeight - ($main[0].clientHeight/2))
			loadOldder();
	}, 100));

	$('#app').delegate('a', 'click', function(e) {
		if (e.target.href.indexOf('http://') !== 0)
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
		} else {
			cutStream();
			PREFiX.update();
		}
	});

	$('#new-window').click(function(e) {
		createPanel(400, 600, '/popup.html?new_window=true');
		close();
	});

	$('#uploading-photo').click(function(e) {
		createPanel(316, 192, 'uploading-photo.html');
	});

	$('#picture-overlay').click(function(e) {
		hidePicture();
	});

	$('#context-timeline').click(function(e) {
		if (! $(e.target).is('a') && ! $(e.target).is('img')) {
			$(this).removeClass('focusInFromBottom').addClass('focusOutFromTop');
			setTimeout(function() {
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

	composebar_model.type = PREFiX.compose.type;
	composebar_model.id = PREFiX.compose.id;
	composebar_model.user = PREFiX.compose.user;
	composebar_model.text = PREFiX.compose.text;
	if (PREFiX.compose.text) {
		$textarea.focus();
		var pos = composebar_model.text.length;
		$textarea[0].selectionStart = $textarea[0].selectionEnd = pos;
	}

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
	var options = {
		url: url,
		focused: true,
		type: 'panel',
		width: width,
		height: height,
		left: (screen.width - width) / 2,
		top: (screen.height - height) / 2
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
	var $overlay = $('#picture-overlay');
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

function checkCount() {
	var count = PREFiX.count;
	var $home_tl = $('#navigation-bar .home-timeline .count');
	var $mentions = $('#navigation-bar .mentions .count');
	var $privatemsgs = $('#navigation-bar .privatemsgs .count');
	if (count.mentions) {
		$mentions.text(count.mentions).show();
	} else {
		$mentions.text('').hide();
	}
	if (count.direct_messages) {
		$privatemsgs.text(count.direct_messages).show();
	} else {
		$privatemsgs.text('').hide();
	}
	var buffered = PREFiX.homeTimeline.buffered.filter(function(status) {
		return ! status.is_self;
	}).length;
	if (buffered) {
		$home_tl.text(Math.min(buffered, 99)).show();
	} else {
		$home_tl.text('').hide();
	}
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
			var at_re = /([^"/]+)"\s+class="former">([^<>\s]+)/g;
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
	showNotification(status.favorited ? '取消收藏..' : '正在收藏..')
	r[status.favorited ? 'removeFavorite' : 'addFavorite']({
		id: status.id
	}).setupAjax({
		lock: self
	}).next(function() {
		status.favorited = ! status.favorited;
		showNotification(status.favorited ? '收藏成功!' : '取消收藏成功!');
	});
}

function showContextTimeline(e) {
	e.preventDefault();
	$body.addClass('show-context-timeline');
	var status = this.$vmodel.status.$model;
	var id = status.id;
	context_tl_model.statuses = [];
	var context_statuses = [ status ];
	var $context_tl = $('#context-timeline');
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
	var $context_tl = $('#context-timeline');
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
		PREFiX.current = vm.current = 'tl_model';
		tl_model.initialize();
	}
	vm.showMentions = function(e) {
		if (loading) return;
		PREFiX.current = vm.current = 'mentions_model';
		mentions_model.initialize();
	}
	vm.showPrivateMsgs = function(e) {
		if (loading) return;
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
	vm.text = vm.type = vm.id = vm.user = '';
	vm.submitting = false;
	vm.onfocus = function(e) {
		lyric = lyric || getLyric();
		$textarea.prop('placeholder', lyric);
	}
	vm.onblur = function(e) {
		$textarea.prop('placeholder', '');
	}
	vm.ondblclick = function(e) {
		return vm.onkeyup({
			ctrlKey: true,
			which: 13
		});
	}
	vm.onkeyup = function(e) {
		var value = $textarea.val();
		if (! value || vm.submitting) return;
		if (e.which === 13 && e.ctrlKey) {
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
				shorten().next(function() {
					data.status = vm.text;
					r.postStatus(data).next(function() {
						showNotification('发表成功!');
						vm.text = '';
						PREFiX.update();
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
		if (! tl.buffered.length)
			return;
		drawAttention();
		var buffered = tl.buffered;
		tl.buffered = [];
		insertKeepScrollTop(function() {
			unshift(tl_model.statuses, buffered);
		});
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
	if (! $main[0].scrollTop)
		cutStream();
}

if (location.search == '?new_window=true') {
	is_panel_mode = true;
	$('html').addClass('panel-mode');
	initFixSize(400, 600);
}

chrome.runtime.sendMessage({ });