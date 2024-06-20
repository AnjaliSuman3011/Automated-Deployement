const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const Redis = require('ioredis');



const publisher = new Redis('rediss://default:AVNS_wWYW9s6qNBxJN8oakvS@caching-32183a7-anjalisuman3011-0933.j.aivencloud.com:18758')


const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIAUX7U6YUFPOHG57FN',
        secretAccessKey: '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'
    }
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log){
    publisher.publish(`logs:${PROJECT_ID}`,JSON.stringify({log}))
}


async function init() {
    console.log('Executing script.js');
    publishLog('Build started...')
    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on('data', function (data) {
        console.log(data.toString());
        publishLog(data.toString())
    });

    p.stderr.on('data', function (data) {
        console.error('Error', data.toString());
        publishLog(`error: ${data.toString()}`)
    });

    p.on('close', async function (code) {
        console.log('Build process exited with code', code);
        publishLog('Build complete...')

        const buildFolderPath = path.join(__dirname, 'output', 'build');

        if (!fs.existsSync(buildFolderPath)) {
            console.error('Error: build folder does not exist');
            return;
        }

        const buildFolderContents = fs.readdirSync(buildFolderPath, { recursive: true });
        publishLog('Starting to upload...')
        for (const file of buildFolderContents) {
            const filePath = path.join(buildFolderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('Uploading', filePath);
            publishLog(`Uploading ${file}`)

            const command = new PutObjectCommand({
                Bucket: 'deployment-system',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) || 'application/octet-stream'
            });

            try {
                await s3Client.send(command);
                console.log('Uploaded', filePath);
                publishLog(`Uploading ${file}`)
            } catch (err) {
                console.error('Failed to upload', filePath, err);
            }
        }
        publishLog(`Done`)
        console.log('done');
    });
}

init();