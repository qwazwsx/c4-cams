/*

made by qwazwsx/thisisatesttoseehowl

https://github.com/qwazwsx


todo: verify links passed into load(x)



*/


/* ########################################### */
/* REQUIREMENTS AND VARS */
var MongoClient = require('mongodb').MongoClient;		//mongoDB client for databases
var mongoUrl = "mongodb://localhost:27017/";			//location of mongoDB server
var uuidv4 = require('uuid/v4');						//generates uuid's for documents
var decay = require('decay');							//get decay for sorting by up&down votes
var wilsonScore = decay.wilsonScore();					//use wilson type of scoring (reddit comments "best" sorting)
var sortBy = require('sort-array');						//helps when sorting arrays of posts
var express = require('express');						//get express for API
var RateLimit = require('express-rate-limit');			//get ratelimiter for express
var app = express();									//get express server
var views = [];											//tracks users for view counts
var reports = [];										//tracks users for reports
var topPosts = []										//list of sorted posts, updates every 10 min
var port = process.env.PORT || 3000;        			// set our port (defaults to 8081 if env var isnt set)


/* ########################################### */
/* SERVER SETUP */

//enable ratelimiting
app.enable('trust proxy');
var apiLimiter = new RateLimit({
  windowMs: 60*1000, // 1 minute
  max: 120,
  delayMs: 0 // disabled
});
app.use('/api/', apiLimiter);

var apiLimiterHard = new RateLimit({
  windowMs: 10*60*1000, // 1 minute
  max: 3,
  delayMs: 0, // disabled
  skipFailedRequests: true
});
app.use('/api/add', apiLimiterHard);

sort();


//re-calculate top posts every 5 min
setInterval(function(){
	sort();
},5*60*1000);

//reset rate-limiting for views and reports
setInterval(function(){
	views = [];
	reports = [];
},30*60*1000);


/* ########################################### */
/* API */


app.post('/api/add', function (req, res) {
	addCamera(req.query.url).then(function(data){
		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
	});
});






//sends ordered list of posts
app.get('/api/top', function (req, res) {
	res.send(topPosts);
});


//################################################
//responds pong
//delay: ms to delay response
app.get('/api/ping', function (req, res) {
	setTimeout(function(){res.send('pong')},req.query.delay);
});



//################################################
//query params
//type: 0 - search by camera object uuid, 1 - search by short url, 2 - search by full url
//query: what you are seaching for
app.post('/api/find', function (req, res) {
	
	if (req.query.query !== undefined){
	
		if (req.query.type == 0){
			search('cams',2,{ _id: req.query.query}).then(function(send){res.send(send[0])});
		}else{
			if (req.query.type == 1){
				search('cams',2,{ url: req.query.query }).then(function(send){res.send(send[0])});
			}else{
				if (req.query.type == 2){
					search('cams',2,{ urlFull: req.query.query }).then(function(send){res.send(send[0])});
				}else{
					res.status(400).send({error: 'parameter \'type\' not set correctly', code: 0});
				}
			}
		}
	
	}else{
		res.status(400).send({error: 'parameter \'query\' not set correctly', code: 1});
	}
});



//################################################
//query params
//uuid
//errors
//0 - you have already reported this camera
app.post('/api/report', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	report(req.query.uuid,ip).then(function(send){
		if (data.error !== undefined){
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
app.post('/api/upvote', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	upvote(req.query.uuid,ip).then(function(data){
		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
		if (data.error !== undefined){
			console.log(data);
		};
	});
});



//################################################
//query params
//uuid: uuid of a camera object
//errors
//0 - uuid doesnt exist
//1 - user already upvoted
app.post('/api/downvote', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;	
	downvote(req.query.uuid,ip).then(function(data){
		if (data.error !== undefined){
			res.status(400).send(data);
		}else{
			res.send(data);
		}
		if (data.error !== undefined){
			console.log(data);
		}
	});
});



//################################################
//returns a random camera object
app.get('/api/random', function (req, res) {
	var ip = req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || req.client.remoteAddress ;
	
	//req.
	
	MongoClient.connect(mongoUrl, function(err, db) {
		if (err) throw err;
		var dbo = db.db("c4-cams");
		dbo.collection('camera_list').aggregate([{ $sample: { size: 1 } }]).toArray(function(err, data) {
			if (err) throw err;
			
			
			
			load(data[0].url,ip).then(function(data){
				res.send(data);
			});;
			
			
			
			db.close();
		});
	});	
	
});



//use routes
app.use('/', express.static('static'))

app.listen(port, function(){
	console.log('[INFO] server running on port '+port);
});


/* ########################################### */
/* FUNCTIONS */



function addCamera(url){
	
	return new Promise(function(resolve,reject){

	search('camera_list',2,{url: url}).then(function(data){
		
		if (data == ''){
		
			//if it is a link
			if (url.indexOf('http') !== -1){
				add('camera_list',{url: url}).then(function(){
					createDoc(url).then(function(data){
						resolve({uuid: data, response: 'OK', code: 200});
					});

				});
			}else{
				resolve({error: 'not valid url', code: 0});

			}
	
		}else{
			resolve({error: 'url alread exists', code: 1});
		}
	});
	
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

	
	MongoClient.connect(mongoUrl, function(err, db) {
		if (err) throw err;
		var dbo = db.db("c4-cams");
		//get all cams
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
			
			
			
			db.close();
		});
	});	
	
	});
	
}



//report a post as dead
//uuid: uuid of cam
//ip: ip of requester
function report(uuid,ip){
	
	return new Promise(function(resolve,reject){

	//if report isnt already in temp array
	if (reports[uuid] == undefined){
		reports[uuid] = [];
	};
	
	//if ip hasnt already reported 
	if (reports[uuid].indexOf(ip) == -1){
		update('cams', { _id:uuid }, { $inc: { reports: 1 } } );
		reports[uuid].push(ip);
	}else{
		resolve({error: 'you have already reported this camera', code: 0});
		
	}
			
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
			
				
				
			}else{
				resolve({error: 'user already downvoted', code: 1});
			};
		};
	});	
	
	});
}



//to be called on page load
//url: full url
//ip: ip of requester
function load(url,ip){
	
	//TODO: add check to see if the url is in the c4 list
	//so people cant feed it garbage data
	
	
	return new Promise(function(resolve,reject){
	
		//check if url already is in database
		search('cams',0,url).then(function(data){
			if (data == ''){
				//if url isnt in the database add it and restart the function
				console.log('[INFO] cam not found in database, creating page')
				createDoc(url).then(function(){
					load(url,ip).then(function(data){
						resolve(data[0]);
					});
				})
			}else{
				//if the camera exists in the database add view count
				console.log('[INFO] PAGE EXISTS');			
			
				//if viewers array for this cam doesnt exist make it
				if (views[data[0]._id] == undefined){
					views[data[0]._id] = [];
				};
				
				//if ip havent already viewed push ip to array and count view
				if (views[data[0]._id].indexOf(ip) == -1){
					views[data[0]._id].push(ip)
					
					//add view to the cam
					update('cams', { _id: data[0]._id }, { $inc: { views: 1 } })
					
					
				};
				
				resolve(data);
			};
			
			
		}).catch(function(err){
			throw err;
		});
		
	});
		
};



	//placeholder function
	//will eventualy serve JSON content
	
//create a new doc from url
//url: full url
function createDoc(url){
	//add / incase url doesnt have / at the end (it breaks regex)
	url = url + '/'
	
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
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) reject(err);
			var dbo = db.db("c4-cams");
			//not as elegant as /(?<=:\/\/)(.+?)(?=\/)/g but positive lookbehinds aren't supported
			if (mode == 0){
				var query = { url: /(:\/\/)(.+?)(?=\/)/g.exec(input)[0].replace('://','') };
			}else{
				if (mode == 1){
					var query = { uuid: input };
				}else{
					if (mode == 2){
						var query = input;
					};
					
				};
				
			};
			dbo.collection(collection).find(query).toArray(function(err, result) {
				if (err) reject(err);
								
				resolve(result);
				
				db.close();
		  });
		});
	});
}


		
//add data to a collection
//collection: collection to add data to
//data: object of data to add
function add(collection,data){
	
	return new Promise(function(resolve,reject){
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) throw err;
			var dbo = db.db("c4-cams");
			dbo.collection(collection).insertOne(data, function(err, res) {
				if (err) throw err;
				resolve();
				db.close();
			});
		});	
	});
};
	
	
//update a document
//collection:string
//query: object of keys to search for 
//data: object of keys to replace
function update(collection,query,data){
	
	return new Promise(function(resolve,reject){
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) throw err;
			var dbo = db.db("c4-cams");
			dbo.collection(collection).updateOne(query, data, function(err, res) {
				if (err) throw err;
				resolve();
				db.close();
			});
		});	
	});
};
	
	
	
//error handler
//https://stackoverflow.com/a/43994999/6088533
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
	
	
	
	
//createDoc('http://te.st:3000').catch(function(err){console.log('asd')})
	
	
	



// MongoClient.connect(url, function(err, db) {
  // if (err) throw err;
  // var dbo = db.db("c4-roulette");
  // var query = { url: "111.111.111.111" };
  // dbo.collection("cam_uuid_translate").find(query).toArray(function(err, result) {
    // if (err) throw err;
    // console.log(result);
    // db.close();
  // });
// });






// MongoClient.connect(url, function(err, db) {
  // if (err) throw err;
  // var dbo = db.db("c4-roulette");
  // var myobj = {_id: uuid.v4(), upvotes: 5, reports: 1};
  // dbo.collection("cams").insertOne(myobj, function(err, res) {
    // if (err) throw err;
    // console.log("1 document inserted");
    // db.close();
  // });
// });