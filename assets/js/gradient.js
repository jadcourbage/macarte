function getColor(res, scaleMin, scaleMax){

	var minHex = '#F1F7FE';
	var maxHex = '#07075F';

	if((res < scaleMin) || (res > scaleMax)){
		return '#FFFFFF';
	} 
	else
	{
	minRgb = hexToRgb(minHex);
	maxRgb = hexToRgb(maxHex);

	minR = parseInt(minRgb.substring(0,3),10);
	minG = parseInt(minRgb.substring(3,6),10);
	minB = parseInt(minRgb.substring(6,9),10);
	maxR = parseInt(maxRgb.substring(0,3),10);
	maxG = parseInt(maxRgb.substring(3,6),10);
	maxB = parseInt(maxRgb.substring(6,9),10);

	r = Math.round(minR + ((maxR - minR)/(scaleMax - scaleMin)) * (res- scaleMin));
	g = Math.round(minG + ((maxG - minG)/(scaleMax - scaleMin)) * (res- scaleMin));
	b = Math.round(minB + ((maxB - minB)/(scaleMax - scaleMin)) * (res- scaleMin));

	hex = '#' + this.byte2Hex(r) + this.byte2Hex(g) + this.byte2Hex(b);
	return(hex);
	}
}



function rgb2hex(rgb)
{

  r = rgb.substring(0,3);
  g = rgb.substring(3,6);
  b = rgb.substring(6,9);

  return '#' + this.byte2Hex(r) + this.byte2Hex(g) + this.byte2Hex(b);
}

function byte2Hex (n)
{
  var nybHexString = "0123456789ABCDEF";
  return String(nybHexString.substr((n >> 4) & 0x0F,1)) + nybHexString.substr(n & 0x0F,1);
}

function hexToRgb(h)
{
    var r = parseInt((cutHex(h)).substring(0,2),16), g = parseInt((cutHex(h)).substring(2,4),16), b = parseInt((cutHex(h)).substring(4,6),16)
    return paddy(r,3)+''+paddy(g,3)+''+paddy(b,3);
}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

function paddy(n, p, c) {
    var pad_char = typeof c !== 'undefined' ? c : '0';
    var pad = new Array(1 + p).join(pad_char);
    return (pad + n).slice(-pad.length);
}