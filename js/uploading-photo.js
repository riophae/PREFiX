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
	}

	var bg_win = chrome.extension.getBackgroundPage();
	var PREFiX = bg_win.PREFiX;
	var Ripple = bg_win.Ripple;
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
			var length = $status.val().trim().length;
			$status.toggleClass('over', length > 140);
		},
		keyup: function(e) {
			if (e.which == 13 && e.ctrlKey)
				submit();
		},
		dblclick: function(e) {
			submit();
		}
	});

	$(window).scroll(function(e) {
		$('body').scrollTop(0);
	});

	var fixing_size = false;
	onresize = _.throttle(function() {
		if (fixing_size) return;
		fixing_size = true;
		var de = document.documentElement;
		resizeTo(316, 192);
		setTimeout(function() {
			resizeBy(300 - de.clientWidth, 150 - de.clientHeight);
			setTimeout(function() {
				fixing_size = false;
			}, 200);
		}, 100);
	}, 100);
	onresize();
});