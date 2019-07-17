module.exports = {
    apps: [
        {
            name: 'mellow_prod',
            script: 'dist/src/main.js',
            error_file: "err.log",
            out_file: "out.log",
            log_file: "combined.outerr.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss.SSS Z",
            // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
            args: '',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                PM2: true,
                EXPRESS_PORT: 4000
            },
            env_staging: {
                PM2: true,
                EXPRESS_PORT: 4000,
                NODE_ENV: 'development'
            },
            env_production: {
                PM2: true,
                EXPRESS_PORT: 3000,
                NODE_ENV: 'production'
            }
        }
    ],

    deploy: {
        staging: {
            user: 'walletsrv',
            host: '46.101.117.238',
            ref: 'origin/release/0.13.0',
            repo: '/home/walletsrv/repo',
            path: '/home/walletsrv/production',
            'post-deploy':
                'npm install && cp ~/.env .env && npm run prestart:prod && pm2 startOrRestart ecosystem.config.js --env staging'
        },
        development: {
            user: 'mellow',
            host: '10.10.0.72',
            ref: 'origin/release/0.13.0',
            repo: 'root@gogs.nkt:adji/walletsrv.git',
            path: '/home/mellow/production',
            'post-deploy':
                'npm install && cp ~/.env .env && npm run prestart:prod && pm2 startOrRestart ecosystem.config.js --env staging'
        },
        production: {
            user: 'walletsrv',
            host: '157.230.228.247',
            ref: 'origin/release/0.13.0',
            repo: '/home/walletsrv/repo',
            path: '/home/walletsrv/production',
            'post-deploy':
                'npm install && cp ~/.env .env && npm run prestart:prod && pm2 startOrRestart ecosystem.config.js --env production'
        }
    }
};
