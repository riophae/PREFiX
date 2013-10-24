$(function() {
	function isImage(type) {
		switch (type) {
		case 'image/jpeg':
		case 'image/png':
		case 'image/gif':
		case 'image/bmp':
		case 'image/jpg':
			return true;
		default:
			return false;
		}
	}
	function computeSize(size) {
		var units = ['', 'K', 'M', 'G', 'T'];
		while (size / 1024 >= .75) {
			size = size / 1024;
			units.shift();
		}
		size = Math.round(size * 10) / 10 + units[0] + 'B';
		return size;
	}
	function fixTransparentPNG() {
		var img = new Image;
		var fr = new FileReader;
		var file_name = file.name;
		fr.onload = function(e) {
			img.src = fr.result;
			Ripple.helpers.image2canvas(img).
			next(function(canvas) {
				var ctx = canvas.getContext('2d');
				var image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
				var pixel_array = image_data.data;
				var m, a, s;
				for (var i = 0, len = pixel_array.length; i < len; i += 4) {
					a = pixel_array[i+3];
					if (a === 255) continue;
					s = 255 - a;
					a /= 255;
					m = 3;
					while (m--) {
						pixel_array[i+m] = pixel_array[i+m] * a + s;
					}
					pixel_array[i+3] = 255;
				}
				ctx.putImageData(image_data, 0, 0);
				canvas.toBlob(function(blob) {
					file = blob;
					file.name = file_name;
					setTip();
				});
			});
		}
		fr.readAsDataURL(file);
	}
	function setTip() {
		var tip = file.name + ' (' + computeSize(file.size) + ')';
		$('#tip').text(tip).prop('title', tip);
	}
	function submit() {
		if (! file) return;
		shorten().next(function() {
			PREFiX.user.postPhoto({
				photo: file,
				status: $status.val().trim()
			}).setupAjax({
				lock: $status,
				timeout: 2 * 60 * 1000,
				onstart: function(e) {
					$('#img-droparea').addClass('loading');
				},
				onprogress: function(e) {
					if (! e.lengthComputable) return;
					var percent = Math.floor(e.loaded / e.total * 100);
					document.title = 'PREFiX - 上传照片 (' + percent + '%)';
				},
				oncomplete: function(e) {
					$('#img-droparea').removeClass('loading');
					document.title = 'PREFiX - 上传照片';
				}
			}).next(function() {
				PREFiX.update();
				close();
			});
		});
	}
	function shorten(links, force) {
		var result = links || $status.val().trim().match(url_re) || [];
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
					setContent($status.val().trim().replace(link, short_url));
				}).
				error(function(e) {
					if (e && ! e.status) {
						ignored.push(link);
					}
				});
			dl.push(d);
		});
		if (dl.length) {
			$('#img-droparea').addClass('loading');
		}
		dl = Deferred.parallel(dl);
		dl = dl.next(function() {
			if ($status.val().trim().length <= 140) return;
			if (ignored.length) {
				return shorten(ignored, true);
			}
		}).next(function() {
			$('#img-droparea').removeClass('loading');
		});
		return dl;
	}
	function setContent(content) {
		$status.val(content.trim().replace(/\s+/g, ' '));
		$status.trigger('input');
	}

	var bg_win = chrome.extension.getBackgroundPage();
	var PREFiX = bg_win.PREFiX;
	var Ripple = bg_win.Ripple;
	var Deferred = bg_win.Deferred;
	var file;

	var $wrapper = $('#wrapper');

	$wrapper.on({
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

			file = e.dataTransfer.files[0];
			if (! file || ! isImage(file.type))
				return file = null;
			if (file.type === 'image/png') {
				fixTransparentPNG();
			}

			setTip();
			$('#tip').css('background-image', 'url("/images/photo.png")');
		}
	});

	var $file = $('#file');

	$file.on('change', function(e) {
		file = $file[0].files[0];
		if (! file || ! isImage(file.type))
			return file = null;
		if (file.type === 'image/png') {
			fixTransparentPNG();
		}
		setTip();
	});

	var $status = $('#status');

	$status.on({
		input: function(e) {
			var length = computeLength($status.val());
			$status.toggleClass('over', length > 140);
		},
		keydown: function(e) {
			if (e.keyCode === 13) {
				e.preventDefault();
			}
		},
		keyup: function(e) {
			if (e.keyCode == 13 && e.ctrlKey)
				submit();
		},
		dblclick: function(e) {
			submit();
		}
	});

	$(window).scroll(function(e) {
		$('body').scrollTop(0);
	}).on('paste', function(e) {
		var e = e.originalEvent;
		var items = e.clipboardData.items;
		if (! items.length) return;
		var f, i = 0;
		while (items[i]) {
			f = items[i].getAsFile();
			if (f && isImage(f.type))	{
				file = f;
				break;
			}
			i++;
		}
		if (! file) return;
		file.name = 'image-from-clipboard.' + file.type.replace('image/', '');
		if (file.type === 'image/png') {
			fixTransparentPNG();
		}
		setTip();
	});

	initFixSize(300, 150);
});

if (! localStorage.messageDisplayed) {
	var msg = '您可以直接将剪接板中的图像数据 (注意并不是图像文件)' +
		'粘贴至本窗口以更便捷地上传图片. PREFiX 将只在您' +
		'通过 "右键菜单 - 粘贴" 或按下 Ctrl + V 时' +
		'读取剪切板中的数据, 且不会擦除或写入内容到剪切板. '
	alert(msg);
	localStorage.messageDisplayed = true;
}