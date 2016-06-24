var program = require('commander');
var cheerio = require('cheerio');
var fs = require('fs');
var URL = require('url');
var child_process = require('child_process');
var imgTypes = ['.jpg', '.jpeg', '.png', '.bmp'];

program
  .version('0.0.1')
  .option('-u, --url [value]', '网页地址')
  .parse(process.argv);

function getWebPage(url, callback) {
  	var command = 'curl ' + url;

  	// 为什么这样就不行捏。。。直接在控制台下面运行 curl xxx 是可以的
  	// TODO 待探究
  	// child_process.exec(command, function(error, stdout, stderr){
  	// 	if(error){
  	// 		console.log('网页获取失败！:' + error);
  	// 		return;
  	// 	}
  	// 	fs.writeFileSync('./fuck.html', stdout);
  	// 	console.log(stdout);
  	// 	callback(stdout);
  	// });

  	var request = require('request');
	request(url, function (error, response, body) {
		if(error || response.statusCode != 200){
  			console.log('网页获取失败！:' + error);
  			return;
  		}
  		callback(body);
	})
}

function getImgUrls(htmlContent){
	var $ = cheerio.load(htmlContent);
	var $imgs = $('#container img');
	var items = [];
	$imgs.each(function(index, ele){
		var src = $(this).prop('src');
		var isImg = imgTypes.some(function(type){
			return src.indexOf(type)!=-1;
		});
		isImg && items.push( src );
	});
	return items;
}

function getAbsoluteImgUrl(imgUrls, originalUrl){
	var url = require('url');
	var parsedUrlObj = url.parse(originalUrl);
	imgUrls = imgUrls.map(function(imgUrl){
		var ret = imgUrl;
		if(!ret.match(/^http/)){
			ret = parsedUrlObj.protocol + '//' + parsedUrlObj.host + url.resolve(parsedUrlObj.pathname, imgUrl);
		}
		ret = ret.replace('.thumb.jpg', '');
		return ret;
	});
	return imgUrls;
}

function outputResult(absoluteImgUrls){
	var child_process = require('child_process');
	fs.writeFileSync('img.txt', absoluteImgUrls.join('\n'));
	// child_process.exec('aria2c -i img.txt -x 12', function(error, stdout, stderr){
	// 	if(error){
	// 		console.error('图片下载失败');
	// 		return;
	// 	}
	// 	console.log('图片下载成功!');
	// 	console.log(stdout);
	// });

	var child = child_process.spawn('aria2c', ['-i', 'img.txt', '-x', '12']);
	child.stdout.on('data', function(data){
		console.log(data);
	});
	child.stderr.on('data', function(data){
		console.log(data);
	});
	child.on('close', function(code){
		console.log('child process exited with code ' + code);
	});
}

function run(){
	if(!program.url){
		console.log('请输入网页地址');
		return;
	}

	getWebPage(program.url, function(htmlContent){
		var imgUrls = getImgUrls( htmlContent );
		imgUrls = getAbsoluteImgUrl( imgUrls, program.url );
		outputResult(imgUrls);
	});
}

run();