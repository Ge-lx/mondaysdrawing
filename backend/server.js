const path = require('path');

const GameController = require('./controllers/GameController');

const express = require('express');
const app = express();
const websockets = require('express-ws')(app);

const DIR_FRONTEND = path.join(__dirname, '../frontend');
const FILE_INDEX = path.join(DIR_FRONTEND, 'index.html');

app.ws('/', GameController.handleClient);
app.get('/', (req, res) => {
    res.sendFile(
        FILE_INDEX,
        {
            dotfiles: 'deny',
            headers: {
                'x-timestamp': Date.now(),
                'x-sent': true,
            },
        },
        (err) => {
            if (err) {
                next(err)
            } else {
                console.log(`Client index.html served to ${req.ip} on ${req.originalUrl}`);
            }
        });
});

app.use(express.static(DIR_FRONTEND));
app.listen(process.env.PORT || 3000, () => console.log('nodend listening...'));
