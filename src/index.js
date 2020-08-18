const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');

const fs = require('fs');

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

//start app 
const port = process.env.PORT || 3001;

app.listen(port, () => 
  console.log(`App is listening on port ${port}.`)
);

const FolderBackUps = "/data/"; 

app.get('/list-files', async (req, res) => {
    fs.readdir(FolderBackUps, (err, files) => {
        res.json({ files})
      });
});


app.post('/upload-base', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {

            let data = []; 
            
            _.forEach(_.keysIn(req.files.bases), (key) => {
                let base = req.files.bases[key];
                
                //move base to uploads directory
                base.mv(FolderBackUps + base.name);

                //push file details
                data.push({
                    name: base.name,
                    mimetype: base.mimetype,
                    size: base.size
                });
            });

            //return response
            res.send({
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});
