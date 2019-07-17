var winston = require('winston');

const options = {
    level: 'debug',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
};
winston.configure(options);

// jest.setTimeout(3000);
