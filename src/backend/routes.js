/*!
governify-render 1.0.0, built on: 2018-05-09
Copyright (C) 2018 ISA group
http://www.isa.us.es/
https://github.com/isa-group/governify-render#readme

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.*/

'use strict';

const express = require("express");
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios')
const jsyaml = require('js-yaml')
const mustache = require("mustache");
mustache.escape = function (text) { return text; };
const config = require('./configurations')

const logger = require("./logger");

module.exports = router;

router.get('/', function (req, res) {
    var viewPath = config.default_render.view;
    var ctrlPath = config.default_render.controller;
    var modelPath = config.default_render.model;
    logger.info("Redirecting to /render?model=" + modelPath + "&view=" + viewPath + "&ctrl=" + ctrlPath);
    res.redirect('/render?model=' + modelPath + '&view=' + viewPath + '&ctrl=' + ctrlPath);

});


async function getFileFromString(URL) {
    var file;
    if (URL.startsWith('https://') || URL.startsWith('http://')) {
        logger.info("Getting external file: " + URL)
        await axios({
            url: URL,
            method: 'GET',
            headers: { 'User-Agent': 'request' },
            transformResponse: function (response) {
                // do not convert the response to JSON or object
                return response;
            }
        }).then(response => {
            file = response.data;
        }).catch(err => {
            console.error(err);
            throw Error('Error obtaining: ' + URL)
        })

    } else {
        //Check first file exist to return null
        if (fs.existsSync('./src/frontend' + URL)) {
            logger.info("Getting file locally: " + URL)
            file = await fs.readFileSync('./src/frontend' + URL, 'utf8');
        }
        else {
            throw Error('Error obtaining: ' + URL)
        }
    }
    //Compatibility for yaml files.
    if (URL.endsWith('.yaml')) {
        file = JSON.stringify(jsyaml.safeLoad(file));
    }
    return file;
}

router.get("/render", async function (req, res) {
    var ctrl = req.query.ctrl;
    var model = req.query.model;
    var view = req.query.view;

    if (!ctrl || !view || !model) {
        logger.warning("No params");
        res.sendStatus(404);
    } else {
        var files;
        try {
            let [fileCtrl, fileModel, fileView] = await Promise.all([getFileFromString(ctrl), getFileFromString(model), getFileFromString(view)]);
            files = {
                FILE_CONTROLLER: fileCtrl,
                FILE_MODEL: fileModel,
                FILE_VIEW: fileView
            }
            logger.info("Displaying render");
            var htmlTemplate = fs.readFileSync('./src/backend/layouts/' + config.layout, 'utf8');
            var htmlRendered = mustache.render(htmlTemplate, files, {}, ['$_[', ']']);
            res.send(htmlRendered);
        } catch (err) {
            logger.warning('Error getting files: ' + err)
            res.status(404).send('404 Not found - ' + err.message);
        }
    }
});

router.post('/updateDefaultTPA', function (req, res) {
    var tpaPath = path.join(__dirname, './../frontend/renders/tpa/template.json');
    fs.writeFileSync(tpaPath, JSON.stringify(req.body, null, 4));
    res.sendStatus(204);
});