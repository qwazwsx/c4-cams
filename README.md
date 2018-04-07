# c4-cams


API documentation: 

## 0. Understanding Camera Objects

Camera objects are composed of 7 parts

- _id 
  - the UUID of the camera object/post
  - eg: `d475a62d-b718-41ff-b427-911f71d33755`
- urlFull
  - the full url of a camera stream
  - eg: `http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/`
- url
  - a shortened version of the url
  - a full url can be converted to a short url with the following regex `/(:\/\/)(.+?)(?=\/)/g`
  - eg: 80.13.70.54:8001
- upvotes
  - amount of upvotes a post has, positive integer
- downvotes
  - amount of downvotes a post has, positive integer
- reports
  - amount of reports a post has, posiitive integer
  - a user only counts as a view every 30 minutes
  - posts are autoreported when they fail to load, aswell as when the user clicks report
- views
  - amount of times the a post has been viewed
  - a user only counts as a view every 30 minutes
  
now that we know that heres an example of a camera object

```JSON
{
  "_id":"d475a62d-b718-41ff-b427-911f71d33755",
  "urlFull":"http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/",
  "url":"80.13.70.54:8001",
  "upvotes":1,
  "downvotes":3,
  "reports":0,
  "views":1
}
```

now onto the API calls



## 1. `GET /api/ping`

returns the text 'pong'

required? | query parameter | use
--------- |---------------  | ---
❌ | delay | delay in ms for sending the text 

###### example

`GET /api/ping?delay=5000`

waits 5 seconds and returns the text `pong`

## 2. `POST /api/find`

search for cams

required? | query parameter | use
--------- |---------------  | ---
✔️ | type | type of search to preform. `0` means to search by the camera objects UUID. `1` means to search by the short url. `2` means to search by the full url
✔️ | query | what to search for, string

###### example

the following 3 API requests all return the same thing

`GET /api/find?type=0&query=d475a62d-b718-41ff-b427-911f71d33755`

(searches for uuid `d475a62d-b718-41ff-b427-911f71d33755`)

`GET /api/find?type=1&query=80.13.70.54:8001`

(searches for short url `80.13.70.54:8001`)

`GET /api/find?type=2&query=http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/`

(searches for full url `http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/`)

They all return the same camera object

```JSON
{"_id":"d475a62d-b718-41ff-b427-911f71d33755",
"url":"80.13.70.54:8001",
"urlFull":"http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/",
"upvotes":17,
"downvotes":2,
"reports":0,
"views":37}
```

## 3. `GET /api/top`

returns an array of camera objects for the top 50 highest rated posts

example:


`GET /api/top`

```JSON
[
  {
    "_id":"202340ed-5fbe-4dcb-817b-d9a9f5ce2c52",
   "url":"24.116.100.10:80",
   "urlFull":"http://24.116.100.10:80/axis-cgi/mjpg/video.cgi?camera=&amp;amp;resolution=640x480/",
   "upvotes":10,
   "downvotes":2,
   "reports":0,
   "views":1
  },
  
  {
    "_id":"a39d3ed7-0994-4c13-97eb-1d12a3325b3b",
    "url":"85.105.134.7:60001",
    "urlFull":"http://85.105.134.7:60001/cgi-bin/snapshot.cgi?chn=0&amp;u=admin&amp;p=&amp;q=0/",
    "upvotes":5,
    "downvotes":1,
    "reports":0,
    "views":1
    },
  ...
]

```



## 4. `POST /api/upvote`

upvotes a given post

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to upvote

###### example

`POST /api/upvote?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will upvote the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`

## 5. `POST /api/downvote`

upvotes a given post

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to downvote

###### example

`POST /api/downvote?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will downvote the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`

## 6. `POST /api/report`

report a given post for being a dead link or inappropriate content 

note: you can only report a post once, trying to report a post multiple times will return error code `0`

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to report

###### example

`POST /api/report?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will report the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`
