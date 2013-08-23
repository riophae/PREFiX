var ce = chrome.extension;
var bg_win = ce.getBackgroundPage();
var Ripple = bg_win.Ripple;
var Deferred = bg_win.Deferred;
var lscache = bg_win.lscache;
var PREFiX = bg_win.PREFiX;

var http_s_url = "https?://(((((([0-9a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([0-9a-zA-Z]))\\.)*(([a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([a-zA-Z])))|([0-9]+)\\.([0-9]+)\\.([0-9]+)\\.([0-9]+))(:([0-9]+)){0,1})(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*)(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*))*(\\?(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*))?)?(#[0-9a-zA-Z-=#!/\|:\+]*)?";
var ftp_url = "ftp://(((((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|\\?|&|=)*)(:(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|\\?|&|=)*)){0,1}@){0,1}(((((([0-9a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([0-9a-zA-Z]))\\.)*(([a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([a-zA-Z])))|([0-9]+)\\.([0-9]+)\\.([0-9]+)\\.([0-9]+))(:([0-9]+)){0,1}))(/((((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|\\?|:|@|&|=)*)(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|\\?|:|@|&|=)*))*)(;type=(A|I|D|a|i|d))?)?";
var url_patt = '(' + http_s_url + ')|(' + ftp_url + ')';
var url_re = new RegExp(url_patt, 'g');
var url_max_len = 35;
var url_placeholder = 'http://is.gd/xxxxxx';

var $body;
var $textarea;
var $main;

var loading = false;
PREFiX.popupActive = true;

var r = PREFiX.user;

if (! r) {
	bg_win.initialize();
	close();
}

var goTop = (function() {
	var s = 0;
	var current;
	return function(e) {
		if (e) {
			e.preventDefault();
			s = $main[0].scrollTop;
		}
		current = $main[0].scrollTop;
		if (s != current) return;
		var to = Math.floor(s / 1.15);
		$main[0].scrollTop = s = to;
		if (s >= 1) setTimeout(goTop, 24);
	}
})();

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
	var length = composebar_model.text.trim().replace(url_re, function(url) {
		return url.length > url_max_len ? url_placeholder : url;
	}).length;
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

function updateRelativeTime() {
	var current = getCurrent();
	if (! current || (! current.statuses && ! current.messages))
		return;
	(current.statuses || current.messages).forEach(function(s) {
		s.relativeTime = getRelativeTime(s.created_at);
	});
}

function createTab(url) {
	chrome.tabs.create({
		url: url,
		active: false
	});	
}

function initMainUI() {
	$body = $('body');

	$textarea = $('#compose-bar textarea');
	$textarea.autosize().atwho({
		at: '@',
		data: PREFiX.friends,
		search_key: 'string',
		tpl: '<li data-value="${name}">${name}</li>'
	});

	$main = $('#main');

	$main.scroll(_.throttle(function(e) {
		getCurrent().scrollTop = $main.scrollTop();
		if ($main.scrollTop() + $main.height() >= $main[0].scrollHeight - $main[0].clientHeight)
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
			var current = getCurrent();
			if (current.statuses) {
				current.statuses = current.statuses.slice(0, 10);
			} else {
				current.messages = current.messages.slice(0, 10);
			}
			PREFiX.update();
		}
	});

	$('#uploading-photo').click(function(e) {
		var options = {
			url: 'uploading-photo.html',
			focused: true,
			type: 'panel',
			width: 316,
			height: 192
		};
		chrome.windows.create(options);
		close();
	});

	$('#picture-overlay').click(function(e) {
		$('body').removeClass('show-picture');
	});

	$('#context-timeline').click(function(e) {
		if (! $(e.target).is('a') && ! $(e.target).is('img')) {
			$('body').removeClass('show-context-timeline');
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

	refreshLoading();

	setInterval(updateRelativeTime, 15000);
	setInterval(checkCount, 100);
}

function showPicture(img_url) {
	var $picture = $('#picture');
	$body.addClass('show-picture');
	$picture.prop('src', img_url).hide();
	waitFor(function() {
		return $picture[0].naturalWidth;
	}, function() {
		if ($picture[0].naturalWidth > 400) {
			$picture.css('width', '400px');
		}
		var width = parseInt($picture.css('width'));
		var height = parseInt($picture.css('height'));
		var left = ($body[0].clientWidth - width) / 2;
		var top = ($body[0].clientHeight - height) / 2;
		left = Math.max(0, left);
		top = Math.max(0, top);
		$picture.css({
			left: left + 'px',
			top: top + 'px'
		}).fadeIn();
	});
}

function checkCount() {
	var count = PREFiX.count;
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
}

function refreshLoading() {
	$('#loading').hide().show();
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
	loading = true;
	var model = getCurrent();
	if (model.statuses) {
		var oldest_status = model.statuses[model.statuses.length - 1];
		if (! oldest_status) return;
		var id = oldest_status.id;
		r[model === tl_model ? 'getHomeTimeline' : 'getMentions']({
			max_id: id
		}).setupAjax({
			lock: loadOldder
		}).next(function(statuses) {
			loading = false;
			appendStatuses(statuses)
		});
	} else {
		var oldest_message = model.messages[model.messages.length - 1];
		if (! oldest_message) return;
		var id = oldest_message.id;
		r.showInbox({
			max_id: id
		}).setupAjax({
			lock: loadOldder
		}).next(function(messages) {
			loading = false;
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
	$body.addClass('show-context-timeline');
	var status = this.$vmodel.status;
	var id = status.id;
	context_tl_model.statuses = [];
	$('#context-timeline ul').html('');
	if (status.repost_status) {
		var statuses = [ status.repost_status, status ];
		push(context_tl_model.statuses, statuses, true);
	} else {
		$('#context-timeline').addClass('loading');
		r.getContextTimeline({ 
			id: id
		}).next(function(statuses) {
			$('#context-timeline').removeClass('loading');
			push(context_tl_model.statuses, statuses, true);
		});
	}
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
		refreshLoading();
	});
});

var composebar_model = avalon.define('composebar-textarea', function(vm) {
	vm.text = vm.type = vm.id = vm.user = '';
	vm.submitting = false;
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
					}).error(function() {
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

	vm.$watch('statuses', function() {
		PREFiX.homeTimeline.statuses = tl_model.$model.statuses;
	});

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.homeTimeline.scrollTop = value;
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
		$main.scrollTop(PREFiX.homeTimeline.scrollTop);
		updateRelativeTime();
	});

	this.interval = setInterval(function update() {
		if (! tl.buffered.length)
			return;
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

	vm.$watch('statuses', function() {
		PREFiX.mentions.statuses = mentions_model.$model.statuses;
	});

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.mentions.scrollTop = value;
	});
});
mentions_model.initialize = function() {
	$('#navigation-bar .mentions').addClass('current');
	$('#title h2').text('Mentions');
	$('#mentions').addClass('current');

	function check() {
		if (PREFiX.count.mentions) 
			update();
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

	vm.$watch('messages', function() {
		PREFiX.privatemsgs.messages = privatemsgs_model.$model.messages;
	});

	vm.scrollTop = 0;

	vm.$watch('scrollTop', function(value) {
		PREFiX.privatemsgs.scrollTop = value;
	});
});
privatemsgs_model.initialize = function() {
	$('#navigation-bar .privatemsgs').addClass('current');
	$('#title h2').text('Private Messages');
	$('#privatemsgs').addClass('current');

	function check() {
		if (PREFiX.count.direct_messages) 
			update();
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
		getCurrent().initialize();
	}, 100);
});

onunload = function() {
	PREFiX.popupActive = false;
}