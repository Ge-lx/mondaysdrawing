# mondaysdrawing

Simple drawing game
**[:construction: Demo](https://gelx.uber.space)**

## To Do:

- [x] Client REST Library -> `/frontend/store.js`
- [x] Client WebSocket -> `/frontend/socket.js`
- [ ] Drawing Area Baiscs -> `/frontend/draw.js`
	- [x] Clear
	- [x] Undo
	- [ ] Fill
- [ ] Game UI
	- [ ] Word Display + Picker
	- [ ] Player List
	- [ ] Chat
- [ ] UI States -> `/frontend/states.js`
	- [x] Basic Controls
	- [ ] Styling
	- [ ] Artwork?
- [x] Server Database -> `/backend/database`
- [x] Server Routing -> `/backend/router.js`
- [x] Server REST -> `/backend/controllers`
	- [x] User Handling -> `./UserController.js`
	- [x] Room Handling -> `./RoomController.js`
- [x] Server WebSocket -> `/backend/logic/GameLogic.js`
	- [ ] Refactor to `/backend/sockets.js`
	- [ ] Chat Handling
- [ ] Game State / Flow control -> `/backend/logic/GameLogic.js` *after refactor*
