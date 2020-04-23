const express = require('express');
const router = require('./router');
const { migrate } = require('./database/database');

(async function () {
	await migrate();

	const app = express();
	app.use(express.json());
	router.initialize(app);

	app.listen(process.env.PORT || 3000, () => console.log('nodend listening...'));
}());


