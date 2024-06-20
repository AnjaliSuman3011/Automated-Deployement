const express = require('express');
const { generateSlug } = require('random-word-slugs'); // Corrected function name
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const app = express();
const{Server}= require('socket.io')
const Redis = require('ioredis');
const cors = require('cors');

const PORT = 9000;

const subscriber = new Redis('rediss://default:AVNS_wWYW9s6qNBxJN8oakvS@caching-32183a7-anjalisuman3011-0933.j.aivencloud.com:18758')

const io = new Server({cors:'*'})

io.on('connection',socket=>{
    socket.on('subscribe',channel=>{
        socket.join(channel)
        socket.emit('message',`Joined ${channel}`)
    })
})

io.listen(9002,()=>console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIAUX7U6YUFPOHG57FN',
        secretAccessKey: '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'
    }
});

const config = {
    CLUSTER: 'arn:aws:ecs:ap-south-1:326394365194:cluster/builder-clusters',
    TASK: 'arn:aws:ecs:ap-south-1:326394365194:task-definition/builder-task'
};

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

app.post('/project', async (req, res) => {
    const { gitURL } = req.body;
    const projectSlug = generateSlug(); // Corrected function name

    const command = new RunTaskCommand({
        cluster: config.CLUSTER, // Fixed the cluster config
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0772dcd15125f8ebf', 'subnet-01c8c90a1fb5ea9bc', 'subnet-0fa2892a6a1ee6f7d'],
                securityGroups: ['sg-09b2b8d787a1ed754']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug }
                    ]
                }
            ]
        }
    });

    await ecsClient.send(command);

    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } });
});

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}


initRedisSubscribe()

app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
