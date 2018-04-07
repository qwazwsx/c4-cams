# c4-cams


API documentation: 


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

They all return the same **camera object**

```JSON
{"_id":"d475a62d-b718-41ff-b427-911f71d33755",
"url":"80.13.70.54:8001",
"urlFull":"http://80.13.70.54:8001/mjpg/video.mjpg?COUNTER/",
"upvotes":17,
"downvotes":2,
"reports":0,
"views":37}
```

## 3. `POST /api/upvote`

upvotes a given post

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to upvote

###### example

`POST /api/upvote?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will upvote the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`

## 4. `POST /api/downvote`

upvotes a given post

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to downvote

###### example

`POST /api/downvote?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will downvote the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`

## 5. `POST /api/report`

report a given post for being a dead link or inappropriate content 

note: you can only report a post once, trying to report a post multiple times will return error code `0`

required? | query parameter | use
--------- |---------------  | ---
✔️ | uuid | the uuid of the post to report

###### example

`POST /api/report?uuid=d475a62d-b718-41ff-b427-911f71d33755`

this will report the post with the uuid of `d475a62d-b718-41ff-b427-911f71d33755`
