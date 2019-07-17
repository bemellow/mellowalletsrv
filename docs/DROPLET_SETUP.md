# Steps for setting up a new Ubuntu-based operating system
This is a guideline for an expert user to setup a droplet in digital ocean, most of the commands are run as root,
so every step my be understood before executing it. 

***DON'T USE THIS GUIDE IF YOU DON'T UNDERSTAND WHAT YOU ARE DOING***  

> *Consider that all commands need to be run either with root privileges.*

## System repositories
**Enable `Partner ` repositories**:

Edit /etc/apt/sources.list and look for a line that looks like this:

```
deb http://archive.canonical.com/ubuntu VERSION partner
```

> Consider that VERSION corresponds to an actual Ubuntu version:
>
> - Xenial
> - Bionic
> - Cosmic
> - Disco
>
> etc

Uncomment the line and save the file, then update repositories and upgrade the full system:

```
apt update && apt full-upgrade -y && apt autoremove --purge
```

## Install common utilities and required libs

### Certbot (Let's Encrypt certificates)
```
apt install software-properties-common && add-apt-repository -y -u ppa:certbot/certbot && apt update && apt full-upgrade -y && apt install -y certbot python-certbot-nginx nginx-extras
```

### Common utilities and tools

```
curl https://raw.githubusercontent.com/PeGa/server-setup/master/debian-stretch/scripts/install-basetools.sh|grep -vE 'geoip|rcconf'|bash
```

### Install Node Version Manager (NVM)
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
```

Add the following to the beginning of the .bashrc file:

``` 
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
```

Load the nvm configuration and install nvm and node:

```
source ~/.bashrc && nvm install v11.6 && nvm use v11.6
```

### Fresh new start

After performing this tasks, it's advisable to perform some cleaning tasks on the server:

```
apt full-upgrade -y && aptitude install -f
```

> *These commands should exit without errors. Should errors appear, please take time to carefully inspect the server status for it might heavily impact the server stability.*

Upon graceful execution of above commands, restart the server.

```
reboot
```

## Configure nginx

> *In Debian-based distros, Nginx serves its content according to the configuration files found into `/etc/nginx/sites-enabled`. This path comprises symlinks to another path, `/etc/nginx/sites-available`. It's advised to work on the first one, thus gaining the ability to easily disable/enable hosts by removing / adding symlinks.*

Disable the default server block:

```
cd /etc/nginx/sites-available/ && mv default default.disabled && rm /etc/nginx/sites-enabled/default
```

Edit `/etc/nginx/nginx.conf` and look for a line that looks like this:

```
include /etc/nginx/sites-enabled/*;
```

Add `.conf` at the end of the line:

``` 
include /etc/nginx/sites-enabled/*.conf;
```

Disable TLSv1 TLSv1.1, leave just the latest TLSv2 in /etc/nginx/nginx.conf. and if certbot is used 
also in /etc/letsencrypt/options-ssl-nginx.conf.
Also choose the latest crypto and hash algorithms.

### Set up new server block:

```
vim /etc/nginx/sites-available/mellowapi.coinfabrik.com.conf
```

Add the corresponding content for the new application; for example:

```
limit_req_zone $binary_remote_addr zone=recoverwallet:10m rate=10r/s;

upstream backend {
        server localhost:3000;
}

server {
        root /var/www/mellow/htdocs;
        index index.html index.htm index.nginx-debian.html;
        server_name mellowapi.coinfabrik.com;

        error_page 400 401 402 403 404 405 406 407 408 409 410 411 412 413 414 415 416 417 422 423 424 426 428 429 431 451 500 501 502 503 504 505 506 507 511 /nginx-errors/$status.json;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-NginX-Proxy true;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $http_host;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
        proxy_http_version 1.1;

        location /nginx-errors {
                try_files $uri $uri/;
        }

        location /recoverWallet {
                limit_req zone=recoverwallet burst=20 nodelay;
                proxy_pass http://backend;
        }

        location / {
                proxy_pass http://backend;
        }


    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/mellowapi.coinfabrik.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/mellowapi.coinfabrik.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
        listen 80;
        listen [::]:80;

        server_name mellowapi.coinfabrik.com;
        return 301 https://$host$request_uri;
}
```

The file bellow is an example that uses certbot for ssl certificates and a hack so errors are 
returned as json: https://github.com/dcolens/nginx-json-errors


### Enabling the server block

```
ln -s /etc/nginx/sites-available/mellowapi.coinfabrik.com.conf /etc/nginx/sites-enabled/
```

## Installing new certficates usign certbot (Optional)

> *Consider that certbot requires a valid domain pointing to the server' s IP address. Thus, the certbot service 
> successfully verifies the server and implements the corresponding certificate.
> Before deploying a new certficate a valid domain registry is needed to be previously configured against the 
> server's IP address with at least 1 hour of age*

```certbot --nginx -d mellowapi.coinfabrik.com```

Typically there's no need to restart nginx, given that Let's Encrypt's certbot should take care of it. In case of doubt:

```/etc/init.d/nginx restart```

Add to the root contab the certbot certificate renew script:
```certbot renew -q```


# Add a user for node app

- useradd -m walletsrv -G sudo 
- usermod -s /bin/bash walletsrv
- passwd walletsrv

# For app installation instructions refer to README.md
