/*

made by qwazwsx/thisisatesttoseehowl

https://github.com/qwazwsx/c4-cams

.


*/


/* ########################################### */
/* REQUIREMENTS AND VARS */
var MongoClient = require('mongodb').MongoClient;		//mongoDB client for databases
//var mongoUrl = "mongodb://localhost:27017/";			//location of mongoDB server
var mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017";	//location of mongoDB server
var uuidv4 = require('uuid/v4');						//generates uuid's for documents
var decay = require('decay');							//get decay for sorting by up&down votes
var wilsonScore = decay.wilsonScore();					//use wilson type of scoring (reddit comments "best" sorting)
var sortBy = require('sort-array');						//helps when sorting arrays of posts
var express = require('express');						//get express for API
var RateLimit = require('express-rate-limit');			//get ratelimiter for express
var app = express();									//get express server
var http = require('http');								//http for checking if URLS are working
var { URL } = require('url');							//parse URLS
var server = require('http').Server(app);			 	//server for socket.io
var io = require('socket.io')(server);					//socket.io
var isOnline = require('is-online');					//check if server is connected to the internet
var views = [];											//tracks users for view counts
var reports = [];										//tracks users for reports
var topPosts = []										//list of sorted posts, updates every 10 min
var port = process.env.PORT || 3000;        			// set our port (defaults to 8081 if env var isnt set)
var dbName = process.env.dbName || "c4-cams";
var db;													//database connection
var dbo;
var time = 0;
//incremented on every dead url, if it gets too high check if the server has a connection
var offlineCheck = 0;


var socketConnections = [];

//setup port
server.listen(port, function(){
  console.log('listening on *:' + port);
});


io.on('connection', function(socket){

	//add connection to array
	socketConnections.push({ id: socket.id, ip: socket.conn.remoteAddress });

	socket.on('disconnect', function() {

		//remove connection from array
		var index = socketConnections.findIndex(function(x) { return x.id === socket.id});
		if (index > -1) {
		    socketConnections.splice(index, 1);
		}
	});


})



//connect to database
MongoClient.connect(mongoUrl, function(err, connection) {

	console.log('[INFO] CONNECTING TO DB')
	if (err){
		console.log('error connecting to db');
		throw err;
		}

	//set database object to global var
	db = connection;
	dbo = db.db(dbName);



	sort();
	registerApiRoutes();
});


//catch shutdown signal and disconnect from DB
//its JS why do I have to write code to support different platforms?
//https://stackoverflow.com/a/14861513/6088533
if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

process.on("SIGINT", function () {
  //graceful shutdown
  db.close().then(function() {
  	console.log('got shutdown signal, closing database connection');
  	process.exit();
  });
  
});



/* ########################################### */
/* SERVER SETUP */

//enable ratelimiting
app.enable('trust proxy');
var apiLimiter = new RateLimit({
  windowMs: 60*1000, // 1 minute
  max: 120,
  delayMs: 0 // disabled
});
app.use('/c4-cams/api/', apiLimiter);

var apiLimiterHard = new RateLimit({
  windowMs: 10*60*1000, // 1 minute
  max: 3,
  delayMs: 0, // disabled
  skipFailedRequests: true
});
app.use('/c4-cams/api/add', apiLimiterHard);



//re-calculate top posts every 5 min
setInterval(function(){
	sort();
},5*60*1000);

//reset "rate-limiting" for views and reports
setInterval(function(){
	views = [];
	reports = [];
},30*60*1000);


/* ########################################### */
/* API */


//func containing all API endpoints and their code
//not properly tabbed on purpose, no need to
function registerApiRoutes(){

	
	
	
//################################################
//add camera to list
app.post('/c4-cams/api/add', function (req, res) {
	addCamera(req.query.url).then(function(data){
		if (data.error !== undefined){
			//if url isnt valid or already exists
			res.status(400).send(data);
		}else{
			res.send(data);
		}
	});
});





//################################################
//sends ordered list of posts
app.get('/c4-cams/api/top', function (req, res) {
	//return cached array
	res.send(topPosts);
});


//################################################
//responds pong
//delay: ms to delay response
app.get('/c4-cams/api/ping', function (req, res) {
	setTimeout(function(){res.send('pong')},req.query.delay);
});



//################################################
//query params
//type: 0 - search by camera object uuid, 1 - search by short url, 2 - search by full url
//query: what you are seaching for
app.post('/c4-cams/api/find', function (req, res) {

	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress;
	var results = 'unset';

	//if query isnt empty
	if (req.query.query !== undefined){
	
		//if searching by uuid
		if (req.query.type == 0){
			search('cams',2,{ _id: req.query.query}).then(function(send){
				results = send;
				respond();
			});
		}else{
			//if searching by short url
			if (req.query.type == 1){
				search('cams',2,{ url: req.query.query }).then(function(send){
					results = send;
					respond();
				});
			}else{
				//if searching by full url
				if (req.query.type == 2){
					search('cams',2,{ urlFull: req.query.query }).then(function(send){
						results = send;
						respond();
						});
				}else{
					//if type is invalid
					res.status(400).send({error: 'parameter \'type\' not set correctly', code: 0});
					results = 'error'
				}
			}
		}
	
		function respond(){
			//if results diddnt error
			if (results !== 'error' ){
				//if nothing was found
				if (results[0] == undefined){
					res.status(400).send({message: 'no cams found', code: 2});
				}else{
					//if results were found

					load(results[0].urlFull,ip).then(function(data) {
						res.send(data)
					})

				}
			}
		}


	}else{
		//if query is empty
		res.status(400).send({error: 'parameter \'query\' not set correctly', code: 1});
	}
});



//################################################
//query params
//uuid
//errors
//0 - you have already reported this camera


app.post('/c4-cams/api/report', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	report(req.query.uuid,ip,true).then(function(send){
		if (send.error !== undefined){
			res.status(400).send(send);
		}else{
			res.send(send);
		}
		
	});

});



//################################################
//query params
//uuid: uuid of a camera object
//errors
//0 - uuid doesnt exist
//1 - user already upvoted
app.post('/c4-cams/api/upvote', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	upvote(req.query.uuid,ip).then(function(data){

		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
	});
});


app.post('/c4-cams/api/unvote', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;
	unvote(req.query.uuid,ip).then(function(data){

		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
	});
});




//################################################
//query params
//uuid: uuid of a camera object
//errors
//0 - uuid doesnt exist
//1 - user already upvoted
app.post('/c4-cams/api/downvote', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	downvote(req.query.uuid,ip).then(function(data){
		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
	});
});



//################################################
//returns a random camera object
app.get('/c4-cams/api/random', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress;
	
	random(ip,req.query.id).then(function(data) {
		res.send(data);
	});
	
});
	
}

//use routes
app.use('/c4-cams/', express.static('static/random'));
app.use('/c4-cams/perma', express.static('static/perma'));
app.use('/c4-cams/random', express.static('static/random'));
app.use('/c4-cams/top', express.static('static/top'));
app.use('/c4-cams', express.static('static'));

app.use('/', express.static('static/random'));
app.use('/perma', express.static('static/perma'));
app.use('/random', express.static('static/random'));
app.use('/top', express.static('static/top'));
app.use('/info', express.static('static/info'));




/* ########################################### */
/* FUNCTIONS */


//get a random camera from the database, check that is works, and make a document for it
//ip: ip of requester
//socketId: optional, improves socketIO messages
function random(ip,socketId) {

	return new Promise(function(resolve,reject){

	//get random document from database
	dbo.collection('camera_list').aggregate([{ $sample: { size: 1 } }]).toArray(function(err, cameraObj) {
		if (err) throw err;
		
		//check if url can be reached
		checkUrl(cameraObj[0].url).then(function(urlCheck){

			//if the url returns an error
			if (urlCheck.error){
				//console.log('[INFO] url dead '+ cameraObj[0].url);

				//if given socketId is actually connected
				if (socketId !== undefined){
					if (io.sockets.connected[socketId] !== undefined){
						//emit message directly to user
						io.sockets.connected[socketId].emit('fail', {error: 'dead url', code: '0', urlFull: cameraObj[0].url, url: cameraObj[0].url});
					}
					//io.clients[socketId].send({error: 'dead url', code: '0', url: cameraObj[0].url})
				}


				//add error flag to doc
				update('camera_list',cameraObj[0],{ $inc: { errors: 1 } } ).then(function(data) {
					
					//if there are 2 or more errors
					if (data.errors >= 2){
						//remove that cam from the list
						remove('camera_list',{url: cameraObj[0].url}).then(function(err,res) {
							console.log('[INFO] removed cam from list '+cameraObj[0].url)
							console.log(socketId)
						});
					}
				})


				//try again with another url
				random(ip,socketId).then(function(data) {
					resolve(data)
				});
			}else{
				//if url returns OK
				load(cameraObj[0].url,ip).then(function(data){

					var tempData = data;
					tempData.time = urlCheck.time;
					resolve(data);
				});
			};
		});
	});

	});
}






//returns status code of given url
//if error response will have error set to true
function checkUrl(url){

	return new Promise(function(resolve,reject){

	//setup options
	var options = new URL(url);
	options.method = 'HEAD'

	//make the request
	var beforeTime = time;
	var req = http.request(options, function(r) {
			//return the response code on no errors
			if (r.statusCode == 200){
				var totalTime = time - beforeTime
				
				resolve({success: true, code: r.statusCode, time: totalTime });
			}else{
				resolve({ error: true, message: 'request succeeded but response code was non-200, response code:'+r.statusCode });
			}
		});
	req.on('error', function(err) {
		//on error return error flag
		offlineCheck++;
		if (offlineCheck >= 15){
			isOnline().then(online => {

				if (!online){
					//server has no connection
					process.exit(1);
				}else{
					offlineCheck = 0;
				}
				//=> true
			});
		}
	 	resolve({ error: true, message: err });
		});
	req.setTimeout(3000, function() {
		//timeout and return error flag
		offlineCheck++;
		if (offlineCheck >= 15){
			isOnline().then(online => {

				if (!online){
					//server has no connection
					process.exit(1);
				}else{
					offlineCheck = 0;
				}
				//=> true
			});
		}
		req.abort();
		resolve({ error: true, message: 'timeout' });
	});
	req.end();

	});
}


setInterval(function() {
	time = time + 100;
},100)

//add a camera to the list
//url: full url?
function addCamera(url){
	
	return new Promise(function(resolve,reject){

	if (url == undefined){
		resolve({error: 'url not set', code: 2});
	}else{
		//search for the given url
		search('camera_list',2,{url: url}).then(function(data){
			
			//if it doesnt already exist
			if (data == ''){
			
				//if it is a link
				if (url.indexOf('http') !== -1){
					checkUrl(url).then(function(urlCheck){
						if (urlCheck.error == undefined){

							//add it to the list
							add('camera_list',{url: url}).then(function(){
								//create a doc for it
								createDoc(url).then(function(data){
									//return OK
									resolve({uuid: data, response: 'OK', code: 200});
								});

							});

						}else{
							resolve({error: 'url is either not reachable to the web or not valid', code: 2});
						}


					})

				}else{
					resolve({error: 'not valid url', code: 0});

				}
		
			}else{
				//if url already exists
				resolve({error: 'url already exists', code: 1});
			}
		});
	}


	});
	
}


//gets all data from database and sorts using wilson type sorting
//read more here: https://github.com/clux/decay#1-wilson-score
//sets var sortedPosts
//sortedPosts gets returned when the top list is needed
//this function should be ran at an interval 5min?? 10 min? 30min?
var unsortedPosts = [];
var score;
var posts;
function sort(){
	
	return new Promise(function(resolve,reject){

		//get all cams
		console.log
		dbo.collection('cams').find({}).toArray(function(err, data) {
			if (err) throw err;
			
			unsortedPosts = [];
			
			//loop over all cams and score them
			for (var i = 0; i < data.length; i++){
				
				//calc score with decay
				score = wilsonScore(data[i].upvotes, data[i].downvotes);
				
				//add this to an array
				unsortedPosts[i] = [];
				unsortedPosts[i].score = score;
				unsortedPosts[i].data = data[i];
				
				
			}
			
			//sort scored posts
			posts = sortBy(unsortedPosts,'score').reverse();
			sortedPosts = [];
			
			//remove score from data
			for (var i = 0; i < posts.length; i++){
				
				sortedPosts[i] = posts[i].data;
				
				
			}
			
			//only get top 50 results
			topPosts = sortedPosts.slice(0, 50);;
			
			console.log('[INFO] top posts calculated')
			
			resolve();
			
			
			//console.log(sortedPosts);
			
			
		});	
	
	});
	
}



//report a post as dead
//uuid: uuid of cam
//ip: ip of requester
function report(uuid,ip,outside){
	
	return new Promise(function(resolve,reject){

	//search for the referenced post
	search('cams', 2, { _id: uuid}).then(function(data){


		if (data == ''){
			//if the post doesnt exist
			resolve({error: 'camera not found', code: 1});
		}else{
			//if it exists

			//if report isnt already in temp array
			if (reports[uuid] == undefined){
				reports[uuid] = [];
			};
			
			//if the ip hasnt already reported this post 
			if (reports[uuid].indexOf(ip) == -1){

				//if there are 2 or more errors
				console.log(data[0].reports)
				if (data[0].reports >= 2){
					//remove that cam from the list
					remove('camera_list',{ _id:uuid }).then(function(err,res) {
						console.log('[INFO] removed cam from list '+data[0].url)
					});
				}else{
					//if there are less than 2 reports

					//if outside report flag is set only report one fith the amount
					if (outside == true){
						update('cams', { _id:uuid }, { $inc: { reports: 0.2 } } );
						console.log('[INFO] external report')
					}else{
						//if report comes internally report with more weight
						update('cams', { _id:uuid }, { $inc: { reports: 1 } } );
					}
				
				}

				//keep track of reports
				reports[uuid].push(ip);
				//return
				resolve({message:'OK'});
			}else{
				resolve({error: 'you have already reported this camera', code: 0});
				
			}
		}
	});


	});	

			
}


//upvote a post
//uuid: uuid of post
//ip: ip of requester
function upvote(uuid,ip){
	
	return new Promise(function(resolve,reject){
	
	
	//search in vote records for upvotes on this ip on this post
	search('votes', 2, { _id: uuid}).then(function(data){

		//if uuid doesnt exist
		if (data == ''){
			resolve({error: 'uuid doesnt exist', code: 0});
		}else{
	
	
			//if user diddnt upvote the post already
			if (data[0].upvoters.indexOf(ip) == -1){
				
				//add upvote
				update('cams', { _id: uuid }, { $inc: {upvotes: 1} } );
				//add ip to upvoters list
				update('votes', { _id: uuid }, { $push: {upvoters: ip} } );
				
				//if user downvoted before
				if (data[0].downvoters.indexOf(ip) !== -1){
					//take away the downvote
					update('cams', { _id: uuid }, { $inc: {downvotes: -1} } );
					//remove ip from downvoters list
					update('votes', { _id: uuid }, { $pull: {downvoters: ip} } );
				};
			
				resolve({message:'OK'});
				
			}else{
				resolve({error: 'user already upvoted', code: 1});
			};
		
		};
	});	
	
	});
}



//downvote a post
//uuid: uuid of post
//ip: ip of requester
function downvote(uuid,ip){
	
	return new Promise(function(resolve,reject){

	
	
	//search in vote records for upvotes on this ip on this post
	search('votes', 2, { _id: uuid}).then(function(data){

		//if uuid doesnt exist
		if (data == ''){
			resolve({error: 'uuid doesnt exist', code: 0});
		}else{
			
			//if user diddnt downvote the post already
			if (data[0].downvoters.indexOf(ip) == -1){
				
				//add downvote
				update('cams', { _id: uuid }, { $inc: {downvotes: 1} } );
				//add ip to downvoters list
				update('votes', { _id: uuid }, { $push: {downvoters: ip} } );
				
				//if user upvoted before
				if (data[0].upvoters.indexOf(ip) !== -1){
					//take away the upvote
					update('cams', { _id: uuid }, { $inc: {upvotes: -1} } );
					//remove ip from upvoters list
					update('votes', { _id: uuid }, { $pull: {upvoters: ip} } );
				};
			
				resolve({message:'OK'});
				
			}else{
				resolve({error: 'user already downvoted', code: 1});
			};
		};
	});	
	
	});
}


function unvote(uuid,ip){

		return new Promise(function(resolve,reject){
	
	
		//search in vote records for votes on this ip on this post
		search('votes', 2, { _id: uuid}).then(function(data){

			if (data == ''){
				resolve({error: 'uuid not valid', code: 1})
			}else{

			//if they downvoted before
			if (data[0].downvoters.indexOf(ip) !== -1){
				//take away the downvote
				update('cams', { _id: uuid }, { $inc: {downvotes: -1} } );
				//remove ip from downvoters list
				update('votes', { _id: uuid }, { $pull: {downvoters: ip} } );
			};

			//if they upvoted before
			if (data[0].upvoters.indexOf(ip) !== -1){
				//take away the upvote
				update('cams', { _id: uuid }, { $inc: {upvotes: -1} } );
				//remove ip from upvoters list
				update('votes', { _id: uuid }, { $pull: {upvoters: ip} } );
			};

			resolve({message:'OK'})
		}


		});

	});

}


//to be called on page load
//url: full url
//ip: ip of requester
function load(url,ip){

	
	return new Promise(function(resolve,reject){
	
		//check if url already is in database
		search('cams',0,url).then(function(searchData){
			if (searchData == ''){
				//if url isnt in the database add it and restart the function
				console.log('[INFO] creating page ' + url)
				createDoc(url).then(function(){
					load(url,ip).then(function(data){

							resolve(data);

					});
				})
			}else{
				//if the camera exists in the database add view count
				//console.log('[INFO] PAGE EXISTS');			
			
				//if viewers array for this cam doesnt exist make it
				if (views[searchData[0]._id] == undefined){
					views[searchData[0]._id] = [];
				};
				
				//if ip havent already viewed push ip to array and count view
				if (views[searchData[0]._id].indexOf(ip) == -1){
					views[searchData[0]._id].push(ip)
					
					//add view to the cam
					update('cams', { _id: searchData[0]._id }, { $inc: { views: 1 } })
					
					
				};
				
				//check if IP has voted before
				checkVote(searchData[0]._id, ip).then(function(vote) {

					//add that result to data
					searchData[0].vote = vote;


					resolve(searchData[0]);

				});

				
			};
			
			
		}).catch(function(err){
			throw err;
		});
		
	});
		
};


function checkVote(uuid,ip){

	return new Promise(function(resolve,reject){

	search('votes', 2, { _id: uuid}).then(function(data){
		//if they downvoted before

		if (data[0].downvoters.indexOf(ip) !== -1){
			resolve('downvote');
		}else{
			//if they upvoted before
			if (data[0].upvoters.indexOf(ip) !== -1){
				resolve('upvote');
			}else{
				resolve('unvoted');
			};
		};

	});

});

}



	//placeholder function
	//will eventualy serve JSON content
	
//create a new doc from url
//url: full url
function createDoc(url){
	//add / incase url doesnt have / at the end (it breaks regex)
	//url = url + '/'
	
	return new Promise(function(resolve,reject){
		
		//generate a uuid
		var uuid = uuidv4();
		
		//check if uuid is already used
		search('cams',1,uuid).then(function(data){
			if (data !== ''){
				//if uuid isnt already used add it to the database
				add('cams',{
					_id:uuid,
					url: /(:\/\/)(.+?)(?=\/)/g.exec(url)[0].replace('://',''), 
					urlFull: url,
					upvotes: 0,
					downvotes: 0,
					reports: 0,
					views: 0
					});
					
				add('votes', { _id:uuid, upvoters: [], downvoters: []} ).then(function(data){
					
					resolve(uuid);
					
				});
				
				
				
			}else{
				//if uuid is already used retry
				console.log('UUID is already used, buy a lottery ticket');
				createDoc(url);
			};
		});
	});
};

	
	
//check if camera is already in the database
//collection: collection to search in
//mode: 0 = search by url. 1 = search by uuid. 2 = input your own query object
//input: full url
function search(collection,mode,input){

	return new Promise(function(resolve,reject){

		//not as elegant as /(?<=:\/\/)(.+?)(?=\/)/g but positive lookbehinds aren't supported
		if (mode == 0){
			//cut long url to short version
			var query = { url: /(:\/\/)(.+?)(?=\/)/g.exec(input)[0].replace('://','') };
		}else{
			if (mode == 1){
				//search for uuid
				var query = { uuid: input };
			}else{
				if (mode == 2){
					//custom search query
					var query = input;
				};
				
			};
			
		};
		//perform the search
		dbo.collection(collection).find(query).toArray(function(err, result) {
			if (err) reject(err);
			
			//return result
			resolve(result);
			
	  });

	});
}


		
//add data to a collection
//collection: collection to add data to
//data: object of data to add
function add(collection,data){
	return new Promise(function(resolve,reject){

		dbo.collection(collection).insertOne(data, function(err, res) {
			if (err) throw err;
			resolve();
		});	
	});
};
	


//remove data from a collection
//collection: collection to remove data to
//data: object of data to remove
function remove(collection,query){
	return new Promise(function(resolve,reject){

		dbo.collection(collection).deleteOne(query, function(err, res) {
			if (err) throw err;
			resolve(err,res);
		});	
	});
};

	
//update a document
//collection:string
//query: object of keys to search for 
//data: object of keys to replace
function update(collection,query,data){
	return new Promise(function(resolve,reject){
		dbo.collection(collection).findOneAndUpdate(query, data,{ returnNewDocument: true }, function(err, res) {
			if (err) throw err;
			resolve(res.value);
		});	
	});
};
	
	
	
//error handler
//https://stackoverflow.com/a/43994999/6088533
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
