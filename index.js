var program = require('commander');
var cheerio = require('cheerio');
var fs = require('fs');
var URL = require('url');
var child_process = require('child_process');
var imgTypes = ['.jpg', '.jpeg', '.png', '.bmp'];

program
  .version('0.0.1')
  .option('-u, --url [value]', '网页地址')
  .option('-p, --page [value]', '网页个数')
  .option('-i, --id [value]', '专辑id')
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
	var $imgs = $('#tiles img');
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
		imgUrls = getAbsoluteImgUrls( imgUrls,  url);
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

/**
 * 将专辑对应的图片地址链接，写到 links.txt 里，后续给到下载工具使用
 * @param  {Object} item 专辑配置信息
 * @param {Function} callback 执行完成的回调
 */
function createImgLinkFile(item, callback){
	var path = require('path');
	var linkFilePath = path.resolve(item.localPath, 'links.txt');

	console.log('创建专辑下载链接文件开始：' + linkFilePath);

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
			fs.writeFileSync(linkFilePath, imgUrlsInOneAlbum.join('\n'));

			console.log('创建专辑下载链接文件结束：' + linkFilePath);

			callback && callback(imgUrlsInOneAlbum, linkFilePath);
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

	item.localPath = absoluteAlbumDest;
	
	if(!fs.existsSync(absoluteAlbumDest)){
		fs.mkdirSync(absoluteAlbumDest);	
	}
	
	fs.writeFileSync(readmeFilePath, JSON.stringify(item, null, 4));

	console.log('专辑目录创建：' + absoluteAlbumDest);

	return absoluteAlbumDest;
}

/**
 * 获取所有专辑的信息
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


function test(){
	var items = [
		{
		    "name": "[TuiGirl推女郎] 2015.11.14 No.63 王依萌~2",
		    "urls": [
		        "http://www.zhuamei.net/home.php?mod=space&uid=3&do=album&id=939&page=1"
		    ],
		    "intro": "美女语录：王依萌~2\r\n明星模特\r\n170cm 92-61-90 鞋码：38\r\n萌颜巨乳，高大白美\r\n爱纠结爱拍照的萌妞\r\n《推女郎》精美影响刊物第 63 期 2015.11.14\r\n拍摄地：三亚-半山半岛洲际 摄影师：推女郎特约\r\n   ",
		    "total": 40,
		    "localPath": "/private/tmp/album/939-[TuiGirl推女郎] 2015.11.14 No.63 王依萌~2"
		},
		{
		    "name": "[TuiGirl推女郎] 2015.08.17 No.58 松果儿",
		    "urls": [
		        "http://www.zhuamei.net/home.php?mod=space&uid=2&do=album&id=904&page=1"
		    ],
		    "intro": "美女语录：新锐模特\r\n168cm 92-60-90 鞋码：36\r\n袅娜娉婷，惹火尤物\r\n艺术系硕士，网红界女神\r\n《推女郎》精美影像刊物第58期\r\n拍摄地：北京 摄影师：推女郎特约",
		    "total": 38,
		    "localPath": "/private/tmp/album/904-[TuiGirl推女郎] 2015.08.17 No.58 松果儿"
		},
		{
		    "name": "[TuiGirl推女郎] 未流出版权图@丛桃桃@辛楠_兔兔李颖 ...",
		    "urls": [
		        "http://www.zhuamei.net/home.php?mod=space&uid=11279&do=album&id=519&page=1"
		    ],
		    "intro": "美女语录：命运从来都是峰回路转的，因为有了曲折和故事，我们的生命才会精彩。有时候，哭泣，不是屈服；后退，不是认输；放手，不是放弃。摔倒了又怎样，至少我们还年轻！别妄想着倒带，这是生活，不是电影。人只要生活在这个世界上，就有很多烦恼，痛苦或是快乐，取决于你的内心。",
		    "total": 29,
		    "localPath": "/private/tmp/album/519-[TuiGirl推女郎] 未流出版权图@丛桃桃@辛楠_兔兔李颖 ..."
		},
		{
		    "name": "[TuiGirl推女郎]2014.03.11 第24期 于大小姐",
		    "urls": [
		        "http://www.zhuamei.net/home.php?mod=space&uid=4&do=album&id=501&page=1",
		        "http://www.zhuamei.net/home.php?mod=space&uid=4&do=album&id=501&page=2"
		    ],
		    "intro": "美女语录：相信美好，相信良善，为人，无悔就是道，无怨就是德。人生，所有的事情，哪能事事如意，样样顺心，何况，痛苦也不是人生的全部，伤过，哭过，日子还是得过。",
		    "total": 55,
		    "localPath": "/private/tmp/album/501-[TuiGirl推女郎]2014.03.11 第24期 于大小姐"
		}		
	];

	items.forEach(function(item){
		createImgLinkFile(item);
	});
	
}

/**
 * 下载图片，图片存放的位置，在 linkeFilePath 所在目录的 images 目录下
 * @param  {String}   linkeFilePath 图片下载链接的地址（本地文件系统绝对路径）
 * @param  {Function} callback      下载完成的回调
 * @return {[type]}                 [description]
 */
function downloadImagesWithLinkFile(linkeFilePath, callback){
	var child_process = require('child_process');
	var path = require('path');
	var dirname = path.dirname(linkeFilePath);
	
	// fs.writeFileSync(imgUrlFilename, absoluteImgUrls.join('\n'));
	
	console.log('开始下载图片：' + dirname);

	child_process.exec('aria2c -i links.txt -x 16 -d ./images', {cwd: dirname}, function(error, stdout, stderr){
		if(error){
			console.error('图片下载失败：' + dirname);
			return;
		}
		console.log('图片下载成功：' + dirname);
		callback && callback();
	});
}

function processLinkFile(){
	var glob = require('glob');
	var files = glob.sync('**/links.txt');
	
	// files = files.slice(2);
	// files.forEach(function(file){
	// 	console.log('处理开始：' + file);
	// 	var content = fs.readFileSync(file, {encoding: 'utf8'});
	// 	var array = JSON.parse(content);
	// 	var str = array.join('\n');
	// 	fs.writeFileSync(file, str);
	// 	console.log('处理结束：' + file);
	// });

	// var file = files[2];
	// downloadImagesWithLinkFile(file);

	files = files.slice(3);
	
	// files.forEach(function(file){
	// 	console.log('处理开始：' + file);
	// 	var content = fs.readFileSync(file, {encoding: 'utf8'});
	// 	var array = JSON.parse(content);
	// 	var str = array.join('\n');
	// 	fs.writeFileSync(file, str);
	// 	console.log('处理结束：' + file);
	// });
	
	download(files, 0);
}

function download(files, index){
	downloadImagesWithLinkFile(files[index], function(){
		if(index<(files.length-1)){
			download(files, index+1);
		}
	});
}

/**
 * 通过用户输入的参数，包括url、catid、page，获取需要处理的页面（专辑的集合页，每个分类可能有多个页面）
 * @param  {String} originalUrl 用户随便拷贝的某个专辑的页面地址
 * @param  {String} catid       专辑的分类id
 * @param  {Number} page        专辑分多少页，人工输入，减少页面分析的麻烦
 * @return {Array}             页面地址的数组
 */
function getAlbumPageUrls(originalUrl, catid, page){
	
	var url = require('url');
	var webPageUrls = [];
	var parsedUrlObj = url.parse(originalUrl, true);
	var query = parsedUrlObj.query;
	var searchStringList = [];
	var value;

	originalUrl = originalUrl.match(/[^\?]+/)[0] + '?';	// 过滤掉 search string

	query.catid = catid;  // 修改专辑id
	delete query.page;  // page 会自动补全，这里不需要


	for(var key in query){
		searchStringList.push(key + '=' + query[key])
	}

	originalUrl += searchStringList.join('&');

	for(var i = 1; i <= page; i++){
		webPageUrls.push(originalUrl + '&page=' + i);
	}

	return webPageUrls;
}

function run(){
	
	if(!program.url){
		console.error('请输入网页地址');
		return;
	}

	// 专辑id
	if(!program.id){
		console.error('请输入专辑地址');
		return;
	}

	// 默认页码
	var page = program.page;
	if(!page){
		page = 1;
	}

	// 专辑所在网页的地址（专辑过多，存在分页的情况）
	var webPageUrls = getAlbumPageUrls(program.url, program.id, page);
	
	console.log(webPageUrls);

	console.log('获取专辑信息开始！');
	
	getAllAlbumItems(webPageUrls, function(items){
		
		console.log('获取专辑信息结束！');

		console.log('创建专辑目录开始！');

		items.forEach(function(item){
			var albumDestPath = createAlbumDest(item);  // 专辑所在地址(本地文件系统)
		});

		console.log('创建专辑目录结束！');

		console.log('创建专辑下载链接文件开始！');
		
		items.forEach(function(item){
			// 创建图片链接文件
			createImgLinkFile(item, function(imgUrlsInOneAlbum, linkFilePath){
				downloadImagesWithLinkFile(linkFilePath);
			});	
		});

		console.log('创建专辑下载链接文件结束！');

		console.log('专辑信息写入album.json开始！');
		
		fs.writeFileSync('./album.json', JSON.stringify(items, null, 4));  // 将专辑相关信息写到文件里
		
		console.log('专辑信息写入album.json结束！');
	});
}

run();

// 各种统计信息，如
// 1、专辑网页多少个解析成功、失败
// 2、相册网页多少个即系成功、失败
// 3、图片多少个下载成功、失败