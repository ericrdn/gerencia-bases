const connStr = "Server=.;Database=master;User Id=sa;Password=Master@Key;";

const config = {
    user: 'sa',
    password: process.env.SA_PASSWORD || 'Master@Key',
    server: 'localhost',
    database: 'master',
    requestTimeout : 6000000
}

const sql = require("mssql");
const moment = require("moment");
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
var path = require('path');
var rimraf = require("rimraf");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const glob = require('glob');
const app = express();


// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

//start app 
const port = process.env.PORT || 3000;

app.listen(port, () =>
    console.log(`App is listening on port ${port}.`)
);

const FolderBackUps = "/data/";

const GenerateDirTemp = () => path.join(FolderBackUps, "temp", uuidv4());

app.get('/list-files', async (req, res) => {
    glob(FolderBackUps + '/**/*', (err, files) => {
        res.json({ files })
    })
});

function ExecutarProcedure(nomeprocedure, params) {
    return new Promise((res, error) => {
        const parametros = Object.entries(params).map(m => ({Parametro: m[0], Valor: m[1]}));

        sql.connect(config).then(pool => {
            var req = pool.request();
            parametros.forEach(i => req.input(i.Parametro, sql.VarChar(50), i.Valor) );
            return req.execute(nomeprocedure);

        }).then(result => {
            res(result.recordset);
        }).then(() => {
            return sql.close()
        }).catch(err => error(err));
        
    });
}

app.post('/restore-database',  async (req, res) => {
    try {
        const { Caminho, NameDataBase } = req.body;

        const extension = path.extname(Caminho);
        let backups_subir = [];

        if (extension === ".7z")
        {
            const temp_folder = GenerateDirTemp();
            const { stdout, stderr } = await exec(`7z e ${Caminho} -o${temp_folder}`);
            const arquivos = glob.sync(temp_folder + '/**/*');

            backups_subir = arquivos;
        }
        else
        {
            backups_subir.push(Caminho);
        }


        await Promise.all(backups_subir.map(item => ExecutarProcedure('RESTORE_BASE', { NOMEBASE: NameDataBase, CAMINHO: item })));

        res.send({});

    }
    catch (err)
    {
        console.log("Err", err);
        res.status(500).send(err)
    }
});

app.post('/backup-database', async (req, res) => {
    try {
        const { NameDataBase } = req.body;
        
        const uuid_folder = GenerateDirTemp();

        console.log(uuid_folder);

        fs.mkdirSync(uuid_folder, { recursive: true});
        
        const uuid_bak = path.join(uuid_folder, `${NameDataBase}.bak`);
        const uuid_zip = path.join(uuid_folder, `${NameDataBase}.7z`);

        const resultado = await ExecutarProcedure('BACKUP_BASE', { NOMEBASE: NameDataBase, CAMINHO: uuid_bak });
        
        const { stdout, stderr } = await exec(`7z a ${uuid_zip} ${uuid_bak}`);
        
        const target = path.join(FolderBackUps, moment().format("YYYYMMDD") );

        fs.mkdirSync(target, { recursive: true});

        fs.copyFileSync(uuid_zip, path.join(target, `${NameDataBase}.7z`));

        rimraf.sync(uuid_folder);

        res.json(target);
    }
    catch (err)
    {
        console.log("Err", err);
        res.status(500).send(err)
    }
});



app.post('/upload-base', async (req, res) => {
    try {
        if (!req.files) {
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
