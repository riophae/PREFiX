var http_s_url = "https?://(((((([0-9a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([0-9a-zA-Z]))\\.)*(([a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([a-zA-Z])))|([0-9]+)\\.([0-9]+)\\.([0-9]+)\\.([0-9]+))(:([0-9]+)){0,1})(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*)(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*))*(\\?(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|:|@|&|=)*))?)?(#[0-9a-zA-Z-=#!/\|:\+]*)?";
var ftp_url = "ftp://(((((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|\\?|&|=)*)(:(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|;|\\?|&|=)*)){0,1}@){0,1}(((((([0-9a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([0-9a-zA-Z]))\\.)*(([a-zA-Z])(([0-9a-zA-Z])|-)*([0-9a-zA-Z])|([a-zA-Z])))|([0-9]+)\\.([0-9]+)\\.([0-9]+)\\.([0-9]+))(:([0-9]+)){0,1}))(/((((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|\\?|:|@|&|=)*)(/(((([0-9a-zA-Z]|(\\$|-|_|\\.|\\+)|(!|\\*|'|\\(|\\)|,))|(%([0-9a-fA-F])([0-9a-fA-F])))|\\?|:|@|&|=)*))*)(;type=(A|I|D|a|i|d))?)?";
var url_patt = '(' + http_s_url + ')|(' + ftp_url + ')';
var url_re = new RegExp(url_patt, 'g');
var url_max_len = 35;
var url_placeholder = 'http://is.gd/xxxxxx';

function computeLength(text) {
	return text.trim().replace(url_re, function(url) {
		return url.length > url_max_len ? url_placeholder : url;
	}).length;
}