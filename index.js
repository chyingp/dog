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

  	
  	
  	// var request = require('request');
 //  	var options = {
 //  		method: 'GET',
 //  		url: url,
 //  		encoding: null
 //  	};
	// request(options, function (error, response, body) {
	// 	if(error || response.statusCode != 200){
 //  			console.log('网页获取失败！:' + error);
 //  			return;
 //  		}
 //  		callback(body);
	// });

	var gbk = require('gbk');
	gbk
	  .fetch(url)
	  .to('string', function(error, body){
	    if (error) {
	      console.log('网页获取失败！:' + error);
	      return;
	    }
	    callback(body);
	});
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

function getAbsoluteImgUrl(imgUrl, originalUrl){
	var url = require('url');
	var parsedUrlObj = url.parse(originalUrl);
	var ret = imgUrl;
	if(!ret.match(/^http/)){
		ret = parsedUrlObj.protocol + '//' + parsedUrlObj.host + url.resolve(parsedUrlObj.pathname, imgUrl);
	}
	ret = ret.replace('.thumb.jpg', '');
	return ret;
}

function getAbsoluteImgUrls(imgUrls, originalUrl){
	var url = require('url');
	var parsedUrlObj = url.parse(originalUrl);
	imgUrls = imgUrls.map(function(imgUrl){
		// var ret = imgUrl;
		// if(!ret.match(/^http/)){
		// 	ret = parsedUrlObj.protocol + '//' + parsedUrlObj.host + url.resolve(parsedUrlObj.pathname, imgUrl);
		// }
		// ret = ret.replace('.thumb.jpg', '');
		// return ret;
		return getAbsoluteImgUrl(imgUrl, originalUrl);
	});
	return imgUrls;
}

function outputResult(absoluteImgUrls){
	var child_process = require('child_process');
	var imgUrlFilename = 'img.' + Math.random() + '.txt';
	fs.writeFileSync(imgUrlFilename, absoluteImgUrls.join('\n'));
	
	// child_process.exec('aria2c -i img.txt -x 12', function(error, stdout, stderr){
	// 	if(error){
	// 		console.error('图片下载失败');
	// 		return;
	// 	}
	// 	console.log('图片下载成功!');
	// 	console.log(stdout);
	// });

	var child = child_process.spawn('aria2c', ['-i', imgUrlFilename, '-x', '12']);
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

function downloadImages(url){
	getWebPage(program.url, function(htmlContent){
		var imgUrls = getImgUrls( htmlContent );
		imgUrls = getAbsoluteImgUrls( imgUrls, program.url );
		outputResult(imgUrls);
	});
}

function getAlbumItems(url, callback){
	
	getWebPage(url, function(htmlContent){
		
		var $ = cheerio.load(htmlContent);
		var $albumItems = $('#tiles li');

		var items = [];

		$albumItems.each(function(index, ele){
			var $this = $(this);
			var $albumLink = $this.find('.attribution .inner a').eq(1);
			var albumImgTotal = $this.find('.content-album-picture-total span').text() - 0; 
			var albumImgSizePerPage = 50;	// 每页多少图片
			var albumImgTotalPage = Math.ceil(albumImgTotal/albumImgSizePerPage); 
			
			var albumUrl = $albumLink.prop('href');
			albumUrl = getAbsoluteImgUrl(albumUrl, url);

			$albumLink.find('span').remove();
			$albumLink.find('script').remove();
			
			var albumUrls = [];

			for(var i = 1; i <= albumImgTotalPage; i++){
				albumUrls.push(albumUrl + '&page=' + i);
			}
			
			var item = {
				name: $albumLink.text(),  // 专辑名
				urls: albumUrls,	// 专辑地址，不止一个页面
				intro: $this.find('.tbmu').text(),  // 简介
				total: albumImgTotal  // 张数
			};

			items.push(item);
		});

		// var filename = 'album.' + Math.random() + '.txt';
		// fs.writeFileSync(filename, JSON.stringify(items, null, 4));
		// return items;
		callback(items);
	});
}

function getAlbumItemsPromise(url){
	// TODO 异常处理
	var p = new Promise(function(resolve, reject){
		getAlbumItems(url, function(items){
			resolve(items);
		});
	});
	return p;
}

function flatten(array){
	var resultArray = array.reduce(function(ret, arrItem){
		ret = ret.concat(arrItem);
		return ret;
	}, []);
	return resultArray;
}

function getAlbumImgUrlsInOnePage(url, callback){
	console.log('专辑图片地址解析开始：' + url);
	getWebPage(url, function(htmlContent){
		
		var imgUrls = getImgUrls( htmlContent );
		imgUrls = getAbsoluteImgUrls( imgUrls, program.url );
		// outputResult(imgUrls);
		console.log('专辑图片地址解析完成：' + url);
		
		callback(imgUrls);
	});
}

/**
 * 获取专辑图片的地址
 * @param  {Array}   urls      专辑图片对应的网页地址，图片多的情况下，可能不止一个页面
 * @param  {Function} callback 回调函数，地址解析完成后调用
 * @return {[type]}            [description]
 */
function getAlbumImgUrls(urls, callback){
	var promises = urls.map(function(url){
		var p = new Promise(function(resolve, reject){
			getAlbumImgUrlsInOnePage(url, function(imgUrls){
				resolve(imgUrls);
			})
		});
	});
	Promise
		.all(promises)
		.then(function(args){
			var imgUrlsOfAllAlbums = flatten(args);

		});
}

function createImgLinkFile(item){
	var path = require('path');
	var linkFilePath = path.resolve(item.localPath, 'links.txt');
	var promises = item.urls.map(function(url){
		return new Promise(function(resolve, reject){
			getAlbumImgUrlsInOnePage(url, function(imgUrls){
				resolve(imgUrls);
			});		
		});
	});
	Promise
		.all(promises)
		.then(function(args){
			var imgUrlsInOneAlbum = flatten(args);
			fs.writeFileSync(linkFilePath, JSON.stringify(imgUrlsInOneAlbum, null, 4));

			console.log('创建专辑下载链接文件：' + linkFilePath);
		});
}

/**
 * 创建专辑存放的目录，包含一个readme文件，存放专辑相关信息
 * @param  {Object} item 专辑描述信息
 * @return {String}      目录对应的文件系统绝对路径
 */
function createAlbumDest(item){
	
	console.log(item.name);

	var url = require('url');
	var path = require('path');
	var urlParsedObj = url.parse(item.urls[0], true);
	var absoluteAlbumDest = path.resolve(urlParsedObj.query.id + '-' + item.name);
	var readmeFilePath = path.resolve(absoluteAlbumDest, './readme.txt');
	
	fs.mkdirSync(absoluteAlbumDest);
	fs.writeFileSync(readmeFilePath, JSON.stringify(item, null, 4));

	console.log('专辑目录创建：' + absoluteAlbumDest);

	return absoluteAlbumDest;
}

/**
 * 获取所有专辑名称
 * @param  {Array} urls 含有图片专辑的网页地址，比如 ['http://xxx.xxx.com/xx']
 * @return {Array}      专辑相关信息，格式为 [{name: 'xx', urls: ['xx', 'xx'], intro: 'xx', total: xx}]
 */
function getAllAlbumItems(urls, callback){

	console.log('获取专辑信息开始：');

	var promises = urls.map(function(url){
		return getAlbumItemsPromise(url);
	});
	
	Promise
		.all(promises)
		.then(function(args){
			var allAlbumItems = flatten(args);

			console.log('获取专辑信息结束，总数为: ' + allAlbumItems.length);

			callback(allAlbumItems);
		});
}

function run(){
	// if(!program.url){
	// 	console.log('请输入网页地址');
	// 	return;
	// }
	
	// 专辑所在网页的地址（专辑过多，存在分页的情况）
	var webPageUrls = [
		'http://www.zhuamei.net/home.php?mod=space&do=album&catid=10&view=all&page=1',
		'http://www.zhuamei.net/home.php?mod=space&do=album&catid=10&view=all&page=2'
	];

	console.log('获取专辑地址开始！');
	getAllAlbumItems(webPageUrls, function(items){
		
		fs.writeFileSync('./album.json', JSON.stringify(items, null, 4));
		console.log('获取专辑地址结束！');


		items.forEach(function(item){
			var albumDestPath = createAlbumDest(item);  // 专辑所在地址(本地文件系统)
			item.localPath = albumDestPath;			
		
			// createImgLinkFile(item);
		});
		createImgLinkFile(items[0]);
		// getAlbumImgUrls(items);
	});
}

run();